import { Schema, model, models, Model } from "mongoose";
import type { ISupplier } from "@/types";

const supplierSchema = new Schema<ISupplier>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 200 },
    contactPerson: { type: String, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true, maxlength: 30 },
    address: { type: String, trim: true, maxlength: 500 },
    notes: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Supplier =
  (models.Supplier as Model<ISupplier>) || model<ISupplier>("Supplier", supplierSchema);
