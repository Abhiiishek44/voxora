import mongoose from "mongoose";
import {
  Membership,
  Notification,
  type INotification,
  type MembershipRole,
} from "@shared/models";
import { enqueueNotificationEmail } from "@shared/queues/email.queue";
import { getSocketManager } from "@sockets/index";
import logger from "@shared/utils/logger";
import type {
  KnowledgeNotificationEvent,
  NotificationEvent,
  NotificationEventType,
  NotificationRecipient,
  NotificationStrategy,
  NotificationStrategyContext,
  NotificationStrategyRegistry,
  NotificationStrategyResult,
  RoleNotificationEvent,
  NotificationPayload,
} from "./notification.types";
import { KNOWLEDGE_NOTIFICATION_STRATEGIES } from "./strategies/knowledge.handlers";
import { ROLE_NOTIFICATION_STRATEGIES } from "./strategies/role.handlers";

type RecipientUser = NotificationRecipient;

const strategyRegistry: NotificationStrategyRegistry = new Map();

function registerStrategies(
  strategies: Record<string, NotificationStrategy<any>>,
): void {
  Object.entries(strategies).forEach(([key, handler]) => {
    strategyRegistry.set(key as NotificationEventType, handler);
  });
}

registerStrategies(KNOWLEDGE_NOTIFICATION_STRATEGIES);
registerStrategies(ROLE_NOTIFICATION_STRATEGIES);

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agent",
};

function formatRole(role?: string): string {
  if (!role) return "member";
  return ROLE_LABELS[role] || role;
}

function normalizeNotification(notification: INotification): NotificationPayload {
  return {
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    message: notification.message || notification.description,
    createdAt: notification.createdAt,
    read: notification.status === "read" || notification.isRead,
  };
}

const UNREAD_CONDITION = {
  $or: [
    { status: "unread" },
    { status: { $exists: false }, isRead: false },
  ],
};

async function runWithOptionalTransaction<T>(
  work: (session?: mongoose.ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();

  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error: any) {
    const message = String(error?.message || "");
    const transactionUnsupported =
      error?.code === 20 ||
      message.includes("Transaction numbers are only allowed") ||
      message.includes("replica set member or mongos");

    if (!transactionUnsupported) throw error;

    logger.warn(
      "[NotificationService] MongoDB transactions unavailable; persisting notifications without a transaction.",
    );
    return work(undefined);
  } finally {
    await session.endSession();
  }
}

class NotificationService {
  async notifyKnowledgeEvent(event: KnowledgeNotificationEvent): Promise<void> {
    await this.notifyEvent(event);
  }

  async notifyRoleEvent(event: RoleNotificationEvent): Promise<void> {
    await this.notifyEvent(event);
  }

  private async notifyEvent(event: NotificationEvent): Promise<void> {
    const strategy = strategyRegistry.get(event.type);
    if (!strategy) return;

    const context: NotificationStrategyContext = {
      resolveRecipients: this.resolveRecipients.bind(this),
      formatRole,
    };

    const result = await strategy(event as any, context);
    if (!result) return;

    await this.deliverNotification(event, result);
  }

  private async deliverNotification(
    event: NotificationEvent,
    result: NotificationStrategyResult,
  ): Promise<void> {
    const {
      title,
      message,
      inAppRecipients,
      emailRecipients,
      emailOnlyRecipients,
      metadata,
      dedupeKeyScope,
    } = result;

    if (inAppRecipients.length === 0 && emailRecipients.length === 0 && emailOnlyRecipients.length === 0) {
      logger.info(
        `[NotificationService] No recipients for ${event.type} in org=${event.organizationId}`,
      );
      return;
    }

    const created = await runWithOptionalTransaction(async (session) => {
      const docs: Array<{ notification: INotification; recipient: RecipientUser }> = [];

      for (const recipient of inAppRecipients) {
        const dedupeKey = [
          event.type,
          event.organizationId,
          dedupeKeyScope || "",
          event.eventId,
          recipient.id,
        ].join(":");

        const existing = await Notification.findOne({ dedupeKey }).session(session || null);
        if (existing) continue;

        const [notification] = await Notification.create(
          [
            {
              organizationId: event.organizationId,
              userId: recipient.id,
              type: event.type,
              title,
              message,
              description: message,
              status: "unread",
              isRead: false,
              dedupeKey,
              metadata: {
                ...metadata,
                eventId: event.eventId,
                recipientRole: recipient.role,
              },
            },
          ],
          { session },
        );

        docs.push({ notification, recipient });
      }

      return docs;
    });

    await this.emitInApp(created);
    await this.sendEmails(event.type, title, message, emailRecipients, emailOnlyRecipients);
  }

  async getNotifications(organizationId: string, userId: string, limit = 50) {
    return Notification.find({ organizationId, userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async getUnreadCount(organizationId: string, userId: string) {
    const count = await Notification.countDocuments({
      organizationId,
      userId,
      ...UNREAD_CONDITION,
    });

    return { count };
  }

  async markAsRead(organizationId: string, userId: string, notificationId: string) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, organizationId, userId },
      { $set: { status: "read", isRead: true } },
      { new: true },
    );
  }

  async markAllAsRead(organizationId: string, userId: string) {
    return Notification.updateMany(
      {
        organizationId,
        userId,
        ...UNREAD_CONDITION,
      },
      { $set: { status: "read", isRead: true } },
    );
  }

  private async resolveRecipients(
    organizationId: string,
    roles: MembershipRole[],
  ): Promise<RecipientUser[]> {
    const memberships = await Membership.find({
      organizationId,
      inviteStatus: "active",
      role: { $in: roles },
    })
      .populate("userId", "name email isActive")
      .lean();

    const unique = new Map<string, RecipientUser>();

    for (const membership of memberships) {
      const user = membership.userId as any;
      if (!user?._id || user.isActive === false) continue;
      const id = user._id.toString();
      if (unique.has(id)) continue;

      unique.set(id, {
        id,
        name: user.name || "there",
        email: user.email,
        role: membership.role,
      });
    }

    return [...unique.values()];
  }

  private async emitInApp(
    entries: Array<{ notification: INotification; recipient: RecipientUser }>,
  ): Promise<void> {
    const socketManager = getSocketManager();
    if (!socketManager) return;

    await Promise.all(
      entries.map(async ({ notification, recipient }) => {
        const payload = normalizeNotification(notification);
        try {
          if (typeof (socketManager as any).emitNotificationToUser === "function") {
            await (socketManager as any).emitNotificationToUser(recipient.id, payload);
            return;
          }
          await socketManager.emitToUser(recipient.id, "notification", payload);
        } catch (error: any) {
          logger.warn(
            `[NotificationService] Failed to emit notification ${notification._id}: ${error?.message || error}`,
          );
        }
      }),
    );
  }



  private async sendEmails(
    type: NotificationEvent["type"],
    title: string,
    message: string,
    recipients: RecipientUser[],
    emailOnlyRecipients: Array<{ name: string; email: string }>,
  ): Promise<void> {
    const emailTargets = new Map<string, { name: string; email: string }>();

    recipients.forEach((recipient) => {
      if (!recipient.email) return;
      emailTargets.set(recipient.email, {
        name: recipient.name,
        email: recipient.email,
      });
    });

    emailOnlyRecipients.forEach((recipient) => {
      if (!recipient.email) return;
      emailTargets.set(recipient.email, recipient);
    });

    await Promise.all(
      [...emailTargets.values()].map(async (recipient) => {
        try {
          await enqueueNotificationEmail(
            recipient.email,
            recipient.name,
            title,
            message,
            type,
          );
        } catch (error: any) {
          logger.warn(
            `[NotificationService] Failed to enqueue email notification ${type}: ${error?.message || error}`,
          );
        }
      }),
    );
  }
}

export default new NotificationService();
