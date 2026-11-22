import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const schema = "ci-v2";
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
export const digest = (...parts) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");
export function output(values) {
  for (const [key, value] of Object.entries(values)) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `${key}=${typeof value === "object" ? JSON.stringify(value) : value}\n`,
    );
  }
}
export function snapshot(cwd, ref) {
  const files = git(cwd, "ls-tree", "-rz", "--full-tree", ref)
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const [metadata, path] = entry.split("\t");
      return { metadata, path };
    });
  const packages = new Map();
  for (const { path } of files.filter(({ path }) =>
    /^(apps|libs|tests)\/[^/]+\/package.json$/.test(path),
  )) {
    const pkg = JSON.parse(git(cwd, "show", `${ref}:${path}`));
    packages.set(pkg.name, { dir: path.slice(0, -13), pkg });
  }
  const dependencies = (name, visited = new Set()) => {
    if (visited.has(name) || !packages.has(name)) return visited;
    visited.add(name);
    const { pkg } = packages.get(name);
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      for (const dependency of Object.keys(pkg[field] ?? {}))
        dependencies(dependency, visited);
    }
    return visited;
  };
  const shared = (path) =>
    [
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      ".npmrc",
      ".dockerignore",
      ".prettierrc",
    ].includes(path) ||
    /^(patches|scripts\/ci|\.github\/actions|\.github\/workflows)\//.test(path);
  const key = (name) => {
    if (!packages.has(name))
      throw new Error(`Missing workspace package: ${name}`);
    const dirs = [...dependencies(name)].map(
      (dependency) => packages.get(dependency).dir,
    );
    return digest(
      schema,
      files.filter(
        ({ path }) =>
          shared(path) || dirs.some((dir) => path.startsWith(`${dir}/`)),
      ),
    );
  };
  const cms = key("@lapuertahostels/cms");
  return {
    types: digest(
      schema,
      cms,
      files.filter(({ path }) => path.startsWith("libs/payload-types/")),
    ),
    frontend: key("@lapuertahostels/frontend"),
    cms,
    e2e: key("@lapuertahostels/e2e"),
  };
}
export function baseline(cwd, eventName, event) {
  try {
    if (eventName === "pull_request")
      return git(cwd, "merge-base", "HEAD", event.pull_request.base.sha).trim();
    if (eventName === "push" && event.before && !/^0+$/.test(event.before)) {
      return git(
        cwd,
        "rev-parse",
        "--verify",
        `${event.before}^{commit}`,
      ).trim();
    }
  } catch {
    /* An unavailable baseline must never skip validation. */
  }
  return null;
}
export function detect(cwd, base, force = false) {
  const current = snapshot(cwd, "HEAD");
  let previous;
  try {
    if (base) previous = snapshot(cwd, base);
  } catch {
    /* Cold baseline. */
  }
  return {
    frontend_key: current.frontend,
    cms_key: current.cms,
    force,
    types_changed: force || !previous || current.types !== previous.types,
    frontend_changed:
      force || !previous || current.frontend !== previous.frontend,
    cms_changed: force || !previous || current.cms !== previous.cms,
    e2e_changed: force || !previous || current.e2e !== previous.e2e,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv[2] === "detect") {
    const event = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"),
    );
    const force =
      process.env.FORCE_REBUILD === "true" ||
      process.env.NEW_RELEASE === "true" ||
      event.inputs?.release === "true" ||
      event.inputs?.release === true;
    output(
      detect(
        process.cwd(),
        baseline(process.cwd(), process.env.GITHUB_EVENT_NAME, event),
        force,
      ),
    );
  } else throw new Error("Expected detect");
}
