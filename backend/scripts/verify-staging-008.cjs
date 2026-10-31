// Retired ad-hoc verifier: the supported verifier is read-only, project-scoped,
// validates TLS, and never creates fixed-ID users or persistent test courses.
void import("./verify-database.mjs").catch(() => {
  console.error("Database verification failed; sensitive details withheld.");
  process.exitCode = 1;
});
