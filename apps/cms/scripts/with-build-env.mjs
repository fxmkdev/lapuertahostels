// Build/type generation needs configuration, but must never require live credentials.
import { spawnSync } from "node:child_process";
const result = spawnSync(process.argv[2], process.argv.slice(3), {
  stdio: "inherit",
  env: {
    MEDIA_STORAGE_ENDPOINT: "https://t3.storage.dev",
    MEDIA_STORAGE_REGION: "auto",
    MEDIA_STORAGE_BUCKET: "build-only",
    MEDIA_PUBLIC_BASE_URL: "https://build-only.invalid",
    MEDIA_STORAGE_ACCESS_KEY_ID: "build-only",
    MEDIA_STORAGE_SECRET_ACCESS_KEY: "build-only",
    ...process.env,
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
