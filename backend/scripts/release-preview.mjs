import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { releaseEnvironment } from "./release-environment.ts";

// A successful empty catalogue deliberately selects the app's existing sample courses.
// No production database, auth service, payment provider or mail service is contacted.
const port = process.argv[2] ?? "3100";
const origin = `http://127.0.0.1:${port}`;
const fixture = createServer((request, response) => {
  const path = new URL(request.url, origin).pathname;
  response.setHeader("Content-Type", "application/json");
  if (request.method === "GET" && path.endsWith("/rest/v1/courses")) response.end("[]");
  else if (request.method === "GET" && path.endsWith("/rest/v1/site_content"))
    response.end(JSON.stringify([{ document: null }]));
  else if (request.method === "GET" && path.endsWith("/rest/v1/site_settings"))
    response.end("[{}]");
  else if (request.method === "GET" && path.endsWith("/auth/v1/settings"))
    response.end(JSON.stringify({ external: { google: false } }));
  else {
    response.statusCode = 401;
    response.end(JSON.stringify({ error: "No fixture session." }));
  }
});
fixture.listen(0, "127.0.0.1");
await once(fixture, "listening");
const fixturePort = fixture.address().port;
const child = spawn(
  process.execPath,
  [
    fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url)),
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    env: {
      ...process.env,
      ...releaseEnvironment(origin),
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}/release-${Date.now()}`,
      SUPABASE_SERVICE_ROLE_KEY: "release-fixture-service-role",
    },
    stdio: "inherit",
    windowsHide: true,
  },
);
child.on("error", () => {
  fixture.close();
  process.exitCode = 1;
});
child.on("exit", (code) => {
  fixture.close();
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    child.kill(signal);
    fixture.close();
  });
