import { NextRequest } from "next/server";
import { auth } from "../../../../../auth";

// ─── In-memory subscriber registry ───────────────────────────────────────────
// Maps userId → Set of SSE response controllers

type Controller = ReadableStreamDefaultController<Uint8Array>;

const subscribers = new Map<string, Set<Controller>>();

export function addSubscriber(userId: string, controller: Controller) {
  if (!subscribers.has(userId)) subscribers.set(userId, new Set());
  subscribers.get(userId)!.add(controller);
}

export function removeSubscriber(userId: string, controller: Controller) {
  subscribers.get(userId)?.delete(controller);
  if (subscribers.get(userId)?.size === 0) subscribers.delete(userId);
}

/**
 * Push a notification event to all connected clients for a given userId or role.
 * Called from notify.ts after creating a DB notification.
 */
export function pushToSubscribers(
  targetUserId: string,
  targetRole: "admin" | "staff" | "all",
  payload: object
) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  const encoded = new TextEncoder().encode(data);

  // Send to specific user
  subscribers.get(targetUserId)?.forEach((ctrl) => {
    try { ctrl.enqueue(encoded); } catch { /* client disconnected */ }
  });

  // Also send to all subscribers with matching role prefix
  // We store role-based subscribers under "role:admin" / "role:staff" keys
  if (targetRole !== "all") {
    subscribers.get(`role:${targetRole}`)?.forEach((ctrl) => {
      try { ctrl.enqueue(encoded); } catch { /* client disconnected */ }
    });
  } else {
    // Broadcast to everyone
    subscribers.forEach((ctrlSet) => {
      ctrlSet.forEach((ctrl) => {
        try { ctrl.enqueue(encoded); } catch { /* client disconnected */ }
      });
    });
  }
}

// ─── GET /api/notifications/stream ───────────────────────────────────────────
// SSE endpoint — client connects and receives real-time notification pushes

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const role = session.user.role;

  let controller: Controller;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;

      // Register under userId AND role
      addSubscriber(userId, controller);
      addSubscriber(`role:${role}`, controller);

      // Send initial heartbeat
      const heartbeat = new TextEncoder().encode(": heartbeat\n\n");
      ctrl.enqueue(heartbeat);
    },
    cancel() {
      removeSubscriber(userId, controller);
      removeSubscriber(`role:${role}`, controller);
    },
  });

  // Keep-alive: send a comment every 25s to prevent proxy timeouts
  const keepAliveInterval = setInterval(() => {
    try {
      const ping = new TextEncoder().encode(": ping\n\n");
      controller.enqueue(ping);
    } catch {
      clearInterval(keepAliveInterval);
    }
  }, 25000);

  req.signal.addEventListener("abort", () => {
    clearInterval(keepAliveInterval);
    removeSubscriber(userId, controller);
    removeSubscriber(`role:${role}`, controller);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
