# P4.6 course learners

## Scope and decisions

Policy record: `planning=deep`, `context_depth=dependency`, `verification_depth=impact`,
`delegation=none`; reasons: migration, staff authorization, dependent API/UI changes.
The authorized scope is the learner panel, dedicated learner types/helpers/handler/route,
learner-only migration, focused tests and this document. No commits, dependencies,
browser use or hosted writes. The migration is additive and tested in disposable memory.

Decision: page enrollment summaries before computing progress and retrieve lesson rows
only for the selected learner. The old RPC embeds every published lesson for every
enrollment; the old local helper also loads all course progress. Keep their existing
eligibility and progress semantics while removing those reads from the panel's path.

## Paths and contracts

- [Panel](../frontend/components/admin/course-learners-panel.tsx)
- [Types](../shared/admin-learners.ts)
- [Parameter/error helpers](../backend/admin/learners.ts)
- [Dedicated handler](../backend/handlers/admin-learners.ts)
- [Dedicated route](../app/api/admin/course-learners/route.ts)
- [Migration](../backend/database/migrations/202611090042_phase4_learner_pages.sql)

`GET /api/admin/course-learners?courseId=<uuid>&page=0&q=<text>&access=all`
returns `{course, learners, enrolledTotal, total, page, pageSize:50}`.
`enrolledTotal` counts all eligible enrollment records before search/access filtering;
`total` is the filtered count, including on an empty/out-of-range page. Neither course
nor summary rows contain lesson arrays. Page is zero based and capped at 10000;
malformed/out-of-range HTTP page values normalize to zero, matching existing admin
pagination conventions. Direct SQL rejects invalid pages/filters.

`GET /api/admin/course-learners?courseId=<uuid>&learnerId=<uuid>` returns
`{course, learner:{...summary, lessons}}`. It validates enrollment within that exact
course. Search, access and page do not hide a selected enrolled learner. Unknown
courses or learners return 404; malformed UUIDs/filters return 400; database/session
authorization failures return 403; unavailable reads return 503 without SQL details.

Search is trimmed, capped at 120 characters, case insensitive literal substring
matching over `name + ' ' + email`; `%` and `_` retain their literal meaning.
Access filters are `all`, `active`, `expired`; expired includes revoked/inactive
enrollments. Null expiry remains active when neither inactive nor revoked, matching
the previous panel. Stable ordering is name, email, user UUID, enrollment UUID.
`enrollmentId` gives rows stable keys even for repeated enrollments. Legacy enrollment
counts are preserved; a learner with multiple enrollment records has a deterministic
first enrollment in their detail response and identical lesson progress in each row.

Only published lessons in the requested course contribute to lesson count,
completion, watched multiranges and last activity. Missing progress is zero/null.
The hosted detail position remains rounded seconds; local-demo retains fractional
seconds, as its previous helper did. Curriculum changes therefore affect summaries
as they did before.

The panel debounces summary reads by 200 ms, resets page on search/access changes,
shows full enrollment and filtered counts, and loads details on selection. Effects
ignore late responses after search/course/selection changes. A course-keyed panel
prevents previous-course content from being shown while loading. Detail errors have
an independent retry without re-fetching the learner page.

## Authorization and compatibility

Hosted calls use `privileged(false)` (admitted session, admin/support role, MFA/key
verification), then `admin_course_learner_page` calls `admin_guard(...,false)` again.
The wrapper is SECURITY DEFINER with an empty search path and fully qualified
relations. The underlying read is SECURITY INVOKER. Both new functions revoke
PUBLIC/anon/authenticated execution and grant only service_role.

Local-demo validates its existing local session and admin/support role before invoking
the same underlying SQL with `p_paid_only=true`. This preserves the previous local
restriction to purchase enrollments with matching paid order/user/course. Hosted
reads retain the old RPC's all-enrollment eligibility, including manual, pending,
expired and revoked enrollments. No attempt is made here to change these pre-existing
product differences, or to grant actual learning access based on dashboard flags.

The exact static route is authoritative over the existing catch-all. The installed
Next router ordering and the dedicated route's GET export are tested. The catch-all's
old hosted support allowlist cannot reject these requests. The panel keeps the same
URL and never calls the old unbounded helper/RPC. Other methods receive Next's 405.

The main owner subsequently authorized precise learner hunks in
`backend/handlers/admin.ts`. Applied this delegation for direct callers of the
exported catch-all handler, and removed both old unbounded learner branches:

```diff
--- a/backend/handlers/admin.ts
+++ b/backend/handlers/admin.ts
@@
-import { localCourseLearners } from "../admin/data";
+import { adminLearnersRequest } from "./admin-learners";
@@
     const action = url.pathname.replace(/^\/api\/admin\//, "");
+    if (request.method === "GET" && action === "course-learners")
+      return adminLearnersRequest(request);
```

The old local `GET/course-learners` block calling `localCourseLearners` and the
old hosted `course-learners` block calling `admin_course_learners` are removed.
No changes to unrelated branches or whole-file formatting. The old helper and old
RPC may be retained for compatibility/comparison; this patch does not alter their
contracts or applied migration history.

## Migration workflow

Filename coordinated with main: `202611090042_phase4_learner_pages.sql` (renamed
from the initial uncommitted `202611090028_course_learner_pagination.sql` at the
main owner's request). Main owns the preceding course/refund migration 041.
`backend/admin/data.ts` remains untouched by this work.
Inspected the custom `backend/scripts/migrate.mjs` and `backend/local/database.ts`
runners: sorted SQL files, checksums, transactional application. No Supabase CLI
workflow is used. Existing migrations are unchanged; only two learner read functions
are added. No indexes, tables, write functions, or policies are changed. Deploy the
migration before application code. Hosted apply remains outside this local task.

Loaded gravitas/karpathy, Supabase/Postgres guidance and relevant pagination,
privilege/index references, React guidance, and installed Next route-handler and
client-boundary docs before coding. Checked current Supabase changelog/functions
docs. Bounded offset pagination follows existing admin contracts; deep offsets and
global exact counts/search still scan eligible enrollments. It is not constant-time
keyset pagination. Progress computation is limited to the page (50 enrollment rows),
and lesson JSON construction is limited to one selected learner.

## Verification

Focused tests:

```sh
node --test --experimental-strip-types tests/phase4-course-learners.test.ts
npx vitest run tests/phase4-course-learners.test.tsx tests/phase4-course-learners-handler.test.tsx
```

The database test applies every migration in order to a fresh in-memory PGlite
Postgres engine. It compares every hosted summary and all lesson details against the
legacy RPC, and covers 50/51 boundaries, final/empty pages, literal/case-insensitive
search, combined access filtering, zero lessons/progress, draft/foreign lesson
exclusion, mismatched order ownership, selected-course enrollment, manual/pending
local exclusion, admin/support/student roles, revoked sessions and function grants.
It also exercises duplicate enrollments and deterministic ordering.

UI tests cover on-demand detail loading, remote paging/search/access resets, counts,
stale search/detail responses, course changes and detail error/retry. Handler tests
cover private/no-store headers, UUID/filter validation, authenticated RPC arguments,
support-compatible authorization, session/MFA rejection, local role fences and
sanitized errors.

Observed isolated payloads: the 56-enrollment/2-published-lesson baseline was about
36.3 KB for the old full result versus 17.7 KB for the summary page. After expanding
the curriculum to 102 published lessons and 58 enrollment records, the old response
was about 1,024 KB versus 17.9 KB for the page (about 98% smaller). Exact bytes vary
slightly with generated timestamps/UUIDs. These are serialized response measurements,
not hosted timing, cold-start or browser measurements.

Final local validation:

- Database/router/adjacent admin tests: **6 passed, 0 failed**, including the fresh
  migrated database equivalence/access test, repeated after the final SQL change.
- UI/handler/admin-auth tests: **25 passed, 0 failed** across three files, including
  direct legacy-handler delegation for both hosted support and local-demo reads.
  Reconfirmed after the main owner's concurrent full-unit run reported the earlier
  retry failure: focused rerun at 22:11 local on 2026-11-09 passed all 25 tests,
  including the selected-lesson retry test. The current detail effect depends on
  `detailRetry`, and its retry button increments that same counter; summary retries
  use the separate `retry` counter. No further implementation fix was needed.
- `npm run typecheck`: passed.
- Focused ESLint: passed with `--max-warnings=0`.
- Focused Prettier checks and `git diff --check`: passed.

The database fences also cover blocked staff and a session belonging to another
actor. No production build, full unrelated test suite, browser checks, hosted
migration application or hosted performance benchmark was performed.

VERDICT: PASS
