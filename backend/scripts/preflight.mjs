import "./load-env.mjs";
import { existsSync } from "node:fs";
import { readiness } from "../config/environment.ts";

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
console.log(`Vercel project link: ${linked ? "present (verify target separately)" : "missing"}`);
console.log("Live checkout: disabled; real Cashfree settlement and launch gates remain incomplete");
if (checks.some((check) => !check.configured) || !linked) process.exitCode = 1;
