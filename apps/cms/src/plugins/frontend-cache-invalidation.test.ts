// @vitest-environment node

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  Config,
  Payload,
  PayloadRequest,
} from "payload";
import { frontendCacheInvalidationPlugin } from "./frontend-cache-invalidation";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
});
afterEach(() => vi.unstubAllGlobals());

async function harness(
  options = {
    url: "https://frontend.example.com/api/invalidate-cms-cache",
    secret: "shared-secret",
  },
) {
  const events: string[] = [];
  const existing = vi.fn(() => {
    events.push("existing");
  });
  const bootstrap = vi.fn();
  const config = await frontendCacheInvalidationPlugin(options)({
    collections: [
      "pages",
      "brands",
      "banners",
      "redirects",
      "media",
      "locale-configs",
      "users",
      "api-keys",
    ].map((slug) => ({
      slug,
      fields: [],
      hooks: { afterChange: [existing], afterDelete: [existing] },
    })),
    globals: ["common", "footer", "settings", "unrelated"].map((slug) => ({
      slug,
      fields: [],
      hooks: { afterChange: [existing] },
    })),
    onInit: bootstrap,
  } as unknown as Config);
  const commit = vi.fn(async function (this: unknown) {
    expect(this).toBe(payload.db);
    events.push("commit");
  });
  const rollback = vi.fn(async () => {
    events.push("rollback");
  });
  const warn = vi.fn();
  const payload = {
    db: { commitTransaction: commit, rollbackTransaction: rollback },
    logger: { warn },
  } as unknown as Payload;
  await config.onInit!(payload);

  const req = (transactionID?: string | Promise<string>) =>
    ({ payload, transactionID }) as PayloadRequest;
  const change = async (
    slug: string,
    transactionID?: string | Promise<string>,
    operation: "afterChange" | "afterDelete" = "afterChange",
  ) => {
    const collection = config.collections!.find((c) => c.slug === slug)!;
    const hooks = collection.hooks![operation]!;
    const doc = { id: "record-1" };
    let result: unknown;
    for (const hook of hooks) {
      result = await hook({
        doc,
        req: req(transactionID),
      } as Parameters<CollectionAfterChangeHook>[0] &
        Parameters<CollectionAfterDeleteHook>[0]);
    }
    return result;
  };
  const changeGlobal = async (slug: string, transactionID?: string) => {
    const global = config.globals!.find((g) => g.slug === slug)!;
    for (const hook of global.hooks!.afterChange!) {
      await hook({
        doc: { id: "global-1" },
        req: req(transactionID),
      } as Parameters<typeof hook>[0]);
    }
  };
  return {
    config,
    payload,
    commit,
    rollback,
    warn,
    events,
    existing,
    bootstrap,
    change,
    changeGlobal,
  };
}

test.each([
  "pages",
  "brands",
  "banners",
  "redirects",
  "media",
  "locale-configs",
])(
  "invalidates %s saves and deletes, preserving hooks and documents",
  async (slug) => {
    const h = await harness();
    expect(await h.change(slug)).toEqual({ id: "record-1" });
    expect(await h.change(slug, undefined, "afterDelete")).toEqual({
      id: "record-1",
    });
    expect(h.existing).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(h.bootstrap).toHaveBeenCalledWith(h.payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://frontend.example.com/api/invalidate-cms-cache",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer shared-secret" },
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  },
);

test.each(["common", "footer", "settings"])(
  "invalidates %s global saves",
  async (slug) => {
    const h = await harness();
    await h.changeGlobal(slug);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(h.existing).toHaveBeenCalledTimes(1);
  },
);

test("does not invalidate unrelated collections or globals", async () => {
  const h = await harness();
  await h.change("users");
  await h.change("api-keys");
  await h.changeGlobal("unrelated");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("deduplicates nested saves and notifies only after the outer commit", async () => {
  const h = await harness();
  await h.change("pages", "txn-1");
  await h.change("brands", Promise.resolve("txn-1"));
  await h.changeGlobal("settings", "txn-1");
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockImplementationOnce(async () => {
    h.events.push("notify");
    return new Response(null, { status: 204 });
  });
  expect(await h.payload.db.commitTransaction("txn-1")).toBeUndefined();
  expect(h.events).toEqual([
    "existing",
    "existing",
    "existing",
    "commit",
    "notify",
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await h.payload.db.commitTransaction("other-txn");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("awaits notification before returning from commit", async () => {
  const h = await harness();
  await h.change("banners", "txn");
  let finish!: (response: Response) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  let completed = false;
  const committing = h.payload.db.commitTransaction("txn").then(() => {
    completed = true;
  });
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(completed).toBe(false);
  finish(new Response(null, { status: 204 }));
  await committing;
  expect(completed).toBe(true);
});

test("discards invalidation on rollback, including failing rollbacks", async () => {
  const h = await harness();
  await h.change("banners", "txn");
  await h.payload.db.rollbackTransaction("txn");
  await h.payload.db.commitTransaction("txn");
  await h.change("pages", "txn-2");
  h.rollback.mockRejectedValueOnce(new Error("rollback failed"));
  await expect(h.payload.db.rollbackTransaction("txn-2")).rejects.toThrow(
    "rollback failed",
  );
  await h.payload.db.commitTransaction("txn-2");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("preserves commit errors and clears pending invalidation", async () => {
  const h = await harness();
  await h.change("banners", "txn");
  h.commit.mockRejectedValueOnce(new Error("commit failed"));
  await expect(h.payload.db.commitTransaction("txn")).rejects.toThrow(
    "commit failed",
  );
  await h.payload.db.commitTransaction("txn");
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each(["http", "network", "timeout"])(
  "logs %s invalidation failures without failing committed saves",
  async (failure) => {
    const h = await harness();
    await h.change("banners", "txn");
    if (failure === "http")
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    else
      fetchMock.mockRejectedValueOnce(
        failure === "timeout"
          ? new DOMException("timed out", "TimeoutError")
          : new Error("offline"),
      );
    await expect(
      h.payload.db.commitTransaction("txn"),
    ).resolves.toBeUndefined();
    expect(h.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        sources: ["banners"],
        msg: expect.stringContaining("invalidation failed"),
      }),
    );
  },
);

test("logs unconfigured invalidation at initialization and continues saving", async () => {
  const h = await harness({ url: "", secret: "" });
  await h.change("pages");
  expect(h.warn).toHaveBeenCalledWith(
    expect.stringContaining("invalidation is disabled"),
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([200, 503])(
  "cancels unread invalidation response bodies (HTTP %s)",
  async (status) => {
    const h = await harness();
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(new ReadableStream({ cancel }), { status }),
    );
    await h.change("banners");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(h.warn).toHaveBeenCalledTimes(status === 200 ? 0 : 1);
  },
);

test("does not report successful invalidation as failed when body cleanup fails", async () => {
  const h = await harness();
  const cancel = vi.fn(() => {
    throw new Error("cleanup failed");
  });
  fetchMock.mockResolvedValueOnce(
    new Response(new ReadableStream({ cancel }), { status: 200 }),
  );
  await h.change("banners");
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(h.warn).not.toHaveBeenCalled();
});
