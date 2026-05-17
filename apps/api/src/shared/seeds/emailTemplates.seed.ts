import { EmailTemplate, type EmailTemplateType } from "@shared/models";

export interface EmailTemplateSeed {
  templateKey: string;
  type: EmailTemplateType;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate?: string;
}

type EmailLayoutInput = {
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  children: string;
  cta?: {
    href: string;
    label: string;
  };
  note?: string;
  footerNote?: string;
};

const BRAND = {
  name: "InteraOne",
  primary: "#845c6c",
  ink: "#22212a",
  panel: "#342936",
  muted: "#6f6a73",
  soft: "#f7f4f5",
  border: "#e7e1e4",
  card: "#fffdfb",
  success: "#5d9658",
  warning: "#da8620",
  danger: "#b94745",
};

const currentYear = new Date().getFullYear();
const headerLogoUrl = "https://avatars.githubusercontent.com/u/222506196?s=200&v=4";

const logoMarkup = `
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr>
    <td width="44" height="44" style="width:44px;height:44px;">
      <img src="${headerLogoUrl}" width="44" height="44" alt="InteraOne" style="display:block;width:44px;height:44px;border:0;border-radius:11px;outline:none;text-decoration:none;">
    </td>
    <td width="14" style="width:14px;font-size:0;line-height:0;">&nbsp;</td>
    <td style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:20px;line-height:24px;font-weight:700;letter-spacing:-0.02em;color:${BRAND.ink};vertical-align:middle;">InteraOne</td>
  </tr>
</table>`.trim();

const styles = `
body{margin:0;padding:0;background:${BRAND.soft};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}
img{border:0;outline:none;text-decoration:none;}
a{text-decoration:none;}
.email-shell{width:100%;background:${BRAND.soft};}
.email-container{width:100%;max-width:640px;margin:0 auto;}
.email-pad{padding:28px 20px;}
.brand-row{padding:8px 4px 22px;}
.card{background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;box-shadow:0 16px 42px rgba(52,41,54,0.08);}
.hero{background:${BRAND.primary};padding:34px 40px 30px;}
.eyebrow{font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#d8cbd1;margin:0 0 14px;}
.hero-title{font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:32px;line-height:38px;font-weight:700;letter-spacing:-0.03em;color:#ffffff;margin:0;}
.hero-copy{font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:16px;line-height:25px;color:#efe8eb;margin:14px 0 0;}
.content{padding:34px 40px 38px;}
.text{font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:15px;line-height:24px;color:${BRAND.ink};margin:0 0 16px;}
.muted{color:${BRAND.muted};}
.section-title{font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;color:${BRAND.ink};margin:0 0 12px;}
.panel{background:#fbf8f9;border:1px solid ${BRAND.border};border-radius:12px;padding:18px 20px;margin:22px 0;}
.button{display:inline-block;background:${BRAND.primary};border:1px solid ${BRAND.primary};border-radius:8px;color:#ffffff !important;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:700;padding:13px 20px;text-align:center;}
.button-row{padding:8px 0 10px;}
.code{font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;line-height:42px;font-weight:700;letter-spacing:0.18em;color:${BRAND.ink};background:#ffffff;border:1px solid ${BRAND.border};border-radius:12px;padding:18px 20px;text-align:center;}
.meta{font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:13px;line-height:20px;color:${BRAND.muted};margin:0;}
.divider{height:1px;background:${BRAND.border};line-height:1px;font-size:1px;margin:24px 0;}
.footer{padding:22px 4px 0;text-align:center;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:12px;line-height:19px;color:${BRAND.muted};}
.list-item{font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:14px;line-height:22px;color:${BRAND.ink};padding:0 0 10px;}
.status-pill{display:inline-block;border-radius:999px;padding:6px 10px;background:#f0eaed;color:${BRAND.primary};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:12px;line-height:14px;font-weight:700;}
@media only screen and (max-width:640px){
  .email-pad{padding:18px 12px !important;}
  .brand-row{padding:4px 4px 16px !important;}
  .hero{padding:28px 22px 24px !important;}
  .content{padding:26px 22px 30px !important;}
  .hero-title{font-size:26px !important;line-height:32px !important;}
  .hero-copy{font-size:15px !important;line-height:23px !important;}
  .button{display:block !important;width:auto !important;}
  .code{font-size:28px !important;line-height:36px !important;letter-spacing:0.14em !important;}
}
`.trim();

function renderLayout(input: EmailLayoutInput): string {
  const ctaMarkup = input.cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" class="button-row">
        <tr>
          <td>
            <a href="${input.cta.href}" class="button">${input.cta.label}</a>
          </td>
        </tr>
      </table>`
    : "";

  const noteMarkup = input.note
    ? `<div class="panel"><p class="meta">${input.note}</p></div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${input.title}</title>
  <style>${styles}</style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${input.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-shell">
    <tr>
      <td align="center" class="email-pad">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-container">
          <tr>
            <td class="brand-row">${logoMarkup}</td>
          </tr>
          <tr>
            <td class="card">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="hero">
                    <p class="eyebrow">${input.eyebrow}</p>
                    <h1 class="hero-title">${input.title}</h1>
                    <p class="hero-copy">${input.intro}</p>
                  </td>
                </tr>
                <tr>
                  <td class="content">
                    ${input.children}
                    ${ctaMarkup}
                    ${noteMarkup}
                    <div class="divider">&nbsp;</div>
                    <p class="meta">${input.footerNote || "This message was sent by InteraOne. If this was not expected, you can safely ignore it."}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="footer">
              &copy; ${currentYear} InteraOne. Intelligent customer conversations for modern teams.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function otpBlock(otpColor = BRAND.primary): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;">
  <tr>
    <td class="code" style="color:${otpColor};">{{otp}}</td>
  </tr>
</table>`.trim();
}

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplateSeed[] = [
  {
    templateKey: "global.email_verification_link",
    type: "email_verification_link",
    subjectTemplate: "Verify your InteraOne email address",
    htmlTemplate: renderLayout({
      preheader: "Use this secure link to verify your InteraOne account.",
      eyebrow: "Account verification",
      title: "Verify your email address",
      intro: "Confirm your email to continue setting up your InteraOne workspace.",
      children: `
        <p class="text">Hi {{name}},</p>
        <p class="text muted">Use the secure link below to verify your email address. This link is short lived to protect your workspace access.</p>
      `,
      cta: {
        href: "{{verificationUrl}}",
        label: "Verify email address",
      },
      note: "This verification link expires in 10 minutes. You can request a new one from the authentication screen.",
      footerNote: "If you did not create an InteraOne account, no action is required.",
    }),
    textTemplate: "Hi {{name}}, verify your InteraOne email address: {{verificationUrl}}. This link expires in 10 minutes.",
  },
  {
    templateKey: "global.email_verification_otp",
    type: "email_verification_otp",
    subjectTemplate: "{{otp}} is your InteraOne verification code",
    htmlTemplate: renderLayout({
      preheader: "Use this code to finish setting up your InteraOne account.",
      eyebrow: "Account verification",
      title: "Verify your InteraOne account",
      intro: "Confirm your email address to continue into your workspace.",
      children: `
        <p class="text">Hi {{name}},</p>
        <p class="text muted">Enter this verification code in the signup window. It is intentionally short lived to protect your workspace access.</p>
        ${otpBlock()}
        <p class="meta">This code expires in <strong>2 minutes</strong>. Do not share it with anyone.</p>
      `,
      note: "You are receiving this because someone started an InteraOne account registration with this email address.",
      footerNote: "If you did not create an InteraOne account, no action is required.",
    }),
    textTemplate: "Hi {{name}}, use {{otp}} to verify your InteraOne account. This code expires in 2 minutes.",
  },
  {
    templateKey: "global.password_reset_otp",
    type: "password_reset_otp",
    subjectTemplate: "{{otp}} is your InteraOne password reset code",
    htmlTemplate: renderLayout({
      preheader: "Use this secure code to reset your InteraOne password.",
      eyebrow: "Password recovery",
      title: "Secure password reset",
      intro: "Use the code below to continue resetting your password.",
      children: `
        <p class="text">Hi {{name}},</p>
        <p class="text muted">We received a request to reset your InteraOne password. Enter this code in the recovery screen to continue.</p>
        ${otpBlock(BRAND.danger)}
        <p class="meta">This code expires in <strong>2 minutes</strong>. If you did not request it, your password has not been changed.</p>
      `,
      note: "For security, InteraOne support will never ask you to share this code.",
      footerNote: "If you did not request a password reset, you can ignore this email.",
    }),
    textTemplate: "Hi {{name}}, use {{otp}} to reset your InteraOne password. This code expires in 2 minutes.",
  },
  {
    templateKey: "global.password_reset",
    type: "password_reset",
    subjectTemplate: "Reset your InteraOne password",
    htmlTemplate: renderLayout({
      preheader: "Reset your password securely from this InteraOne link.",
      eyebrow: "Security request",
      title: "Reset your password",
      intro: "A password reset was requested for your InteraOne account.",
      children: `
        <p class="text">Hi {{name}},</p>
        <p class="text muted">Use the secure link below to choose a new password. This keeps your workspace protected while giving you quick access back to your account.</p>
      `,
      cta: {
        href: "{{resetUrl}}",
        label: "Reset password",
      },
      note: "This link expires in 10 minutes. If it expires, you can request a new password reset from the login page.",
      footerNote: "If you did not request this password reset, you can safely ignore this email.",
    }),
    textTemplate: "Hi {{name}}, reset your InteraOne password here: {{resetUrl}}. This link expires in 10 minutes.",
  },
  {
    templateKey: "global.invite",
    type: "invite",
    subjectTemplate: "You're invited to join InteraOne as a {{role}}",
    htmlTemplate: renderLayout({
      preheader: "{{inviterName}} invited you to join an InteraOne workspace.",
      eyebrow: "Workspace invitation",
      title: "Join your team on InteraOne",
      intro: "{{titleText}}",
      children: `
        <p class="text">Hello,</p>
        <p class="text muted">{{bodyText}}</p>
        <div class="panel">
          <p class="section-title">What happens next</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td class="list-item">1. Accept the invitation using the secure link below.</td></tr>
            <tr><td class="list-item">2. Set up your account access.</td></tr>
            <tr><td class="list-item">3. Start collaborating with your workspace team.</td></tr>
          </table>
        </div>
      `,
      cta: {
        href: "{{inviteUrl}}",
        label: "Accept invitation",
      },
      note: "This invitation expires in 7 days. Ask your workspace owner to resend it if the link expires.",
      footerNote: "If you were not expecting this invitation, you can safely ignore this email.",
    }),
    textTemplate: "{{inviterName}} invited you to join InteraOne as a {{role}}. Accept the invitation: {{inviteUrl}}",
  },
  {
    templateKey: "global.welcome",
    type: "welcome",
    subjectTemplate: "Welcome to InteraOne. Your workspace is ready.",
    htmlTemplate: renderLayout({
      preheader: "Your InteraOne account is ready to use.",
      eyebrow: "Welcome",
      title: "Your workspace is ready",
      intro: "InteraOne is set up for focused, high quality customer conversations.",
      children: `
        <p class="text">Hi {{name}},</p>
        <p class="text muted">Your account is active with <strong>{{role}}</strong> access. You can now enter the dashboard, configure your widget, invite teammates, and monitor conversations from one workspace.</p>
        <div class="panel">
          <p class="section-title">Recommended first steps</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td class="list-item">Set your workspace profile and business details.</td></tr>
            <tr><td class="list-item">Customize the chat widget to match your brand.</td></tr>
            <tr><td class="list-item">Review routing, member roles, and analytics.</td></tr>
          </table>
        </div>
      `,
      cta: {
        href: "{{loginUrl}}",
        label: "Open dashboard",
      },
      footerNote: "You are receiving this because your InteraOne account was created successfully.",
    }),
    textTemplate: "Hi {{name}}, welcome to InteraOne. Open your dashboard: {{loginUrl}}",
  },
  {
    templateKey: "global.notification",
    type: "notification",
    subjectTemplate: "{{title}}",
    htmlTemplate: renderLayout({
      preheader: "{{message}}",
      eyebrow: "Workspace notification",
      title: "{{title}}",
      intro: "A workspace update is available in InteraOne.",
      children: `
        <p class="text">Hi {{name}},</p>
        <p class="text muted">{{message}}</p>
        <div class="panel">
          <span class="status-pill">{{status}}</span>
          <p class="meta" style="margin-top:12px;">Open InteraOne to review the latest details and take action if needed.</p>
        </div>
      `,
      cta: {
        href: "{{actionUrl}}",
        label: "{{actionLabel}}",
      },
      footerNote: "You are receiving this because notifications are enabled for your InteraOne workspace.",
    }),
    textTemplate: "{{title}}\n\n{{message}}\n\n{{actionLabel}}: {{actionUrl}}",
  },
  {
    templateKey: "global.alert",
    type: "alert",
    subjectTemplate: "InteraOne alert: {{title}}",
    htmlTemplate: renderLayout({
      preheader: "{{message}}",
      eyebrow: "Workspace alert",
      title: "{{title}}",
      intro: "InteraOne detected an item that may need your attention.",
      children: `
        <p class="text">Hi {{name}},</p>
        <p class="text muted">{{message}}</p>
        <div class="panel" style="border-color:#ead3d2;background:#fff8f7;">
          <p class="section-title" style="color:${BRAND.danger};">Recommended action</p>
          <p class="meta">{{recommendation}}</p>
        </div>
      `,
      cta: {
        href: "{{actionUrl}}",
        label: "{{actionLabel}}",
      },
      footerNote: "You are receiving this alert because you are listed as a workspace admin or owner.",
    }),
    textTemplate: "InteraOne alert: {{title}}\n\n{{message}}\n\nRecommended action: {{recommendation}}\n\n{{actionLabel}}: {{actionUrl}}",
  },
];

export async function seedEmailTemplates(): Promise<{
  inserted: number;
}> {
  const operations = DEFAULT_EMAIL_TEMPLATES.map((template) => ({
    updateOne: {
      // Match by templateKey first, but also by legacy type-only records so
      // startup seeding can backfill templateKey without creating duplicates.
      filter: {
        $or: [{ templateKey: template.templateKey }, { type: template.type }],
      },
      update: {
        $set: {
          templateKey: template.templateKey,
          type: template.type,
          subjectTemplate: template.subjectTemplate,
          htmlTemplate: template.htmlTemplate,
          textTemplate: template.textTemplate || "",
        },
        $setOnInsert: {
          isActive: true,
        },
      },
      upsert: true,
    },
  }));

  const result = await EmailTemplate.bulkWrite(operations, { ordered: true });
  return { inserted: result.upsertedCount || 0 };
}
