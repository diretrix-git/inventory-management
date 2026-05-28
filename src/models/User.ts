import { Schema, model, models, Model } from "mongoose";
import type { IUser } from "@/types";

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    role: { type: String, enum: ["admin", "staff"], required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const User = (models.User as Model<IUser>) || model<IUser>("User", userSchema);
