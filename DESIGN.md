---
name: Market Method
description: A considered trading-education storefront preview; learn the process and respect the risk.
colors:
  background: "#0b0e11"
  surface: "#1e222d"
  raised: "#272d3a"
  foreground: "#f0f3fa"
  muted: "#a1a6b2"
  accent: "#90acff"
  accent-ink: "#ffffff"
  line: "#343b4b"
  overlay: "#000b"
  light-background: "#f0f3fa"
  light-surface: "#ffffff"
  light-raised: "#fff"
  light-foreground: "#131722"
  light-muted: "#535b6d"
  light-accent: "#234fca"
  light-accent-ink: "#ffffff"
  light-line: "#cbd2df"
  light-overlay: "#0b0e11c0"
typography:
  display:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "clamp(44px, 4.8vw, 70px)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.04em"
  headline:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "clamp(31px, 3.2vw, 44px)"
    fontWeight: 500
    lineHeight: 1.16
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "21px"
    fontWeight: 500
    lineHeight: 1.16
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "16px"
  label:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.4
  measurement:
    fontFamily: '"IBM Plex Mono", monospace'
    fontWeight: 400
rounded:
  tag: "4px"
  field: "5px"
  control: "6px"
  media: "12px"
  dialog: "16px"
spacing:
  compact: "12px"
  control: "24px"
  section: "110px"
  section-mobile: "60px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "14px 24px"
  button-primary-disabled:
    backgroundColor: "{colors.line}"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "14px 24px"
  course-tag:
    textColor: "{colors.muted}"
    rounded: "{rounded.tag}"
    padding: "4px 9px"
  risk-exercise:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.media}"
    padding: "29px 32px 25px"
  preview-dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.dialog}"
---

# Design System: Market Method

## Overview

### Current landing-page direction

The owner requested a richer redesign using the newly added [SaaS Product UI System skill](./.agents/skills/ai-ui-design-skills/saas-product-ui-system/SKILL.md). The current landing surface is **a considered learning workspace**: neutral-first obsidian and slate, restrained electric-blue actions, strong typography, elevated course-path panel, structured course collection and clear supporting sections. It contains no hero photograph or video, respecting the owner's earlier removals.

[landing.css](./frontend/styles/landing.css) owns landing composition and section surfaces; shared colour tokens come from [globals.css](./frontend/styles/globals.css). The landing page inherits the institutional palette used by the catalogue, authentication and account screens. The exact current token choices are documented in the colour revision below.

The landing layout uses a 1200px container, comfortable density, a two-column desktop hero with actual course navigation, three product cards, a learning-process section, a working arithmetic exercise, community readiness, FAQ and final CTA. Typography uses the existing self-hosted Manrope/IBM Plex Mono with rem-based landing scales. Most reading text is 1rem; metadata is secondary. Panels use consistent 18–20px radii with limited elevation; primary/secondary controls remain distinct. The hero stacks before cramped widths and keeps the primary action visible early on mobile.

CSS scope is `.landing-page` plus a body selector when that surface is present. Header/footer inherit its colour system on that route; catalogue, account and policy layouts are preserved. Existing theme persistence, keyboard focus, Radix dialog semantics, native disclosures, illustrative content labels and disabled checkout states remain in force.

**Creative North Star: "An evening study space"**

Obsidian surfaces, electric-blue actions, off-white highlights and clear grotesk typography make the storefront feel quiet and considered. Curriculum, teaching process and an interactive arithmetic example carry the message. Original conceptual desk imagery adds atmosphere without implying an instructor identity or trading performance.

This captures the implemented Phase 1 preview. The user delegated branding, colours and fonts; Market Method remains a developer-proposed identity. Final business identity, instructor information, course content/prices, public contacts and policy approval remain unresolved. [PRODUCT.md](./PRODUCT.md), the [requirements](./course-website-requirements.md) and [Phase 1 status](./docs/PHASE-1-STATUS.md) govern those facts. [globals.css](./frontend/styles/globals.css) is the implementation source; frontmatter records its current reusable values, and [.impeccable/design.json](./.impeccable/design.json) carries extensions.

**Key Characteristics:**

- Institutional obsidian, slate and electric blue, with a coordinated cool light theme.
- Spacious sections with compact secondary labels and readable primary copy.
- Flat tonal surfaces, restrained outlines and original geometric course artwork.
- Useful, keyboard-accessible interactions with honest preview states.

## Colors

### Primary

Mint teal identifies primary actions, active controls, numeric emphasis, checkmarks and small brand details. Dark accent ink gives filled mint controls contrast. In light mode the accent becomes a deeper green, paired with a pale control label. Use semantic CSS variables so both themes remain coherent.

### Neutral

Ink background, charcoal surface and raised slate establish the dark hierarchy. Warm paper foreground and cool grey muted copy keep text distinct; subdued slate borders divide sections. Light mode uses warm paper background, pale green-grey surfaces, white raised areas, deep ink text and green-grey dividers. Modal overlays are theme-specific.

The muted green, ochre and lavender course-cover palettes belong to the original artwork; they are not additional UI action colours.

**The Theme Pairing Rule.** Pair accent with accent ink, and foreground/muted/line with the active theme's surfaces. Do not copy dark-only hex values into new controls.

## Typography

**Display and body:** Manrope Variable, sans-serif fallback. **Measurements and prices:** IBM Plex Mono, monospace fallback. Both are self-hosted through Fontsource imports in [root-layout.tsx](./frontend/layouts/root-layout.tsx); no browser font request goes to Google Fonts.

Manrope provides an open, restrained voice; mono distinguishes amounts, percentages, durations and numbered process steps. Headings use balanced wrapping and medium weight. Body copy uses pretty wrapping.

The frontmatter display describes the desktop hero; standard page headings use `clamp(42px, 5.2vw, 72px)`. The hero becomes 65px below the first breakpoint and `clamp(35px, 8.5vw, 49px)` on phones, with looser leading. Course-card titles are 22px. Primary reading selectors explicitly use 16px, overriding earlier compact responsive declarations. The body baseline is 15px/1.65; small labels retain their component-specific sizes. Supporting disclaimers, footer copy and exercise notes use 12px. Do not mistake an earlier mobile rule for the final reading size.

## Layout

The centred content container tops out at 1280px. Desktop gutters are 48px per side, becoming 32px at 1100px and 20px at 600px. Major sections generally use 110px vertical spacing, reduced to 60px on phones; individual tonal sections have their own spacing.

Course collections use three columns, then two at 899px, then one at 600px. Paired explanatory sections stack on mobile. The hero is text-led at the owner's request: no image, video or reserved media column. Desktop navigation is replaced by a menu trigger below 900px. The header itself is not sticky.

The catalogue combines a labelled level select with text search, a live result count and a resettable empty state. Its controls stack on phones. Detail pages use curriculum content beside a sticky purchase summary on desktop. Below 900px that summary is replaced by an in-flow access/refund information block and a fixed, disabled purchase bar; preserve safe-area bottom padding and footer clearance.

Checkout, player and admin screens are later-phase intentions, not implemented screen patterns. They may inherit these tokens, but should not be represented as shipped layouts.

## Elevation & Depth

Depth comes primarily from tonal surfaces, borders, About-page photography and modal overlays. Cards and controls have no ambient drop shadow. The original geometric course covers contain small hard-edged offset shadows as illustration details; those do not establish a UI elevation scale. The hero image, matching video and gradient overlay have been removed at the owner's request. Dialogs sit above a full-viewport overlay.

## Shapes

Controls have gently squared corners, media and exercise/purchase panels use larger curves, and small tags have compact corners. The desktop preview dialog has the largest radius, reducing to the media radius on phones. Round icon buttons and circular playback symbols are purposeful exceptions. Borders are thin, quiet and functional. Course artwork uses blocks, parallel structures and orbital shapes without a decorative background grid.

## Components

### Buttons and links

Filled teal buttons carry the primary action, with a 52px minimum height and the frontmatter padding. Hover mixes the accent with white and raises the button by 2px. Secondary buttons are transparent with a line-coloured border, becoming raised on hover. Disabled purchase buttons use line/muted colours and a forbidden cursor. Text links use an accent arrow and gently widen the arrow gap on hover. Round icon buttons are normally 44px. Global keyboard focus is a 2px accent outline with 5px offset; individual input focus retains local placement.

### Course cards and tags

Cards are open editorial groups: rounded original artwork, then tags, title, summary, metadata and an outlined price/action row. The entire card is not a nested panel. Course-image arrows reveal on hover. Tags use a thin border, muted text and compact padding. Prices, counts and curriculum are illustrative and must remain visibly labelled until approved.

### Inputs and empty states

Search uses a thin outlined container, inline magnifier, explicit accessible label and a 44px input. The native level select uses the surface background and field radius. Search and filter combine; a no-results state offers a reset that clears both. Inputs use the accent caret and native accent colour.

### Navigation and disclosures

The wordmark combines a three-bar symbol, mixed-weight text and teal period. Desktop links indicate the current page; mobile navigation uses a Radix dialog drawer with labelled controls and route-dismiss behaviour. FAQ and curriculum use native details/summary with a rotating disclosure icon. Preserve semantic links, visible focus and the skip link.

### Lesson-format dialog

Radix manages focus, Escape and modal semantics. The panel is scrollable within viewport height, with an accessible title/description and labelled close button. The content is a written preview of a proposed lesson format, explicitly stating that an instructor video has not been supplied. Its play motif must not be described as functioning lesson playback.

### Position-sizing exercise

The surface groups account size, percentage range and a live result. The actual calculation is account size multiplied by risk percentage, not a share/contract quantity. Defaults are ₹50,000 and 1%; the range runs 0.5–2% in 0.5% increments. Numeric output uses Indian grouping and a polite live region. Preserve the illustration label and explanation that real losses may exceed the budget. The range has a 44px interaction height.

### Conceptual hero media and motion

The original [desk image](./public/images/study-desk.png) depicts a conceptual workspace, not a real instructor. Its [silent ambient loop](./public/videos/study-loop.webm) is an original eight-second, 15fps VP9 camera movement of approximately 364KB, documented in [Phase 1 status](./docs/PHASE-1-STATUS.md). The optimised still remains the fallback.

Video is eligible only at 900px or wider without reduced-motion or data-saving signals. It pauses outside the viewport or when the document is hidden, preserves explicit user pause, and exposes a pause/play control. Small hover transitions take roughly 180–200ms; the dialog enters over 220ms. Reduced motion removes animations/transitions, hover lift and smooth scrolling, and keeps decorative video off. Page content never depends on an entrance animation to become visible.

### Theme and unavailable states

Dark is the default. A theme toggle persists the preference locally; an early script applies it before rendering, with storage failures tolerated. Shared loading, error and not-found states use the same palette and typography. Account, contact/social and enrolment states explain their readiness honestly. Authentication and purchases are not enabled by the storefront preview.

## Do's and Don'ts

### Do:

- **Do** use semantic theme variables and self-hosted typography.
- **Do** retain readable primary copy, keyboard focus, native controls and reduced-motion behaviour.
- **Do** distinguish conceptual imagery and illustrative course/pricing content from owner-approved facts.
- **Do** preserve disabled enrolment, preview notices and staging no-index rules until their integration and content gates pass.
- **Do** carry access/refund information and safe-area clearance onto mobile detail pages.

### Don't:

- **Don't** invent an instructor, credentials, student counts, testimonials, profit claims or urgency.
- **Don't** describe the ambient loop or written preview as an instructor lesson video.
- **Don't** promote the proposed identity, curriculum, prices or policy drafts to approved business facts.
- **Don't** add background media to controls or imply that unavailable account/payment actions succeed.

## Current palette revision ? 30 October 2026

The owner selected an institutional trading palette. This supersedes the earlier warm charcoal/sage direction described above. Shared surfaces use obsidian #0B0E11, section backgrounds #131722, slate cards #1E222D and off-white text #F0F3FA. Primary actions use electric blue #2962FF with white text; inline accents use #90ACFF in dark mode and #234FCA in light mode. Secondary copy uses #A1A6B2 for readable contrast on slate; the requested #787B86 is retained as a subtle neutral token. The landing page now inherits shared colour tokens instead of overriding them. Course artwork, preview banners/dialogs and social images follow the blue/slate family. Existing layouts, typography and interactions are preserved, with cool light-theme counterparts.
