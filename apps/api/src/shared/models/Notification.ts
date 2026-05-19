import mongoose, { Document, Model, Schema } from "mongoose";

export const NOTIFICATION_TYPES = [
  "assignment",
  "ai_sync",
  "system",
  "billing",
  "KNOWLEDGE_UPLOAD_QUEUED",
  "KNOWLEDGE_UPLOAD_COMPLETED",
  "KNOWLEDGE_REINDEX_STARTED",
  "KNOWLEDGE_REINDEX_COMPLETED",
  "KNOWLEDGE_INGESTION_FAILED",
  "ADMIN_INVITED",
  "AGENT_INVITED",
  "ADMIN_INVITE_ACCEPTED",
  "AGENT_INVITE_ACCEPTED",
  "ADMIN_ROLE_CHANGED",
  "AGENT_ROLE_CHANGED",
  "ADMIN_SUSPENDED",
  "AGENT_SUSPENDED",
  "ADMIN_REMOVED",
  "AGENT_REMOVED",
  "ADMIN_REACTIVATED",
  "AGENT_REACTIVATED",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationStatus = "unread" | "read";

export interface INotification extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  description: string;
  status: NotificationStatus;
  isRead: boolean;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ["unread", "read"], default: "unread", index: true },
    isRead: { type: Boolean, default: false, index: true },
    dedupeKey: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.pre("validate", function (next) {
  if (!this.message && this.description) this.message = this.description;
  if (!this.description && this.message) this.description = this.message;
  this.isRead = this.status === "read";
  next();
});

NotificationSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() as any;
  const $set = update?.$set ?? update ?? {};
  if ($set.status) {
    $set.isRead = $set.status === "read";
  } else if (typeof $set.isRead === "boolean") {
    $set.status = $set.isRead ? "read" : "unread";
  }
  if (update?.$set) update.$set = $set;
  next();
});

NotificationSchema.pre("updateMany", function (next) {
  const update = this.getUpdate() as any;
  const $set = update?.$set ?? update ?? {};
  if ($set.status) {
    $set.isRead = $set.status === "read";
  } else if (typeof $set.isRead === "boolean") {
    $set.status = $set.isRead ? "read" : "unread";
  }
  if (update?.$set) update.$set = $set;
  next();
});

// Indexes for common queries and retry-safe event handling
NotificationSchema.index({ organizationId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export const Notification: Model<INotification> = mongoose.model<INotification>(
  "Notification",
  NotificationSchema
);
