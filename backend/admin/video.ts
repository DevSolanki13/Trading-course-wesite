import "server-only";
import { requireEnv } from "../config/env";
import { AuthError } from "../auth/http";
async function provider(path: string, method = "GET") {
  try {
    const r = await fetch(`https://dev.vdocipher.com/api/${path}`, {
      method,
      headers: { Authorization: `Apisecret ${requireEnv("VDOCIPHER_API_SECRET")}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error("PROVIDER_FAILED");
    return await r.json();
  } catch {
    throw new AuthError(503, "The video provider is temporarily unavailable. Retry later.");
  }
}
export async function videoStatus(id: string) {
  const d = await provider(`videos/${encodeURIComponent(id)}`);
  return {
    status: String(d.status ?? "unknown"),
    duration: typeof d.length === "number" ? Math.ceil(d.length) : 0,
  };
}
export async function videoUpload(title: string) {
  const d = await provider(`videos?title=${encodeURIComponent(title)}`, "PUT");
  const p = d.clientPayload as Record<string, string> | undefined;
  let safe = false;
  try {
    const u = new URL(p?.uploadLink ?? "");
    safe =
      u.protocol === "https:" &&
      u.hostname.endsWith(".amazonaws.com") &&
      !u.username &&
      !u.password;
  } catch {}
  if (!safe || typeof d.videoId !== "string" || !p)
    throw new AuthError(503, "The provider did not return a supported upload target.");
  return {
    videoId: d.videoId as string,
    uploadLink: p.uploadLink,
    fields: Object.fromEntries(
      ["policy", "key", "x-amz-signature", "x-amz-algorithm", "x-amz-date", "x-amz-credential"].map(
        (k) => [k, p[k]],
      ),
    ),
  };
}
