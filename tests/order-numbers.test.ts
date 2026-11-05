import { test, before, after } from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { generateOrderNumber, generateInvoiceNumber } from '../src/lib/order-utils';
import { Order } from '../src/models/Order';
import { Invoice } from '../src/models/Invoice';

// Deliberately ignore MONGODB_URI: this suite only touches a random local database.
const database = `inventory_phase3_test_${new mongoose.Types.ObjectId()}`;
before(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27027/${database}?replicaSet=phase3&directConnection=true`);
  await Promise.all([Order.init(), Invoice.init()]);
});
after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
test('concurrent number allocation never repeats, even without order inserts', async () => {
  for (const allocate of [generateOrderNumber, generateInvoiceNumber]) {
    const numbers = await Promise.all(Array.from({ length: 12 }, () => allocate()));
    assert.equal(new Set(numbers).size, 12);
  }
});
test('legacy numeric maximum survives deletion gaps and suffixes above 9999', async () => {
  const day = new Date('2020-01-02T00:00:00Z');
  await Order.collection.insertMany([{ orderNumber: 'ORD-20200102-0001' }, { orderNumber: 'ORD-20200102-10001' }]);
  await Invoice.collection.insertMany([{ invoiceNumber: 'INV-20200102-0001', orderId: new mongoose.Types.ObjectId() }, { invoiceNumber: 'INV-20200102-10001', orderId: new mongoose.Types.ObjectId() }]);
  assert.equal(await generateOrderNumber(day), 'ORD-20200102-10002');
  assert.equal(await generateInvoiceNumber(day), 'INV-20200102-10002');
});

test('storage preparation is repeatable on a replica set', () => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const output = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/prepare-order-storage.ts'], {
      env: { ...process.env, MONGODB_URI: `mongodb://127.0.0.1:27027/${database}?replicaSet=phase3&directConnection=true` },
      encoding: 'utf8', stdio: 'pipe',
    });
    assert.match(output, /Order storage collections and indexes prepared/);
  }
});
