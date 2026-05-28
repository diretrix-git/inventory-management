import { Schema, model, models, Model } from "mongoose";
import type { ISystemSettings } from "@/types";

const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    businessName: { type: String, required: true, default: "My Business", maxlength: 200 },
    businessAddress: { type: String, default: "", maxlength: 500 },
    taxRate: { type: Number, required: true, default: 0, min: 0, max: 100 },
    lowStockThreshold: { type: Number, required: true, default: 10, min: 0 },
  },
  { timestamps: false }
);

export const SystemSettings =
  (models.SystemSettings as Model<ISystemSettings>) ||
  model<ISystemSettings>("SystemSettings", systemSettingsSchema);
