import type { MembershipRole, NotificationType } from "@shared/models";

export type KnowledgeNotificationEventType =
  | "KNOWLEDGE_UPLOAD_QUEUED"
  | "KNOWLEDGE_UPLOAD_COMPLETED"
  | "KNOWLEDGE_REINDEX_STARTED"
  | "KNOWLEDGE_REINDEX_COMPLETED"
  | "KNOWLEDGE_INGESTION_FAILED";

export type RoleNotificationEventType =
  | "ADMIN_INVITED"
  | "AGENT_INVITED"
  | "ADMIN_INVITE_ACCEPTED"
  | "AGENT_INVITE_ACCEPTED"
  | "ADMIN_ROLE_CHANGED"
  | "AGENT_ROLE_CHANGED"
  | "ADMIN_SUSPENDED"
  | "AGENT_SUSPENDED"
  | "ADMIN_REMOVED"
  | "AGENT_REMOVED"
  | "ADMIN_REACTIVATED"
  | "AGENT_REACTIVATED";

export type NotificationChannel = "in_app" | "email";

export type NotificationEventType =
  | KnowledgeNotificationEventType
  | RoleNotificationEventType;

export interface KnowledgeNotificationEvent {
  eventId: string;
  type: KnowledgeNotificationEventType;
  organizationId: string;
  documentId: string;
  title: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface RoleNotificationEvent {
  eventId: string;
  type: RoleNotificationEventType;
  organizationId: string;
  actor?: {
    id: string;
    name: string;
    email: string;
    role?: string;
  };
  target?: {
    id: string;
    name: string;
    email: string;
    role?: string;
  };
  previousRole?: string;
  newRole?: string;
  metadata?: Record<string, unknown>;
}

export type NotificationEvent = KnowledgeNotificationEvent | RoleNotificationEvent;

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
}

export type NotificationRecipient = {
  id: string;
  name: string;
  email: string;
  role: MembershipRole;
};

export type NotificationEmailRecipient = {
  name: string;
  email: string;
};

export interface NotificationStrategyResult {
  title: string;
  message: string;
  inAppRecipients: NotificationRecipient[];
  emailRecipients: NotificationRecipient[];
  emailOnlyRecipients: NotificationEmailRecipient[];
  metadata?: Record<string, unknown>;
  dedupeKeyScope?: string;
}

export interface NotificationStrategyContext {
  resolveRecipients: (
    organizationId: string,
    roles: MembershipRole[],
  ) => Promise<NotificationRecipient[]>;
  formatRole: (role?: string) => string;
}

export type NotificationStrategy<E extends NotificationEvent = NotificationEvent> = (
  event: E,
  context: NotificationStrategyContext,
) => Promise<NotificationStrategyResult | null>;

export type NotificationStrategyRegistry = Map<
  NotificationEventType,
  NotificationStrategy<any>
>;
