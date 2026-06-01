import { connectDB } from "@/lib/db";
import { Notification, type INotification } from "@/models/Notification";

type NotifyParams = Omit<INotification, "_id" | "read" | "createdAt">;

/**
 * Create a notification. Fire-and-forget — never throws.
 */
export async function notify(params: NotifyParams): Promise<void> {
  try {
    await connectDB();
    await Notification.create({ ...params, read: false });
  } catch (err) {
    console.error("[Notify] Failed to create notification:", err);
  }
}
