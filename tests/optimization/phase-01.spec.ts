import { expect, test } from "@playwright/test";

test("production student, player and admin preservation journey", async ({ page }, info) => {
  const errors: string[] = [];
  page.setDefaultTimeout(20_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(
    (theme) => {
      localStorage.setItem("market-method-theme", theme);
      localStorage.setItem("indianxtrade-diwali-video-seen", "1");
    },
    info.project.name.endsWith("light") ? "light" : "dark",
  );
  // Local playable media makes controls deterministic, without a remote provider/DRM claim.
  await page.route("https://interactive-examples.mdn.mozilla.net/**", (route) =>
    route.fulfill({ path: "public/videos/study-loop.webm", contentType: "video/webm" }),
  );
  async function login(email: string) {
    const result = await page.request.post("/api/auth/login", {
      headers: { Origin: "http://127.0.0.1:3113" },
      data: { email, password: "OptimizationFixture123!" },
    });
    expect(result.status()).toBe(200);
  }
  async function capture(name: string) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
  }
  async function studentView(desktop: string | RegExp, mobile: string) {
    if (info.project.name.startsWith("mobile"))
      await page
        .getByRole("navigation", { name: "Student workspace navigation" })
        .getByRole("button", { name: mobile, exact: true })
        .click();
    else await page.getByRole("tab", { name: desktop }).click();
  }
  await login("demo@example.com");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "My courses", exact: true })).toBeVisible();
  await capture("student-courses");
  await studentView("Explore courses", "Explore");
  await expect(page.locator(".student-explore-card")).toHaveCount(2);
  await capture("student-explore");
  await page.getByLabel("Search courses", { exact: true }).fill("no-such-fixture");
  await expect(page.getByRole("heading", { name: "No courses match your query" })).toBeVisible();
  await capture("student-empty-search");
  await page.getByRole("button", { name: "Reset filters" }).click();
  await studentView(/Billing & receipts/, "Billing");
  await expect(page.getByRole("heading", { name: /Billing/ }).first()).toBeVisible();
  await capture("student-billing");
  await studentView("Profile & settings", "Profile");
  await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
  await capture("student-profile");
  await studentView(/My courses/, "My courses");
  await page.getByRole("button", { name: /^(Resume lesson|Start course)$/ }).click();
  await expect(page.locator(".video-learning-page")).toBeVisible();
  const video = page.locator(".vlp-player-container video");
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState))
    .toBeGreaterThanOrEqual(2);
  await capture("player");
  const initialTitle = await page.locator(".video-learning-page h1").innerText();
  const selected = page.locator(".vlp-lesson-item.is-active");
  await selected.click();
  await expect(page.locator(".video-learning-page h1")).toHaveText(initialTitle);
  await expect(video).toHaveCount(1);
  await video.evaluate((element: HTMLVideoElement) => {
    element.loop = true;
    element.currentTime = 0;
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".vlp-player-container")).toHaveClass(/is-playing/);
  await page.mouse.move(0, 0);
  const seek = page.getByRole("slider", { name: "Video seek scrubber" });
  await seek.focus();
  await expect(page.locator(".vlp-player-controls-overlay")).toHaveCSS("opacity", "1");
  await seek.press("Home");
  await seek.press("ArrowRight");
  await expect
    .poll(async () => Number(await seek.getAttribute("aria-valuenow")))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Toggle captions" }).click();
  await expect(page.getByRole("button", { name: "Toggle captions" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("slider", { name: "Volume slider" }).fill("0.5");
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.volume)).toBe(0.5);
  await page.getByRole("button", { name: "Playback speed" }).click();
  await page.getByRole("button", { name: "1.5x", exact: true }).click();
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.playbackRate))
    .toBe(1.5);
  await page.getByRole("tab", { name: /notes/i }).click();
  await page.locator(".vlp-notes-textarea").fill("Private fixture note");
  await page.getByRole("button", { name: "Save notes", exact: true }).click();
  await page.getByRole("tab", { name: /Resources/ }).click();
  await capture("player-resources");
  const summary = await (await page.request.get("/api/purchase/dashboard")).json();
  const paid = summary.orders.find((order: { status: string }) => order.status === "paid");
  expect(paid).toBeTruthy();
  await page.goto(`/checkout/success?orderId=${paid.id}`);
  await expect(page.getByRole("heading", { name: "Payment confirmed" })).toBeVisible();
  await capture("payment-confirmed");
  await page.request.post("/api/auth/logout", { headers: { Origin: "http://127.0.0.1:3113" } });
  await login("admin@example.com");
  await page.goto("/admin");
  await expect(page.locator(".admin-course-horizontal-card")).toHaveCount(2);
  await capture("admin-courses");
  for (const [name, heading] of [
    ["Overview", "Overview"],
    ["Students", "Students"],
    ["Orders", "Orders"],
    ["Refunds", "Refund review"],
    ["Coupons", "Coupons"],
    ["Announcements", "Announcements"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
    await capture(`admin-${name.toLowerCase()}`);
  }
  expect(errors).toEqual([]);
});
