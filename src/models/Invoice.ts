import { Schema, model, models, Model } from "mongoose";
import type { IInvoice } from "@/types";

const invoiceLineSchema = new Schema(
  {
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    issuedTo: { type: String, required: true },
    items: { type: [invoiceLineSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["issued", "void"], default: "issued", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

invoiceSchema.index({ createdAt: 1 });

export const Invoice =
  (models.Invoice as Model<IInvoice>) || model<IInvoice>("Invoice", invoiceSchema);
