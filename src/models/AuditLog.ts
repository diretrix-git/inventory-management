import { Schema, model, models, Model } from "mongoose";
import type { IAuditLog } from "@/types";

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    action: { type: String, required: true },
    targetModel: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId },
    details: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog =
  (models.AuditLog as Model<IAuditLog>) || model<IAuditLog>("AuditLog", auditLogSchema);
