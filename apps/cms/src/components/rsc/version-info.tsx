import { Pill } from "@payloadcms/ui";
import fs from "fs/promises";

import styles from "./version-info.module.css";

export async function VersionInfo() {
  const packageJson = JSON.parse(await fs.readFile("./package.json", "utf-8"));
  return (
    <div className={styles.container}>
      <Pill pillStyle="light-gray" rounded>
        v{packageJson.version}
      </Pill>
    </div>
  );
}
