# Performance Changes

## Changes in this pass

| File                                            | Change                                                                                                                             | Reason                                                                                               | Behavior impact                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `app/robots.ts`                                 | Added production-only indexing gate and public sitemap rules.                                                                      | Prevent accidental indexing of previews and private routes while allowing an explicit launch switch. | No visual or application-route change.                  |
| `app/layout.tsx`                                | Made root metadata indexing conditional on `VERCEL_ENV=production` and `ALLOW_INDEXING=true`.                                      | Keep preview and local environments `noindex`.                                                       | No visual change.                                       |
| `frontend/components/floating-card-marquee.tsx` | Replaced outcome-like figures with process and clearly illustrative copy; preserved card count, geometry, animation, and controls. | Avoid presenting fabricated market or student results as factual.                                    | Content changed; layout and motion are preserved.       |
| `frontend/pages/home-page.tsx`                  | Relabeled ticker values as illustrative/not live and replaced outcome-oriented wording.                                            | Make educational sample data unambiguous.                                                            | Content changed; layout and interactions are preserved. |

## Existing optimizations retained

The repository already contains public-data caching, authentication request
deduplication, deferred panels, local font assets, and marquee lifecycle
pausing. This pass did not rewrite those mechanisms or change private caching
behavior.

## Validation

- TypeScript check passed.
- Production build passed.
- Unit tests passed: 17 tests in 5 files.
- Backend tests passed in the initial run.
- Repository-wide lint and format checks remain blocked by unrelated pre-existing
  diagnostics in admin components and 42 previously unformatted files.
