import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? args[portIndex + 1] : "3000";
const env = {
  ...process.env,
  LOCAL_DEMO: "true",
  PROJECT_STAGE: "local",
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
  PAYMENT_PROVIDER: "",
  PAYMENT_MODE: "",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  DATABASE_URL: "",
  AUTH_SECRET: "",
  RAZORPAY_KEY_ID: "",
  RAZORPAY_KEY_SECRET: "",
  RAZORPAY_WEBHOOK_SECRET: "",
  RESEND_API_KEY: "",
  RESEND_FROM_EMAIL: "",
  CASHFREE_CLIENT_ID: "",
  CASHFREE_CLIENT_SECRET: "",
  VDOCIPHER_API_SECRET: "",
  GOOGLE_OAUTH_CONFIGURED: "false",
  OPERATIONS_ENABLED: "false",
  NOTIFICATION_DELIVERY_ENABLED: "false",
  SEED_DEMO_USERS: "true",
};
const child = spawn(
  process.execPath,
  [
    fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url)),
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    ...args,
  ],
  { env, stdio: "inherit", windowsHide: true },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
