import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Order } from '@/models/Order';
import { Product } from '@/models/Product';
import { Invoice } from '@/models/Invoice';
import { SystemSettings } from '@/models/SystemSettings';
import { generateOrderNumber, generateInvoiceNumber } from '@/lib/order-utils';

export class OrderError extends Error {
  constructor(message: string, public readonly status = 409) { super(message); }
}
export interface CreateOrderInput {
  customerName: string;
  customerEmail?: string;
  notes?: string;
  items: { productId: string; quantity: number }[];
  idempotencyKey: string;
}

function canonicalRequest(input: CreateOrderInput) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(input.idempotencyKey)) {
    throw new OrderError('A valid Idempotency-Key header is required', 400);
  }
  const items = input.items.map(item => {
    if (!mongoose.isObjectIdOrHexString(item.productId)) throw new OrderError('Invalid product ID', 400);
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new OrderError('Invalid quantity', 400);
    return { productId: item.productId.toLowerCase(), quantity: item.quantity };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
  if (!items.length) throw new OrderError('Order must contain at least one item', 400);
  if (new Set(items.map(item => item.productId)).size !== items.length) throw new OrderError('Duplicate product lines', 400);
  return {
    customerName: input.customerName.trim(), customerEmail: input.customerEmail?.trim().toLowerCase() || '',
    notes: input.notes ?? '', items,
  };
}

async function deductStock(items: { productId: string | mongoose.Types.ObjectId; quantity: number }[], session: mongoose.ClientSession) {
  for (const item of items) {
    const result = await Product.updateOne(
      { _id: item.productId, quantity: { $gte: item.quantity } },
      { $inc: { quantity: -item.quantity } }, { session },
    );
    if (result.matchedCount !== 1) throw new OrderError('Insufficient stock or product no longer available');
  }
}

/** Fail closed if the unique indexes required by this protocol are absent.
 * init waits for automatic development index builds; deployments with autoIndex
 * disabled must run prepare-order-storage before accepting requests.
 */
async function requireUniqueIndexes() {
  await Order.init();
  await Invoice.init();
  const orders = await Order.collection.listIndexes().toArray();
  const invoices = await Invoice.collection.listIndexes().toArray();
  // Match the complete supported contract, not just a subset of the filter.
  // Extra predicates can exclude pending orders and permit duplicate requests.
  const supported = (index: (typeof orders)[number], fields: string[], partialFilter?: Record<string, unknown>) =>
    index.unique === true && index.sparse !== true && index.expireAfterSeconds === undefined &&
    (!index.collation || index.collation.locale === 'simple') &&
    isDeepStrictEqual(Object.entries(index.key), fields.map(field => [field, 1])) &&
    isDeepStrictEqual(index.partialFilterExpression, partialFilter);
  const requestFilter = { idempotencyKey: { $type: 'string' } };
  if (!orders.some(index => supported(index, ['orderNumber'])) ||
      !invoices.some(index => supported(index, ['invoiceNumber'])) ||
      !invoices.some(index => supported(index, ['orderId'])) ||
      !orders.some(index => supported(index, ['createdBy', 'idempotencyKey'], requestFilter))) {
    throw new OrderError('Required order indexes are missing or incompatible; run prepare-order-storage', 503);
  }
}

export async function createOrder(input: CreateOrderInput, createdBy: string) {
  const request = canonicalRequest(input);
  const requestHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
  const key = { createdBy, idempotencyKey: input.idempotencyKey };
  const replay = async () => {
    const order = await Order.findOne(key);
    if (!order) return null;
    if (order.requestHash !== requestHash) throw new OrderError('Idempotency key used for a different request');
    return { order, replayed: true as const };
  };
  await requireUniqueIndexes();
  const previous = await replay();
  if (previous) return previous;

  // Stable across callback retries; unused allocations leave harmless gaps.
  const now = new Date();
  const orderNumber = await generateOrderNumber(now);
  const invoiceNumber = await generateInvoiceNumber(now);
  const dbSession = await mongoose.startSession();
  try {
    return await dbSession.withTransaction(async () => {
      const existing = await Order.findOne(key).session(dbSession);
      if (existing) {
        if (existing.requestHash !== requestHash) throw new OrderError('Idempotency key used for a different request');
        return { order: existing, replayed: true as const };
      }
      const products = await Product.find({ _id: { $in: request.items.map(i => i.productId) } }).session(dbSession);
      if (products.length !== request.items.length) throw new OrderError('One or more products not found', 400);
      const settings = await SystemSettings.findOne({}).session(dbSession).lean();
      const orderItems = request.items.map(item => {
        const product = products.find(p => String(p._id) === item.productId)!;
        if (product.quantity < item.quantity) throw new OrderError('Insufficient stock');
        return { productId: product._id, productName: product.name, sku: product.sku ?? '', quantity: item.quantity, unitPrice: product.price, lineTotal: product.price * item.quantity };
      });
      const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const taxRate = settings?.taxRate ?? 0;
      const taxAmount = Math.round(subtotal * taxRate / 100 * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      const requiresApproval = totalAmount >= 15000;
      const [order] = await Order.create([{
        ...key, requestHash, orderNumber, items: orderItems, subtotal, taxRate, taxAmount, totalAmount,
        status: requiresApproval ? 'pending' : 'confirmed', requiresApproval,
        customerName: request.customerName, customerEmail: request.customerEmail || undefined, notes: input.notes,
      }], { session: dbSession });
      if (!requiresApproval) await deductStock(orderItems, dbSession);
      await Invoice.create([{
        invoiceNumber, orderId: order._id, issuedTo: request.customerName,
        items: orderItems.map(({ productName, sku, quantity, unitPrice, lineTotal }) => ({ productName, sku, quantity, unitPrice, lineTotal })),
        subtotal, taxRate, taxAmount, totalAmount, status: 'issued',
      }], { session: dbSession });
      return { order, replayed: false as const, invoiceNumber, settings };
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
  } catch (error) {
    // A concurrent request may have won the unique creation-key race.
    // Resolve only after the failed transaction has ended, never inside it.
    if ((error as { code?: number }).code === 11000) {
      const result = await replay();
      if (result) return result;
    }
    throw error;
  } finally {
    await dbSession.endSession();
  }
}

export async function transitionOrder(id: string, status: 'confirmed' | 'cancelled') {
  if (!mongoose.isObjectIdOrHexString(id)) throw new OrderError('Invalid order ID', 400);
  const dbSession = await mongoose.startSession();
  try {
    return await dbSession.withTransaction(async () => {
      const order = await Order.findById(id).session(dbSession);
      if (!order) throw new OrderError('Order not found', 404);
      const previousStatus = order.status;
      const allowed = previousStatus === 'pending' || (previousStatus === 'confirmed' && status === 'cancelled');
      if (!allowed) throw new OrderError(`Invalid status transition: ${previousStatus} → ${status}`);
      const claimed = await Order.findOneAndUpdate(
        { _id: id, status: previousStatus }, { $set: { status } }, { returnDocument: 'after', session: dbSession },
      );
      if (!claimed) throw new OrderError('Order status changed concurrently');
      if (status === 'confirmed') {
        await deductStock(order.items, dbSession);
      } else if (previousStatus === 'confirmed') {
        for (const item of order.items) {
          const result = await Product.updateOne({ _id: item.productId }, { $inc: { quantity: item.quantity } }, { session: dbSession });
          if (result.matchedCount !== 1) throw new OrderError('Product for stock restoration not found');
        }
      }
      return { order: claimed, previousStatus };
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
  } finally {
    await dbSession.endSession();
  }
}
