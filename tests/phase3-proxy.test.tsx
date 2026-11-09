import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { proxy, config } from "../proxy";

const mocks = vi.hoisted(() => ({ create: vi.fn(), user: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LOCAL_DEMO", "false");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fixture-publishable");
  mocks.create.mockReturnValue({ auth: { getUser: mocks.user } });
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
});
afterEach(() => vi.unstubAllEnvs());
const image = "/api/course-thumbnails/11111111-1111-4111-8111-111111111111";
function request(path: string, method = "GET") {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { cookie: "sb-fixture-auth-token=fixture" },
  });
}

it("does not invoke session refresh for valid public thumbnail GET/HEAD requests", async () => {
  for (const method of ["GET", "HEAD"]) {
    const response = await proxy(request(`${image}?w=160`, method));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  }
  expect(mocks.create).not.toHaveBeenCalled();
});

it("retains auth refresh and no-store for other APIs, malformed IDs and unsupported methods", async () => {
  for (const [path, method] of [
    ["/api/admin/orders", "GET"],
    ["/api/purchase/orders", "GET"],
    ["/api/auth/me", "GET"],
    ["/api/course-thumbnails/not-a-uuid", "GET"],
    [image, "POST"],
  ]) {
    const response = await proxy(request(path, method));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  }
  expect(mocks.user).toHaveBeenCalledTimes(5);
});

it("exempts only the two exact favicon paths, not similarly named private routes", () => {
  for (const url of ["/favicon-dark.png", "/favicon-light.png"])
    expect(doesProxyMatch({ config, url })).toBe(false);
  for (const url of [
    "/favicon-light.png/private",
    "/dashboard",
    "/account",
    "/admin",
    "/api/admin/orders",
    "/api/course-thumbnails/private/file",
  ])
    expect(doesProxyMatch({ config, url })).toBe(true);
});
