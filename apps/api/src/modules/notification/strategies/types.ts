import type { MembershipRole } from "@shared/models";
import type {
  NotificationEvent,
  NotificationEventType,
} from "../notification.types";

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
