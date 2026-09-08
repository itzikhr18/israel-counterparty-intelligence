import { spawn } from "node:child_process";
import { once } from "node:events";

// Keep the server and client in the same command/network namespace. Some
// executors isolate loopback across separate commands. No paid-test entrypoints.
const port = "3018";
let server;
let smoke;
try {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Local server startup timed out")),
      15_000,
    );
    const finish = (error) => {
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    server.once("error", finish);
    server.once("exit", (code) =>
      finish(new Error(`Local server exited: ${code}`)),
    );
    server.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      if (chunk.toString().includes("Ready")) finish();
    });
  });
  smoke = spawn(
    process.execPath,
    ["scripts/security-release-smoke.mjs", `http://127.0.0.1:${port}`],
    {
      stdio: "inherit",
      timeout: 120_000,
    },
  );
  const [code] = await once(smoke, "exit");
  process.exitCode = code ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  // These children belong to this run; no unrelated process is touched.
  smoke?.kill("SIGTERM");
  server?.kill("SIGTERM");
}
