import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import {
  availableParallelism,
  cpus,
  platform,
  release,
  totalmem,
} from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const frontend = fileURLToPath(new URL("..", import.meta.url));
const root = resolve(frontend, "../..");
const args = process.argv.slice(2);
const baseline = args.includes("--baseline");
const outputIndex = args.indexOf("--output");
if (outputIndex === -1 || !args[outputIndex + 1]) {
  throw new Error(
    "Usage: benchmark-typecheck.mjs [--baseline] --output <json>",
  );
}
const output = resolve(args[outputIndex + 1]);
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const compilers = baseline ? ["tsc"] : ["tsc6", "tsc"];
const scenarios = ["compiler", "routes-warm", "routes-regenerated"];
const report = {
  startedAt: new Date().toISOString(),
  mode: baseline ? "baseline" : "pilot",
  node: process.version,
  os: `${platform()} ${release()} ${process.arch}`,
  cpu: cpus()[0]?.model,
  logicalCpus: cpus().length,
  availableParallelism: availableParallelism(),
  memoryBytes: totalmem(),
  protocol: {
    batches: 2,
    warmupPairs: 2,
    measuredPairs: 7,
    incremental: false,
    note: "Sequential fresh processes; OS filesystem caches are uncontrolled. Installation and Payload generation are excluded.",
  },
  samples: [],
};

function capture(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: frontend,
    encoding: "utf8",
    env: { ...process.env, CI: "true" },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const error = new Error(
      `${command} ${commandArgs.join(" ")} (exit ${result.status}): ${result.error ?? ""}\n${result.stdout}\n${result.stderr}`,
    );
    error.exitStatus = result.status;
    throw error;
  }
  return result.stdout.trim();
}

function hash(path) {
  return createHash("sha256")
    .update(readFileSync(resolve(root, path)))
    .digest("hex");
}

function save() {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
}

try {
  Object.assign(report, {
    commit: capture("git", ["rev-parse", "HEAD"]),
    trackedDiff: capture("git", ["diff", "--stat"]),
    pnpm: capture(pnpm, ["--version"]),
    configSha256: hash("apps/frontend/tsconfig.json"),
    lockSha256: hash("pnpm-lock.yaml"),
    payloadTypesSha256: hash("libs/payload-types/src/payload-types.ts"),
    compilers: Object.fromEntries(
      compilers.map((compiler) => [
        compiler,
        capture(pnpm, ["exec", compiler, "--version"]),
      ]),
    ),
  });
  capture(pnpm, ["exec", "react-router", "typegen"]);
  for (let batch = 1; batch <= 2; batch++) {
    for (const scenario of scenarios) {
      for (let pair = 0; pair < 9; pair++) {
        const order = (pair + batch) % 2 ? [...compilers].reverse() : compilers;
        for (const compiler of order) {
          if (scenario === "routes-regenerated") {
            rmSync(resolve(frontend, ".react-router"), {
              recursive: true,
              force: true,
            });
          }
          const start = performance.now();
          const commandArgs =
            scenario === "compiler"
              ? ["exec", compiler]
              : ["run", compiler === "tsc6" ? "typecheck:ts6" : "typecheck"];
          const diagnosticOutput = capture(pnpm, commandArgs);
          const sample = {
            batch,
            scenario,
            pair: pair + 1,
            warmup: pair < 2,
            compiler,
            milliseconds: performance.now() - start,
            exitStatus: 0,
            diagnosticOutput,
          };
          report.samples.push(sample);
          save();
          console.log(
            `${batch} ${scenario} ${compiler} ${sample.warmup ? "warmup" : "sample"} ${sample.milliseconds.toFixed(1)}ms`,
          );
        }
      }
    }
  }
  report.completedAt = new Date().toISOString();
} catch (error) {
  report.failure = { message: String(error), exitStatus: error.exitStatus };
  process.exitCode = 1;
} finally {
  save();
}
