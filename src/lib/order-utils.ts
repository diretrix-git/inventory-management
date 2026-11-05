import { Order } from '@/models/Order';
import { Invoice } from '@/models/Invoice';
import { Sequence } from '@/models/Sequence';

/** Atomic daily allocation. Gaps after failed requests are intentional.
 * Initialize above the largest legacy suffix, never the document count.
 * Allocate outside business transactions so a fresh counter's upsert race can
 * be resolved without continuing an aborted transaction.
 */
async function allocate(kind: 'ORD' | 'INV', date: Date): Promise<string> {
  const day = date.toISOString().slice(0, 10).replaceAll('-', '');
  const prefix = `${kind}-${day}-`;
  if (!await Sequence.exists({ _id: prefix })) {
    const field = kind === 'ORD' ? 'orderNumber' : 'invoiceNumber';
    const collection = kind === 'ORD' ? Order.collection : Invoice.collection;
    const [legacy] = await collection.aggregate<{ maximum: number }>([
      { $match: { [field]: { $regex: `^${prefix}[0-9]+$` } } },
      { $project: { value: { $convert: { input: { $substrBytes: [`$${field}`, prefix.length, -1] }, to: 'double', onError: 0 } } } },
      { $group: { _id: null, maximum: { $max: '$value' } } },
    ]).toArray();
    try {
      await Sequence.create({ _id: prefix, value: legacy?.maximum ?? 0 });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  const sequence = await Sequence.findOneAndUpdate(
    { _id: prefix }, { $inc: { value: 1 } }, { returnDocument: 'after' },
  ).lean();
  if (!sequence) throw new Error('Identifier counter missing');
  return `${prefix}${String(sequence.value).padStart(4, '0')}`;
}

export const generateOrderNumber = (date = new Date()) => allocate('ORD', date);
export const generateInvoiceNumber = (date = new Date()) => allocate('INV', date);
