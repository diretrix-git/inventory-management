import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Direct import — not using @/ alias since this runs outside Next.js
import { User } from "../src/models/User";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "Admin User";

async function seed() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);

  try {
    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      isActive: true,
    });

    console.log(`✓ Admin user created: ${ADMIN_EMAIL}`);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
