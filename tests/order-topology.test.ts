import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createOrder } from '../src/lib/order-service';
import { Product } from '../src/models/Product';
import { Order } from '../src/models/Order';
import { Invoice } from '../src/models/Invoice';
const database = `inventory_phase3_test_${new mongoose.Types.ObjectId()}`;
const uri = `mongodb://127.0.0.1:27028/${database}?directConnection=true`;
before(async () => {
  await mongoose.connect(uri);
  await Promise.all([Product.init(), Order.init(), Invoice.init()]);
});
after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
test('standalone server rejects creation without changing order, invoice or stock', async () => {
  const p = await Product.create({ name: 'Synthetic standalone', sku: randomUUID(), category: 'test', supplierId: new mongoose.Types.ObjectId(), quantity: 2, price: 100 });
  await assert.rejects(createOrder({ customerName: 'Synthetic', items: [{ productId: String(p._id), quantity: 1 }], idempotencyKey: randomUUID() }, new mongoose.Types.ObjectId().toString()), /Transaction numbers are only allowed/);
  assert.equal((await Product.findById(p._id))!.quantity, 2);
  assert.equal(await Order.countDocuments(), 0);
  assert.equal(await Invoice.countDocuments(), 0);
});
test('storage preparation explicitly rejects standalone topology', () => {
  assert.throws(() => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/prepare-order-storage.ts'], {
    env: { ...process.env, MONGODB_URI: uri }, encoding: 'utf8', stdio: 'pipe',
  }), /MongoDB replica set or sharded cluster is required/);
});
