import { appendFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { preflight, publish, restore } from "./snapshot.mjs";

try {
  const [command, id] = process.argv.slice(2);
  if (command === "preflight") {
    const selected = await preflight(process.env, id);
    if (process.env.GITHUB_OUTPUT)
      await appendFile(process.env.GITHUB_OUTPUT, `snapshot_id=${selected}\n`);
    console.log(`Snapshot verified: ${selected}`);
  } else if (command === "publish") {
    console.log(`Snapshot published: ${await publish(process.env)}`);
  } else if (command === "release") {
    if (process.env.SNAPSHOT_RESTORE_ENABLED === "true") {
      await restore(process.env, process.env.SNAPSHOT_ID);
      console.log(`Snapshot restored: ${process.env.SNAPSHOT_ID}`);
    }
    execFileSync(
      "pnpm",
      ["--filter", "@lapuertahostels/cms", "payload", "migrate"],
      { stdio: "inherit" },
    );
  } else throw new Error("Expected publish, preflight, or release");
} catch (error) {
  // Driver errors can include credentials or server addresses. Report only
  // our own assertion/validation errors; detailed tool argv is never printed.
  console.error(
    error.name === "AssertionError" || error.constructor === Error
      ? error.message
      : "Snapshot operation failed",
  );
  process.exitCode = 1;
}
