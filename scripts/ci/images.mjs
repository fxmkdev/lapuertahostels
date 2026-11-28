import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { output } from "./inputs.mjs";

function execute(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command}: ${result.stderr || result.stdout}`);
  return result.stdout;
}
export function classify(error) {
  const message = String(error);
  if (
    /unauthorized|authentication required|denied|forbidden|insufficient_scope|access denied/i.test(
      message,
    )
  )
    return "fatal";
  if (
    /manifest unknown|manifest_unknown|name unknown|name_unknown|: not found|404 Not Found/i.test(
      message,
    )
  )
    return "missing";
  return "retry";
}
const pause = () => new Promise((resolve) => setTimeout(resolve, 5000));
export async function inspect(
  image,
  { run = execute, attempts = 4, sleep = pause } = {},
) {
  for (let attempt = 1; ; attempt++) {
    try {
      const metadata = JSON.parse(
        run("docker", [
          "buildx",
          "imagetools",
          "inspect",
          image,
          "--format",
          "{{json .Manifest}}",
        ]),
      );
      if (!/^sha256:[a-f0-9]{64}$/.test(metadata.digest))
        throw new Error("Registry returned no valid image digest");
      return `${image.split("@")[0].replace(/:[^/:]+$/, "")}@${metadata.digest}`;
    } catch (error) {
      const kind = classify(error);
      if (kind === "missing") return null;
      if (kind === "fatal" || attempt >= attempts) throw error;
      await sleep();
    }
  }
}
export function policy({ changed, force, cached }) {
  return { build: force || !cached, checks: changed || force || !cached };
}
export function copyImage(source, target, run = execute) {
  run("docker", [
    "buildx",
    "imagetools",
    "create",
    "--prefer-index=false",
    "--tag",
    target,
    source,
  ]);
}
async function waitForImage(image, options, expected) {
  const { sleep = pause } = options;
  for (let attempt = 0; attempt < 24; attempt++) {
    const resolved = await inspect(image, options);
    if (resolved && (!expected || resolved === expected)) return resolved;
    await sleep();
  }
  throw new Error(`Image is unavailable: ${image}`);
}
async function flyBuild({ app, imageApp, imageTag, buildTag, appVersion }) {
  const child = spawn(
    "flyctl",
    [
      "deploy",
      "--app",
      imageApp,
      "--config",
      `apps/${app}/fly.build.toml`,
      "--build-only",
      "--depot-scope",
      "app",
      "--build-arg",
      `APP_VERSION=${appVersion}`,
      "--image-label",
      buildTag,
      "--label",
      `org.opencontainers.image.version=${imageTag}`,
      "--push",
    ],
    { stdio: "inherit" },
  );
  // Let flyctl cancel its BuildKit session and release the remote builder
  // before the runner resorts to killing orphan processes.
  let interrupted;
  const onInterrupt = () => {
    interrupted = "SIGINT";
    child.kill("SIGINT");
  };
  const onTerminate = () => {
    interrupted = "SIGTERM";
    child.kill("SIGTERM");
  };
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  const timeout = setTimeout(() => {
    interrupted = "timeout";
    child.kill("SIGTERM");
  }, 3_600_000);
  try {
    const [code, signal] = await once(child, "exit");
    if (interrupted || code !== 0)
      throw new Error(`Fly build failed: ${interrupted || signal || code}`);
  } finally {
    clearTimeout(timeout);
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
  }
}
export async function prepareImage(
  inputs,
  { buildImage = flyBuild, ...options } = {},
) {
  const {
    app,
    imageApp,
    imageKey,
    imageTag,
    buildTag,
    appVersion,
    changed,
    force,
  } = inputs;
  if (
    !["frontend", "cms"].includes(app) ||
    !imageApp ||
    !/^[a-f0-9]{64}$/.test(imageKey) ||
    !imageTag ||
    !appVersion
  )
    throw new Error("Missing or invalid image inputs");
  const repository = `registry.fly.io/${imageApp}`;
  const cacheImage = `${repository}:ci-v2-${imageKey}`;
  const image = `${repository}:${imageTag}`;
  let source = force ? null : await inspect(cacheImage, options);
  const { build, checks } = policy({ changed, force, cached: source });
  if (build) {
    if (!buildTag) throw new Error("A unique build tag is required");
    await buildImage(inputs);
    source = await waitForImage(`${repository}:${buildTag}`, options);
  }
  copyImage(source, image, options.run);
  const resolved = await waitForImage(image, options, source);
  if (resolved !== source)
    throw new Error(`Image alias digest mismatch: ${image}`);
  // Only the successful result gate promotes this image into the reuse cache.
  return {
    image,
    digest: source,
    cache_image: cacheImage,
    checks,
    built: build,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv[2] === "promote") {
    const needs = JSON.parse(process.env.NEEDS);
    for (const app of ["frontend", "cms"]) {
      const {
        digest,
        cache_image: cacheImage,
        built,
      } = needs[`${app}-build-push`].outputs;
      if (built === "true") copyImage(digest, cacheImage);
    }
  } else {
    const result = await prepareImage({
      app: process.env.APP,
      imageApp: process.env.IMAGE_APP,
      imageKey: process.env.IMAGE_KEY,
      imageTag: process.env.IMAGE_TAG,
      buildTag: process.env.BUILD_TAG,
      appVersion: process.env.APP_VERSION,
      changed: process.env.CHANGED === "true",
      force: process.env.FORCE_REBUILD === "true",
    });
    output(result);
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### ${process.env.APP}\n\n- Source changed: ${process.env.CHANGED}\n- Image: ${result.built ? "built (forced or cache miss)" : "reused"}\n- Checks required: ${result.checks}\n- Tag: \`${result.image}\`\n- Digest: \`${result.digest}\`\n\nReused images retain their original embedded version and provenance.\n`,
    );
  }
}
