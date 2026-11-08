import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { releaseEnvironment } from "./release-environment.ts";

// Dedicated production-mode, disposable local database. Never runs against Supabase.
const [mode = "start", label = "phase-01", port = "3113"] = process.argv.slice(2);
if (!["build", "start"].includes(mode) || !/^[a-z0-9-]+$/.test(label) || !/^\d{4,5}$/.test(port))
  throw new Error("Usage: optimization-preview.mjs build|start unique-label [port]");
const origin = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  ...releaseEnvironment(origin),
  VERCEL: "",
  VERCEL_ENV: "",
  NODE_ENV: "production",
  LOCAL_DEMO: "true",
  LOCAL_DATA_NAME: `optimization-${label}`,
  LOCAL_SEED_PASSWORD: "OptimizationFixture123!",
  SEED_DEMO_USERS: "true",
  ALLOW_MOCK_PAYMENTS: "true",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  UPI_GATEWAY: "",
  UPI_PAYMENTS_ENABLED: "off",
  UPI_RELAY_ENABLED: "off",
  UPI_PILOT_USER_IDS: "",
  INDIANXTRADE_COLLECTOR_EMAIL: "",
  INDIANXTRADE_COLLECTOR_PASSWORD: "",
  INDIANXTRADE_SESSION_TOKEN: "",
  SMS_RELAY_SECRET: "",
};
const child = spawn(
  process.execPath,
  [
    fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url)),
    mode,
    ...(mode === "start" ? ["--hostname", "127.0.0.1", "--port", port] : []),
  ],
  { env, stdio: "inherit", windowsHide: true },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
