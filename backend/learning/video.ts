import "server-only";
import { requireEnv } from "../config/env";
import { AuthError } from "../auth/http";
export async function playbackCredentials(videoId: string, watermark: string) {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(videoId))
    throw new AuthError(503, "This lesson video is not configured.");
  try {
    const response = await fetch(
      `https://dev.vdocipher.com/api/videos/${encodeURIComponent(videoId)}/otp`,
      {
        method: "POST",
        headers: {
          Authorization: `Apisecret ${requireEnv("VDOCIPHER_API_SECRET")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ttl: 120,
          annotate: JSON.stringify([
            {
              type: "rtext",
              text: watermark.slice(0, 254),
              alpha: "0.65",
              color: "0xFFFFFF",
              size: "15",
              interval: "5000",
              skip: "1000",
            },
          ]),
        }),
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error("PROVIDER_FAILED");
    const data = await response.json();
    if (typeof data.otp !== "string" || typeof data.playbackInfo !== "string")
      throw new Error("INVALID_PROVIDER_RESPONSE");
    return { otp: data.otp as string, playbackInfo: data.playbackInfo as string };
  } catch {
    throw new AuthError(
      503,
      "Protected playback is temporarily unavailable. Please retry.",
      "VIDEO_UNAVAILABLE",
    );
  }
}
