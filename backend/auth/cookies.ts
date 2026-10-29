import "server-only";
export function secureCookies() {
  return process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") === true;
}
export function cookiePolicy(remember = false) {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax" as const,
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  };
}
