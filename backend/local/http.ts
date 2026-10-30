import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  localSession,
  localSignIn,
  localSignUp,
  localSignOut,
  localRateLimit,
  LOCAL_SESSION_COOKIE,
} from "./auth";
import { AuthError, body, failure, json } from "../auth/http";
import { safeNext } from "../auth/policy";
export function purchaseOrigin(request: Request) {
  const expected = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
    : new URL(request.url).origin;
  const incoming = request.headers.get("origin");
  if (incoming === expected) return;
  try {
    const a = new URL(incoming ?? ""),
      b = new URL(expected);
    if (
      ["127.0.0.1", "localhost"].includes(a.hostname) &&
      ["127.0.0.1", "localhost"].includes(b.hostname) &&
      a.port === b.port &&
      a.protocol === b.protocol
    )
      return;
  } catch {}
  throw new AuthError(403, "This request must come from the application.");
}
export async function localAuthRequest(request: Request) {
  try {
    const action = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
    const jar = await cookies();
    if (request.method === "GET") {
      if (action === "options")
        return json({
          googleEnabled: false,
          localDemo: true,
          demoLoginHint: process.env.NODE_ENV !== "production",
        });
      const user = await localSession(jar.get(LOCAL_SESSION_COOKIE)?.value);
      if (action === "status") return json({ authenticated: !!user, localDemo: true });
      if (action === "me" && user)
        return json({ user: { ...user, aal: "local-demo" }, localDemo: true });
      return json({ error: "Please sign in to continue." }, 401);
    }
    purchaseOrigin(request);
    if (action === "logout") {
      await localSignOut(jar.get(LOCAL_SESSION_COOKIE)?.value);
      jar.delete(LOCAL_SESSION_COOKIE);
      return json({ redirect: "/login" });
    }
    if (!["login", "signup"].includes(action))
      return json(
        { error: "This account feature requires the configured authentication service." },
        503,
      );
    const input = z
      .object({
        email: z
          .string()
          .trim()
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
        password: z.string().min(1).max(72),
        name: z.string().trim().min(2).max(100).optional(),
        next: z.string().optional(),
        remember: z.boolean().optional(),
        admin: z.boolean().optional(),
        phone: z.string().optional(),
      })
      .strict()
      .parse(await body(request));
    if (Buffer.byteLength(input.password, "utf8") > 72)
      throw new AuthError(400, "Use a password no longer than 72 UTF-8 bytes.");
    await localRateLimit(`login:${input.email}`);
    if (action === "signup" && (input.password.length < 12 || !input.name))
      throw new AuthError(400, "Provide a name and a password of at least 12 characters.");
    const token =
      action === "signup"
        ? await localSignUp(input.name!, input.email, input.password)
        : await localSignIn(input.email, input.password);
    jar.set(LOCAL_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 604800,
    });
    return json({ redirect: safeNext(input.next, "/dashboard") });
  } catch (error) {
    if (error instanceof z.ZodError)
      return json({ error: "Check your email, password and name." }, 400);
    if (error && typeof error === "object" && "status" in error)
      return json(
        { error: error instanceof Error ? error.message : "Sign in failed." },
        Number(error.status),
      );
    return failure(error);
  }
}
