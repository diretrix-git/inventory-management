import { connectDB } from "@/lib/db";
import { AuditLog } from "@/models/AuditLog";
import type { Types } from "mongoose";

interface AuditParams {
  userId: string | Types.ObjectId;
  userName: string;
  action: string;
  targetModel: string;
  targetId?: string | Types.ObjectId;
  details?: Record<string, unknown>;
}

export async function logAction(params: AuditParams): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create(params);
  } catch (err) {
    console.error("[AuditLog] Failed:", err);
    // Never rethrow — fire-and-forget
  }
}
