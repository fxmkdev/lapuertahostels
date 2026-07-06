import { Pill } from "@payloadcms/ui";
import fs from "fs/promises";
import path from "path";

import styles from "./version-info.module.css";

const VERSION_PACKAGE_JSON_PATHS = [
  "apps/cms/.next/standalone/apps/cms/package.json",
  "package.json",
  "apps/cms/package.json",
];

export async function VersionInfo() {
  const version = await getVersion();

  return (
    <div className={styles.container}>
      <Pill pillStyle="light-gray" rounded>
        v{version}
      </Pill>
    </div>
  );
}

async function getVersion() {
  for (const packageJsonPath of VERSION_PACKAGE_JSON_PATHS) {
    const version = await getVersionFromPackageJson(packageJsonPath);
    if (version) {
      return version;
    }
  }

  return "0.0.0-unknown";
}

async function getVersionFromPackageJson(packageJsonPath: string) {
  try {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(process.cwd(), packageJsonPath), "utf-8"),
    ) as { version?: unknown };

    return typeof packageJson.version === "string"
      ? packageJson.version
      : undefined;
  } catch {
    return undefined;
  }
}
