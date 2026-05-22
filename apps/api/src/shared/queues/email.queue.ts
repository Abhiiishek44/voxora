import { Queue, ConnectionOptions } from "bullmq";
import config from "@shared/infra/config";
import {
  isEmailEnabled,
  buildInviteEmail,
  buildPasswordResetEmail,
  buildEmailVerificationLinkEmail,
  buildWelcomeEmail,
  buildEmailVerificationOTPEmail,
  buildForgotPasswordOTPEmail,
  type EmailOptions,
} from "../utils/email";
import { resolveFromEmail } from "../utils/email-sender";

export const EMAIL_QUEUE = "platform-email";

const connection: ConnectionOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
};

const emailQueue = new Queue<EmailOptions>(EMAIL_QUEUE, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

async function enqueueEmail(
  jobName: "invite" | "password_reset" | "welcome" | "email_verification_link" | "email_verification_otp" | "password_reset_otp",
  payload: { to: string; subject: string; html: string; text?: string },
): Promise<void> {
  const from = await resolveFromEmail();
  await emailQueue.add(jobName, { ...payload, from });
}

export async function enqueueInviteEmail(
  to: string,
  inviterName: string,
  role: string,
  inviteToken: string,
): Promise<boolean> {
  if (!isEmailEnabled()) return false;
  const { subject, html } = await buildInviteEmail(inviterName, role, inviteToken);
  await enqueueEmail("invite", { to, subject, html });
  return true;
}

export async function enqueuePasswordResetEmail(
  to: string,
  name: string,
  resetToken: string,
): Promise<boolean> {
  if (!isEmailEnabled()) return false;
  const { subject, html } = await buildPasswordResetEmail(name, resetToken);
  await enqueueEmail("password_reset", { to, subject, html });
  return true;
}

export async function enqueueWelcomeEmail(
  to: string,
  name: string,
  role: string,
): Promise<boolean> {
  if (!isEmailEnabled()) return false;
  const { subject, html } = await buildWelcomeEmail(name, role);
  await enqueueEmail("welcome", { to, subject, html });
  return true;
}

export async function enqueueEmailVerificationOTPEmail(
  to: string,
  name: string,
  otp: string,
): Promise<boolean> {
  if (!isEmailEnabled()) return false;
  const { subject, html } = await buildEmailVerificationOTPEmail(name, otp);
  await enqueueEmail("email_verification_otp", { to, subject, html });
  return true;
}

export async function enqueueEmailVerificationLinkEmail(
  to: string,
  name: string,
  token: string,
): Promise<boolean> {
  if (!isEmailEnabled()) return false;
  const { subject, html } = await buildEmailVerificationLinkEmail(name, token);
  await enqueueEmail("email_verification_link", { to, subject, html });
  return true;
}

export async function enqueueForgotPasswordOTPEmail(
  to: string,
  name: string,
  otp: string,
): Promise<boolean> {
  if (!isEmailEnabled()) return false;
  const { subject, html } = await buildForgotPasswordOTPEmail(name, otp);
  await enqueueEmail("password_reset_otp", { to, subject, html });
  return true;
}

export { emailQueue };
