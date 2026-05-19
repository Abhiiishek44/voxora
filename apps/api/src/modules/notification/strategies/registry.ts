import type { NotificationEventType } from "../notification.types";
import type {
  NotificationStrategy,
  NotificationStrategyRegistry,
} from "./types";
import { KNOWLEDGE_NOTIFICATION_STRATEGIES } from "./knowledge.handlers";
import { ROLE_NOTIFICATION_STRATEGIES } from "./role.handlers";

const registry: NotificationStrategyRegistry = new Map();

function registerStrategies(
  strategies: Record<string, NotificationStrategy<any>>,
): void {
  Object.entries(strategies).forEach(([key, handler]) => {
    registry.set(key as NotificationEventType, handler);
  });
}

registerStrategies(KNOWLEDGE_NOTIFICATION_STRATEGIES);
registerStrategies(ROLE_NOTIFICATION_STRATEGIES);

export function getNotificationStrategy(
  type: NotificationEventType,
): NotificationStrategy<any> | undefined {
  return registry.get(type);
}
