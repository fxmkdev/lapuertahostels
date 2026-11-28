import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { output } from "./inputs.mjs";

export async function isCurrentRequest(
  { eventName, event, repository, apiUrl, token },
  request = fetch,
) {
  if (eventName !== "pull_request") return true;
  const number = event.pull_request?.number;
  const sha = event.pull_request?.head?.sha;
  if (!number || !sha || !repository || !apiUrl || !token)
    throw new Error("Missing PR image admission inputs");
  const response = await request(
    `${apiUrl.replace(/\/$/, "")}/repos/${repository}/pulls/${number}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok)
    throw new Error(`PR image admission failed: HTTP ${response.status}`);
  const current = await response.json();
  if (!current.head?.sha || !["open", "closed"].includes(current.state))
    throw new Error("GitHub returned invalid PR image admission data");
  return current.state === "open" && current.head.sha === sha;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const current = await isCurrentRequest({
    eventName: process.env.GITHUB_EVENT_NAME,
    event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")),
    repository: process.env.GITHUB_REPOSITORY,
    apiUrl: process.env.GITHUB_API_URL,
    token: process.env.GITHUB_TOKEN,
  });
  output({ current });
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    current
      ? "Image requests admitted for this revision.\n"
      : "Image requests skipped: this PR revision is superseded or closed.\n",
  );
}
