import { redisClient } from "@shared/config/redis";
import logger from "@shared/utils/logger";
import NotificationService from "./notification.service";
import type {
  KnowledgeNotificationEvent,
  RoleNotificationEvent,
} from "./notification.types";

export const KNOWLEDGE_NOTIFICATION_CHANNEL = "knowledge:notification";
export const ROLE_NOTIFICATION_CHANNEL = "membership:notification";

export async function startKnowledgeNotificationSubscriber(): Promise<void> {
  const subscriber = redisClient.duplicate();
  await subscriber.connect();

  await subscriber.subscribe(KNOWLEDGE_NOTIFICATION_CHANNEL, async (raw) => {
    try {
      const event = JSON.parse(raw) as KnowledgeNotificationEvent;
      await NotificationService.notifyKnowledgeEvent(event);
    } catch (error: any) {
      logger.error(
        `[NotificationSubscriber] Failed to handle knowledge notification: ${error?.message || error}`,
      );
    }
  });

  logger.info(
    `[NotificationSubscriber] Listening on "${KNOWLEDGE_NOTIFICATION_CHANNEL}"`,
  );
}

export async function startRoleNotificationSubscriber(): Promise<void> {
  const subscriber = redisClient.duplicate();
  await subscriber.connect();

  await subscriber.subscribe(ROLE_NOTIFICATION_CHANNEL, async (raw) => {
    try {
      const event = JSON.parse(raw) as RoleNotificationEvent;
      await NotificationService.notifyRoleEvent(event);
    } catch (error: any) {
      logger.error(
        `[NotificationSubscriber] Failed to handle role notification: ${error?.message || error}`,
      );
    }
  });

  logger.info(
    `[NotificationSubscriber] Listening on "${ROLE_NOTIFICATION_CHANNEL}"`,
  );
}

export async function publishRoleNotificationEvent(
  event: RoleNotificationEvent,
): Promise<void> {
  try {
    await redisClient.publish(ROLE_NOTIFICATION_CHANNEL, JSON.stringify(event));
  } catch (error: any) {
    logger.error(
      `[NotificationPublisher] Failed to publish role notification: ${error?.message || error}`,
    );
  }
}
