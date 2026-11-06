import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAuthEmailHtml, buildAuthEmailText } from "../backend/auth/email-template";
import { deliverAuthEmail } from "../backend/auth/email";
import { tokenDigest } from "../backend/auth/crypto";
import { emailLogoAttachment } from "../backend/email/logo";
import { EMAIL_LOGO_CID, transactionalEmailHtml } from "../backend/email/template";
import { buildNotificationEmailHtml } from "../backend/notifications/email-template";
import { sendNotification } from "../backend/notifications/delivery";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  sendMail: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../backend/database/supabase", () => ({ createAdminClient: () => mocks }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: mocks.sendMail }) },
}));
const request = vi.fn();
const url =
  "https://academy.example.invalid/auth/confirm?token=single-use-fixture&next=%2Fdashboard";
const input = {
  userId: "user-fixture",
  email: "learner@example.invalid",
  providerHash: "private-provider-hash",
  purpose: "signup" as const,
};

function documentFor(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue(mocks);
  mocks.insert.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue(mocks);
  mocks.eq.mockResolvedValue({ error: null });
  request.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", request);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://academy.example.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-key");
  vi.stubEnv("RESEND_API_KEY", "fixture-email-key");
  vi.stubEnv("RESEND_FROM_EMAIL", "noreply@example.invalid");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("compact authentication emails", () => {
  it.each([
    ["signup", "Verify your email address", "Verify email"],
    ["recovery", "Reset your password", "Reset password"],
    ["invite", "Your team invitation", "Accept invitation"],
  ] as const)("preserves the action and security information for %s", (purpose, title, action) => {
    const html = buildAuthEmailHtml({ url, purpose });
    const doc = documentFor(html);
    expect(doc.querySelector("h1")?.textContent).toBe(title);
    expect(
      [...doc.querySelectorAll("a")].find((a) => a.textContent === action)?.getAttribute("href"),
    ).toBe(url);
    expect(doc.body.textContent).toContain("single-use link expires in 30 minutes");
    expect(doc.body.textContent).toContain("Never share");
    expect(doc.body.textContent).toContain("ignore it");
    expect(doc.querySelector("img")?.getAttribute("src")).toBe(`cid:${EMAIL_LOGO_CID}`);
    expect(doc.querySelectorAll("img")).toHaveLength(1);
    expect(buildAuthEmailText({ url, purpose })).toContain(`${action}:\n${url}`);
  });

  it("escapes dynamic text and attributes rather than interpreting them as HTML", () => {
    const html = transactionalEmailHtml({
      title: '<script>alert("title")</script>',
      preheader: '<img src="bad">',
      paragraphs: ['Course <img src=x onerror="alert(1)"> & access'],
      action: {
        label: "<b>Continue</b>",
        url: 'https://academy.example.invalid/?token=" onmouseover="bad',
      },
    });
    const doc = documentFor(html);
    expect(doc.querySelectorAll("script,[onmouseover],[onerror]")).toHaveLength(0);
    expect(doc.querySelectorAll("img")).toHaveLength(1);
    expect(doc.querySelector("h1")?.textContent).toBe('<script>alert("title")</script>');
    expect(doc.querySelector("a")?.getAttribute("href")).toContain('token=" onmouseover="bad');
  });
});

describe("embedded logo transport", () => {
  it("provides real JPEG bytes and an attachment ID matching the template", async () => {
    const logo = await emailLogoAttachment();
    const bytes = Buffer.from(logo.content, "base64");
    expect([...bytes.subarray(0, 3)]).toEqual([255, 216, 255]);
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes.length).toBeLessThan(50000);
    expect(logo.content_type).toBe("image/jpeg");
    expect(logo.content_id).toBe(EMAIL_LOGO_CID);
  });

  it("sends matching inline content through Resend and retains the original token lifetime", async () => {
    const before = Date.now();
    await deliverAuthEmail(input);
    const payload = JSON.parse(request.mock.calls[0][1].body);
    const doc = documentFor(payload.html);
    const action = new URL(doc.querySelector("a")!.href);
    const saved = mocks.insert.mock.calls[0][0];
    expect(action.origin).toBe("https://academy.example.invalid");
    expect(action.pathname).toBe("/auth/confirm");
    expect(tokenDigest(action.searchParams.get("token")!)).toBe(saved.nonce_hash);
    expect(Date.parse(saved.expires_at)).toBeGreaterThanOrEqual(before + 30 * 60000);
    expect(Date.parse(saved.expires_at)).toBeLessThanOrEqual(Date.now() + 30 * 60000);
    expect(payload.text).toContain(action.toString());
    expect(payload.html).not.toContain(input.providerHash);
    expect(payload.attachments[0].content_id).toBe(EMAIL_LOGO_CID);
    expect(payload.attachments[0].content).toBe((await emailLogoAttachment()).content);
    expect(payload.from).toBe("noreply@example.invalid");
    expect(mocks.update).toHaveBeenCalledWith({ delivery_state: "sent" });
  });

  it("builds a related MIME image for SMTP without a network send", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("GMAIL_USER", "smtp@example.invalid");
    vi.stubEnv("GMAIL_APP_PASSWORD", "fixture-smtp-password");
    const real = await vi.importActual<typeof import("nodemailer")>("nodemailer");
    const transport = real.default.createTransport({
      streamTransport: true,
      buffer: true,
      newline: "unix",
    });
    mocks.sendMail.mockImplementation((options) => transport.sendMail(options));
    await deliverAuthEmail({ ...input, purpose: "recovery" });
    const mime = (await mocks.sendMail.mock.results[0].value).message.toString();
    expect(mime).toContain("multipart/related");
    expect(mime).toContain(`Content-ID: <${EMAIL_LOGO_CID}>`);
    expect(mime).toContain("Content-Disposition: inline");
    expect(mime).toContain("Content-Type: image/jpeg");
    expect(mime).toContain("multipart/alternative");
    expect(request).not.toHaveBeenCalled();
  });

  it("records provider rejection as a failed delivery", async () => {
    request.mockResolvedValue({ ok: false });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(deliverAuthEmail(input)).rejects.toMatchObject({ code: "EMAIL_UNAVAILABLE" });
      expect(mocks.update).toHaveBeenCalledWith({ delivery_state: "failed" });
    } finally {
      log.mockRestore();
    }
  });
});

describe("purchase and refund confirmations", () => {
  const notification = {
    id: "notice-fixture",
    subject: "Your course receipt",
    body: "Payment confirmed for Charts & risk <basics>.\nTotal INR 1999.00.",
    dedupe_key: "purchase:order-fixture",
    attempts: 1,
    claimed_until: new Date(Date.now() + 300000).toISOString(),
    delivery_started_at: new Date().toISOString(),
  };
  it("keeps saved confirmation details and plain text while adding course and billing links", async () => {
    const env = {
      RESEND_API_KEY: "fixture-key",
      RESEND_FROM_EMAIL: "sender@example.invalid",
      NEXT_PUBLIC_APP_URL: "https://academy.example.invalid/",
    };
    expect(await sendNotification(notification, input.email, env, request)).toBe(true);
    const payload = JSON.parse(request.mock.calls[0][1].body);
    const doc = documentFor(payload.html);
    expect(payload.text).toBe(notification.body);
    expect(doc.body.textContent).toContain("Charts & risk <basics>");
    expect(doc.querySelector("basics")).toBeNull();
    expect([...doc.querySelectorAll("a")].map((a) => a.href)).toContain(
      "https://academy.example.invalid/dashboard?view=billing",
    );
    expect(payload.attachments[0].content_id).toBe(EMAIL_LOGO_CID);
    expect(new Headers(request.mock.calls[0][1].headers).get("Idempotency-Key")).toBe(
      notification.dedupe_key,
    );
  });

  it("does not invent settled-refund claims", () => {
    const doc = documentFor(
      buildNotificationEmailHtml(
        {
          ...notification,
          dedupe_key: "refund:fixture:approved",
          subject: "Refund request update",
          body: "Payment-provider processing has not started; approval is not settlement.",
        },
        "https://academy.example.invalid",
      ),
    );
    expect(doc.querySelector("h1")?.textContent).toBe("Refund request update");
    expect(doc.body.textContent).toContain("approval is not settlement");
    expect(doc.body.textContent).not.toContain("Open my courses");
  });

  it("turns saved course and receipt URLs into short actions without losing purchase details", () => {
    const course = "https://academy.example.invalid/learn/basic-to-advance";
    const receipt = "https://academy.example.invalid/dashboard/orders/fixture/receipt";
    const doc = documentFor(
      buildNotificationEmailHtml(
        {
          ...notification,
          body: `Total INR 1999.00. Order fixture\nCourse: ${course}\nReceipt: ${receipt}`,
        },
        "https://academy.example.invalid",
      ),
    );
    expect(doc.body.textContent).toContain("Total INR 1999.00. Order fixture");
    expect(doc.body.textContent).not.toContain("https://academy.example.invalid");
    expect(doc.querySelector('a[href="' + course + '"]')?.textContent).toBe("Open my courses");
    expect(doc.querySelector('a[href="' + receipt + '"]')?.textContent).toBe("View receipt");
  });

  it("does not turn an untrusted receipt URL into an action", () => {
    const doc = documentFor(
      buildNotificationEmailHtml(
        {
          ...notification,
          body: "Receipt: https://other.example.invalid/dashboard/orders/fixture/receipt",
        },
        "https://academy.example.invalid",
      ),
    );
    expect(doc.body.textContent).toContain("Receipt: https://other.example.invalid");
    expect(doc.querySelector('a[href^="https://other.example.invalid"]')).toBeNull();
  });

  it.each([undefined, "javascript:alert(1)", "http://untrusted.example.invalid"])(
    "omits dashboard links when the public URL is invalid: %s",
    (origin) => {
      const doc = documentFor(buildNotificationEmailHtml(notification, origin));
      expect([...doc.querySelectorAll("a")].map((a) => a.href)).toEqual([
        "mailto:support@indianxtrade.com",
      ]);
    },
  );
});
