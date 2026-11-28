import assert from "node:assert/strict";
import { test } from "node:test";
import { isCurrentRequest } from "./admit-images.mjs";

const inputs = {
  eventName: "pull_request",
  event: { pull_request: { number: 451, head: { sha: "older-head" } } },
  repository: "example/site",
  apiUrl: "https://api.github.com/",
  token: "test-token",
};
const response =
  (sha, state = "open") =>
  async () => ({
    ok: true,
    json: async () => ({ head: { sha }, state }),
  });

test("main pushes and manual releases are admitted without a PR lookup", async () => {
  for (const eventName of ["push", "workflow_dispatch"])
    assert.equal(
      await isCurrentRequest({ eventName }, () => {
        throw new Error("Unexpected API lookup");
      }),
      true,
    );
});
test("the current PR revision is admitted", async () => {
  assert.equal(await isCurrentRequest(inputs, response("older-head")), true);
});
test("an older run finishing prerequisites late cannot enter the cancellation group", async () => {
  assert.equal(await isCurrentRequest(inputs, response("newer-head")), false);
});
test("closed PRs are not admitted even when their head matches", async () => {
  assert.equal(
    await isCurrentRequest(inputs, response("older-head", "closed")),
    false,
  );
});
test("PR lookup uses authenticated bounded requests and preserves enterprise API paths", async () => {
  await isCurrentRequest(
    { ...inputs, apiUrl: "https://github.example/api/v3/" },
    async (url, options) => {
      assert.equal(
        url,
        "https://github.example/api/v3/repos/example/site/pulls/451",
      );
      assert.equal(options.headers.Authorization, "Bearer test-token");
      assert.ok(options.signal instanceof AbortSignal);
      return response("older-head")();
    },
  );
});
test("API failures fail closed rather than admitting stale work", async () => {
  for (const status of [401, 403, 503])
    await assert.rejects(
      isCurrentRequest(inputs, async () => ({ ok: false, status })),
      new RegExp(`HTTP ${status}`),
    );
  await assert.rejects(
    isCurrentRequest(inputs, async () => {
      throw new Error("timeout");
    }),
    /timeout/,
  );
});
test("missing inputs and malformed PR data fail closed", async () => {
  await assert.rejects(
    isCurrentRequest({ ...inputs, token: "" }),
    /Missing PR/,
  );
  await assert.rejects(
    isCurrentRequest(inputs, async () => ({
      ok: true,
      json: async () => ({}),
    })),
    /invalid PR/,
  );
});
