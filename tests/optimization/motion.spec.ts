import { expect, test } from "@playwright/test";

// Chromium exposes one tracing session: keep the raw rendering trace rather than
// competing with Playwright's tracing session. Video remains enabled.
test.use({ trace: "off" });

test("carousel hover, interruption, repaint profile and reduced motion", async ({ page }, info) => {
  await page.addInitScript(
    (theme) => {
      localStorage.setItem("market-method-theme", theme);
      localStorage.setItem("indianxtrade-diwali-video-seen", "1");
    },
    info.project.name.endsWith("light") ? "light" : "dark",
  );
  await page.goto("/");
  const wrap = page.locator(".marquee-wrap");
  await wrap.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect(page.locator(".marquee-card")).toHaveCount(16);
  const card = page.locator(".marquee-card").first();
  expect(
    await card.evaluate((element) => getComputedStyle(element).transitionProperty),
  ).not.toContain("transform");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Tracing.start", {
    categories: "devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.layers",
    transferMode: "ReturnAsStream",
  });
  const sample = async (ms: number) =>
    page.evaluate(async (duration) => {
      const values: { time: number; transform: string; signature: string }[] = [];
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const frame = (time: number) => {
          values.push({
            time,
            transform: (document.querySelector(".marquee-card") as HTMLElement).style.transform,
            signature: [...document.querySelectorAll<HTMLElement>(".marquee-card")]
              .map((element) => element.style.transform)
              .join("|"),
          });
          if (time - start < duration) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      return values;
    }, ms);
  const moving = await sample(1600);
  expect(new Set(moving.map((frame) => frame.signature)).size).toBeGreaterThan(10);
  await wrap.hover();
  await sample(1600); // Existing speed easing approaches zero without snapping.
  const hovering = await sample(200);
  const x = (value: string) => Number(value.match(/calc\(-50% \+ ([\d.-]+)px\)/)?.[1]);
  expect(Math.abs(x(hovering[0].transform) - x(hovering.at(-1)!.transform))).toBeLessThan(1);
  await page.screenshot({ path: info.outputPath("carousel-hover.png") });
  await page.mouse.move(0, 0);
  const resumed = await sample(1000);
  expect(new Set(resumed.map((frame) => frame.signature)).size).toBeGreaterThan(10);
  const complete = new Promise<string>((resolve) =>
    cdp.once("Tracing.tracingComplete", (event) => resolve(event.stream ?? "")),
  );
  await cdp.send("Tracing.end");
  const stream = await complete;
  expect(stream).not.toBe("");
  let trace = "";
  for (;;) {
    const result = await cdp.send("IO.read", { handle: stream });
    trace += result.data;
    if (result.eof) break;
  }
  await cdp.send("IO.close", { handle: stream });
  await info.attach("rendering-trace", { body: trace, contentType: "application/json" });
  const events = JSON.parse(trace).traceEvents as { name: string; dur?: number; args?: unknown }[];
  const gaps = moving
    .slice(1)
    .map((frame, index) => frame.time - moving[index].time)
    .sort((a, b) => a - b);
  const profile = {
    frames: moving.length,
    frameGapMedianMs: gaps[Math.floor(gaps.length / 2)],
    frameGapMaxMs: gaps.at(-1),
    gapsOver34Ms: gaps.filter((gap) => gap > 34).length,
    // An estimate, not a physical-device GPU dropped-frame counter.
    rendering: Object.fromEntries(
      ["Paint", "Layout", "UpdateLayoutTree", "CompositeLayers"].map((name) => [
        name,
        {
          count: events.filter((event) => event.name === name).length,
          durationMs:
            events
              .filter((event) => event.name === name)
              .reduce((sum, event) => sum + (event.dur ?? 0), 0) / 1000,
        },
      ]),
    ),
    layers: await card.evaluate((element) => ({
      blur: getComputedStyle(element).backdropFilter,
      shadow: getComputedStyle(element).boxShadow,
      mask: getComputedStyle(document.querySelector(".marquee-mask")!).maskImage,
    })),
  };
  await info.attach("motion-profile", {
    body: JSON.stringify(profile, null, 2),
    contentType: "application/json",
  });
  expect(profile.layers.blur).not.toBe("none");
  expect(profile.layers.mask).not.toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await sample(350);
  expect(new Set(reduced.map((frame) => frame.signature)).size).toBe(1);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await wrap.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  const enabled = await sample(350);
  expect(new Set(enabled.map((frame) => frame.signature)).size).toBeGreaterThan(2);
});
