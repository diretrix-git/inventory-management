import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI is required");

async function main() {
  await mongoose.connect(MONGODB_URI!);
  const result = await mongoose.connection.db!
    .collection("users")
    .updateMany({}, { $set: { loginAttempts: 0, lockedUntil: null } });
  console.log(`✓ Unlocked ${result.modifiedCount} account(s). You can now log in.`);
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
