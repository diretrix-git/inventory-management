import { Schema, model, models, Model } from "mongoose";
import type { IProduct } from "@/types";

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 50 },
    category: { type: String, trim: true, maxlength: 100 },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 10 },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier" },
    imageUrl: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

productSchema.index({ supplierId: 1 });

productSchema.virtual("isLowStock").get(function (this: IProduct) {
  return this.quantity <= this.lowStockThreshold;
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

export const Product =
  (models.Product as Model<IProduct>) || model<IProduct>("Product", productSchema);
