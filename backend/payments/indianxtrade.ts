import { z } from "zod";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { createHash } from "node:crypto";
import type { Environment } from "../config/environment.ts";
import { GatewayError } from "./gateway-error.ts";

const ORIGIN = "https://indianxtrade.com";
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{24,128}$/);
const statusSchema = z.object({
  status: z.enum(["AWAITING_PAYMENT", "PENDING_CONFIRMATION", "COMPLETED", "REJECTED", "EXPIRED"]),
});
export function sharedUpiGateway(env: Environment = process.env) {
  return env.UPI_GATEWAY === "indianxtrade";
}
export function sharedCollectionVpas(env: Environment = process.env): string[] {
  const entries = (env.UPI_COLLECTION_VPAS?.trim() || env.UPI_COLLECTION_VPA || "")
    .split(",")
    .map((vpa) => vpa.trim().toLowerCase());
  if (
    entries.length > 32 ||
    entries.some((vpa) => !/^[a-z0-9._-]{1,256}@[a-z0-9._-]{1,64}$/.test(vpa))
  )
    return [];
  return [...new Set(entries)];
}
export function sharedUpiConfigured(env: Environment = process.env) {
  return (
    sharedUpiGateway(env) &&
    !!env.INDIANXTRADE_COLLECTOR_EMAIL?.includes("@") &&
    (env.INDIANXTRADE_COLLECTOR_PASSWORD?.length ?? 0) >= 32 &&
    sharedCollectionVpas(env).length > 0
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
    let response: Response;
    try {
      response = await this.fetcher(`${ORIGIN}/api/auth/login`, {
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
    } catch {
      const error = new GatewayError("GATEWAY_UNAVAILABLE");
      error.safeToRetryCreation = true;
      throw error;
    }
    const cookie = response.headers
      .get("set-cookie")
      ?.match(/(?:^|[,;]\s*)asm_session=([A-Za-z0-9_-]+)/)?.[1];
    if (!response.ok || !cookie) {
      const error = new GatewayError("GATEWAY_UNAVAILABLE");
      error.safeToRetryCreation = true;
      throw error;
    }
    this.session = cookie;
  }
  private async request(path: string, method = "GET", data?: unknown) {
    if (!this.session) await this.login();
    const send = async () => {
      try {
        return await this.fetcher(`${ORIGIN}${path}`, {
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
      } catch {
        throw new GatewayError("GATEWAY_UNAVAILABLE");
      }
    };
    let response = await send();
    if (response.status === 401) {
      await this.login();
      response = await send();
    }
    if (!response.ok) {
      const error = new GatewayError("GATEWAY_UNAVAILABLE");
      error.safeToRetryCreation =
        response.status >= 400 && response.status < 500 && response.status !== 408;
      throw error;
    }
    return response;
  }
  async create(total: number): Promise<string> {
    if (!sharedUpiConfigured(this.env)) {
      const error = new GatewayError("GATEWAY_CONFIGURATION");
      error.safeToRetryCreation = true;
      throw error;
    }
    // Its existing minimum is INR 500; reserve below the invoice so its positive offset never overcharges.
    if (!Number.isSafeInteger(total) || total < 51000 || total > 100000000) {
      const error = new GatewayError("TOTAL_UNSUPPORTED");
      error.safeToRetryCreation = true;
      throw error;
    }
    const response = await this.request("/api/deposits", "POST", {
      method: "UPI",
      amountInr: total - 1000,
    });
    try {
      return z.object({ checkoutToken: tokenSchema }).parse(await response.json()).checkoutToken;
    } catch {
      // A successful POST with an unreadable response may already have reserved a deposit.
      throw new GatewayError("GATEWAY_RESPONSE");
    }
  }
  async checkoutIntent(token: string, total: number, createdAt: number): Promise<SharedUpiIntent> {
    if (!Number.isFinite(createdAt) || createdAt + 50 * 60000 <= Date.now())
      throw new GatewayError("SETUP_EXPIRED");
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
      if (images.size > 8) throw new GatewayError("QR_EXTRACTION");
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
    if (links.size !== 1) throw new GatewayError("QR_EXTRACTION");
    const uri = [...links][0];
    if (uri.length > 4096) throw new GatewayError("UPI_PARAMETERS");
    const params = new URL(uri).searchParams;
    const keys = [...params.keys()];
    if (new Set(keys).size !== keys.length) throw new GatewayError("UPI_PARAMETERS");
    const rawAmount = params.get("am") ?? "";
    if (!/^\d{1,8}\.\d{2}$/.test(rawAmount)) throw new GatewayError("AMOUNT_FORMAT");
    const [rupees, paise] = rawAmount.split(".");
    const amount = Number(rupees) * 100 + Number(paise);
    const vpa = params.get("pa") ?? "";
    const details = { expectedAmount: total, amount };
    if (params.get("cu") !== "INR")
      throw new GatewayError("CURRENCY_MISMATCH", {
        ...details,
        currency: /^[A-Z]{3}$/.test(params.get("cu") ?? "") ? params.get("cu")! : "invalid",
      });
    if (!Number.isSafeInteger(total) || amount < total - 1999 || amount > total)
      throw new GatewayError("AMOUNT_MISMATCH", details);
    if (!sharedCollectionVpas(this.env).includes(vpa.toLowerCase()))
      throw new GatewayError("ACCOUNT_MISMATCH", {
        ...details,
        accountHash: createHash("sha256").update(vpa.toLowerCase()).digest("hex").slice(0, 16),
      });
    return {
      token,
      uri,
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
