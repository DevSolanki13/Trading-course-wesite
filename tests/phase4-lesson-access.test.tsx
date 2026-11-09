import { beforeEach, expect, it, vi } from "vitest";
import { learningAccount, lessonAccess, type LearningAccount } from "../backend/learning/data";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), admitted: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../backend/database/supabase", () => ({ createAdminClient: () => mocks }));
vi.mock("../backend/auth/session", () => ({ admitted: mocks.admitted }));
const course = "11111111-1111-4111-8111-111111111111";
const lesson = "22222222-2222-4222-8222-222222222222";
const owner = "33333333-3333-4333-8333-333333333333";
const metadata = {
  id: lesson,
  module_id: "module",
  title: "Lesson",
  is_preview: false,
  published: true,
  duration_seconds: 60,
  modules: { course_id: course, courses: { id: course, status: "published" } },
};
type Result = { data: unknown; error: { code?: string } | null };
const results: Record<string, Result> = {};
function table(name: string) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(async () => results[name]),
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(results[name]).then(resolve, reject),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  return query;
}
const queries: Record<string, ReturnType<typeof table>> = {};
function account() {
  return {
    context: { user: { id: owner }, admin: mocks },
    progress: [],
    enrollments: [
      {
        course_id: course,
        source: "purchase",
        order_id: "order",
        active: true,
        revoked_at: null,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
    ],
    orders: [{ id: "order", user_id: owner, course_id: course, status: "paid" }],
  } as unknown as LearningAccount;
}
beforeEach(() => {
  vi.clearAllMocks();
  for (const name of ["lessons", "orders", "enrollments"]) {
    results[name] = { data: name === "lessons" ? metadata : [], error: null };
    queries[name] = table(name);
  }
  mocks.from.mockImplementation((name: string) => queries[name]);
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  mocks.admitted.mockResolvedValue(account().context);
});

it("resolves lesson/module/course metadata with one read and loads only the verified course scope", async () => {
  const evidence = account();
  const load = vi.fn().mockResolvedValue(evidence);
  const result = await lessonAccess(lesson, load);
  expect(mocks.from.mock.calls).toEqual([["lessons"]]);
  expect(queries.lessons.select).toHaveBeenCalledWith(
    expect.stringContaining("modules!inner(course_id,courses!inner(id,status))"),
  );
  expect(load).toHaveBeenCalledWith(course);
  expect(result.lesson).not.toHaveProperty("modules");
  expect(result.accessExpiresAt).toBe(evidence.enrollments[0].expires_at);
});

it.each([
  null,
  { ...metadata, published: false },
  { ...metadata, modules: { course_id: course, courses: { id: course, status: "draft" } } },
  {
    ...metadata,
    modules: { course_id: "different", courses: { id: course, status: "published" } },
  },
])(
  "denies missing/unpublished or inconsistent metadata before loading account evidence",
  async (data) => {
    results.lessons = { data, error: null };
    const load = vi.fn();
    await expect(lessonAccess(lesson, load)).rejects.toMatchObject({ status: 404 });
    expect(load).not.toHaveBeenCalled();
  },
);

it("preserves anonymous previews, but requires sign-in for protected lessons", async () => {
  await expect(lessonAccess(lesson, null)).rejects.toMatchObject({
    status: 401,
    code: "SIGN_IN_REQUIRED",
  });
  results.lessons = { data: { ...metadata, is_preview: true }, error: null };
  await expect(lessonAccess(lesson, null)).resolves.toMatchObject({
    lesson: { is_preview: true },
    account: null,
  });
});

it.each(["wrong-owner", "expired", "revoked", "unpaid", "inactive"])(
  "preserves %s access denial",
  async (reason) => {
    const value = account();
    if (reason === "wrong-owner") value.orders[0].user_id = "another-owner";
    if (reason === "expired") value.enrollments[0].expires_at = "2000-01-01";
    if (reason === "revoked") value.enrollments[0].revoked_at = new Date().toISOString();
    if (reason === "unpaid") value.orders[0].status = "pending";
    if (reason === "inactive") value.enrollments[0].active = false;
    await expect(lessonAccess(lesson, value)).rejects.toMatchObject({
      status: 403,
      code: "COURSE_LOCKED",
    });
  },
);

it("keeps admission/device errors and fails closed when metadata cannot be read", async () => {
  const load = vi.fn().mockRejectedValue({ status: 409, code: "DEVICE_LIMIT" });
  await expect(lessonAccess(lesson, load)).rejects.toMatchObject({ code: "DEVICE_LIMIT" });
  results.lessons = { data: null, error: { code: "unavailable" } };
  await expect(lessonAccess(lesson, null)).rejects.toMatchObject({ status: 503 });
});

it("scopes enrollment/order evidence to both verified owner and course without reading progress", async () => {
  const result = await learningAccount(course);
  for (const name of ["orders", "enrollments"]) {
    expect(queries[name].eq).toHaveBeenCalledWith("user_id", owner);
    expect(queries[name].eq).toHaveBeenCalledWith("course_id", course);
  }
  expect(result.progress).toEqual([]);
  expect(mocks.admitted).toHaveBeenCalledTimes(1);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("retains full library/course progress reads when no lesson scope is supplied", async () => {
  await learningAccount();
  expect(mocks.rpc).toHaveBeenCalledWith("learning_progress", { p_user: owner });
  expect(queries.orders.eq).not.toHaveBeenCalledWith("course_id", expect.anything());
});
