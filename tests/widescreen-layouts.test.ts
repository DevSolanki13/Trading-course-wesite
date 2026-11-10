import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Wide-screen layouts (Batch C) tokens, media queries and width caps", () => {
  const root = process.cwd();
  const globalsCss = fs.readFileSync(path.join(root, "frontend/styles/globals.css"), "utf8");
  const landingCss = fs.readFileSync(path.join(root, "frontend/styles/landing.css"), "utf8");
  const adminCss = fs.readFileSync(path.join(root, "frontend/styles/admin.css"), "utf8");
  const videoCss = fs.readFileSync(path.join(root, "frontend/styles/video-learning.css"), "utf8");
  const studentCss = fs.readFileSync(
    path.join(root, "frontend/styles/student-dashboard.css"),
    "utf8",
  );

  // 1. globals.css tokens and default container
  assert.match(globalsCss, /--container-max:\s*1280px/, "Default container max is 1280px");
  assert.match(globalsCss, /--gutter:\s*96px/, "Default gutter is 96px");
  assert.match(
    globalsCss,
    /max-width:\s*var\(--container-max,\s*1280px\)/,
    ".container uses --container-max token",
  );
  assert.match(
    globalsCss,
    /width:\s*calc\(100%\s*-\s*var\(--gutter,\s*96px\)\)/,
    ".container uses --gutter token",
  );

  // 2. globals.css wide-screen steps
  assert.match(globalsCss, /@media\s*\(min-width:\s*1600px\)/, "Contains 1600px media query");
  assert.match(globalsCss, /@media\s*\(min-width:\s*1920px\)/, "Contains 1920px media query");
  assert.match(globalsCss, /@media\s*\(min-width:\s*2560px\)/, "Contains 2560px media query");
  assert.match(
    globalsCss,
    /--container-max:\s*1440px/,
    "1600px breakpoint sets --container-max to 1440px",
  );
  assert.match(
    globalsCss,
    /--container-max:\s*1680px/,
    "1920px breakpoint sets --container-max to 1680px",
  );
  assert.match(
    globalsCss,
    /--container-max:\s*1840px/,
    "2560px breakpoint sets --container-max to 1840px",
  );

  // 3. landing.css preserves 1240px below 1600px and expands at >= 1600px
  assert.match(
    landingCss,
    /\.landing-page\s+\.container\s*\{\s*max-width:\s*min\(var\(--container-max,\s*1280px\),\s*1240px\)/,
    "Landing container is capped at 1240px below 1600px",
  );
  assert.match(
    landingCss,
    /@media\s*\(min-width:\s*1600px\)\s*\{[\s\S]*?\.landing-page\s+\.container\s*\{\s*max-width:\s*var\(--container-max\);/,
    "Landing container expands to --container-max at 1600px",
  );

  // 4. admin.css caps content width on wide screens and adjusts sidebar at 1920px
  assert.match(
    adminCss,
    /@media\s*\(min-width:\s*1600px\)\s*\{[\s\S]*?\.admin-main\s*\{[\s\S]*?max-width:\s*1600px;/,
    "Admin main is capped at 1600px at >= 1600px",
  );
  assert.match(
    adminCss,
    /@media\s*\(min-width:\s*1920px\)\s*\{[\s\S]*?grid-template-columns:\s*300px minmax\(0,\s*1fr\);/,
    "Admin sidebar expands to 300px at >= 1920px",
  );
  assert.match(
    adminCss,
    /@media\s*\(min-width:\s*1920px\)\s*\{[\s\S]*?\.admin-main\s*\{[\s\S]*?max-width:\s*1800px;/,
    "Admin main is capped at 1800px at >= 1920px",
  );
  assert.match(
    adminCss,
    /@media\s*\(min-width:\s*2560px\)\s*\{[\s\S]*?\.admin-main\s*\{[\s\S]*?max-width:\s*2200px;/,
    "Admin main is capped at 2200px at >= 2560px",
  );

  // 5. video-learning.css expands portal body and caps video player at 1680px
  assert.match(
    videoCss,
    /@media\s*\(min-width:\s*1600px\)\s*\{[\s\S]*?\.vlp-main\s*\{\s*max-width:\s*1440px;/,
    "Video learning main expands to 1440px at 1600px",
  );
  assert.match(
    videoCss,
    /@media\s*\(min-width:\s*1920px\)\s*\{[\s\S]*?\.vlp-portal-body\s*\{\s*grid-template-columns:\s*380px minmax\(0,\s*1fr\);/,
    "Video curriculum sidebar expands to 380px at 1920px",
  );
  assert.match(
    videoCss,
    /@media\s*\(min-width:\s*1920px\)\s*\{[\s\S]*?\.vlp-player-container\s*\{\s*max-width:\s*1680px;/,
    "Video player container is capped at 1680px at 1920px",
  );
  assert.match(
    videoCss,
    /@media\s*\(min-width:\s*2560px\)\s*\{[\s\S]*?\.vlp-player-container\s*\{\s*max-width:\s*1680px;/,
    "Video player container remains capped at 1680px at 2560px for crispness",
  );

  // 6. student-dashboard.css expands at 2560px
  assert.match(
    studentCss,
    /@media\s*\(min-width:\s*2560px\)\s*\{[\s\S]*?\.student-main-content[\s\S]*?max-width:\s*2100px;/,
    "Student dashboard main content expands to 2100px at 2560px",
  );

  // 7. Logo at leftmost for >= 1600px
  assert.match(
    globalsCss,
    /@media\s*\(min-width:\s*1600px\)\s*\{[\s\S]*?\.site-header\s+\.container\s*\{[\s\S]*?max-width:\s*none;[\s\S]*?width:\s*100%;/,
    "Site header logo sits at the leftmost on screens >= 1600px",
  );

  // 8. Hero annotations (chart & teacher notes) come closer to center for >= 1600px
  const diwaliCss = fs.readFileSync(path.join(root, "frontend/styles/diwali.css"), "utf8");
  assert.match(
    diwaliCss,
    /@media\s*\(min-width:\s*1600px\)\s*\{[\s\S]*?\.hero-modern--diwali\s+\.hero-annotation-chart\s*\{[\s\S]*?right:\s*calc\(50%\s*\+/,
    "Hero annotated chart comes closer to center on screens >= 1600px",
  );
  assert.match(
    diwaliCss,
    /@media\s*\(min-width:\s*1600px\)\s*\{[\s\S]*?\.hero-modern--diwali\s+\.hero-teacher-notes\s*\{[\s\S]*?left:\s*calc\(50%\s*\+/,
    "Hero teacher notes drawing comes closer to center on screens >= 1600px",
  );
});
