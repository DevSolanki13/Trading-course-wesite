# GlobalBulls Performance Audit

## Scope

This audit covers the current Next.js 16 / React 19 application and the existing
performance work recorded in `docs/CLEANUP-AND-SPEED-IMPLEMENTATION.md`. No
production deployment, payment, or shared database mutation was performed.

## Confirmed evidence

| Area | Evidence | Severity | Risk |
| --- | --- | --- | --- |
| Public catalogue | `backend/public/catalogue.ts` uses a five-minute `unstable_cache` entry, a project-specific cache key, and tag invalidation. | Medium | Public content can become stale for up to five minutes unless an admin write invalidates it. |
| Authentication | `frontend/components/auth-provider.tsx` deduplicates same-route `/api/auth/me` calls and rejects stale responses. | Medium | Session refresh remains intentionally dynamic and private. |
| Marquee | `frontend/components/floating-card-marquee.tsx` uses `requestAnimationFrame`, `IntersectionObserver`, reduced-motion handling, hidden-tab pausing, and transform updates. | Medium | The component remains client-side work on the homepage. |
| Route rendering | Public pages remain `force-dynamic` because they combine public catalogue data with session-sensitive redirects. | Medium | Removing dynamic rendering without a security design could leak personalized state. |
| Indexing | `app/robots.ts` and root metadata now gate indexing behind production `ALLOW_INDEXING=true`. | High | Launch configuration must explicitly enable indexing only when public content is approved. |
| Public copy | Homepage market figures are explicitly illustrative and no longer present outcome-like claims. | High | Claims should still be reviewed against approved marketing copy before launch. |

## Historical measurements

The existing cleanup report recorded a local mobile Lighthouse baseline of 69
performance, 6,786 ms total blocking time, 1.07 s LCP, and 0.0024 CLS. Its final
repeatable run recorded 88 performance, 452 ms blocking time, 1.22 s LCP, and
0.0023 CLS. An earlier 98 score was not reproducible. These are local synthetic
measurements, not field Core Web Vitals.

## Prioritized next steps

1. Re-run Lighthouse on an isolated production server and record a stable median
   over at least three runs.
2. Profile the homepage and dashboard with React DevTools and Chrome Performance
   before changing client boundaries.
3. Measure route response times and cache-hit behavior with production-like
   Supabase data.
4. Validate real-device video playback and authenticated navigation separately;
   never make private routes publicly cacheable.

## Limitations

No production RUM, real-device Core Web Vitals, authenticated provider latency,
or real VdoCipher playback measurements are available in this workspace.
