# Phase 1 implementation and acceptance

## Current delivery

### Landing redesign with the newly added skill

- **Audience and goal:** learners inspecting Hindi trading-education courses; the primary action is exploring the course catalogue.
- **Surface and density:** public marketing/trust surface, comfortable density.
- **Visual direction:** warm neutral-first dark surfaces, sage action colour, coordinated light mode, restrained elevation and strong typography. No hero image/video was reintroduced.
- **Structure:** text-led hero with real course-path links, learning principles, course collection, teaching process, live risk arithmetic, community readiness, FAQ and final CTA.
- **Typography/tokens:** existing self-hosted fonts, rem-based landing type, 1200px container, scoped semantic dark/light tokens, consistent panel/control radii.
- **Components/states:** actual course navigation and dialogs, consistent course cards, clear hover/focus feedback, visible coming-soon community states and unchanged disabled enrolment.
- **Responsive/accessibility:** current 48 route/viewport/theme checks and targeted homepage/course-page Axe audits pass. Catalogue controls, dialog behavior, mobile navigation, risk exercise and theme persistence remain working.
- **Implementation:** [home page](../frontend/pages/home-page.tsx) and [scoped landing styles](../frontend/styles/landing.css); no changes to purchase/auth/database flows. Application checks exclude the installed skill-source folder instead of modifying its vendor files.

Build, lint, type checking, 10 automated tests, formatting and HTTP smoke pass. The redesigned landing page's local mobile Lighthouse run scored **99 performance** and **100 accessibility**, with **0.9s LCP**, **0.002 CLS** and **110ms TBT**. These are local lab measurements, not field guarantees. Earlier Lighthouse numbers below are historical results for the previous design. Content/integration acceptance gaps remain unchanged.

Latest owner revision: removed the hero image and its matching ambient video entirely. The hero is text-led and its spacing no longer reserves a media column. Stored artwork remains available for the separate About-page image; previous background-video checks below describe the earlier preview, not the current hero.

Owner visual revision: removed the hero media gradient overlay in all themes and breakpoints. Desktop copy and media now occupy separate areas so the image stays clear and light-theme text remains on its own surface. The original poster/video and accessible playback controls are retained.

Public storefront implemented as a staging preview. The proposed name is **Market Method**, using the developer's delegated branding authority. Final business identity, instructor biography/photo, real curriculum/pricing, support/social links and policy approval remain owner inputs. No purchase, sign-in or private-content access is enabled by this phase.

## Implemented scope

- Homepage with original conceptual study artwork, silent ambient video, course collection, teaching approach, interactive illustrative risk exercise, lesson-format dialog, community readiness and FAQ.
- Searchable/filterable catalogue and three example course-detail pages with proposed modules, lesson metadata, outcomes, prerequisites, refund summary and disabled enrolment controls.
- Instructor/approach and contact/support pages that explicitly identify missing business inputs rather than inventing people or contacts.
- Draft Terms, Privacy, Refund Policy and Trading Disclaimer pages with a clear owner-review state.
- Shared typography, palette, header/footer, persistent dark/light theme, mobile menu, Radix dialog focus handling, native disclosures, keyboard focus, loading/error/empty/not-found states and safe-area-aware mobile purchase bar.
- Canonical metadata, social-image generation, sitemap, and explicit no-index/disallow rules for staging. These must remain until real content and launch gates are approved.

## Provisional content and access boundaries

The [public course data](../frontend/content/courses.ts) is an illustrative view model. It is not a payment source of truth and no demo course was inserted into the staging database. Global and per-course notices identify sample prices, totals and curriculum; selected modules are examples, not a claim to be the final complete course. The [site configuration](../frontend/content/site.ts) holds missing contact/social fields as null. The written preview dialog does not pretend to play an instructor video. The account page explains that authentication follows in Phase 2.

## Artwork and video provenance

- [Study artwork](../public/images/study-desk.png): generated with the built-in image tool; conceptual workspace photograph, no real instructor identity or trading performance implied.
- [Silent ambient loop](../public/videos/study-loop.webm): original 8-second, 15fps VP9 camera movement over that image, generated locally with [the asset script](../backend/scripts/generate-ambient-video.mjs). Approximately 364 KB. No third-party stock footage or audio used.
- Course-cover artwork is original, code-native geometry in [CourseArtwork](../frontend/components/course-artwork.tsx).
- Manrope Variable and IBM Plex Mono are self-hosted from the installed Fontsource packages; no browser request to Google Fonts.
- Ambient video loads only on sufficiently wide screens without reduced-motion/data-saving signals, pauses offscreen/when hidden and has a pause/play control. The optimised poster remains on mobile or when playback is unavailable.

Image prompt: wide photographic still life of a charcoal study desk, dark-green smoked glass geometric forms, an open ivory chart notebook, pencil and paper, soft mint side lighting, warm paper, deep shadows, no people, logos, readable text, profit claims or UI. Generated using the built-in image tool, not an API-key CLI fallback.

## Verification

The production build, lint/typecheck/format and existing 10 configuration/signature/database tests pass. Browser checks completed 48 combinations of route, viewport and theme with no horizontal overflow or runtime errors. Tested widths: 1440, 768, 390 and 360 pixels. Interactions include catalogue search/no-results/reset/filter, mobile menu navigation, dialog Escape handling, theme persistence and the illustrative calculator. Targeted mobile course-page Axe audits pass in both themes with zero reported violations after fixing accessible-name mismatches and a landmark omission. Actual non-reduced-motion playback, explicit pause → scroll away → return, explicit resume and removal of mobile video also pass. Public-route/404/sitemap/no-index HTTP smoke checks pass.

Mobile Lighthouse lab results on local production build: performance **92**, accessibility **100**, best practices **96**, SEO **69**. Search indexing is deliberately blocked for staging; the SEO score is not a launch endorsement. LCP **3.1 seconds**, CLS **0.002**, TBT **170 ms**. The stricter under-two-second landing target is not yet met under this test profile and remains a performance task. These results do not establish real-device/field performance.

### Independent focused review

| Finding                                              | Final verdict                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| Light-theme caption contrast                         | Resolved: contrasting backing and light text                       |
| Explicit video pause overridden by viewport observer | Resolved: persistent user intent independent from automatic pauses |
| Mobile course access/refund summary missing          | Resolved: dedicated mobile information section and policy link     |
| Focused final verdict                                | Pass; UI preview ready for owner review                            |

The reviewer independently rechecked source and screenshots. Build/Axe/browser runs were executed in the implementation session, not independently repeated by the reviewer. Verification tooling is in [verify-storefront](../backend/scripts/verify-storefront.mjs); screenshots and machine reports are kept in the ignored local review folder.

The mechanical design detector ran once and flagged an unnecessary course-artwork background grid; it was removed. Physical iPhone/Android playback, field performance and a full accessibility audit remain launch checks rather than claims from this phase.

## Remaining owner acceptance

- Final brand/business identity, instructor portrait/biography and verified credentials.
- Real courses, lesson counts/durations, final prices and tax treatment.
- Actual course trailers/free-preview videos; the conceptual background is not an instructor lesson.
- Support email, public social URLs and buyer community details.
- Reviewed legal policies and relevant regulatory disclosures.
- Authenticated ownership-aware course CTA after Phase 2; checkout activation after Phase 3.

The UI implementation can be reviewed now. Full Phase 1 content acceptance remains pending these inputs.

### Colour revision ? 30 October 2026

Applied the owner?s institutional obsidian/slate/electric-blue palette across shared and landing styles, auth forms, course artwork, dialogs and Open Graph image. Landing colour overrides now inherit shared tokens; secondary text uses a brighter cool grey for small-text contrast. This supersedes the earlier charcoal/sage direction.

Verification: production build, lint, formatting and editor diagnostics pass. All 48 storefront route/viewport/theme checks and eight mobile authentication-page WCAG A/AA Axe audits pass, with zero recorded violations in the targeted audits.
