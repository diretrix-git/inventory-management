import mongoose from 'mongoose';
import { Order } from '../src/models/Order';
import { Invoice } from '../src/models/Invoice';
import { Product } from '../src/models/Product';
import { Sequence } from '../src/models/Sequence';
import { SystemSettings } from '../src/models/SystemSettings';

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  try {
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('MongoDB replica set or sharded cluster is required; standalone servers are unsupported');
    // Add declared indexes; never drop existing indexes or rewrite records.
    for (const model of [Order, Invoice, Product, Sequence, SystemSettings]) {
      await model.createCollection();
      await model.createIndexes();
    }
    console.log('Order storage collections and indexes prepared');
  } finally {
    await mongoose.disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
