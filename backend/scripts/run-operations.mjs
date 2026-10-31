import "./load-env.mjs";
import { operationsAuthorized } from "../operations/policy.ts";
if (!process.argv.includes("--run")) {
  console.log(
    "Dry run: no jobs or emails processed. Configure staging, CRON_SECRET and the application origin, then use npm run operations:run -- --run. Notification delivery also requires its separate opt-in.",
  );
  process.exit(0);
}
try {
  const authorization = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!operationsAuthorized(authorization)) throw new Error("OPERATIONS_NOT_CONFIGURED");
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL);
  if (
    origin.username ||
    origin.password ||
    origin.href !== `${origin.origin}/` ||
    (origin.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(origin.hostname))
  )
    throw new Error("INVALID_APPLICATION_ORIGIN");
  const response = await fetch(`${origin.origin}/api/operations/run`, {
    headers: { Authorization: authorization },
    redirect: "error",
    signal: AbortSignal.timeout(260000),
  });
  const result = await response.json();
  const safe = Object.fromEntries(
    ["jobs", "completed", "retried", "notifications", "accepted", "failed"]
      .filter((key) => Number.isSafeInteger(result[key]))
      .map((key) => [key, result[key]]),
  );
  console.log(JSON.stringify({ httpStatus: response.status, ...safe }));
  if (!response.ok) process.exitCode = 1;
} catch {
  console.error(
    "Operations request failed. Verify staging configuration and server logs; credentials and provider details withheld.",
  );
  process.exitCode = 1;
}
