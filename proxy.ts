import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { contentSecurityPolicy } from "./backend/security/content-policy";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const nextResponse = () => {
    const next = NextResponse.next({ request: { headers: requestHeaders } });
    next.headers.set("Content-Security-Policy", policy);
    next.headers.set("Cache-Control", "private, no-store");
    return next;
  };
  let response = nextResponse();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-")))
    return response;
  const remember = request.cookies.get("mm_remember")?.value === "1";
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        requestHeaders.set("cookie", request.cookies.toString());
        response = nextResponse();
        for (const { name, value, options } of values)
          response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            secure: process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") === true,
            sameSite: "lax",
            path: "/",
            maxAge: options.maxAge === 0 ? 0 : remember ? 60 * 60 * 24 * 30 : undefined,
            expires: undefined,
          });
      },
    },
  });
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images/|videos/|favicon.ico|robots.txt|sitemap.xml|opengraph-image).*)",
  ],
};
