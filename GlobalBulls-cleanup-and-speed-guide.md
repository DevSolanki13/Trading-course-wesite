# GlobalBulls: Cleanup & Speed Guide

Based on a review of `Trading-course-wesite-main.zip` (2 Nov 2026). Payments are out of scope.

**How to use this file**

1. Make a branch first: `git checkout -b cleanup-and-speed`
2. Do **one section at a time**, then run:
   ```bash
   npm run typecheck && npm run lint && npm test && npm run test:unit
   ```
3. Commit after each section so any step can be undone with `git revert`.

Legend: 🔴 launch blocker · 🟠 important · 🟡 nice to have

---

# PART 1: What to delete or change

## 1.1 🟠 Delete 4 dead files (about 1,057 lines)

Nothing imports these. I deleted them in a copy of your project and `typecheck`, `lint`, all 42 node tests and all 10 vitest tests still passed.

| File | Lines | Why it is dead |
|---|---|---|
| `frontend/components/hero-media.tsx` | 94 | Never imported anywhere. |
| `frontend/components/learning-workspace.tsx` | 380 | Replaced by `student-dashboard.tsx` and `purchase-player.tsx`. `/learn` and `/learn/[slug]` now only redirect to `/dashboard`. |
| `frontend/components/learning-library.tsx` | 351 | Same as above. |
| `frontend/components/protected-player.tsx` | 232 | Only imported by `learning-workspace.tsx`. |

```bash
git rm frontend/components/hero-media.tsx \
       frontend/components/learning-workspace.tsx \
       frontend/components/learning-library.tsx \
       frontend/components/protected-player.tsx
```

**Also check afterwards (do not bulk-delete):**
- `frontend/lib/learning-api.ts` is imported by nothing I could find. Delete it if `grep -rn "learning-api" app frontend` is empty.
- `frontend/styles/learning.css` (637 lines) is still imported by `app/dashboard/page.tsx:6` and `app/dashboard/orders/page.tsx:6`. About 8 rules in it belong to the deleted components. Remove unused CSS later with a tool (see 2.7). Do not guess by hand.
- `public/images/study-desk.png` stays, because `frontend/pages/about-page.tsx:22` uses it. Just shrink it (see 2.5).

---

## 1.2 🔴 Remove the hard-coded demo logins from the production path

**Where:**
- `backend/local/seed.ts` lines 9 to 10 and 17 create `demo@example.com` (student) and `admin@example.com` (**admin**), both with password `1234567890`.
- `backend/scripts/seed-local.mjs` line 8 prints those credentials.
- `backend/purchase/mode.ts` returns `true` for the local demo mode in production when `LOCAL_DEMO=true` and `ALLOW_MOCK_PAYMENTS=true`. That mode **replaces real authentication** with the local one.

**Step 1: check Vercel today.** In Project → Settings → Environment Variables, make sure these are **not set** for Production or Preview: `LOCAL_DEMO`, `ALLOW_MOCK_PAYMENTS`, `SEED_DEMO_USERS`.

**Step 2: make it impossible to turn on by mistake.** Replace `backend/purchase/mode.ts` with:

```ts
import type { Environment } from "../config/environment.ts";

/** Local sample data must never run on a deployed (Vercel) environment. */
export function localDemoEnabled(env: Environment = process.env) {
  if (env.VERCEL) return false; // hard stop on any Vercel deployment
  if (env.LOCAL_DEMO === "false") return false;
  if (env.NODE_ENV === "production")
    return env.LOCAL_DEMO === "true" && env.ALLOW_MOCK_PAYMENTS === "true";
  if (env.LOCAL_DEMO === "true") return true;
  return !env.NEXT_PUBLIC_SUPABASE_URL && !env.DATABASE_URL;
}
```

(The Razorpay special case in the old file can go. Add it back only if you actually use Razorpay.)

**Step 3: random password for the seeded admin.** In `backend/local/seed.ts` line 17:

```ts
// before
const digest = await hash("1234567890", 12);
// after: use an env var, or fall back to a random one printed once
const seedPassword = process.env.LOCAL_SEED_PASSWORD ?? randomBytes(9).toString("base64url");
const digest = await hash(seedPassword, 12);
```

and add `randomBytes` to the `node:crypto` import at the top of the file.

**For the payment-gateway reviewer account:** create it in **Supabase → Authentication → Users → Add user** (tick *Auto Confirm*) with a strong password like `Demo@12345678`. Do not use these local seeds, and delete the account after approval.

---

## 1.3 🔴 Remove the fake market and performance claims from the homepage

A trading-education site must not show results or numbers that look real. Your own PRODUCT.md forbids invented content.

**A. `frontend/components/floating-card-marquee.tsx`, lines 19 to 28:**
Replace the array with cards that are about the *method*, not numbers:

```ts
const marqueeCards = [
  { type: "dark", label: "The market rewards", value: "process", change: "not prediction" },
  { type: "risk", label: "Risk first", value: "Define it", change: "before you enter" },
  { type: "live", label: "Learning format", value: "Hindi lessons", change: "at your pace" },
  { type: "portfolio", label: "Checklist", value: "Plan → Review", change: "every trade" },
  { type: "order", label: "Illustration", value: "Sample chart", change: "not real data" },
];
```

Specifically **delete** these three:
- `NIFTY 50 / 22,487.65 / +2.84%`
- `Portfolio growth / +24.8% / 90 days`
- `Students trained / 5,000+` (keep it only if it is true and you can prove it)

Also on line 72 in the same file, `BANKNIFTY -0.8%` is inside the card visual. Replace or remove it with the card above.

**B. `frontend/pages/home-page.tsx`, line 18:**
```ts
const ticker = ["NIFTY 50", "BANKNIFTY", "BTC/USD", "ETH/USD", "GOLD", "USD/INR"];
```
This feeds the scrolling ticker at the very top of the homepage (`+3.3%`, `-1.5%` and so on) with **no "sample" label**. Either delete the ticker section, or relabel it clearly:
`"Illustrative values for education only. Not live prices."`

**C. Also reword on the same page:** "100% Practical" and any "consistent traders" wording. Keep the tone of "process, not outcomes".

---

## 1.4 🔴 Stop blocking Google (noindex and robots)

| File | Line | What it does |
|---|---|---|
| `app/robots.ts` | 2 to 3 | `disallow: "/"` blocks everything |
| `app/layout.tsx` | 13 | `robots: { index: false, follow: false }` on every page |
| `app/login/page.tsx:1`, `app/signup/page.tsx:2` | | fine, keep these |

Replace `app/robots.ts`:

```ts
import type { MetadataRoute } from "next";
import { siteOrigin } from "@/frontend/lib/metadata";

const live = process.env.VERCEL_ENV === "production" && process.env.ALLOW_INDEXING === "true";

export default function robots(): MetadataRoute.Robots {
  if (!live) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/dashboard", "/checkout", "/auth", "/account", "/pay"],
    },
    sitemap: new URL("/sitemap.xml", siteOrigin()).toString(),
  };
}
```

In `app/layout.tsx` line 13:
```ts
robots: process.env.VERCEL_ENV === "production" && process.env.ALLOW_INDEXING === "true"
  ? { index: true, follow: true }
  : { index: false, follow: false },
```

Then set `ALLOW_INDEXING=true` in Vercel **Production only**, when you are ready to go public.

---

## 1.5 🟠 Replace the 3 copies of `parse()` with one shared helper

Copies at `backend/handlers/auth.ts:38`, `backend/handlers/admin.ts:275` and `backend/handlers/learning.ts:12`.

Create `backend/auth/parse.ts`:
```ts
import type { z } from "zod";
import { AuthError } from "./http";

export function parse<T>(schema: z.ZodType<T>, input: unknown, fallback = "Check the supplied information."): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new AuthError(400, result.error.issues[0]?.message ?? fallback, "VALIDATION_ERROR");
  return result.data;
}
```
Delete the local copies and `import { parse } from "../auth/parse";`. Behaviour is the same, except the message when a field fails, so keep the `fallback` argument if you want the exact old text (`learning.ts` uses "Check the learning request fields.").

---

## 1.6 🟡 Leftovers to tidy (low risk)

- **Brand name:** "GlobalBulls" appears in 27 files and "Market Method" in 5. Run `grep -rn "Market Method\|market-method" app frontend backend` and rename. The theme key `market-method-theme` in `app/layout.tsx` is user-visible only in localStorage, so changing it just resets people's theme choice once.
- **`DESIGN.md`:** still describes the old blue theme and Market Method. Update it, or v0 will "fix" the new green back to blue.
- **`regenerator-runtime`** (package.json) is imported in `backend/billing/document.ts:2`. Remove it only if the receipt PDF still generates after you delete the import (test `/api/orders/[orderId]/document`).
- **`backend/local/*`, `@electric-sql/pglite` (27 MB), `bcryptjs`:** demo-only code in production dependencies. Moving them to `devDependencies` is risky because they are imported dynamically. Try it on a Vercel *preview* deploy first, and only keep it if the build and the dashboard still work.
- **Payments (after you pick the gateway):** the routes `app/api/payments/demo/*`, `app/api/payments/mock/*`, `app/api/webhooks/razorpay` and the unused providers in `backend/payments/providers.ts` can go once you settle on one provider.

---

## 1.7 ⛔ Do NOT delete these (they look unused but are not)

- `backend/handlers/learning.ts`, `backend/learning/*` and `app/api/learning/[...action]/route.ts`.
- The SQL functions `learning_start`, `learning_heartbeat`, `learning_complete`.

**Why:** these are your video-lease and watch-time system. Read the next section.

---

## 1.8 🔴 Verify: real paid lessons may not play (found while checking what is dead)

I could not run against your real Supabase, so **test this on staging with a real test purchase** before launch. Reading the code:

1. The new player (`frontend/components/purchase-player.tsx`) shows a protected VdoCipher video only if `lesson.vdoCipher` exists (line 550).
2. `lesson.vdoCipher` is created in `backend/purchase/repository.ts` (lines 86 to 135) **only inside `if (localDemoEnabled())`**. The Supabase function `purchase_read` (migrations `…0010`, `…0011`) returns `videoUrl` only for demo lessons and returns no VdoCipher data at all.
3. Without `vdoCipher`, the player falls back to `lesson.videoUrl || "/sample-lesson.mp4"` (line 596). **`/sample-lesson.mp4` does not exist** in `public/`.
4. The new player never calls `/api/learning/heartbeat` or `/api/learning/playback`. So watch time is never recorded in `order_watch_ranges`. Your refund rule ("under 10% watched") would then always see 0%.

**Likely fix (small):** in the real (non-local) path, have the player request an OTP from the existing, already-secure endpoint `POST /api/learning/playback` (which does the access check, lease and watermark with the learner's email), and send `POST /api/learning/heartbeat` every few seconds while playing. The backend side is already written and tested, so this is mostly frontend wiring in `purchase-player.tsx`. That is why section 1.7 says not to delete the learning backend.

---

# PART 2: Make the site fast

Measured on your production build (mobile Lighthouse, local): `/courses` 99, `/login` 99, **homepage 69** (Total Blocking Time **4.3 s**), every page served `Cache-Control: private, no-store`, and every route is dynamic.

Do these in order. Biggest wins first.

## 2.1 🟠 Let public pages be cached (biggest win)

**Cause (two things):**
- `proxy.ts` lines 33 and 63 set `Cache-Control: private, no-store` on **every** response and adds a per-request CSP nonce.
- `app/layout.tsx` calls `headers()` to read that nonce, which forces **every** route to render on demand.

**Fix in four steps:**

**(a) Remove the nonce from the root layout.** Replace the inline theme script (`app/layout.tsx`, lines 20 to 26) with a static file so it needs no nonce.

Create `public/theme-init.js`:
```js
try{var t=localStorage.getItem('market-method-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}
```
and in `app/layout.tsx` drop the `headers()` import and the `nonce` line, and use:
```tsx
<head>
  <script src="/theme-init.js" />
</head>
```
(Allowed by the CSP because it is `'self'`.)

**(b) Only run the proxy on pages that need a session.** In `proxy.ts`, change the matcher at the bottom:
```ts
export const config = {
  matcher: [
    "/dashboard/:path*", "/checkout/:path*", "/admin/:path*", "/account/:path*",
    "/auth/:path*", "/learn/:path*", "/pay/:path*", "/api/:path*", "/login", "/signup",
  ],
};
```
Public pages (`/`, `/courses`, `/about`, `/contact`, legal) then skip the proxy completely, so no `getUser()` call, no `no-store`.

**(c) Give public pages a static CSP in `next.config.ts`** (inside `headers()`), since they have no nonce:
```ts
{
  source: "/((?!dashboard|checkout|admin|account|auth|learn|pay|api).*)",
  headers: [{
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://player.vdocipher.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self'; frame-src https://player.vdocipher.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  }],
},
```
This is slightly looser than the nonce policy (`'unsafe-inline'` for scripts), but only on public pages that handle no login or payment data. Keep the strict nonce CSP on the protected routes.

**(d) Cache the public data.** Add to `app/page.tsx`, `app/courses/page.tsx`, `app/courses/[slug]/page.tsx`, `app/about/page.tsx`:
```ts
export const revalidate = 300; // 5 minutes
```
Remove `export const dynamic = "force-dynamic"` from those files if present. Do the same for `app/sitemap.ts` (change line 5 to `export const revalidate = 3600;`). When an admin publishes or edits a course, call `revalidatePath("/courses")` and `revalidatePath("/")` in the admin handler so changes appear immediately.

**Check:** `npm run build` should now show `○` or `●` (static/ISR) instead of `ƒ` next to `/`, `/courses`, `/about`.

> ⚠️ The course pages call `/api/learning/course` in the browser to know whether the buyer already owns the course. That is why they can still be cached: ownership is resolved after load (see 2.2).

## 2.2 🟠 One auth request per page instead of up to three

`/api/auth/me` is called separately by `frontend/components/site-header.tsx:65`, `frontend/components/course-access-action.tsx:31` and `frontend/pages/catalogue-page.tsx:41`. Each one costs several database round trips for logged-in users, and anonymous visitors get a 401 error in the console on every page.

Create `frontend/components/auth-provider.tsx`:
```tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Me = { id: string; name: string; email: string; role: string } | null;
const AuthContext = createContext<{ me: Me; ready: boolean }>({ me: null, ready: false });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ me: Me; ready: boolean }>({ me: null, ready: false });
  useEffect(() => {
    // Skip the call entirely for visitors who have never signed in
    if (!document.cookie.includes("mm_remember")) { setState({ me: null, ready: true }); return; }
    let live = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setState({ me: d?.user ?? null, ready: true }))
      .catch(() => live && setState({ me: null, ready: true }));
    return () => { live = false; };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
```
Wrap `{children}` in `frontend/layouts/root-layout.tsx` with `<AuthProvider>`. Then in the three components replace the `fetch("/api/auth/me")` effect with `const { me } = useAuth();`.

> `mm_remember` is set at login (`backend/auth/session.ts`, `setRemember`). Test that the header still shows the logged-in state after you sign in without ticking "Remember me". If it does not, use the cookie name from your session setup, or fall back to always calling `/me` once in the provider.

## 2.3 🟠 Fix the homepage's 4.3 s blocking time (marquee)

**Cause:** `frontend/components/floating-card-marquee.tsx` runs `requestAnimationFrame` and writes `transform`, `opacity`, `zIndex` and `pointerEvents` for **16 cards on every frame**, even when scrolled off-screen. `frontend/components/hero/HeroAnnotations.tsx:23` also calls `getBoundingClientRect()` (forced reflow).

Quick wins, in order of effort:

1. **Halve the cards.** The array is doubled on line 29 (`[...marqueeCards, ...marqueeCards]`). With the 5 cards from 1.3 you already render fewer.
2. **Pause when off-screen.** In the marquee's `useEffect`, wrap the loop:
```tsx
const visible = { current: true };
const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; if (visible.current) frame = requestAnimationFrame(tick); });
io.observe(container); // the marquee's root element ref
// inside tick(): if (!visible.current) return;
```
and call `io.disconnect()` in the cleanup.
3. **Stop it on small or slow phones.** Wrap the whole effect in `if (window.matchMedia("(max-width: 700px)").matches) return;` and let CSS show a static row of cards.
4. **Longer term:** move the animation to a CSS `@keyframes` transform on one wrapper (compositor-only, near zero JS).

Re-run Lighthouse after each step. Target: Total Blocking Time below 300 ms.

## 2.4 🟠 Deploy near your users (Mumbai)

Most of your students are in India. Add to `vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "regions": ["bom1"]
}
```
Also check that your **Supabase project region is Mumbai (ap-south-1)**. A server in Mumbai talking to a database in the US adds about 200 ms to every request. The region of an existing Supabase project cannot be changed, so check it in Supabase → Project Settings.

## 2.5 🟠 Shrink images

`public/images/study-desk.png` is **2.1 MB** (used on the About page). `sharp` is already in your devDependencies:
```bash
node -e "require('sharp')('public/images/study-desk.png').resize({width:1600}).webp({quality:78}).toFile('public/images/study-desk.webp').then(console.log)"
```
Then in `frontend/pages/about-page.tsx:22` use `src="/images/study-desk.webp"`, or better, use `next/image`:
```tsx
import Image from "next/image";
<Image src="/images/study-desk.webp" alt="" width={1600} height={1000} sizes="(max-width: 900px) 100vw, 50vw" />
```
Only 6 places use `next/image` today. The six `<img>` tags (with `eslint-disable` comments) in `course-manager.tsx`, `student-dashboard.tsx` and `purchase-player.tsx` can stay for admin-uploaded images, but give them `loading="lazy"` and `width`/`height`.

`public/videos/study-loop.webm` (364 KB) is not used by any page. It is only mentioned in `docs/PHASE-1-STATUS.md` and generated by `backend/scripts/generate-ambient-video.mjs`. It is harmless (never downloaded unless requested), so it is optional to delete.

## 2.6 🟡 Self-host the two Google fonts

`frontend/pages/home-page.tsx` lines 2 and 16 to 28 use `next/font/google` for **Caveat** and **Newsreader**. That makes the build depend on the internet (it failed in my sandbox) and contradicts your "self-hosted fonts" rule.

```bash
npm i @fontsource/caveat @fontsource-variable/newsreader
```
In `frontend/layouts/root-layout.tsx` add:
```ts
import "@fontsource/caveat/500.css";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/newsreader/wght-italic.css";
```
In `home-page.tsx` delete the `import { Caveat, Newsreader }` line and the two font constants, and replace the two usages:
```tsx
<HeroAnnotations className={annotationFont.variable}>  →  <HeroAnnotations>
<h1 id="landing-title" className={headlineFont.variable}>  →  <h1 id="landing-title">
```
Then define the variables in `frontend/styles/landing.css` at the top:
```css
:root { --font-annotations: "Caveat", cursive; --font-headline: "Newsreader Variable", Georgia, serif; }
```
(They are used by `hero-annotations.css:69` and `landing.css:112`.)

## 2.7 🟡 Ship less CSS

- `app/courses/page.tsx:10` and `app/courses/[slug]/page.tsx:10` import **`admin.css` (1,551 lines)** on **public** pages. Find which classes those pages need from it and move just those rules into `globals.css` (or a new `catalogue.css`), then remove the import.
- `frontend/styles/globals.css` is 3,250 lines and `brand.css` re-declares the colours with `:root:root` to win over it. Merge `brand.css` tokens into `globals.css` and delete the old blue tokens.
- To find unused rules safely: `npx purgecss --css frontend/styles/learning.css --content "app/**/*.tsx" "frontend/**/*.tsx" --output /tmp/purged` and compare sizes. Do not overwrite blindly; review the diff.
- Fix the 43 `!important` in `admin.css` when you touch the mobile layout (see below).

## 2.8 🟡 Load heavy admin and player code only when needed

These are big client components used by few visitors:
```tsx
import dynamic from "next/dynamic";
const CourseManager = dynamic(() => import("@/frontend/components/admin/course-manager").then(m => m.CourseManager), { loading: () => <p>Loading…</p> });
```
Apply to `course-manager.tsx` (1,368 lines), `purchase-player.tsx` (976) and the other admin panels. Students never download admin code, and admins do not download the player.

To see what is big: `npm i -D @next/bundle-analyzer` and run a build with `ANALYZE=true`.

## 2.9 🟡 Small server wins

- `backend/handlers/auth.ts` `options()` fetches Supabase settings on every login page view. Cache it for 10 minutes:
  `fetch(url, { next: { revalidate: 600 } })` (remove `cache: "no-store"` there).
- `backend/public/catalogue.ts` `publicCatalog` is only memoised per request (`cache()`). Wrap the Supabase query in `unstable_cache(..., ["catalog"], { revalidate: 300, tags: ["catalog"] })` and call `revalidateTag("catalog")` when admins publish.
- Replace `getUser()` with `getClaims()` in `proxy.ts` line ~62, which verifies the JWT locally instead of calling Supabase on every protected request. (`getClaims` exists in your supabase-js version; test login, logout and refresh after the change.)

## 2.10 Measure (do not guess)

```bash
npm run build && npm run start
# in another terminal, from the project root:
npx lighthouse http://127.0.0.1:3000/ --only-categories=performance --form-factor=mobile --output=html --output-path=./lh-home.html
npm run test:performance   # your own script
```
Test on **mobile with 4x CPU slowdown** (the default) and on a real mid-range Android phone over 4G. Also check Vercel → Analytics → Speed Insights after launch.

**Targets:** homepage Lighthouse mobile ≥ 90, TBT < 300 ms, LCP < 2.5 s, `/` and `/courses` showing `x-vercel-cache: HIT` on repeat loads.

---

# Part 3: Suggested order for today

1. **(5 min)** Check Vercel env vars: no `LOCAL_DEMO`, `ALLOW_MOCK_PAYMENTS`, `SEED_DEMO_USERS` (1.2).
2. **(15 min)** Fix `mode.ts` (1.2) and robots/noindex gating (1.4).
3. **(15 min)** Remove fake stats and ticker (1.3).
4. **(30–60 min)** Test one full real purchase on staging and verify video plays and watch time is saved (1.8). This decides whether launch is safe.
5. **(10 min)** Delete the 4 dead files (1.1) and run the checks.
6. **(1–2 h)** Speed work: 2.4, 2.5, 2.3, then 2.1 and 2.2.
7. **Later:** CSS cleanup, fonts, dynamic imports, shared `parse()`, rebrand leftovers.
