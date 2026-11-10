# Implementation plan: admin mobile, admin sign-out, manual payment approval, wide screens

Repo: `DevSolanki13/Trading-course-wesite` (Next.js, Supabase, local demo mode)
Base: `origin/main` at `6960488` ("Merge removal of GST offer explanation"), the latest commit on `main`.
Work on a new branch: `feat/admin-mobile-payments-widescreen` created from that commit.

Read this whole file first. Then read `AGENTS.md` and the relevant guides in `node_modules/next/dist/docs/` before writing any code. This Next.js version differs from older versions.

## 0. Ground rules

- Do NOT merge, rebase onto, or edit the `perf-optimizations` branch. It is a separate, unmerged branch (`0e45ce6`) that also edits `frontend/components/admin/admin-workspace.tsx`. Keep your edits to that file small and self-contained so a later merge only needs a minor conflict resolution.
- No deployment. No migration applied to any shared or hosted database. Migrations are only added as files and tested against the local migrated database (PGlite) used by the existing tests.
- Never edit a migration that already exists. Add a new file after `202611100029_payment_reference.sql`. Suggested name: `202611110030_admin_manual_upi_approval.sql`.
- No new dependencies. No redesign. Keep the current look, theme tokens (light and dark), fonts, branding, and all existing features.
- Do not weaken any security check. Admin-only actions stay admin-only.
- Line numbers below were read on `6960488` and may drift. Re-read the code before editing.
- Run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit` and `npm test` before each commit. Run `npm run format` on files you changed.
- `npm run build` rewrites `next-env.d.ts`. Restore it with `git checkout -- next-env.d.ts` before committing.
- One commit per batch (A, B, C below). Do not push to `main`.

Order: **Batch A** (tasks 1 and 2 together), then **Batch B** (task 3), then **Batch C** (task 4), then **Batch D** (final verification).
Reason: the new mobile drawer in Batch A is where the sign-out button lives. The approval dialog in Batch B must be built mobile-friendly on top of Batch A.

---

## Batch A: Admin on phones, and the missing Sign out (tasks 1 and 2)

### What is wrong today (verified in code)

Files: `frontend/components/admin/admin-workspace.tsx`, `frontend/styles/admin.css`, `frontend/styles/admin-shared.css`.

1. At `max-width: 900px`, `admin.css` (about line 461 onward) turns the sidebar into a static block at the top of the page. It hides the grouped navigation with `.admin-nav-group { display: none }`. It also hides `.admin-sidebar-bottom { display: none }`.
2. `.admin-sidebar-bottom` contains the "View storefront" link, the profile menu popover (Edit profile, Platform settings, Team security, Sign out) and the `.admin-signout` button. **So on a phone the Sign out button and the whole account menu are hidden.** This is the cause of "no logout button in the admin panel".
3. The only phone navigation is a horizontal strip of 13 small pills (`.admin-mobile-tabs`) inside the sidebar block. The brand, workspace switcher and pills push the real content far down the screen.
4. The theme toggle sits in the top bar, which wraps awkwardly on small screens.
5. Panels use wide tables (`.admin-table-wrap`). The UPI payments, orders, students and refunds panels are the main ones. Their action buttons sit in the last column, off-screen on a phone.
6. On the desktop sidebar, the "Workspace / Commerce / Manage" groups leave out three views: `content` ("Site content"), `operations` ("Operations & audit") and `profile`. `content` and `operations` are reachable only via the phone pills or `?view=`. `profile` is reachable only through the popover. See `workspaceItems`, `commerceItems` and `manageItems` in `admin-workspace.tsx`.

### Target behaviour

On widths up to 900px:

- A compact sticky top bar with: a menu button (opens a drawer), the BullMark brand link, the current section title (the existing breadcrumb text), and the theme toggle.
- The drawer is a left sheet. It contains the same grouped navigation as desktop (Workspace, Commerce, Manage), the "View storefront" link, the account block (name, email, Edit profile, Platform settings, Team security & 2FA) and a clearly visible **Sign out** button at the bottom. It reuses the existing `renderNavItems` data and handlers. It does not duplicate the `allViews` list.
- Drawer accessibility: `role="dialog"` with `aria-modal="true"` and a label. It closes on Escape, on backdrop tap and after choosing a view. It traps and restores focus. Body scroll is locked while open. The menu button has `aria-expanded` and `aria-controls`.
- Remove the pill strip. The drawer replaces it. Keep `handleSelectView` and the `?view=` URL and history behaviour exactly as they are.
- Support-role users see only the views they can see today.

Desktop (above 900px) must look and behave exactly as now, with one deliberate change: add `content` and `operations` to the "Manage" group so every admin view is reachable on desktop too. This is flagged as a **decision for Dev**. Default: do it. Leave `profile` in the account popover only.

### Sign out fix

- Keep a single `logout()` in `admin-workspace.tsx` and call it from the drawer button and from the desktop buttons.
- Today `logout()` navigates to `/login` even when the request fails (the `catch` still calls `router.push`). That can look signed out while the session is still alive. Match `student-dashboard.tsx`: check `response.ok`. On failure, show an inline error such as "Sign out failed. Please retry." and stay on the page.
- On success, go to `/login` (as now) and `router.refresh()`.
- The sign-out button must be visible without scrolling the page on a 360x640 phone: either pin it to the drawer bottom or keep the drawer scrollable with a sticky footer.

### Phone layout for the panels

Breakpoints to test: 360, 390, 430, 768 (tablet), and 900 (boundary).

- General: no horizontal page scroll (`document.documentElement.scrollWidth <= clientWidth`) in any admin view. Inputs and selects use at least 16px font on phones to avoid iOS zoom. Buttons and links in tables, tabs and menus have at least a 44px touch target. Use `min-height: 100dvh` and `env(safe-area-inset-*)` padding.
- Tables: below 720px, convert these four to a stacked card layout, one card per row, with the label for each cell shown, and the action button full width at the bottom of the card:
  - `upi-payments-panel.tsx` (all three tabs)
  - `orders-panel.tsx`
  - `students-panel.tsx`
  - `refunds-panel.tsx`

  Use a CSS-only approach with `data-label` attributes on `<td>` and keep the real `<table>` markup so screen readers and desktop are unchanged. Other panels keep the horizontally scrollable `.admin-table-wrap`, but check that the scroll area is obvious and does not trap vertical scrolling.

- Check every panel at 390px: overview, courses (+ course editor, lesson editor, learners), students, orders (+ order detail), UPI payments, refunds, coupons, announcements, site content, operations, team, settings, profile. Fix overflowing forms, fixed-width elements (`max-width: 520px`, `540px`, `680px` in `admin-shared.css`; `250px`, `280px`, `500px` in `admin.css`), and any modal or popover wider than the viewport.
- Put new phone rules in `admin.css` inside the existing `@media (max-width: 900px)` and `(max-width: 600px)` blocks, or in a new block next to them. Do not change unrelated selectors.

### Tests for Batch A

- Unit tests (Vitest, `tests/`): at a phone viewport, the admin workspace exposes a menu button. Opening it shows Sign out and the group navigation. Choosing a view closes it. Escape closes it. A failed `/api/auth/logout` shows the error and does not navigate. A successful one navigates to `/login`.
- Playwright (see `playwright.release.config.ts` and `tests/release/`; add a phone project if one is missing): sign in as the demo admin, open `/admin` at 390x844, assert Sign out is reachable, assert no horizontal overflow on every view id in `allViews`, and take screenshots of UPI payments and orders.
- The demo admin for local runs is `admin@example.com` / `1234567890` (see `backend/local/seed.ts`; test accounts only).

---

## Batch B: Admin can manually approve a payment (task 3)

### How payments work today (verified)

- Admin view: `frontend/components/admin/upi-payments-panel.tsx`, tabs Needs review / Unmatched credits / History. The only per-row action is "Check payment" (`upi-check`), which asks the gateway and settles only if the gateway reports `COMPLETED`.
- Backend route: `backend/handlers/admin.ts`. `upi-check` appears in a local-demo branch (around line 304 to 323) and in the hosted branch (around line 777). It uses `limit(...)`, `audit(...)` and `privileged()` from `backend/auth/session.ts`.
- Settlement: SQL function `public.purchase_settle(p_event jsonb)` in `202610310010_purchase_access.sql`. It locks the order, requires `provider`, `currency = 'INR'` and `amount = orders.total_paise`, and de-duplicates on `purchase_events(provider, event_key)`. On `paid` it sets the order paid and inserts `purchase_access` and `enrollments`. It also inserts the receipt row in `notification_outbox`. **It only moves an order that is currently `pending`.** For any other status it silently records the event and changes nothing.
- It finds the order by `provider_order_id`. A UPI order whose checkout was never bound to the gateway can have a null `provider_order_id`.
- Student-submitted UTR references live in `purchase_payment_references` and are explicitly "claims for review, never evidence". The admin view shows them as "Student reference · unverified".
- `audit()` in `session.ts` always writes `target_type: 'account'` with no `details`. `audit_log` has a `details jsonb` column.

### Design

Add an **admin-only, audited, idempotent** action "Approve manually". It is for the case where the money really reached the bank account but the gateway did not confirm.

**1. Database (new migration `202611110030_admin_manual_upi_approval.sql`)**

- New table `public.purchase_manual_approvals`: `order_id uuid primary key references orders(id)`, `approved_by uuid not null references profiles(id)`, `utr text not null check (utr ~ '^[A-Z0-9]{6,32}$')`, `reason text not null check (char_length(reason) between 10 and 300)`, `amount_paise integer not null`, `previous_status text not null`, `gateway_status text`, `approved_at timestamptz not null default clock_timestamp()`. Add a unique index on `utr` (one bank UTR can approve only one order). Enable RLS and `revoke all` from `public, anon, authenticated, service_role`, as done for `purchase_payment_references`.
- New function `public.admin_upi_manual_approve(p_actor uuid, p_order uuid, p_utr text, p_reason text, p_confirm_amount integer) returns jsonb`. Use `security definer`, `set search_path = ''`, `revoke ... from public, anon, authenticated`, `grant execute ... to service_role`. Follow the style of `purchase_upi_reference` in `202611100029_payment_reference.sql`. Inside ONE transaction it must:
  1. Confirm `p_actor` is an active admin (`profiles.role = 'admin'`, not blocked). Raise `42501` otherwise. This is defence in depth. The handler checks too.
  2. `select ... from orders where id = p_order for update`. Require `purchase_provider = 'upi'`.
  3. Require `p_confirm_amount = total_paise` (the admin must re-enter the amount). Raise `22023` otherwise.
  4. Require `provider_order_id is not null`. If null, raise a clear error ("Checkout was never set up for this order; nothing to approve").
  5. If the order is already `paid`, return `{status:'paid', alreadyPaid:true}` with no change and no error (double-click safe).
  6. Only allow `pending`. For `cancelled`/`expired`/`failed`, see "Open decision" below.
  7. If the gateway row says `COMPLETED` for this order, refuse and tell the admin to use "Check payment" instead. If the UTR appears in `academy_upi_unmatched_credits`, its `amount_paise` must equal the order total. If the UTR is not in the bank-records snapshot, the handler requires an explicit "I checked this in the bank statement" confirmation flag (see handler).
  8. Insert into `purchase_manual_approvals` (the unique UTR index rejects reuse).
  9. Call the existing settlement: `perform public.purchase_settle(jsonb_build_object('provider','upi','providerOrderId', o.provider_order_id, 'providerPaymentId', 'manual_' || o.id, 'amount', o.total_paise, 'currency','INR','status','paid'))`. **Do not copy the settlement SQL.** Reusing it keeps access, enrollment, receipt row and financial snapshots identical to a normal payment. The deterministic payment id `manual_<orderId>` makes it idempotent.
  10. Insert an `audit_log` row in the same transaction: `action = 'upi_payment_manually_approved'`, `target_type = 'order'`, `target_id = order id`, `details = {utr, reason, amount_paise, previous_status, gateway_status}`.
  11. Return `{status:'paid', alreadyPaid:false}`.
- Update the staff read model so the UI can show who approved: add `manual_approved_by` (name), `manual_approved_at` and `manual_reason` as **new columns at the END** of the `academy_upi_payment_orders` view (use `create or replace view`, appended columns only). Then add them to the JSON built by `academy_upi_payment_read`. Read the latest definitions in `202611100029_payment_reference.sql` and `202611080027_upi_snapshot_safe_updates.sql` first and keep every existing column and the existing review reasons unchanged.

**2. Backend route**

- File: `backend/admin/upi-payments.ts` gets `approveAcademyUpiPayment(...)`. Route in `backend/handlers/admin.ts`: action `upi-manual-approve`, POST only, in both the hosted branch and the local-demo branch, next to `upi-check`.
- Use `privileged(true)` (admin only, not support, MFA enforced there). The panel is already admin-only, but the route must enforce it on its own.
- Rate limit: `limit(request, "admin-upi-approve", context.user.id, 10, 60)`.
- Validate with zod `.strict()`: `{ id: uuid, utr: /^[A-Z0-9]{6,32}$/ (uppercase it first), reason: string trimmed 10 to 300 chars, confirmAmount: positive integer, bankChecked: boolean }`. If the UTR is not found in the bank-records snapshot and `bankChecked` is not true, reject with a clear message.
- Call the RPC with `p_actor = context.user.id`. Map SQL errors to `AuthError` with friendly text. Never return raw database errors.
- After success, best-effort receipt send: look up the owner with `purchase_payment_owner` and call `sendPurchaseReceipt` from `backend/purchase/mail.ts` inside `try/catch`. A mail failure must never fail or roll back the approval. The outbox row already exists, so the worker retries later.
- Add the new action label to the audit display in `operations-panel.tsx` if actions are mapped to labels there.

**3. UI (`upi-payments-panel.tsx`, `shared/admin.ts`)**

- Add optional fields to `AdminUpiPayment`: `manualApproval?: { by: string; at: string; reason: string } | null`.
- In Needs review and History rows where `status === 'pending'`, add an "Approve manually" button next to "Check payment". It is a secondary, clearly cautious style, not the primary one. Show it for unbound orders too, but if the order has no gateway order the dialog explains why it cannot be approved.
- Dialog (accessible modal, focus trap, Escape, `aria-modal`, usable at 360px width). It shows: student, email, course, order id, amount, the student's unverified reference (if any), and the gateway status.
  - Fields: UTR (prefilled from the row's verified UTR or the student reference, editable), Reason (required, 10 to 300 chars), "Type the amount to confirm" (must equal the order amount in rupees), and a "I checked this payment in the bank statement" checkbox. The checkbox is required when the UTR is not found in the synced bank records.
  - Warning text: "This grants course access and sends the receipt. It can only be reversed by a refund."
  - Submit shows "Approving…" and is disabled while busy. On success: show a status message, close the dialog and reload. On failure: show the error inside the dialog and keep it open.
- Show a "Manual" badge plus "Approved by X · date · reason" on approved rows in History.
- Unmatched credits tab: keep "Find Academy orders". No automatic link from a credit to an order.
- In the new card layout on phones (Batch A), the new button and the dialog must be fully usable.

### Open decision (ask Dev, default noted)

Orders in `cancelled` status can have a student-submitted reference (see `purchase_upi_reference`, which allows `pending` and `cancelled`). That is the "paid after the checkout expired" case. `purchase_settle` does nothing for them. **Default for this batch: approve `pending` orders only, and show "This checkout was closed; contact the developer" for others.** If Dev wants closed checkouts supported, it needs a deliberate, tested transition `cancelled -> pending -> paid` inside the same RPC. Check the `orders` status constraints and the unique `purchase_access(user_id, course_id)` rule first. Do not build it without confirmation.

### Tests for Batch B

Follow `tests/admin-upi-database.test.ts` and `tests/admin-upi-payments.test.tsx`.

- SQL (migrated PGlite): admin approves a pending UPI order: order paid, enrollment and `purchase_access` rows exist, outbox receipt row exists, approval row and audit row exist with the right details. Second call returns `alreadyPaid` and creates no duplicate rows. Non-admin actor (student, support) is refused. Wrong amount refused. Non-UPI order refused. Unbound order (null `provider_order_id`) refused. Reused UTR refused. Gateway `COMPLETED` refused. Unmatched-credit amount mismatch refused. Cancelled order refused (default).
- Handler: support role gets 403. Unauthenticated gets 401. Missing MFA gets the existing `MFA_REQUIRED`. Invalid body gets 400. Rate limit works.
- Panel: button visible only for pending rows. Dialog validation (reason length, amount match, checkbox rule). Success reloads. Error stays open. Manual badge in History.
- **Refund check:** after a manual approval, run the existing refund request and evidence flow on that order. Confirm the refund evidence and eligibility still work and that the financial snapshots are unchanged. If refund evidence depends on gateway data that manual approvals do not have, report it as a finding instead of silently patching it.
- Existing UPI tests (`upi-*.test.*`, `shared-upi-purchase`, `payment-*`) must still pass unchanged.

---

## Batch C: Wide-screen layouts (task 4)

### What is wrong today (verified by screenshots at 2560x1440 and by CSS)

- Public pages: `.container` in `globals.css` is `width: calc(100% - 96px); max-width: 1280px`. At 2560px the header, content and footer sit in a 1280px column with about 640px of empty space on each side.
- Other fixed caps: `landing.css` 1240px, `video-learning.css` 1240px, `payment-gateway.css` 1120/1044px, `purchase.css` 1040px, `auth.css` 1060px. The student dashboard is already capped at 1720px (`student-dashboard.css`).
- Admin: `admin.css` has a 280px sidebar and a `minmax(0, 1fr)` content area with no maximum width, so tables and forms stretch across the whole screen on 2560px and ultrawide displays.
- The festival intro video overlay is capped near 1600px. That is fine.

### Principle

All changes go inside `@media (min-width: 1600px)` (and nested larger steps). **Nothing may change at 1440px and below.** Compare screenshots at 1440x900 before and after to prove it.

### Plan

1. Add tokens in `globals.css`: `--container-max` (1280px by default, 1440px at 1600px and up, 1680px at 1920px and up, 1840px at 2560px and up) and `--gutter` (96px by default; larger at wide sizes). Change `.container` to `max-width: var(--container-max)`.
2. Apply per page type:
   - **Widen:** homepage and landing sections, course catalogue/grid (more columns via `repeat(auto-fill, minmax(...))`, not larger cards), course detail, header and footer (use the same container), the learning player (the video plus curriculum sidebar can use more width; cap the video at about 1680px so it stays crisp), the student dashboard (already 1720px; raise modestly at 2560px), and the admin area.
   - **Keep narrow and centred:** login, signup, reset, device pages, checkout and payment gateway pages, legal text, forms and long-text measures (about 60 to 75ch). A narrow form centred on a 2560px screen is correct.
3. Admin on wide screens: sidebar 280px up to 1919px, 300px from 1920px. `.admin-main` gets a centred `max-width` (about 1800px at 1920px, about 2200px at 2560px). Dashboard card grids use `auto-fit` so extra width gives extra columns. Tables get more room, not bigger text.
4. Typography: use `clamp()` for hero headings and section titles so they grow a little at wide sizes. Do NOT scale the root font size unless you first confirm the CSS uses `rem` widely. If it does, a small step (such as 112.5% from 2200px) is allowed and must be checked everywhere.
5. Hero and viewport units: check any `vh`-based hero heights and background images at 2560x1440 and 3440x1440 (21:9). Make sure nothing is stretched, cut off or left with big empty bands.
6. Decorations: the Diwali header lights and decorations (`diwali.css`, `header-lights.css`, `payment-fireworks.css`) have their own `min-width: 1280px` rules. Check them at 1920, 2560 and 3440. They must stay aligned to the layout and not float in empty space.
7. Do not touch festival video behaviour (autoplay once, skip, replay).

### Verification for Batch C

Screenshot before and after at 1440x900 (must be identical), 1920x1080, 2560x1440, 3440x1440, light and dark, for: home, course list, course detail, login, student dashboard, admin overview, admin orders, admin UPI payments, learning player, checkout. Also check no horizontal scroll and no layout shift on resize across 1599 to 1600 and 1919 to 1920.

---

## Batch D: Final verification

1. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit`, `npm test`, `npm run build`, and the release Playwright suite (`npm run test:release`; read its environment setup first, it should use its own synthetic config and port 3100).
2. A short written summary listing: files changed, migration name, tests added, screenshots taken, and anything not verified (for example real payment provider behaviour, real devices, hosted database).
3. Mention clearly: the migration has NOT been applied to any shared database and must be applied, reviewed and tested on staging before the app is deployed. The rollback is to revert the app first. The new table and functions are additive and can stay.

## What was and was not verified when this plan was written

Verified: the latest commit on `main` is `6960488`; the `perf-optimizations` branch is not in `main`; the phone CSS hides the sidebar bottom block that holds Sign out; settlement only moves `pending` orders and finds orders by `provider_order_id`; the public container is capped at 1280px (screenshot at 2560px); the admin has no content width cap.

Not verified: the admin screens were not screenshotted on a phone (the local demo run timed out), so the per-panel overflow list in Batch A comes from the CSS and must be checked in a browser. Refund behaviour after a manual approval was not traced. Hosted database state was not inspected.
