# Phase 4: learning platform and protected playback

Updated: 30 October 2026, IST. **Core implementation delivered; browser DRM acceptance and purchase integration remain pending.** Cashfree/Phase 3 is deferred at the owner's request. Phase 4 is not marked fully accepted merely because a provider OTP or production build succeeds.

## Implemented

| Area                 | Behavior                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student library      | `/learn` displays actual active enrollments, progress, resume links and published courses to explore. A useful empty state appears when no courses have been assigned. Profile and device controls remain under `/account`, which links to the library.                                                                                                         |
| Classroom            | `/learn/[slug]` provides ordered modules/lessons, completion indicators, duration, locked lessons, public published previews and an expandable mobile curriculum. Data comes from the database, not the illustrative public catalogue.                                                                                                                          |
| Protected access     | Paid lesson notes and tokens require a verified admitted session and an active manual grant or matching paid order/enrollment. Draft lessons/courses, pending/refunded purchases and revoked access are denied. Provider asset IDs and notes are excluded from public curriculum DTOs.                                                                          |
| Provider integration | VdoCipher OTP/playbackInfo is generated only by the server after authorisation. OTP issuance TTL is 120 seconds; it is not a stream termination timer. Provider secrets remain backend-only. No course MP4 endpoint, download or offline feature is added.                                                                                                      |
| Watermark            | The authenticated learner's email is passed as a moving watermark; guests receive a public-preview label. Automatic approval review initially rejected email disclosure; the exact action was subsequently manually approved. The privacy policy and player-start copy disclose the identifier. Emails, secrets and tokens are excluded from logs/test reports. |
| Player controls      | Responsive iframe and VdoCipher v2 API, resume seek after metadata loads, explicit 0.5–2× speed selector, built-in provider quality controls, focusable wrapper Space/arrow shortcuts, PiP disable request, mark complete/incomplete, next lesson and optional auto-next playback. Browser autoplay/PiP behavior remains platform-dependent.                    |
| Resume/completion    | Progress is server-owned and survives browser-local data clearing. Completion is a separate boolean and never awards watched duration. Resume pulses are normally every ten seconds plus play/pause/seek/rate events. Interrupted navigation can lose the final unsent interval.                                                                                |
| Watched time         | A server-timed lease validates sequence, user/session/lesson and current entitlement. It accumulates a union of millisecond intervals, so replay is not counted twice. Seeks, impossible jumps and late pulses receive no interval credit; time is bounded by real elapsed time at at most 2×. Preview lessons are excluded from paid-course consumption.       |
| Concurrent playback  | Two admitted devices remain allowed. Starting a new authenticated player replaces the user's previous learning lease; the older player fails its next heartbeat and pauses. Only one player can accrue watch time per learner at once. This prevents parallel tabs/devices multiplying credited time.                                                           |
| Notes/resources      | Authorised notes and text worksheets render safely as plain text within the classroom. No public storage URL or download action is exposed. Browser-visible text can still be copied, printed or photographed. Binary/PDF attachments need a separately reviewed viewer/storage workflow; this phase provides text resources.                                   |
| Orders/refunds       | Private order history displays recorded states, totals and IST times. Eligibility display requires immutable paid time/policy/duration/lesson snapshots that match the current curriculum; missing/changed snapshots require support review. No payment or refund API is enabled. Invoice generation is Phase 3; refund requests/processing are Phase 5.        |
| Community            | Public Telegram/Instagram links come from validated settings. A private Telegram invite is returned only for an active qualifying paid purchase and a future invite expiry. Manual course grants alone do not unlock the private group. Missing/expired links produce explicit unavailable states.                                                              |

## Database and code

[Migration 004](../backend/database/migrations/202610300004_learning.sql) is applied to staging using the existing transactional checksum-ledger runner. It adds lesson progress, a private playback lease, private text resources, community settings, admitted-session progress RLS and five service-role-only learning RPCs. Original applied migrations are unchanged.

The verifier checks **four migration checksums, 18 RLS-protected tables, nine auth RPCs and five learning RPCs**, restricted writes and baseline triggers. No anonymous/authenticated client can write progress, create enrollments, read private assets or call the privileged learning RPCs directly.

Implementation follows the existing single-package layers: [backend learning services](../backend/learning), [learning HTTP handler](../backend/handlers/learning.ts), [frontend library](../frontend/components/learning-library.tsx), [classroom](../frontend/components/learning-workspace.tsx), [player](../frontend/components/protected-player.tsx) and [shared serialisable contracts](../shared/learning.ts). The shared folder contains types only, preserving frontend/backend import boundaries. Styling uses the owner's obsidian/slate/electric-blue system.

## Verification and evidence

- Lint, strict TypeScript, production build and **18 automated tests** passed. The learning SQL tests run real PostgreSQL-compatible constraints, grants, lease replacement and multirange behavior in disposable PGlite.
- Live staging tests used two disposable accounts and one temporary course. Public preview, non-buyer/draft denial, private notes, provider-ID isolation, real VdoCipher credentials, resume, completion, heartbeat replay rejection and lease replacement passed.
- Synthetic pending/paid/refunded records exercised entitlement checks. These were fixture records, **not Cashfree payments**. Refund eligibility without a complete purchase snapshot correctly fails closed.
- The library/classroom passed **12 route/viewport/theme combinations** at 1440/390/360px, with no overflow or targeted WCAG A/AA Axe violations. Mobile curriculum open/close was tested.
- The browser SDK contract simulation passed: real UI events saved resume/watched time through the API into the database, speed selection worked and auto-next loaded the next lesson. This test-only simulation is explicitly separate from actual DRM verification.
- Actual headless Chrome playback did not advance. A separate provider probe reproduced the error independently of the application, and both isolated incognito and persistent profiles reported **Widevine unavailable**. The provider displayed a protected-content/browser-settings error. Token generation and metadata are working; the configured video is reported ready with a 168-second duration. Actual DRM playback, visible watermark and physical Android/iPhone acceptance are **not claimed passed**.
- Disposable identities and their course/order/enrollment/progress/resource/session records were removed after each suite. No real owner role or purchase was modified. Local test screenshots/reports and isolated browser profiles remain ignored.

Run from the repository root against a current local production preview:

```powershell
npm run check
npm run db:verify
npm run test:learning
npm run test:ui
npm run smoke
```

`test:learning` requires the staging keys and configured VdoCipher test video. It creates only disposable users/data and performs real provider calls. It is not an automatic CI job. Use `npm run test:learning -- --api-only` for a focused provider/access/progress check without repeating browser audits. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a browser installation if Playwright Chromium is not installed. The script reports PARTIAL and returns nonzero when functional checks pass but actual playback is not confirmed. A FAIL line identifies a test or cleanup failure. Read the safe report and console results rather than treating an SDK simulation as DRM verification. Do not treat a simulation as a successful DRM integration.

## Remaining acceptance

1. Verify actual playback in a normal supported Chrome/Edge browser with protected content allowed, and on Android Chrome/iPhone Safari. Confirm the moving watermark, quality selection, speed, resume, keyboard controls, auto-next and handling of blocked playback. The automated browser's Widevine failure must not be bypassed by exposing unprotected video files.
2. Map real course/module/lesson records to processed provider videos and approved notes/durations; publish intentionally. No fake enrollment or public sample course was left behind for the owner's real account. The account library is empty until actual records/grants are configured. Content-management UI is Phase 5.
3. Finish Phase 3 to verify a real sandbox purchase-to-enrollment-to-playback flow, receipt viewing and immutable curriculum/policy snapshots. Actual invoice download remains a Phase 3 task.
4. Supply official community links and, if desired, a Telegram invite whose expiration/revocation is also configured at Telegram. The database expiry hides the invite after its deadline but cannot revoke a copied external link by itself. Member removal automation remains later work.
5. Confirm provider behavior for already-running streams after access/device/refund revocation. Server APIs and heartbeat saving reject immediately; the browser pauses on its next pulse. A client can block/modify JavaScript and OTP expiry does not necessarily terminate an active provider stream.

## Operator content contract

Courses must be published, modules ordered, and lessons published with verified durations between one second and 24 hours. Store each provider video ID only in the private lesson-assets table. Store notes there and optional text worksheets in lesson resources; never copy provider credentials into public course metadata.

Active manual enrollments are owner-controlled grants. Purchase enrollments must reference a paid order with the same user/course. There is no client enrollment endpoint or demo access bypass. Grants/publishing through the database require an authorised operator; Phase 5 will supply the corresponding audited admin UI.

For future Phase 3 snapshots, use a server-owned course snapshot containing `title`, `duration_seconds` for non-preview content, and `lessons: [{ id, duration_seconds, is_preview }]` for the complete published lesson version. Incomplete or mismatched snapshots are not enough to approve a financial eligibility calculation. Current watched history is per user/lesson; repeated-purchase/version migration rules require explicit treatment before refund automation.

Telemetry validates plausible reported playback; it cannot prove human attention or defeat a fully modified browser. Conservative rejection of late/seek samples can undercount. This limitation and handling of disputes must be accepted before automated monetary refund decisions.

Official implementation references: [OTP API](https://www.vdocipher.com/docs/server/playbackauth/otp/), [watermark annotations](https://www.vdocipher.com/docs/server/playbackauth/anno/), [player API](https://www.vdocipher.com/docs/player/v2/api-reference/accessing-player/), [video proxy APIs](https://www.vdocipher.com/docs/player/v2/video-apis/) and [player options](https://www.vdocipher.com/docs/player/v2/config-player/).
