import type { MembershipRole } from "@shared/models";
import type {
  RoleNotificationEvent,
  RoleNotificationEventType,
} from "../notification.types";
import type {
  NotificationEmailRecipient,
  NotificationRecipient,
  NotificationStrategy,
  NotificationStrategyResult,
} from "./types";

type CopyBuilder = (event: RoleNotificationEvent) => { title: string; message: string };

function buildRoleCopy(
  event: RoleNotificationEvent,
  formatRole: (role?: string) => string,
): { title: string; message: string } {
  const actorName = event.actor?.name || "Someone";
  const targetName = event.target?.name || "the member";
  const previousRole = formatRole(event.previousRole);
  const newRole = formatRole(event.newRole || event.target?.role);

  const builders: Record<RoleNotificationEventType, CopyBuilder> = {
    ADMIN_INVITED: () => ({
      title: "Admin invited",
      message: `${actorName} invited ${targetName} to join as an admin.`,
    }),
    AGENT_INVITED: () => ({
      title: "Agent invited",
      message: `${actorName} invited ${targetName} to join as an agent.`,
    }),
    ADMIN_INVITE_ACCEPTED: () => ({
      title: "Admin invite accepted",
      message: `${targetName} accepted the admin invitation.`,
    }),
    AGENT_INVITE_ACCEPTED: () => ({
      title: "Agent invite accepted",
      message: `${targetName} accepted the agent invitation.`,
    }),
    ADMIN_ROLE_CHANGED: () => ({
      title: "Admin role updated",
      message: `${actorName} updated ${targetName}'s role from ${previousRole} to ${newRole}.`,
    }),
    AGENT_ROLE_CHANGED: () => ({
      title: "Agent role updated",
      message: `${actorName} updated ${targetName}'s role from ${previousRole} to ${newRole}.`,
    }),
    ADMIN_SUSPENDED: () => ({
      title: "Admin suspended",
      message: `${actorName} suspended ${targetName}.`,
    }),
    AGENT_SUSPENDED: () => ({
      title: "Agent suspended",
      message: `${actorName} suspended ${targetName}.`,
    }),
    ADMIN_REMOVED: () => ({
      title: "Admin removed",
      message: `${actorName} removed ${targetName} from the workspace.`,
    }),
    AGENT_REMOVED: () => ({
      title: "Agent removed",
      message: `${actorName} removed ${targetName} from the workspace.`,
    }),
    ADMIN_REACTIVATED: () => ({
      title: "Admin reactivated",
      message: `${actorName} reactivated ${targetName}.`,
    }),
    AGENT_REACTIVATED: () => ({
      title: "Agent reactivated",
      message: `${actorName} reactivated ${targetName}.`,
    }),
  };

  const builder = builders[event.type];
  return builder
    ? builder(event)
    : {
        title: "Membership updated",
        message: `${actorName} updated ${targetName}.`,
      };
}

const buildRoleStrategy: NotificationStrategy<RoleNotificationEvent> = async (
  event,
  { resolveRecipients, formatRole },
): Promise<NotificationStrategyResult | null> => {
  const { title, message } = buildRoleCopy(event, formatRole);

  const inAppRecipientsMap = new Map<string, NotificationRecipient>();
  const emailRecipientsMap = new Map<string, NotificationRecipient>();
  const emailOnlyRecipients: NotificationEmailRecipient[] = [];

  const toRecipient = (
    user?: RoleNotificationEvent["actor"] | RoleNotificationEvent["target"],
    roleOverride?: MembershipRole,
  ): NotificationRecipient | null => {
    if (!user?.id) return null;
    return {
      id: user.id,
      name: user.name || "there",
      email: user.email || "",
      role: roleOverride || (user.role as MembershipRole) || "agent",
    };
  };

  const addRecipient = (
    map: Map<string, NotificationRecipient>,
    recipient: NotificationRecipient | null,
  ) => {
    if (!recipient?.id) return;
    map.set(recipient.id, recipient);
  };

  const addEmailOnly = (user?: RoleNotificationEvent["target"]) => {
    if (!user?.email) return;
    emailOnlyRecipients.push({ name: user.name || "there", email: user.email });
  };

  const actorRecipient = toRecipient(event.actor);
  const targetRecipient = toRecipient(event.target);
  const actorIsAdmin = event.actor?.role === "admin";
  const owners = await resolveRecipients(event.organizationId, ["owner"]);

  type RecipientContext = {
    owners: NotificationRecipient[];
    actorRecipient: NotificationRecipient | null;
    targetRecipient: NotificationRecipient | null;
    actorIsAdmin: boolean;
  };

  const handlers: Record<RoleNotificationEventType, (ctx: RecipientContext) => void> = {
    ADMIN_INVITED: ({ owners: ownerList }) => {
      ownerList.forEach((owner) => addRecipient(inAppRecipientsMap, owner));
    },
    AGENT_INVITED: ({ actorRecipient: actor }) => {
      addRecipient(inAppRecipientsMap, actor);
    },
    ADMIN_INVITE_ACCEPTED: ({ owners: ownerList }) => {
      ownerList.forEach((owner) => addRecipient(inAppRecipientsMap, owner));
      ownerList.forEach((owner) => addRecipient(emailRecipientsMap, owner));
    },
    AGENT_INVITE_ACCEPTED: ({ owners: ownerList, actorRecipient: actor, actorIsAdmin: isAdmin }) => {
      ownerList.forEach((owner) => addRecipient(inAppRecipientsMap, owner));
      addRecipient(inAppRecipientsMap, actor);
      if (isAdmin) {
        addRecipient(emailRecipientsMap, actor);
      }
    },
    ADMIN_ROLE_CHANGED: ({ owners: ownerList, targetRecipient: target }) => {
      ownerList.forEach((owner) => addRecipient(inAppRecipientsMap, owner));
      addRecipient(inAppRecipientsMap, target);
      addRecipient(emailRecipientsMap, target);
      ownerList.forEach((owner) => addRecipient(emailRecipientsMap, owner));
    },
    AGENT_ROLE_CHANGED: ({ owners: ownerList, actorRecipient: actor, targetRecipient: target }) => {
      ownerList.forEach((owner) => addRecipient(inAppRecipientsMap, owner));
      addRecipient(inAppRecipientsMap, actor);
      addRecipient(inAppRecipientsMap, target);
      addRecipient(emailRecipientsMap, target);
    },
    ADMIN_SUSPENDED: ({ owners: ownerList }) => {
      ownerList.forEach((owner) => addRecipient(inAppRecipientsMap, owner));
      ownerList.forEach((owner) => addRecipient(emailRecipientsMap, owner));
      addEmailOnly(event.target);
    },
    AGENT_SUSPENDED: ({ owners: ownerList, actorRecipient: actor }) => {
      ownerList.forEach((owner) => addRecipient(inAppRecipientsMap, owner));
      addRecipient(inAppRecipientsMap, actor);
      addEmailOnly(event.target);
    },
    ADMIN_REMOVED: ({ owners: ownerList }) => {
      ownerList.forEach((owner) => addRecipient(inAppRecipientsMap, owner));
      ownerList.forEach((owner) => addRecipient(emailRecipientsMap, owner));
      addEmailOnly(event.target);
    },
    AGENT_REMOVED: ({ owners: ownerList, actorRecipient: actor }) => {
      ownerList.forEach((owner) => addRecipient(inAppRecipientsMap, owner));
      addRecipient(inAppRecipientsMap, actor);
      addEmailOnly(event.target);
    },
    ADMIN_REACTIVATED: ({ owners: ownerList, targetRecipient: target }) => {
      ownerList.forEach((owner) => addRecipient(inAppRecipientsMap, owner));
      addRecipient(inAppRecipientsMap, target);
      addRecipient(emailRecipientsMap, target);
    },
    AGENT_REACTIVATED: ({ owners: ownerList, actorRecipient: actor, targetRecipient: target }) => {
      ownerList.forEach((owner) => addRecipient(inAppRecipientsMap, owner));
      addRecipient(inAppRecipientsMap, actor);
      addRecipient(inAppRecipientsMap, target);
      addRecipient(emailRecipientsMap, target);
    },
  };

  const handler = handlers[event.type];
  if (handler) {
    handler({
      owners,
      actorRecipient,
      targetRecipient,
      actorIsAdmin,
    });
  }

  return {
    title,
    message,
    inAppRecipients: [...inAppRecipientsMap.values()],
    emailRecipients: [...emailRecipientsMap.values()],
    emailOnlyRecipients,
    metadata: {
      ...event.metadata,
      actorId: event.actor?.id,
      targetId: event.target?.id,
      previousRole: event.previousRole,
      newRole: event.newRole,
    },
    dedupeKeyScope: event.target?.id || event.actor?.id,
  };
};

export const ROLE_NOTIFICATION_STRATEGIES: Record<
  RoleNotificationEventType,
  NotificationStrategy<RoleNotificationEvent>
> = {
  ADMIN_INVITED: buildRoleStrategy,
  AGENT_INVITED: buildRoleStrategy,
  ADMIN_INVITE_ACCEPTED: buildRoleStrategy,
  AGENT_INVITE_ACCEPTED: buildRoleStrategy,
  ADMIN_ROLE_CHANGED: buildRoleStrategy,
  AGENT_ROLE_CHANGED: buildRoleStrategy,
  ADMIN_SUSPENDED: buildRoleStrategy,
  AGENT_SUSPENDED: buildRoleStrategy,
  ADMIN_REMOVED: buildRoleStrategy,
  AGENT_REMOVED: buildRoleStrategy,
  ADMIN_REACTIVATED: buildRoleStrategy,
  AGENT_REACTIVATED: buildRoleStrategy,
};
