import { z } from "zod";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import type { Environment } from "../config/environment.ts";

const ORIGIN = "https://indianxtrade.com";
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{24,128}$/);
const statusSchema = z.object({
  status: z.enum(["AWAITING_PAYMENT", "PENDING_CONFIRMATION", "COMPLETED", "REJECTED", "EXPIRED"]),
});
export function sharedUpiGateway(env: Environment = process.env) {
  return env.UPI_GATEWAY === "indianxtrade";
}
export function sharedUpiConfigured(env: Environment = process.env) {
  return (
    sharedUpiGateway(env) &&
    !!env.INDIANXTRADE_COLLECTOR_EMAIL?.includes("@") &&
    (env.INDIANXTRADE_COLLECTOR_PASSWORD?.length ?? 0) >= 32 &&
    /^[a-z0-9._-]+@[a-z0-9._-]+$/i.test(env.UPI_COLLECTION_VPA ?? "")
  );
}
export type SharedUpiIntent = {
  token: string;
  uri: string;
  amount: number;
  vpa: string;
  payeeName: string;
  expiresAt: string;
};

/** Uses the existing gateway's authenticated public APIs; no IndianXtrade code is changed. */
export class IndianxtradeGateway {
  private session: string;
  constructor(privateEnv: Environment = process.env, fetcher: typeof fetch = fetch) {
    this.env = privateEnv;
    this.fetcher = fetcher;
    this.session = privateEnv.INDIANXTRADE_SESSION_TOKEN ?? "";
  }
  private env: Environment;
  private fetcher: typeof fetch;
  private async login() {
    if (!sharedUpiConfigured(this.env)) throw new Error("Shared UPI gateway is not configured.");
    const response = await this.fetcher(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGIN },
      body: JSON.stringify({
        email: this.env.INDIANXTRADE_COLLECTOR_EMAIL,
        password: this.env.INDIANXTRADE_COLLECTOR_PASSWORD,
      }),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const cookie = response.headers
      .get("set-cookie")
      ?.match(/(?:^|[,;]\s*)asm_session=([A-Za-z0-9_-]+)/)?.[1];
    if (!response.ok || !cookie)
      throw new Error(
        "Shared payment gateway sign-in is unavailable. Check the saved order before retrying.",
      );
    this.session = cookie;
  }
  private async request(path: string, method = "GET", data?: unknown) {
    if (!this.session) await this.login();
    const send = () =>
      this.fetcher(`${ORIGIN}${path}`, {
        method,
        headers: {
          Cookie: `asm_session=${this.session}`,
          Origin: ORIGIN,
          "Content-Type": "application/json",
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    let response = await send();
    if (response.status === 401) {
      await this.login();
      response = await send();
    }
    if (!response.ok)
      throw new Error(
        `Shared UPI gateway is temporarily unavailable (${response.status}). Check your saved order before retrying.`,
      );
    return response;
  }
  async create(total: number): Promise<SharedUpiIntent> {
    // Its existing minimum is INR 500; reserve below the invoice so its positive offset never overcharges.
    if (!Number.isSafeInteger(total) || total < 51000 || total > 100000000)
      throw new Error("Shared UPI checkout requires a total between INR 510 and INR 10,00,000.");
    const createdAt = Date.now();
    const remote = z
      .object({ checkoutToken: tokenSchema })
      .parse(
        await (
          await this.request("/api/deposits", "POST", { method: "UPI", amountInr: total - 1000 })
        ).json(),
      );
    return this.checkoutIntent(remote.checkoutToken, total, createdAt);
  }
  async checkoutIntent(token: string, total: number, createdAt: number): Promise<SharedUpiIntent> {
    const page = await this.request(`/checkout/${tokenSchema.parse(token)}`);
    const html = await page.text();
    const links = new Set(
      [...html.matchAll(/href="(upi:\/\/pay\?[^"<>]+)"/g)].map((match) =>
        match[1].replaceAll("&amp;", "&"),
      ),
    );
    // The current gateway renders a server-generated QR instead of a deep-link anchor.
    // Decode the original QR locally; never infer the amount from rounded display text.
    if (links.size === 0) {
      const images = new Set(
        [...html.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)].map((match) => match[1]),
      );
      if (images.size > 8) throw new Error("Unexpected gateway payment page.");
      for (const base64 of images) {
        if (base64.length > 350000) continue;
        try {
          const bytes = Buffer.from(base64, "base64");
          if (bytes.length < 24 || bytes.readUInt32BE(16) > 1024 || bytes.readUInt32BE(20) > 1024)
            continue;
          const png = PNG.sync.read(bytes);
          const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
          if (decoded?.data.startsWith("upi://pay?")) links.add(decoded.data);
        } catch {
          /* Ignore non-payment images; fail below if there is no unique UPI QR. */
        }
      }
    }
    if (links.size !== 1)
      throw new Error("Could not read the saved gateway QR. Do not send payment; contact support.");
    const params = new URL([...links][0]).searchParams;
    const rawAmount = params.get("am") ?? "";
    const amount = Math.round(Number(rawAmount) * 100);
    const vpa = params.get("pa") ?? "";
    if (
      !/^\d+\.\d{2}$/.test(rawAmount) ||
      params.get("cu") !== "INR" ||
      amount < total - 1999 ||
      amount > total ||
      vpa.toLowerCase() !== this.env.UPI_COLLECTION_VPA?.toLowerCase()
    )
      throw new Error(
        "The shared gateway payment does not match the saved course total or collection account.",
      );
    return {
      token,
      uri: [...links][0],
      amount,
      vpa,
      payeeName: params.get("pn") || "IndianXtrade",
      expiresAt: new Date(createdAt + 50 * 60000).toISOString(),
    };
  }
  async status(token: string) {
    return statusSchema.parse(
      await (await this.request(`/api/deposits/${tokenSchema.parse(token)}/status`)).json(),
    ).status;
  }
}
