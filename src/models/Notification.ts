import { Schema, model, models, Model } from "mongoose";

export interface INotification {
  _id: string;
  userId: string;        // recipient user ID ("admin" for admin-wide notifications)
  role: "admin" | "staff" | "all";
  type: "order_created" | "order_approved" | "order_cancelled" | "low_stock" | "info";
  title: string;
  message: string;
  link?: string;         // e.g. "/orders"
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ["admin", "staff", "all"], required: true },
    type: {
      type: String,
      enum: ["order_created", "order_approved", "order_cancelled", "low_stock", "info"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification =
  (models.Notification as Model<INotification>) ||
  model<INotification>("Notification", notificationSchema);
