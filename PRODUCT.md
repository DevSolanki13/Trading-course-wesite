# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Learners purchasing trading education, with English website text and Hindi course videos. Mobile and desktop access are required. The instructor and support staff operate separate administrative roles.

## Product Purpose

Sell 2–3 courses initially and provide secure, online-only access for the configured course period after verified purchase; no lifetime access. The public storefront helps visitors understand the curriculum, preview teaching and choose a suitable course.

## Capabilities and Constraints

Next.js/TypeScript, one root package and deployment. Presentation lives in frontend, server operations in backend, framework routes in app. Cashfree payments, Supabase auth/database, Resend email and DRM streaming are specified. Two active devices maximum. Seven-day refunds require less than 10% of a course watched. GST is configurable; tax treatment needs owner confirmation. Purchases remain disabled until later integration gates pass.

## Brand Commitments

The user explicitly delegates branding, colours and fonts to the developer. The requirements specify dark mode by default with a light option, high-quality mobile UX, subtle accessible motion and a non-template appearance.

## Evidence on Hand

[Requirements](./course-website-requirements.md) and [implementation plan](./IMPLEMENTATION-PLAN.md). No final instructor identity, portraits, course metadata, prices, testimonials or public social URLs have been supplied. A content-readiness question is pending. Those facts must stay openly unconfirmed; the storefront may use labelled illustrative content without enabling purchase.

## Product Principles

- Teach a process without promising trading profits.
- Let learners inspect curriculum and price before committing.
- Keep payment and content access decisions on the server.
- Clearly distinguish provisional content from owner-approved facts.

## Accessibility & Inclusion

Mobile-first web, keyboard accessibility, WCAG AA contrast, reduced motion, clear errors and readable type, as requested in the requirements.
