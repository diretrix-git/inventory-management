import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { createOrder, transitionOrder } from '../src/lib/order-service';
import { Order } from '../src/models/Order';
import { Product } from '../src/models/Product';
import { Invoice } from '../src/models/Invoice';
import { SystemSettings } from '../src/models/SystemSettings';

const database = `inventory_phase3_test_${new mongoose.Types.ObjectId()}`;
const actor = new mongoose.Types.ObjectId().toString();
before(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27027/${database}?replicaSet=phase3&directConnection=true`);
  await Promise.all([Order.init(), Product.init(), Invoice.init(), SystemSettings.init()]);
});
after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
beforeEach(async () => {
  await Order.deleteMany({});
  await Product.deleteMany({});
  await Invoice.deleteMany({});
  await SystemSettings.deleteMany({});
});
async function product(quantity = 1, price = 100) {
  return Product.create({ name: 'Synthetic item', sku: randomUUID(), category: 'test', supplierId: new mongoose.Types.ObjectId(), quantity, price });
}
function input(id: unknown, key: string = randomUUID()) {
  return { customerName: 'Synthetic customer', items: [{ productId: String(id), quantity: 1 }], idempotencyKey: key };
}
function successes(results: PromiseSettledResult<unknown>[]) {
  return results.filter(r => r.status === 'fulfilled').length;
}
test('last-item contention permits one checkout and one invoice', async () => {
  const p = await product();
  const results = await Promise.allSettled([createOrder(input(p._id), actor), createOrder(input(p._id), actor)]);
  assert.equal(successes(results), 1);
  assert.equal((await Product.findById(p._id))!.quantity, 0);
  assert.equal(await Order.countDocuments(), 1);
  assert.equal(await Invoice.countDocuments(), 1);
});
test('duplicate concurrent requests return one order and deduct once', async () => {
  const p = await product(5);
  const request = input(p._id);
  const results = await Promise.all(Array.from({ length: 5 }, () => createOrder(request, actor)));
  assert.equal(new Set(results.map(r => String(r.order._id))).size, 1);
  assert.equal(results.filter(r => !r.replayed).length, 1);
  assert.equal((await Product.findById(p._id))!.quantity, 4);
  assert.equal(await Invoice.countDocuments(), 1);
  assert.equal((await createOrder(request, actor)).replayed, true);
  await assert.rejects(createOrder({ ...request, customerName: 'Changed' }, actor), /different request/);
});
test('creation keys are scoped to the authenticated creator', async () => {
  const p = await product(5);
  const request = input(p._id);
  const a = await createOrder(request, actor);
  const b = await createOrder(request, new mongoose.Types.ObjectId().toString());
  assert.notEqual(String(a.order._id), String(b.order._id));
});
test('duplicate cart lines cannot bypass stock guards', async () => {
  const p = await product();
  const request = input(p._id);
  await assert.rejects(createOrder({ ...request, items: [...request.items, ...request.items] }, actor), /Duplicate product/);
  assert.equal(await Order.countDocuments(), 0);
  assert.equal((await Product.findById(p._id))!.quantity, 1);
});
test('NPR 15000 including tax requires approval and reserves no stock', async () => {
  const p = await product(2, 12500);
  await SystemSettings.create({ taxRate: 20 });
  const result = await createOrder(input(p._id), actor);
  assert.equal(result.order.totalAmount, 15000);
  assert.equal(result.order.status, 'pending');
  assert.equal((await Product.findById(p._id))!.quantity, 2);
  await transitionOrder(String(result.order._id), 'cancelled');
  assert.equal((await Product.findById(p._id))!.quantity, 2);
});
test('below boundary auto-confirms', async () => {
  const p = await product(1, 14999.99);
  const result = await createOrder(input(p._id), actor);
  assert.equal(result.order.status, 'confirmed');
  assert.equal((await Product.findById(p._id))!.quantity, 0);
});
test('approval with insufficient stock leaves pending status and all quantities intact', async () => {
  const a = await product(1, 15000), b = await product(1);
  const request = input(a._id);
  request.items.push({ productId: String(b._id), quantity: 1 });
  const { order } = await createOrder(request, actor);
  await Product.updateOne({ _id: b._id }, { $set: { quantity: 0 } });
  await assert.rejects(transitionOrder(String(order._id), 'confirmed'), /Insufficient stock/);
  assert.equal((await Order.findById(order._id))!.status, 'pending');
  assert.equal((await Product.findById(a._id))!.quantity, 1);
  assert.equal((await Product.findById(b._id))!.quantity, 0);
});
test('concurrent approvals claim an order once', async () => {
  const p = await product(3, 15000);
  const { order } = await createOrder(input(p._id), actor);
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => transitionOrder(String(order._id), 'confirmed')));
  assert.equal(successes(results), 1);
  assert.equal((await Product.findById(p._id))!.quantity, 2);
  await assert.rejects(transitionOrder(String(order._id), 'confirmed'), /Invalid status transition/);
});
test('double cancellation restores stock once', async () => {
  const p = await product(3);
  const { order } = await createOrder(input(p._id), actor);
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => transitionOrder(String(order._id), 'cancelled')));
  assert.equal(successes(results), 1);
  assert.equal((await Product.findById(p._id))!.quantity, 3);
  await assert.rejects(transitionOrder(String(order._id), 'cancelled'), /Invalid status transition/);
});
test('missing product during cancellation rolls back earlier restoration and status', async () => {
  const a = await product(2), b = await product(2);
  const request = input(a._id);
  request.items.push({ productId: String(b._id), quantity: 1 });
  const { order } = await createOrder(request, actor);
  await Product.deleteOne({ _id: b._id });
  await assert.rejects(transitionOrder(String(order._id), 'cancelled'), /Product.*not found/);
  assert.equal((await Order.findById(order._id))!.status, 'confirmed');
  assert.equal((await Product.findById(a._id))!.quantity, 1);
});
test('invoice write failure rolls back order and stock', async () => {
  const p = await product(2);
  // Real server-side validation failure, after the transaction stock writes.
  await mongoose.connection.db!.command({ collMod: Invoice.collection.name, validator: { totalAmount: { $lt: 0 } }, validationLevel: 'strict' });
  try {
    await assert.rejects(createOrder(input(p._id), actor));
    assert.equal(await Order.countDocuments(), 0);
    assert.equal(await Invoice.countDocuments(), 0);
    assert.equal((await Product.findById(p._id))!.quantity, 2);
  } finally {
    await mongoose.connection.db!.command({ collMod: Invoice.collection.name, validator: {} });
  }
});
test('invalid IDs fail without writes', async () => {
  await assert.rejects(createOrder(input('invalid'), actor), /Invalid product/);
  await assert.rejects(transitionOrder('invalid', 'confirmed'), /Invalid order/);
  assert.equal(await Order.countDocuments(), 0);
});
test('different pending orders contend for the last item at approval', async () => {
  const p = await product(1, 15000);
  const a = await createOrder(input(p._id), actor);
  const b = await createOrder(input(p._id), actor);
  const results = await Promise.allSettled([transitionOrder(String(a.order._id), 'confirmed'), transitionOrder(String(b.order._id), 'confirmed')]);
  assert.equal(successes(results), 1);
  assert.equal(await Order.countDocuments({ status: 'confirmed' }), 1);
  assert.equal(await Order.countDocuments({ status: 'pending' }), 1);
  assert.equal((await Product.findById(p._id))!.quantity, 0);
});
test('approval racing cancellation leaves stock consistent with the committed state', async () => {
  const p = await product(2, 15000);
  const { order } = await createOrder(input(p._id), actor);
  await Promise.allSettled([transitionOrder(String(order._id), 'confirmed'), transitionOrder(String(order._id), 'cancelled')]);
  const saved = await Order.findById(order._id);
  assert.equal(saved!.status, 'cancelled');
  assert.equal((await Product.findById(p._id))!.quantity, 2);
});
test('missing idempotency index fails closed without stock or order writes', async () => {
  const p = await product(2);
  await Order.collection.dropIndex('createdBy_1_idempotencyKey_1');
  try {
    await assert.rejects(createOrder(input(p._id), actor), /Required order indexes are missing/);
    assert.equal(await Order.countDocuments(), 0);
    assert.equal((await Product.findById(p._id))!.quantity, 2);
  } finally {
    await Order.createIndexes();
  }
});

// Each alternate index is created on the real server, not mocked metadata.
const incompatibleIndexes = [
  { name: 'status-filtered creation key', model: Order, indexName: 'createdBy_1_idempotencyKey_1', key: { createdBy: 1, idempotencyKey: 1 }, options: { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' }, status: 'confirmed' } } },
  { name: 'partial order number', model: Order, indexName: 'orderNumber_1', key: { orderNumber: 1 }, options: { unique: true, partialFilterExpression: { status: 'confirmed' } } },
  { name: 'partial invoice number', model: Invoice, indexName: 'invoiceNumber_1', key: { invoiceNumber: 1 }, options: { unique: true, partialFilterExpression: { totalAmount: { $gte: 15000 } } } },
  { name: 'partial invoice order ID', model: Invoice, indexName: 'orderId_1', key: { orderId: 1 }, options: { unique: true, partialFilterExpression: { totalAmount: { $gte: 15000 } } } },
  { name: 'nonunique creation key', model: Order, indexName: 'createdBy_1_idempotencyKey_1', key: { createdBy: 1, idempotencyKey: 1 }, options: { partialFilterExpression: { idempotencyKey: { $type: 'string' } } } },
  { name: 'reversed creation key', model: Order, indexName: 'createdBy_1_idempotencyKey_1', key: { idempotencyKey: 1, createdBy: 1 }, options: { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } } },
  { name: 'extended creation key', model: Order, indexName: 'createdBy_1_idempotencyKey_1', key: { createdBy: 1, idempotencyKey: 1, status: 1 }, options: { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } } },
  { name: 'sparse order number', model: Order, indexName: 'orderNumber_1', key: { orderNumber: 1 }, options: { unique: true, sparse: true } },
  { name: 'case-insensitive creation key', model: Order, indexName: 'createdBy_1_idempotencyKey_1', key: { createdBy: 1, idempotencyKey: 1 }, options: { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } }, collation: { locale: 'en', strength: 2 } } },
] as const;
for (const configuration of incompatibleIndexes) {
  test(`incompatible ${configuration.name} rejects all concurrent pending requests without writes`, async () => {
    const p = await product(100, 15000);
    const collection = configuration.model.collection;
    await collection.dropIndex(configuration.indexName);
    try {
      await collection.createIndex(configuration.key, { ...configuration.options, name: configuration.indexName });
      const request = input(p._id);
      const results = await Promise.allSettled(Array.from({ length: 20 }, () => createOrder(request, actor)));
      assert.equal(successes(results), 0, 'every request must fail closed under an insufficient index');
      for (const result of results) {
        assert.equal(result.status, 'rejected');
        if (result.status === 'rejected') {
          assert.equal(result.reason.status, 503);
          assert.match(result.reason.message, /Required order indexes/);
        }
      }
      assert.equal(await Order.countDocuments(), 0);
      assert.equal(await Invoice.countDocuments(), 0);
      assert.equal((await Product.findById(p._id))!.quantity, 100);
    } finally {
      await collection.dropIndex(configuration.indexName);
      await Order.createIndexes();
      await Invoice.createIndexes();
    }
  });
}

test('legacy headerless clients fail without writes, then upgraded keyed retries create once', async () => {
  const p = await product(5);
  for (const key of ['', 'short', 'contains spaces and is invalid']) {
    await assert.rejects(createOrder(input(p._id, key), actor), error => {
      assert.equal((error as { status: number }).status, 400);
      assert.match((error as Error).message, /Idempotency-Key/);
      return true;
    });
  }
  assert.equal(await Order.countDocuments(), 0);
  assert.equal(await Invoice.countDocuments(), 0);
  assert.equal((await Product.findById(p._id))!.quantity, 5);
  const upgraded = input(p._id);
  const first = await createOrder(upgraded, actor);
  const retried = await createOrder(upgraded, actor);
  assert.equal(first.replayed, false);
  assert.equal(retried.replayed, true);
  assert.equal(String(first.order._id), String(retried.order._id));
  await assert.rejects(createOrder({ ...upgraded, customerName: 'Changed payload' }, actor), error => {
    assert.equal((error as { status: number }).status, 409);
    return true;
  });
  assert.equal(await Order.countDocuments(), 1);
  assert.equal(await Invoice.countDocuments(), 1);
  assert.equal((await Product.findById(p._id))!.quantity, 4);
});
