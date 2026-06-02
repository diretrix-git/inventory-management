import { Schema, model, models, Model } from "mongoose";

export interface ICategory {
  _id: string;
  name: string;
  description?: string;
  createdAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Category =
  (models.Category as Model<ICategory>) ||
  model<ICategory>("Category", categorySchema);
