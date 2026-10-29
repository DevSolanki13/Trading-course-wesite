import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";

// Node scripts do not inherit Next.js's env loader. Existing shell vars win.
for (const file of [".env.development.local", ".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}
