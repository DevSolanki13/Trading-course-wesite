// This ad-hoc path bypassed the migration ledger, target guard and TLS checks.
// Refuse even when called with old arguments. Review drift with db:verify first.
console.error(
  "Retired unsafe migration shortcut. No changes made. Use npm run db:verify, then review the ledger and SQL before npm run db:migrate -- --apply. Never reapply an existing migration to repair a checksum mismatch.",
);
process.exitCode = 1;
