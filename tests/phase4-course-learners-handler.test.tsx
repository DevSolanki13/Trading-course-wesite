import { beforeEach, expect, it, vi } from "vitest";
import { adminLearnersRequest } from "../backend/handlers/admin-learners";
import { adminRequest } from "../backend/handlers/admin";
import { GET } from "../app/api/admin/course-learners/route";
import { AuthError } from "../backend/auth/http";

const mocks = vi.hoisted(() => ({
  local: false,
  user: { id: "local-staff", role: "support" } as { id: string; role: string } | null,
  privileged: vi.fn(),
  rpc: vi.fn(),
  query: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("../backend/auth/session", () => ({ privileged: mocks.privileged }));
vi.mock("../backend/purchase/mode", () => ({ localDemoEnabled: () => mocks.local }));
vi.mock("../backend/local/auth", () => ({
  LOCAL_SESSION_COOKIE: "local",
  localSession: async () => mocks.user,
}));
vi.mock("../backend/local/database", () => ({
  localDatabase: async () => ({ query: mocks.query }),
}));
const course = "11111111-1111-4111-8111-111111111111";
const learner = "22222222-2222-4222-8222-222222222222";
const request = (query = `courseId=${course}`) =>
  new Request(`http://localhost/api/admin/course-learners?${query}`);

it("legacy handler delegates learner reads to the bounded support-compatible RPC", async () => {
  expect((await adminRequest(request())).status).toBe(200);
  expect(mocks.privileged).toHaveBeenCalledWith(false);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("admin_course_learner_page", {
    p_actor: "staff",
    p_session: "session",
    p_course: course,
    p_query: "",
    p_page: 0,
    p_access: "all",
    p_learner: null,
  });
});

it("legacy local handler delegates before its old unbounded learner helper", async () => {
  mocks.local = true;
  expect((await adminRequest(request())).status).toBe(200);
  expect(mocks.query).toHaveBeenCalledExactlyOnceWith(
    "select public.admin_course_learner_read($1,$2,$3,$4,$5,true) as result",
    [course, "", 0, "all", null],
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.local = false;
  mocks.user = { id: "local-staff", role: "support" };
  mocks.privileged.mockResolvedValue({
    user: { id: "staff" },
    sessionId: "session",
    admin: { rpc: mocks.rpc },
  });
  mocks.rpc.mockResolvedValue({ data: { learners: [], total: 0 }, error: null });
  mocks.query.mockResolvedValue({ rows: [{ result: { learners: [], total: 0 } }] });
});
it("dedicated route exports the bounded handler with support authorization and private responses", async () => {
  expect(GET).toBe(adminLearnersRequest);
  const response = await GET(
    request(`courseId=${course}&learnerId=${learner}&page=2&access=active&q=a%25_`),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.privileged).toHaveBeenCalledWith(false);
  expect(mocks.rpc).toHaveBeenCalledWith("admin_course_learner_page", {
    p_actor: "staff",
    p_session: "session",
    p_course: course,
    p_learner: learner,
    p_page: 2,
    p_access: "active",
    p_query: "a%_",
  });
});
it.each([401, 403])(
  "preserves hosted session/MFA/role rejection %s without reading learner data",
  async (status) => {
    mocks.privileged.mockRejectedValue(new AuthError(status, "Denied"));
    expect((await GET(request())).status).toBe(status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  },
);
it.each([
  "courseId=invalid",
  `courseId=${course}&learnerId=invalid`,
  `courseId=${course}&access=unknown`,
])("rejects malformed parameters: %s", async (query) => {
  expect((await GET(request(query))).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([
  ["P0002", 404],
  ["42501", 403],
  ["22023", 400],
  ["XX000", 503],
])("maps SQL %s to %s without exposing SQL", async (code, status) => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "Sensitive SQL" } });
  const response = await GET(request());
  expect(response.status).toBe(status);
  expect(await response.text()).not.toContain("Sensitive SQL");
});
it("uses the same bounded SQL read with legacy paid-only semantics for local support", async () => {
  mocks.local = true;
  expect((await GET(request(`courseId=${course}&page=-1`))).status).toBe(200);
  expect(mocks.query).toHaveBeenCalledWith(
    "select public.admin_course_learner_read($1,$2,$3,$4,$5,true) as result",
    [course, "", 0, "all", null],
  );
  expect(mocks.privileged).not.toHaveBeenCalled();
  mocks.query.mockRejectedValue({ code: "P0002" });
  expect((await GET(request())).status).toBe(404);
});
it("rejects anonymous and student local sessions before reading the database", async () => {
  mocks.local = true;
  mocks.user = null;
  expect((await GET(request())).status).toBe(401);
  mocks.user = { id: "student", role: "student" };
  expect((await GET(request())).status).toBe(403);
  expect(mocks.query).not.toHaveBeenCalled();
});
