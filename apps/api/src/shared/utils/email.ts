import config from "@shared/config";
import {
  EmailTemplate,
  type EmailTemplateType,
} from "@shared/models";
import { DEFAULT_EMAIL_TEMPLATES } from "@shared/seeds/emailTemplates.seed";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: {
    name: string;
    email: string;
  };
}

export interface BuiltEmail {
  subject: string;
  html: string;
  text?: string;
}

type TemplateVars = Record<string, string>;

const DEFAULT_TEMPLATES = DEFAULT_EMAIL_TEMPLATES.reduce(
  (acc, template) => {
    acc[template.type] = {
      subjectTemplate: template.subjectTemplate,
      htmlTemplate: template.htmlTemplate,
      textTemplate: template.textTemplate,
    };
    return acc;
  },
  {} as Record<EmailTemplateType, { subjectTemplate: string; htmlTemplate: string; textTemplate?: string }>,
);

const REQUIRED_TEMPLATE_TOKENS: Partial<Record<EmailTemplateType, string[]>> = {
  invite: ["{{inviteUrl}}"],
  password_reset: ["{{resetUrl}}"],
  email_verification_link: ["{{verificationUrl}}"],
  email_verification_otp: ["{{otp}}"],
  password_reset_otp: ["{{otp}}"],
  welcome: ["{{loginUrl}}"],
  notification: ["{{actionUrl}}"],
};

/**
 * Returns true when EMAIL_PROVIDER is set to a real provider.
 * Used by callers to decide whether to enqueue an email job at all.
 */
export function isEmailEnabled(): boolean {
  return config.email.provider === "resend" || config.email.provider === "mailhog";
}

function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? "";
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function getTemplate(type: EmailTemplateType): Promise<{
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate?: string;
}> {
  const template = await EmailTemplate.findOne({ type, isActive: true })
    .select("subjectTemplate htmlTemplate textTemplate")
    .lean();

  if (template) {
    return {
      subjectTemplate: template.subjectTemplate,
      htmlTemplate: template.htmlTemplate,
      textTemplate: template.textTemplate,
    };
  }

  return DEFAULT_TEMPLATES[type];
}

async function buildFromTemplate(type: EmailTemplateType, vars: TemplateVars): Promise<BuiltEmail> {
  try {
    const template = await getTemplate(type);
    const requiredTokens = REQUIRED_TEMPLATE_TOKENS[type] ?? [];
    const templateHasRequiredTokens = requiredTokens.every((token) =>
      [template.subjectTemplate, template.htmlTemplate, template.textTemplate]
        .filter(Boolean)
        .some((content) => (content as string).includes(token)),
    );

    if (!templateHasRequiredTokens) {
      const defaults = DEFAULT_TEMPLATES[type];
      return {
        subject: renderTemplate(defaults.subjectTemplate, vars),
        html: renderTemplate(defaults.htmlTemplate, vars),
        text: defaults.textTemplate ? renderTemplate(defaults.textTemplate, vars) : undefined,
      };
    }

    return {
      subject: renderTemplate(template.subjectTemplate, vars),
      html: renderTemplate(template.htmlTemplate, vars),
      text: template.textTemplate ? renderTemplate(template.textTemplate, vars) : undefined,
    };
  } catch {
    // Database read/write failed; keep mail flow working with in-memory defaults.
    const defaults = DEFAULT_TEMPLATES[type];
    return {
      subject: renderTemplate(defaults.subjectTemplate, vars),
      html: renderTemplate(defaults.htmlTemplate, vars),
      text: defaults.textTemplate ? renderTemplate(defaults.textTemplate, vars) : undefined,
    };
  }
}

// ── Template builders ────────────────────────────────────────────────────────

function getClientUrl(): string {
  return (config.app.clientUrl || "http://localhost:5173").replace(/\/+$/, "");
}

export async function buildInviteEmail(
  inviterName: string,
  role: string,
  inviteToken: string,
): Promise<BuiltEmail> {
  const inviteUrl = `${getClientUrl()}/auth/accept-invite?token=${encodeURIComponent(inviteToken)}`;

  const safeInviterName = escapeHtml(inviterName);
  const safeRole = escapeHtml(role);

  const titleText = "Join the InteraOne Organization";
  const bodyText = `<strong>${safeInviterName}</strong> has invited you to join their organization as an <strong>${safeRole}</strong>.`;

  return buildFromTemplate("invite", {
    inviterName: safeInviterName,
    role: safeRole,
    inviteUrl,
    titleText,
    bodyText,
  });
}

export async function buildPasswordResetEmail(
  name: string,
  resetToken: string,
): Promise<BuiltEmail> {
  const resetUrl = `${getClientUrl()}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;

  return buildFromTemplate("password_reset", {
    name: escapeHtml(name),
    resetUrl,
  });
}

export async function buildEmailVerificationLinkEmail(
  name: string,
  token: string,
): Promise<BuiltEmail> {
  const verificationUrl = `${getClientUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;

  return buildFromTemplate("email_verification_link", {
    name: escapeHtml(name),
    verificationUrl,
  });
}

export async function buildWelcomeEmail(name: string, role: string): Promise<BuiltEmail> {
  const loginUrl = `${getClientUrl()}/auth/login`;

  return buildFromTemplate("welcome", {
    name: escapeHtml(name),
    role: escapeHtml(role),
    loginUrl,
  });
}

export async function buildNotificationEmail(input: {
  name: string;
  title: string;
  message: string;
  status?: string;
  actionUrl?: string;
  actionLabel?: string;
}): Promise<BuiltEmail> {
  return buildFromTemplate("notification", {
    name: escapeHtml(input.name),
    title: escapeHtml(input.title),
    message: escapeHtml(input.message),
    status: escapeHtml(input.status || "Notification"),
    actionUrl: input.actionUrl || `${config.app.clientUrl}/dashboard`,
    actionLabel: escapeHtml(input.actionLabel || "Open dashboard"),
  });
}

export async function buildEmailVerificationOTPEmail(
  name: string,
  otp: string,
): Promise<BuiltEmail> {
  return buildFromTemplate("email_verification_otp", {
    name: escapeHtml(name),
    otp: escapeHtml(otp),
  });
}

export async function buildForgotPasswordOTPEmail(
  name: string,
  otp: string,
): Promise<BuiltEmail> {
  return buildFromTemplate("password_reset_otp", {
    name: escapeHtml(name),
    otp: escapeHtml(otp),
  });
}
