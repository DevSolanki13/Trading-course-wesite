# Cleanup and speed implementation

Implemented the approved behavior-preserving items from [the cleanup guide](../GlobalBulls-cleanup-and-speed-guide.md). Application copy, layout, colors, course cards, theme storage, player controls and payment providers were preserved. No deployment, remote database mutation or change to the local secrets file was performed.

## Changes

| Area            | Result                                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dead code       | Removed four unreferenced legacy components and their now-unused learning API client. Kept the active learning backend, leases, heartbeat SQL and refund evidence.                                                                                                                                     |
| Demo isolation  | Vercel production/preview cannot select local authentication, even when demo switches are set. Local development keeps its documented demo logins. New explicitly enabled production test seeds use an environment-supplied or random password; existing credentials are not rewritten.                |
| Validation      | Shared parser factory preserves each handler's original error message selection, status and error code.                                                                                                                                                                                                |
| Authentication  | Header, catalogue and course actions share one authentication request per route. Navigation and window focus refresh the session. Earlier requests cannot overwrite a newer session or a cleared logout. No browser-readable cookie shortcut is used.                                                  |
| Catalogue data  | Successful public catalogue/content/settings reads are cached for five minutes. Relevant successful admin writes immediately invalidate public data and public routes, including individual course pages. Cache keys use the runtime Supabase project, and transient settings failures are not cached. |
| Animation       | Eliminated duplicate animation scheduling, stopped frame work for reduced motion/hidden tabs, and skipped invisible-card updates. Preserved all cards, the curved geometry, declared speed, opacity calculation and hover slowdown. Batched annotation geometry reads before style writes.             |
| Images          | Lossless PNG compression reduced the About image from 2,183,099 to 1,897,916 bytes (13.1%). Original source pixels, URL, dimensions and rendered screenshots are unchanged. A WebP variant was evaluated but not retained because the image optimizer produced small pixel differences.                |
| Fonts           | Bundled the exact existing Latin Caveat/Newsreader WOFF2 assets and their licenses. Kept preloading, swap behavior, weights, styles and fallback metrics. Builds no longer fetch these fonts from Google.                                                                                              |
| CSS             | Extracted shared catalogue/admin table styles before workspace-only styles while preserving their order. Public course routes no longer import the workspace stylesheet. Removed unused legacy learning selectors and consolidated the existing green theme tokens into the shared stylesheet.         |
| Deferred panels | Admin panels, the optional catalogue learner panel and the student player load through dynamic imports when rendered. Panel contents and controls are unchanged.                                                                                                                                       |
| Documentation   | Updated [DESIGN.md](../DESIGN.md) to describe the existing GlobalBulls implementation instead of the superseded Market Method/blue theme. Kept historical identifiers and the saved theme key.                                                                                                         |

Public course CSS was reduced from approximately 37 KB to 16 KB before compression. The old learning stylesheet was reduced from approximately 12 KB to 1 KB, retaining active refund controls and native progress styles.

## Verification

- Production build passes.
- Lint, TypeScript and all 43 server/database tests pass.
- All 17 unit tests pass, including authentication races and public-cache invalidation.
- The 32 existing release checks pass across desktop/mobile and light/dark themes. The eight new cleanup checks pass after a focused rerun, including shared authentication, catalogue layout switching and keyboard access to deferred learner panels.
- Focused local demo checks pass for admin panel navigation and opening the deferred student classroom, saving completion and reloading saved progress. These do not establish real-provider playback acceptance.
- Compared 20 page/theme/viewport combinations with the pre-change build. All collected heading, hero, course-grid and image layout measurements match. Catalogue/login/About screenshots match pixel-for-pixel; homepage differences are confined to minor marquee compositing pixels, with no geometry or typography change.
- An isolated production-server exercise confirmed repeated public reads share their database queries, two runtime projects using one build do not share cached content, and a transient settings failure is retried on the next request.

The release test launcher now supplies a successful, local-only empty Supabase catalogue fixture. The application's existing sample courses are then exercised deterministically. The former invalid project URL made course pages return 404, including in the pre-change build; that setup could not validate course interactions reliably.

The new mobile admin-panel test uses keyboard activation after layout switching. Pointer automation in that sequence was unreliable; the existing stylesheet and extracted stylesheet were separately checked and produced matching button bounds and hit targets. No mobile admin redesign was attempted.

## Performance measurement

The initial mobile Lighthouse run scored 69 performance and 100 accessibility, with approximately 6,786 ms total blocking time, 1.07 s LCP and 0.0024 CLS. Optimized runs ranged from 88 to 98 performance. The final run, after stopping the other test servers, scored **88 performance and 100 accessibility**, with approximately **452 ms blocking time, 1.22 s LCP and 0.0023 CLS**. An earlier run reached 98 performance and 126 ms blocking time, but that best score was not reproduced consistently.

These are local synthetic measurements, not production or field Core Web Vitals. Lighthouse reported a load-time-limit warning during these runs, so its results may be incomplete. The guide's 90 performance / below 300 ms blocking-time targets are **not yet consistently met**, and the final performance command exits nonzero. Do not treat the earlier best score as a production guarantee. Raw local outputs are stored under the ignored artifacts directories.

## Deliberately retained or deferred

- Per-request CSP nonces, private HTML responses and server-rendered role personalization remain. Only public data is cached; shared full-page caching would require a separate security/personalization design.
- Homepage claims, ticker content, card count and phone animations remain unchanged.
- Indexing remains disabled until launch readiness is confirmed. No production indexing switch was enabled.
- Payment providers/routes and runtime database/password dependencies remain. The installed PDF font library references regeneratorRuntime, so its supporting runtime was retained.
- Vercel region, production environment variables and Supabase region were not changed.
- The production paid-video credential/watch-heartbeat issue identified in the guide remains a separate functional repair and staging acceptance task. No real purchase, provider credentials or remote data was used in these checks.
