import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classify,
  inspect,
  policy,
  prepareImage,
  copyImage,
} from "./images.mjs";

const hash = "a".repeat(64);
const newHash = "b".repeat(64);
const inputs = {
  app: "frontend",
  imageApp: "frontend-test",
  imageKey: hash,
  imageTag: "v1.2.3-sha",
  buildTag: "ci-build-123-1",
  appVersion: "1.2.3",
  changed: false,
  force: false,
};
const repository = "registry.fly.io/frontend-test";
const cacheImage = `${repository}:ci-v2-${hash}`;
function registry(cached) {
  const images = new Map(cached ? [[cacheImage, hash]] : []);
  const calls = [];
  let builds = 0;
  return {
    calls,
    images,
    get builds() {
      return builds;
    },
    options: {
      sleep: async () => {},
      run(command, args) {
        calls.push([command, ...args]);
        assert.equal(command, "docker");
        if (args[2] === "inspect") {
          const digest = images.get(args[3]);
          if (!digest) throw new Error("manifest unknown");
          return JSON.stringify({ digest: `sha256:${digest}` });
        }
        assert.equal(args[2], "create");
        const target = args[args.indexOf("--tag") + 1];
        const source = args.at(-1);
        assert.match(source, /@sha256:/);
        images.set(target, source.split("@sha256:")[1]);
        return "";
      },
      buildImage(actual) {
        builds++;
        assert.equal(actual.appVersion, "1.2.3");
        images.set(`${repository}:${actual.buildTag}`, newHash);
      },
    },
  };
}
test("registry cache hit copies the original digest without a build", async () => {
  const f = registry(true);
  const result = await prepareImage(inputs, f.options);
  assert.equal(f.builds, 0);
  assert.equal(result.built, false);
  assert.equal(result.checks, false);
  assert.equal(result.digest, `${repository}@sha256:${hash}`);
  assert.equal(f.images.get(`${repository}:${inputs.imageTag}`), hash);
  assert.ok(f.calls.some((args) => args.includes("--prefer-index=false")));
});
test("missing image rebuilds and requires checks even for unchanged code", async () => {
  const f = registry(false);
  const result = await prepareImage(inputs, f.options);
  assert.equal(f.builds, 1);
  assert.equal(result.built, true);
  assert.equal(result.checks, true);
  assert.equal(result.digest, `${repository}@sha256:${newHash}`);
  // Failed validation must not leave a reusable cache entry.
  assert.equal(f.images.has(cacheImage), false);
});
test("changed app with an already validated image still runs checks", async () => {
  const f = registry(true);
  const result = await prepareImage({ ...inputs, changed: true }, f.options);
  assert.equal(result.built, false);
  assert.equal(result.checks, true);
});
test("release/manual forcing builds a new version despite an existing cache and version tag", async () => {
  const f = registry(true);
  f.images.set(`${repository}:${inputs.imageTag}`, hash);
  const result = await prepareImage({ ...inputs, force: true }, f.options);
  assert.equal(f.builds, 1);
  assert.equal(result.checks, true);
  assert.equal(result.digest, `${repository}@sha256:${newHash}`);
  assert.equal(f.images.get(cacheImage), hash);
});
test("image fingerprints are isolated by app registry", async () => {
  const f = registry(true);
  await assert.rejects(
    prepareImage({ ...inputs, app: "unknown" }, f.options),
    /invalid image inputs/,
  );
});
test("genuine registry misses and access errors are distinguished", () => {
  assert.equal(classify(new Error("manifest unknown")), "missing");
  assert.equal(classify(new Error("name unknown")), "missing");
  assert.equal(classify(new Error("repository: not found")), "missing");
  assert.equal(classify(new Error("unauthorized: manifest unknown")), "fatal");
  assert.equal(classify(new Error("forbidden")), "fatal");
  assert.equal(classify(new Error("unexpected status 503")), "retry");
});
test("auth failure is fatal and never starts a rebuild", async () => {
  let builds = 0;
  await assert.rejects(
    prepareImage(inputs, {
      run() {
        throw new Error("unauthorized");
      },
      buildImage() {
        builds++;
      },
    }),
    /unauthorized/,
  );
  assert.equal(builds, 0);
});
test("transient errors retry, persistent errors fail", async () => {
  let calls = 0;
  const options = {
    sleep: async () => {},
    run() {
      if (++calls === 1) throw new Error("503");
      return JSON.stringify({ digest: `sha256:${hash}` });
    },
  };
  assert.equal(
    await inspect(`${repository}:tag`, options),
    `${repository}@sha256:${hash}`,
  );
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    inspect(`${repository}:tag`, {
      sleep: async () => {},
      run() {
        calls++;
        throw new Error("503");
      },
    }),
    /503/,
  );
  assert.equal(calls, 4);
});
test("a missing manifest is a cache miss without retries", async () => {
  assert.equal(
    await inspect(`${repository}:tag`, {
      run() {
        throw new Error("manifest unknown");
      },
    }),
    null,
  );
});
test("malformed image metadata fails closed", async () => {
  await assert.rejects(
    inspect(`${repository}:tag`, { attempts: 1, run: () => "{}" }),
    /valid image digest/,
  );
});
test("registry hosts with ports preserve their repository", async () => {
  assert.equal(
    await inspect("localhost:5000/test:tag", {
      run: () => JSON.stringify({ digest: `sha256:${hash}` }),
    }),
    `localhost:5000/test@sha256:${hash}`,
  );
});
test("alias copying preserves the source manifest", () => {
  const calls = [];
  copyImage("repo@sha256:abc", "repo:tag", (...args) => calls.push(args));
  assert.deepEqual(calls, [
    [
      "docker",
      [
        "buildx",
        "imagetools",
        "create",
        "--prefer-index=false",
        "--tag",
        "repo:tag",
        "repo@sha256:abc",
      ],
    ],
  ]);
});
test("build failure never aliases or promotes an image", async () => {
  const f = registry(false);
  await assert.rejects(
    prepareImage(inputs, {
      ...f.options,
      buildImage() {
        throw new Error("build failed");
      },
    }),
    /build failed/,
  );
  assert.equal(f.images.has(`${repository}:${inputs.imageTag}`), false);
});
for (const [signal, cooperative] of [
  ["SIGINT", true],
  ["SIGTERM", true],
  ["SIGTERM", false],
]) {
  test(
    `build cancellation ${cooperative ? "forwards" : "forces termination after ignored"} ${signal} and never aliases the image`,
    { timeout: 10_000 },
    async (t) => {
      const directory = await mkdtemp(join(tmpdir(), "ci-cancel-"));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const stopped = join(directory, "stopped");
      const calls = join(directory, "registry-calls");
      const executable = join(directory, "flyctl");
      await writeFile(
        executable,
        `#!${process.execPath}
const fs = require("node:fs");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    fs.writeFileSync(${JSON.stringify(stopped)}, signal);
    if (${cooperative}) process.exit(0);
  });
}
console.log(JSON.stringify({ pid: process.pid, args: process.argv.slice(2) }));
setInterval(() => {}, 1000);
`,
        { mode: 0o755 },
      );
      const helper = spawn(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import { appendFileSync } from "node:fs";
import { prepareImage } from ${JSON.stringify(new URL("./images.mjs", import.meta.url).href)};
await prepareImage(${JSON.stringify(inputs)}, {
  run() {
    appendFileSync(${JSON.stringify(calls)}, "inspect\\n");
    throw new Error("manifest unknown");
  }
});`,
        ],
        { env: { ...process.env, PATH: `${directory}:${process.env.PATH}` } },
      );
      t.after(() => helper.kill("SIGKILL"));
      helper.stderr.resume();
      const exit = once(helper, "exit");
      const [ready] = await once(helper.stdout, "data");
      const { pid, args } = JSON.parse(ready.toString());
      t.after(() => {
        try {
          process.kill(pid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      });
      assert.equal(args[args.indexOf("--depot-scope") + 1], "app");
      helper.kill(signal);
      const [code] = await exit;
      // Even a clean child exit after cancellation must not continue aliasing.
      assert.notEqual(code, 0);
      assert.equal(await readFile(stopped, "utf8"), signal);
      assert.equal(await readFile(calls, "utf8"), "inspect\n");
    },
  );
}
test("alias propagation waits for the expected digest", async () => {
  const f = registry(true);
  const run = f.options.run;
  let remaining = 2;
  const result = await prepareImage(inputs, {
    ...f.options,
    run(command, args) {
      if (
        args[2] === "inspect" &&
        args[3] === `${repository}:${inputs.imageTag}` &&
        remaining-- > 0
      )
        return JSON.stringify({ digest: `sha256:${newHash}` });
      return run(command, args);
    },
  });
  assert.equal(result.digest, `${repository}@sha256:${hash}`);
  assert.ok(remaining < 0);
});
test("build policy covers both changed and unchanged apps", () => {
  assert.deepEqual(policy({ changed: false, force: false, cached: true }), {
    build: false,
    checks: false,
  });
  assert.deepEqual(policy({ changed: false, force: false, cached: false }), {
    build: true,
    checks: true,
  });
  assert.deepEqual(policy({ changed: true, force: false, cached: true }), {
    build: false,
    checks: true,
  });
  assert.deepEqual(policy({ changed: false, force: true, cached: true }), {
    build: true,
    checks: true,
  });
});
