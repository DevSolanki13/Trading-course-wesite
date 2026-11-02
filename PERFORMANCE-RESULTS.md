# Performance Results

## Before and after

| Metric | Before | After | Status |
| --- | --- | --- | --- |
| Local mobile Lighthouse performance | 69 baseline; 88 repeatable optimized run | Not re-measured in this pass | Pending isolated rerun |
| LCP | 1.07 s baseline; 1.22 s repeatable optimized run | Not re-measured | Pending |
| CLS | 0.0024 baseline; 0.0023 repeatable optimized run | Not re-measured | Pending |
| Total blocking time | 6,786 ms baseline; 452 ms repeatable optimized run | Not re-measured | Pending |
| Production build | Passed | Passed | Verified |
| TypeScript | Passed after the change | Passed | Verified |
| Unit tests | 17 tests passed | 17 tests passed | Verified |

The recorded 98 Lighthouse score from the prior report was not reproducible and
is intentionally not treated as a release result.

## Bundle and API measurements

No new bundle analyzer or production API latency sample was collected in this
pass. The current public catalogue cache configuration is documented in the
audit and should be measured with production-like data before claiming a
latency improvement.

## Remaining limitations

Real-device performance, field Core Web Vitals, provider latency, authenticated
dashboard behavior, and protected video playback still require isolated staging
or production-like validation.
