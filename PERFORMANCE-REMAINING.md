# Remaining Performance Work

1. Run three or more isolated mobile Lighthouse runs against the same production
   build and report median and range.
2. Collect browser Performance traces for homepage marquee, course catalogue,
   dashboard navigation, and the course player on a representative mobile device.
3. Measure cache-hit and cache-miss response times for public catalogue,
   course-detail, and sitemap requests.
4. Validate authenticated route latency with real Supabase staging data; do not
   introduce public full-page caching for session-sensitive pages.
5. Measure VdoCipher startup and seek behavior on supported physical browsers.
6. Add field monitoring after launch for LCP, INP, CLS, route errors, and API
   failures.
7. Enable `ALLOW_INDEXING=true` only in the approved Vercel Production
   environment after content, legal pages, and canonical URLs are signed off.
