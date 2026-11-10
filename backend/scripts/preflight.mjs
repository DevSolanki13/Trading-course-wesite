import "./load-env.mjs";
import { existsSync } from "node:fs";
import { readiness } from "../config/environment.ts";
import { upiConfig } from "../payments/upi-config.ts";

const checks = readiness(process.env);
console.log(
  "Service configuration readiness (configuration is not connectivity or launch acceptance)",
);
for (const check of checks) {
  console.log(`${check.configured ? "CONFIGURED" : "MISSING"} ${check.service}`);
  if (check.missing.length) console.log(`  Required keys: ${check.missing.join(", ")}`);
  for (const message of check.invalid) console.log(`  ${message}`);
}
const linked = existsSync(".vercel/project.json");
const upi = upiConfig();
console.log(`${upi.configured ? "CONFIGURED" : "MISSING"} UPI collection configuration`);
console.log(`Vercel project link: ${linked ? "present (verify target separately)" : "missing"}`);
console.log(
  `Public UPI checkout: ${upi.enabled ? "enabled" : "disabled"}; real payment acceptance must be verified separately`,
);
if (checks.some((check) => !check.configured) || !upi.configured || !linked) process.exitCode = 1;
