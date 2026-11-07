import { configuredValue, type Environment } from "../config/environment.ts";

export function upiConfig(env: Environment = process.env) {
  const vpa = env.UPI_COLLECTION_VPA?.trim() ?? "";
  const markers = (env.UPI_ACCOUNT_MARKERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const senders = (env.UPI_RELAY_SENDERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const secret = env.SMS_RELAY_SECRET?.trim() ?? "";
  const enabled =
    env.PAYMENT_PROVIDER === "upi" &&
    env.UPI_PAYMENTS_ENABLED === "on" &&
    /^[a-z0-9.\-_]{2,256}@[a-z0-9.\-_]{2,64}$/i.test(vpa) &&
    configuredValue(secret) &&
    secret.length >= 32 &&
    markers.length > 0 &&
    senders.length > 0;
  return {
    enabled,
    vpa,
    markers,
    senders,
    secret,
    payeeName: env.UPI_PAYEE_NAME?.trim() || "IndianXtrade Academy",
  };
}

/** Match a destination account from the bank's message, never a client-supplied label. */
export function academyCreditMessage(sender: string, body: string, env: Environment = process.env) {
  const config = upiConfig(env);
  return (
    config.senders.some((s) => sender.toLowerCase().includes(s.toLowerCase())) &&
    config.markers.some((s) => body.toLowerCase().includes(s.toLowerCase()))
  );
}

export function upiLink(vpa: string, payeeName: string, amount: number, orderId: string) {
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: (amount / 100).toFixed(2),
    cu: "INR",
    tn: `Academy ${orderId}`,
  });
  return `upi://pay?${params}`;
}
