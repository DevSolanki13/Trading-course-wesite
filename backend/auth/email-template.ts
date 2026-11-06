import { transactionalEmailHtml } from "../email/template.ts";

export type AuthEmailPurpose = "signup" | "recovery" | "invite";

const messages = {
  signup: {
    title: "Verify your email address",
    intro: "Welcome to indianXtrade. Confirm your email address to activate your student account.",
    action: "Verify email",
  },
  recovery: {
    title: "Reset your password",
    intro:
      "We received a password reset request for your indianXtrade account. Choose a new password below.",
    action: "Reset password",
  },
  invite: {
    title: "Your team invitation",
    intro:
      "You’ve been invited to the indianXtrade staff workspace. Accept your invitation to set up your access.",
    action: "Accept invitation",
  },
} satisfies Record<AuthEmailPurpose, { title: string; intro: string; action: string }>;

const securityNote =
  "This single-use link expires in 30 minutes. Never share it or your password. If you didn’t request this email, you can ignore it.";

export function buildAuthEmailHtml(input: { url: string; purpose: AuthEmailPurpose }): string {
  const message = messages[input.purpose];
  return transactionalEmailHtml({
    title: message.title,
    preheader: message.intro,
    paragraphs: [message.intro],
    action: { label: message.action, url: input.url },
    note: securityNote,
    fallbackUrl: input.url,
  });
}

export function buildAuthEmailText(input: { url: string; purpose: AuthEmailPurpose }): string {
  const message = messages[input.purpose];
  return `indianXtrade | ${message.title}\n\n${message.intro}\n\n${message.action}:\n${input.url}\n\n${securityNote}\n\nNeed help? support@indianxtrade.com`;
}
