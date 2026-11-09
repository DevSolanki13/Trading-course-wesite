# Phase 2: implementation results and your browser checklist

Date: 9 November 2026

Status: **Code implementation and non-browser verification complete. Browser/visual acceptance is pending with the user.** No browser automation, Playwright, Lighthouse or browser tools were run in this phase, as requested.

## Changes and their use

| Area                           | Before                                                               | After / use                                                                                                                                                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Greeting video                 | 15,193,616 bytes                                                     | 9,317,016 bytes: **38.7% smaller**, reducing download work. Full 10 seconds, 1920×1080, 24 fps and original AAC stereo audio retained.                                                                                                                                                   |
| Video startup/delivery         | Original source URL                                                  | Versioned MP4 with metadata before media bytes (`faststart`), verified byte ranges, correct MIME and year-long immutable caching. Autoplay timing and player controls were not rewritten.                                                                                                |
| Dark wordmark                  | 170,701-byte PNG                                                     | 91,264-byte lossless WebP: **46.5% smaller**, identical visible pixels and dimensions.                                                                                                                                                                                                   |
| Light wordmark                 | 156,673-byte PNG                                                     | 86,440-byte lossless WebP: **44.8% smaller**, identical visible pixels and dimensions.                                                                                                                                                                                                   |
| Dark/light compact marks       | 23,137 / 22,094-byte PNGs                                            | 16,240 / 15,702-byte lossless WebPs: **29.8% / 28.9% smaller**.                                                                                                                                                                                                                          |
| Theme-logo loading             | Two eager images; missing intrinsic dimensions                       | Native lazy loading keeps CSS-hidden/offscreen artwork deferred; intrinsic dimensions reserve space. Hover, keyboard focus or click warms only alternate artwork present on the page. First theme change normally waits for decode to avoid a blank logo.                                |
| Theme robustness               | Immediate theme assignment                                           | Latest-click tracking prevents stale completion during rapid toggles. A failed image or 1.2-second safety timeout cannot permanently block switching. An exceptionally slow/failed asset can still appear late; check this manually.                                                     |
| Brand caching                  | Auth proxy forced `private, no-store`, overriding asset cache policy | Only the public brand folder now skips auth interception, like the existing public video/image folders. Versioned logos have verified immutable caching. Protected pages and API routes remain intercepted.                                                                              |
| Uploaded course images         | Original upload downloaded at every display size                     | Five allowlisted widths: 160, 320, 640, 960, 1600. Native responsive `srcset`/`sizes` selects suitable card, detail, admin, dashboard and compact-sidebar delivery. Smaller variants preserve aspect ratio and never upscale/crop.                                                       |
| Thumbnail endpoint             | Original immutable UUID-based upload                                 | Existing URL without width still returns original bytes; 1600 does too. Smaller widths are generated on request. Invalid/duplicate widths are rejected before storage reads. Existing UUIDs, upload authorization, publication rules, storage queries and database schema are unchanged. |
| Loading priorities             | Full-size course detail and card images                              | Details remain eager/high priority; cards and other thumbnails default to lazy/async decoding. Existing CSS sizing/cropping, artwork fallbacks and editor error handling remain. Video poster uses the 960px variant for public uploads.                                                 |
| External/protected/data images | Direct delivery                                                      | Unchanged URLs. Only recognized public upload paths get transformed. MFA and payment QR data images retain `unoptimized`; the externally configured instructor portrait retains it rather than enabling unrestricted server-side fetching.                                               |
| Annotation font                | Forced 50,964-byte Caveat preload on the homepage                    | `preload: false`; browser can request it when annotations actually use it. Exact font file, family, weights, glyphs, fallback metrics and headline fonts retained. No font subset was deleted.                                                                                           |
| Regression coverage            | Existing tests                                                       | Added media-byte/MP4-ordering, lossless-pixel, responsive URL, variant-route, proxy matcher and theme decode/race/failure/timeout tests; updated editor expectations without changing saved thumbnail URLs.                                                                              |

Original MP4 and PNG assets remain untouched for comparison/rollback. Versioned `v2` files must not be overwritten after deployment; use a new filename for future replacements.

## Evidence

- Production build: **passed**, including the revised proxy matcher.
- ESLint and TypeScript: **passed**.
- Component/API unit suite: **152 passed in 25 files**. Uses jsdom and mocked data boundaries, not a browser.
- Node/backend/asset suite: **62 passed**. Includes local database isolation, video box/duration/track checks and logo pixel comparison on black and white backgrounds.
- Production HTTP checks against an isolated release preview: all five new assets returned **200**, correct MIME/length and `public, max-age=31536000, immutable`; video range request returned **206**, `bytes 0-1023/9317016`, exactly 1,024 bytes. Raw HTTP conditional brand request returned **304**.
- Anonymous dashboard/checkout/account checks still returned redirects with **`private, no-store`**. Matcher tests retain interception for private routes and thumbnail APIs. No shared database/provider calls or writes were used for these checks.
- Built Caveat font bytes equal the original 50,964-byte font. Homepage HTML/response hints no longer force-preload that file. Actual width-dependent browser font downloading is **not yet verified**.
- FFmpeg comparison over all 240 frames: **SSIM 0.992011**. This is automated similarity evidence, not human visual approval or a claim of pixel-identical video.
- Existing announcement file-tracing warning remains. It is unrelated cleanup/build work; not hidden or marked fixed here. Downloaded encoding tools under ignored artifacts were not found in production `.nft.json` traces.

The video was encoded with the executable from pinned `@ffmpeg-installer/win32-x64@4.1.0`, obtained as an ignored local tool, not added as a project dependency:

```text
ffmpeg -i ORIGINAL.mp4 -map 0:v:0 -map 0:a:0 -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a copy -movflags +faststart indianxtrade-greeting-v2.mp4
```

Logos use the existing Sharp installation with `webp({ lossless: true, effort: 6 })`, without resizing. Thumbnail variants use quality 82; full-size originals remain byte-identical. Their visual sharpness still needs your review. First uncached variant requests do image processing; immutable caching benefits subsequent requests. No CDN hit rate or whole-site speed increase has been measured in this phase.

## Your browser checks

Use your normal local app, not the isolated evidence preview. Restart the normal development server if configuration changes have not loaded. For representative speed comparisons, use a production build/start on a free port; development compilation is not production latency.

1. **Fresh greeting:** open a new private window. Confirm immediate muted autoplay, complete content, Skip during loading, Close after ending and Escape. Compare video quality with the retained original URL. Check both desktop and phone-sized views.
2. **Returning visit/replay:** reload the same window; greeting should not auto-open again. Click the homepage greeting/replay control; check playback, close and keyboard focus returning to the triggering control. To repeat first-visit checks without deleting login data, remove only `indianxtrade-diwali-video-seen` from local storage.
3. **Themes/logos:** switch dark/light with mouse, keyboard and phone tap; try rapid double clicks and reload with each saved theme. Check that logos remain sharp and correctly sized, with no blank flash or layout movement. Repeat with Slow 3G; report any noticeable switch delay or logo flash.
4. **Course images:** check homepage/catalogue cards, course detail, student courses/explore, player sidebar/poster and admin list/editor. Inspect the same image at 1×/2× display density if available. Check sharpness, cropping and layout against the original.
5. **Thumbnail replacement:** in a test course, upload a different image, save and reopen. Confirm the new image appears across the app with a new UUID URL. Confirm remove/error/fallback behavior and an existing external HTTPS image still work. Do not change a live course just to test.
6. **Fonts/animations:** compare desktop at 1440px and mobile at about 390px, in both themes. Check handwriting, headline fonts, no new layout jumps, and unchanged hero, ticker, carousel and order-detail animations.
7. **Network evidence:** DevTools → Network. With cache disabled, capture a cold load at identical viewport/throttle settings. Check the new greeting URL, active-theme logos and thumbnail `?w=` requests (compact sidebar should choose a small width). Check the Fonts filter below/above annotation breakpoints. Do not assume all declared font subsets download. Then enable caching and reload for a warm comparison; inspect transfer/cache columns. Confirm inactive logos do not eagerly download until theme intent/visibility requires them. Save both HAR captures if you want a measured comparison.
8. **Error resilience:** temporarily block the new MP4 request and confirm you can close the error state and continue. Unblock it and replay. Block the alternate logo while switching and confirm the theme control does not stay stuck; restore requests afterward.

- [ ] Visual/video quality accepted.
- [ ] Desktop/mobile and both themes accepted.
- [ ] Autoplay/skip/replay/focus/error behavior accepted.
- [ ] Thumbnail replacement, sharpness and privacy behavior accepted.
- [ ] Actual font, active-theme and cold/warm browser network evidence captured.

## Scope and handoff

Policy: preserve all features, animation styling, fonts and access rules; no browser testing, deployment, hosted-data mutation or unrequested cleanup. Required skills used: `gravitas` and `karpathy-guidelines` for surgical implementation/evidence; React best practices and installed Next.js docs for delivery; `make-interfaces-feel-better` to preserve visual geometry rather than redesign; Supabase guidance for unchanged storage boundaries; verification/routing guidance for HTTP cache checks and the narrowly scoped public-brand exclusion.

P2.1-P2.6 implementation is finished. P2.7 and browser-dependent acceptance portions of the earlier tasks remain open until you perform the checklist. Phase 3 has not started. No commit/push was made.
