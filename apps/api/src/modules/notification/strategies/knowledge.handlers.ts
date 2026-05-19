import type {
  KnowledgeNotificationEvent,
  KnowledgeNotificationEventType,
} from "../notification.types";
import type {
  NotificationStrategy,
  NotificationStrategyResult,
} from "./types";

const KNOWLEDGE_RULES: Record<
  KnowledgeNotificationEventType,
  {
    inAppRoles: Array<"owner" | "admin" | "agent">;
    emailRoles: Array<"owner" | "admin" | "agent">;
    title: (documentTitle: string) => string;
    message: (documentTitle: string) => string;
  }
> = {
  KNOWLEDGE_UPLOAD_QUEUED: {
    inAppRoles: ["owner", "admin"],
    emailRoles: [],
    title: (documentTitle) => "Knowledge upload queued",
    message: (documentTitle) =>
      `"${documentTitle}" has been added to the indexing queue.`,
  },
  KNOWLEDGE_UPLOAD_COMPLETED: {
    inAppRoles: ["owner", "admin", "agent"],
    emailRoles: ["owner", "admin"],
    title: () => "Knowledge upload completed",
    message: (documentTitle) =>
      `"${documentTitle}" is indexed and available to the AI assistant.`,
  },
  KNOWLEDGE_REINDEX_STARTED: {
    inAppRoles: ["owner", "admin"],
    emailRoles: [],
    title: () => "Knowledge reindex started",
    message: (documentTitle) =>
      `"${documentTitle}" has been queued for reindexing.`,
  },
  KNOWLEDGE_REINDEX_COMPLETED: {
    inAppRoles: ["owner", "admin", "agent"],
    emailRoles: [],
    title: () => "Knowledge reindex completed",
    message: (documentTitle) =>
      `"${documentTitle}" has been reindexed successfully.`,
  },
  KNOWLEDGE_INGESTION_FAILED: {
    inAppRoles: ["owner", "admin"],
    emailRoles: ["owner", "admin"],
    title: () => "Knowledge ingestion failed",
    message: (documentTitle) =>
      `"${documentTitle}" could not be indexed. Please review the source and try again.`,
  },
};

const buildKnowledgeStrategy: NotificationStrategy<KnowledgeNotificationEvent> = async (
  event,
  { resolveRecipients },
): Promise<NotificationStrategyResult | null> => {
  const rule = KNOWLEDGE_RULES[event.type];
  if (!rule) return null;

  const documentTitle = event.title || "Knowledge source";
  const title = rule.title(documentTitle);
  const message = event.message || rule.message(documentTitle);

  const inAppRecipients = await resolveRecipients(
    event.organizationId,
    rule.inAppRoles,
  );
  const emailRecipients = inAppRecipients.filter((recipient) =>
    rule.emailRoles.includes(recipient.role),
  );

  return {
    title,
    message,
    inAppRecipients,
    emailRecipients,
    emailOnlyRecipients: [],
    metadata: {
      ...event.metadata,
      documentId: event.documentId,
    },
    dedupeKeyScope: event.documentId,
  };
};

export const KNOWLEDGE_NOTIFICATION_STRATEGIES: Record<
  KnowledgeNotificationEventType,
  NotificationStrategy<KnowledgeNotificationEvent>
> = {
  KNOWLEDGE_UPLOAD_QUEUED: buildKnowledgeStrategy,
  KNOWLEDGE_UPLOAD_COMPLETED: buildKnowledgeStrategy,
  KNOWLEDGE_REINDEX_STARTED: buildKnowledgeStrategy,
  KNOWLEDGE_REINDEX_COMPLETED: buildKnowledgeStrategy,
  KNOWLEDGE_INGESTION_FAILED: buildKnowledgeStrategy,
};
