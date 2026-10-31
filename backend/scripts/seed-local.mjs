// Local-only seed: never connects to or modifies a Supabase project.
process.env.LOCAL_DEMO = "true";
const { localDatabase } = await import("../local/database.ts");
const db = await localDatabase();
console.log("Local sample database ready. Existing purchases were preserved.");
if (process.env.NODE_ENV !== "production" || process.env.SEED_DEMO_USERS === "true")
  console.log(
    "Test accounts: demo@example.com / 1234567890 and admin@example.com / 1234567890. Remove demo users before production.",
  );
await db.close();
