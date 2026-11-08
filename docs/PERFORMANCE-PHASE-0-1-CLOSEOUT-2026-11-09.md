# Phase 0-1 local implementation closeout

Status: **COMPLETE for local implementation and acceptance. Phase 2 has not started.**

This closes the measurement and interaction-fix phases, not a production release. Hosted authentication, real payment/DRM providers, physical devices and field Core Web Vitals remain Phase 7 checks. No production deployment or shared-database change occurred.

## Evidence

- [Preservation inventory and scope](./PERFORMANCE-PRESERVATION-INVENTORY-2026-11-09.md) names public, student, admin/support, checkout, receipt/refund and player capabilities.
- [Production acceptance report](../artifacts/optimization/acceptance.json): **12 passed, zero failures/skips**, across desktop/mobile and both themes. Covers authenticated student/admin flows, playable lesson controls, current-lesson reselection, notes/resources, confirmed payment display, empty search, order loading/error/retry, frame-by-frame entry, focus restoration, carousel hover/resume and reduced motion.
- Additional [rapid-switch browser test](../tests/optimization/order-switching.spec.ts): **four passed**, including real touch taps in both mobile themes. Traces under [rapid-order evidence](../artifacts/optimization/rapid-order-traces) show a delayed first response cannot replace the second selection, and dismissal restores focus.
- Public baseline: 16 screenshots from the earlier capture. New acceptance output includes private-page screenshots, loading/error/empty states, videos and browser traces. Representative mobile player and halfway order-entry screenshots were also visually inspected.
- [Navigation baseline](../artifacts/optimization/phase01-accepted-baseline-20261109/navigation.json): **33 completed samples**, three per scenario/cache combination. Raw samples include API timing, requests, transferred JS/CSS/media bytes, LCP, session-window CLS, long tasks and fixed-window blocking time. No Lighthouse score is used as this baseline.
- [Public-data cache probe](../artifacts/optimization/public-cache/result.json): first request reads courses/content/settings once each; subsequent homepage/about/course-detail requests perform no further catalogue reads. HTML remains `private, no-store`.
- Core interaction regression evidence: 142 React/unit tests and 57 backend/SQL/security tests passed in the preceding batch; the production release-browser suite passed all 48 checks. The dedicated local production build passed with the already-recorded announcement-storage tracing warning. Final command reruns are recorded in the main results log.
- Final rerun: **142 unit tests and 57 backend tests passed**; lint and type check passed. Syntax checks passed for the new measurement/preview runners. Formatting and diff checks are included in the handoff validation.

## Measurement conditions

[Navigation runner](../backend/scripts/measure-phase01-navigation.mjs) starts its own loopback production fixture with a unique disposable database, primes it, and checks student/admin login before sampling. It does not use the user's port-3000 application. The separately built local production fixture uses build-origin 3113; the API test client supplies that origin for fixture login while navigation is isolated on 3115. No application authorization or origin rule was changed.

Chromium 156, 390x844, normal motion, 150ms emulated network latency, 204800 bytes/second download and 4x CPU slowdown. Cold/warm mean browser-cache state with the server/database already primed. Each sample observes five seconds after DOM readiness; it is not a whole-session or whole-video measurement. Streaming bytes are bytes received during that observation, not the complete video file size. First-visit samples retain real greeting autoplay; all three reached playable ready state with advancing playback time.

LCP/CLS are limited to this observation window. CLS uses the maximum shift session with a one-second gap/five-second window and excludes recent input. Blocking time is the sum of long-task duration above 50ms after FCP through observation end: **not standardized Lighthouse TBT or field INP**. Raw API timings include the configured network delay. Cached JS/CSS transfer can be zero without removing the request or its execution.

These measurements follow the core Phase 1 fixes and precede Phase 2. They establish a reliable next-phase baseline, not retroactive proof of a Phase 1 speed gain. Earlier incomplete Lighthouse runs and unprimed/mixed-scenario attempts are diagnostic history only.

## Baseline: median [minimum-maximum]

Times are milliseconds. Transfer is decimal kB within the observation window. Full ranges for every recorded metric remain in the linked JSON.

| Scenario               | LCP              | CLS    | Blocking      | Transfer | Requests |
| ---------------------- | ---------------- | ------ | ------------- | -------- | -------- |
| Home returning, cold   | 2172 [2088-2232] | 0.0285 | 352 [349-403] | 801.6    | 33       |
| Home returning, warm   | 800 [676-864]    | 0      | 210 [147-420] | 366.4    | 33       |
| Home first video, cold | 2144 [2132-2168] | 0.0285 | 607 [521-635] | 1281.0   | 34       |
| Course detail, cold    | 1776 [1620-1848] | 0.0291 | 333 [270-950] | 703.4    | 38       |
| Course detail, warm    | 1168 [1028-1268] | 0      | 373 [305-391] | 368.4    | 38       |
| Login, cold            | 992 [968-1220]   | 0.0802 | 326 [319-346] | 638.9    | 31       |
| Login, warm            | 344 [336-568]    | 0.1904 | 370 [288-397] | 350.4    | 31       |
| Student, cold          | 1980 [1964-2032] | 0.0096 | 465 [447-467] | 698.8    | 31       |
| Student, warm          | 1056 [1056-1100] | 0      | 310 [32-313]  | 351.4    | 31       |
| Admin, cold            | 4140 [4132-4140] | 0.0039 | 544 [521-555] | 711.2    | 31       |
| Admin, warm            | 1932 [1872-1940] | 0.0148 | 357 [288-393] | 349.6    | 31       |

### Budgets for subsequent work

- Compare each route/cache/video scenario separately at these same settings, with three runs and median/range. Investigate an LCP or blocking median regression above 10%; never trade away behavior for a score.
- Route-specific cold LCP regression-review ceilings: home returning 2389ms, first-video home 2358ms, course detail 1954ms, login 1091ms, student 2178ms, admin 4554ms. These are tolerance thresholds, **not acceptable final speed goals**. Admin's 4140ms baseline already needs improvement in Phases 3/5.
- Phase 2 delivery target: at least 20% lower returning-home median transfer if visual review permits, without higher initial JS/CSS or moving delay to first interaction. Set the greeting-file encoding target only after inspecting candidates; preserve complete content and immediate skip/replay.
- Target CLS <=0.1 for every scenario. The baseline exposes a warm-login median of 0.1904 and individual course/admin outliers of approximately 0.378/0.376. Track these in font/image/layout work in Phases 2/5; Phase 0 completion does not mean they are fixed.
- Admin records two identity requests per navigation; retain this explicit Phase 3 deduplication target. No identity or private data was publicly cached.

## Phase 1 acceptance

| Requirement                                                                                           | Verification                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lesson/order correctness, stale responses, dismissal/reconciliation, filter retry, hidden-tab polling | Existing focused React regressions and authenticated production journeys.                                                                                                                                                                                 |
| Inline animation with following rows displaced, interrupted reopen, no ending gap                     | Unit interruption/reduced-motion tests, four-project release test, and production start/halfway/end frame inspection. Entry/exit remains approximately 280ms; opacity retains its 180ms timing.                                                           |
| Carousel timing and full content                                                                      | All 16 cards remain. Actual frame transforms move, ease toward a hover stop and resume; reduced motion stops and re-enabling it restarts movement. The path/radius/direction/speed implementation was not replaced.                                       |
| Ticker continuity and bounded transitions                                                             | Identical ticker halves; CSS source comparison confirms original timings/curves for 22 tracked-HEAD `all` declarations plus the pre-existing working-tree action-button case. No `transition: all` remains in frontend styles.                            |
| Focused player controls                                                                               | Real authenticated owned-lesson fixture stays visible during focused keyboard seeking. Play/pause, seek, volume, captions and speed are exercised. Fullscreen/PiP code and policy are unchanged; provider/native-device acceptance remains Phase 7.       |
| Appearance and repaint investigation                                                                  | Both themes and viewport sizes captured; blur(12px), shadows and gradient masks remain in computed styles. Rendering traces preserve Paint/Layout/style work for inspection. No causal evidence justified stripping an effect or changing a visual layer. |

Rendering profile: desktop dark/light Paint totals were approximately 200/210ms, Layout 10.6/11.0ms, and style updates 62.8/64.7ms over the recorded interaction. Mobile dark/light Paint totals were 137/154ms and Layout 1.8/1.6ms. Recorded frame-gap medians were 50ms desktop and 16.7ms mobile under tracing/video overhead. These are **not** physical-device dropped-frame counters or proof of 60fps. Deeper real-device performance acceptance remains Phase 7; no effect was removed to hide a trace cost.

## Next

Phase 2 remains untouched. Start with media inspection, candidate encodes and responsive branding/thumbnail/font delivery, keeping originals recoverable and checking visual quality. No additional feature implementation is required to close the local Phase 0-1 gate.

VERDICT: PASS
