import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { invalidateFrontendCache } from "./snapshot-invalidation.mjs";
import { quoteCommandArgument } from "./snapshot-policy.mjs";

test("cache invalidation retries connection failures and warming servers", async () => {
  let calls = 0,
    waits = 0;
  await invalidateFrontendCache({
    secret: "test",
    wait: async () => {
      waits++;
    },
    fetcher: async (_url, { headers }) => {
      assert.equal(headers.Authorization, "Bearer test");
      calls++;
      if (calls === 1) throw new Error("ECONNREFUSED");
      return { ok: calls === 3, status: calls === 3 ? 204 : 503 };
    },
  });
  assert.equal(calls, 3);
  assert.equal(waits, 2);
});
test("cache invalidation fails immediately on authentication errors and bounds retries", async () => {
  let calls = 0;
  await assert.rejects(
    invalidateFrontendCache({
      secret: "test",
      fetcher: async () => {
        calls++;
        return { ok: false, status: 401 };
      },
    }),
    /rejected/,
  );
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(
    invalidateFrontendCache({
      secret: "test",
      attempts: 3,
      wait: async () => {},
      fetcher: async () => {
        calls++;
        return { ok: false, status: 503 };
      },
    }),
    /did not become ready/,
  );
  assert.equal(calls, 3);
});
test("serialized invalidation code survives command quoting and uses the remote secret", async () => {
  const literal = "a'b\n$(printf must-remain-literal)";
  assert.equal(
    execFileSync("sh", ["-c", `printf '%s' ${quoteCommandArgument(literal)}`], {
      encoding: "utf8",
    }),
    literal,
  );
  const code = `await (${invalidateFrontendCache.toString()})();`;
  const recovered = execFileSync(
    "sh",
    ["-c", `printf '%s' ${quoteCommandArgument(code)}`],
    { encoding: "utf8" },
  );
  assert.equal(recovered, code);
  let called = false;
  await runInNewContext(`(async () => { ${recovered} })()`, {
    process: { env: { CMS_CACHE_INVALIDATION_SECRET: "remote-secret" } },
    AbortSignal,
    setTimeout,
    fetch: async (_url, { headers }) => {
      assert.equal(headers.Authorization, "Bearer remote-secret");
      called = true;
      return { ok: true, status: 204 };
    },
  });
  assert(called);
});
