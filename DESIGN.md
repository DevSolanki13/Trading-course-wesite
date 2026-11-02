---
name: GlobalBulls
description: Trading education in Hindi; learn the process and respect the risk.
colors:
  background: "#111111"
  surface: "#191919"
  raised: "#222222"
  foreground: "#f3f5f7"
  muted: "#a7afb9"
  brand: "#16c784"
  accent: "#35dca0"
  accent-ink: "#03110b"
  light-background: "#fafafa"
  light-surface: "#ffffff"
  light-raised: "#f0f4f2"
  light-foreground: "#131b19"
  light-muted: "#52615a"
  light-accent: "#08784f"
---

# GlobalBulls design system

This documents the existing implementation. Cleanup and speed work must preserve its content, layout, colors, typography, motion and user flows. It supersedes the previous Market Method/blue-theme guidance. Product facts and unresolved launch requirements remain governed by [PRODUCT.md](./PRODUCT.md).

## Source of truth

- [globals.css](./frontend/styles/globals.css) owns shared dark/light tokens, typography and base controls.
- [brand.css](./frontend/styles/brand.css) owns shared brand treatment, pill buttons, surfaces, header/footer and course-card overrides.
- [landing.css](./frontend/styles/landing.css) owns the homepage composition and its route-specific colors.
- [hero-annotations.css](./frontend/components/hero/hero-annotations.css) owns the existing annotated hero.
- [admin-shared.css](./frontend/styles/admin-shared.css) owns shared admin tables, learner panels and catalogue management rows. [admin.css](./frontend/styles/admin.css) imports it before workspace-only overrides, preserving the cascade.
- [student-dashboard.css](./frontend/styles/student-dashboard.css) and [video-learning.css](./frontend/styles/video-learning.css) own the current learning workspace. [learning.css](./frontend/styles/learning.css) retains the shared refund controls and native progress styling.

## Color and surfaces

Dark is the default: near-black backgrounds, charcoal surfaces, light foreground and green/teal actions. Light mode uses pale backgrounds, white surfaces, dark text and a deeper green accent. The homepage has its own near-black background (#0a0a0b) in dark mode. Use the implemented semantic variables for both themes; do not restore the old electric-blue palette.

Keep the current background patterns, outlines, shadows and corner radii. Shared panel radius is 24px; primary buttons use the existing green-to-teal gradient and pill shape. The current bull mark is the brand symbol.

## Typography

Manrope Variable is the body face, Fraunces Variable is the shared display face, and IBM Plex Mono is used for measurements. The homepage headline uses Newsreader 500 normal/italic; annotations use Caveat 500. These assets are served locally. The original hero font bytes and fallback metrics are retained in [fonts](./frontend/assets/fonts/) and [hero-fonts.css](./frontend/styles/hero-fonts.css).

Keep the existing font sizes, line heights, tracking, wrapping and spacing. Do not substitute typefaces during optimization.

## Layout and behavior

The current homepage has a centered editorial headline, annotation drawings, a curved floating-card marquee, course collection and supporting sections. Preserve all cards, their labels and the marquee's path, speed and hover slowdown. Reduced motion keeps the cards static; off-screen and hidden-tab animation work can stop.

The public catalogue includes learner cards and server-personalized admin management rows. Keep ownership checks, role-specific controls, course filtering and the horizontal/grid switcher. Shared public catalogue data may be cached; session, ownership and account data must remain private.

Admin and student workspaces already exist. Keep their navigation, tables, forms, player controls, purchase history, receipt access and loading/error states. Optional panels can load on demand without redesigning their contents.

## Theme, accessibility and content

Preserve dark/light parity, keyboard focus, accessible control names, semantic links, reduced-motion handling, image alternative text and existing responsive breakpoints. The theme preference remains stored under the existing market-method-theme key so saved choices survive upgrades. Keep the early nonce-protected initialization script.

Content, statistics, sample labels, checkout states and payment integrations are outside cleanup changes. Do not add claims or change published copy. The conceptual About image remains the same composition and pixels; its PNG is compressed losslessly without changing the URL or image format.
