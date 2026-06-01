import { connectDB } from "@/lib/db";
import { Notification, type INotification } from "@/models/Notification";
import { pushToSubscribers } from "@/app/api/notifications/stream/route";

type NotifyParams = Omit<INotification, "_id" | "read" | "createdAt">;

/**
 * Create a notification in DB and push it instantly via SSE to connected clients.
 * Fire-and-forget — never throws.
 */
export async function notify(params: NotifyParams): Promise<void> {
  try {
    await connectDB();
    const doc = await Notification.create({ ...params, read: false });

    // Push real-time via SSE
    pushToSubscribers(params.userId, params.role, {
      type: "notification",
      notification: {
        _id: doc._id.toString(),
        ...params,
        read: false,
        createdAt: doc.createdAt,
      },
    });
  } catch (err) {
    console.error("[Notify] Failed:", err);
  }
}
