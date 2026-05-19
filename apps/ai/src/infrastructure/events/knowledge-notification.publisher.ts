import { randomUUID } from "crypto";
import { pubsubRedis } from "../cache/redis.client";

export const KNOWLEDGE_NOTIFICATION_CHANNEL = "knowledge:notification";

export type KnowledgeNotificationEventType =
  | "KNOWLEDGE_UPLOAD_COMPLETED"
  | "KNOWLEDGE_REINDEX_COMPLETED"
  | "KNOWLEDGE_INGESTION_FAILED";

export interface KnowledgeNotificationEvent {
  eventId: string;
  type: KnowledgeNotificationEventType;
  organizationId: string;
  documentId: string;
  title: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export async function publishKnowledgeNotificationEvent(
  event: Omit<KnowledgeNotificationEvent, "eventId"> & { eventId?: string },
): Promise<void> {
  const payload: KnowledgeNotificationEvent = {
    ...event,
    eventId: event.eventId || randomUUID(),
  };

  await pubsubRedis.publish(KNOWLEDGE_NOTIFICATION_CHANNEL, JSON.stringify(payload));
}
