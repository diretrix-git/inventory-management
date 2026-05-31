import { Schema, model, models, Model } from "mongoose";
import type { IOrder } from "@/types";

const orderLineSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    items: { type: [orderLineSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
      required: true,
    },
    customerName: { type: String, required: true, trim: true, maxlength: 200 },
    customerEmail: { type: String, trim: true, lowercase: true },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: 1 });
orderSchema.index({ createdBy: 1 });

export const Order =
  (models.Order as Model<IOrder>) || model<IOrder>("Order", orderSchema);
