import type { Config, Payload, PayloadRequest, Plugin } from "payload";

type Options = { url?: string; secret?: string };
type TransactionId = number | string;
type Notify = (payload: Payload, sources: Set<string>) => Promise<void>;
type ContentChanged = (req: PayloadRequest, source: string) => Promise<void>;

const contentCollections = new Set([
  "pages",
  "brands",
  "banners",
  "redirects",
  "media",
  "locale-configs",
]);
const contentGlobals = new Set(["common", "footer", "settings"]);

function createNotifier({ url, secret }: Options): Notify {
  return async (payload, sources) => {
    if (!url || !secret) return;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(3000),
        redirect: "error",
      });
      // The callback only needs the status; cleanup must not change its outcome.
      await response.body?.cancel().catch(() => undefined);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      payload.logger.warn({
        msg: "CMS content saved, but frontend cache invalidation failed",
        sources: [...sources],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

function installTransactionHooks(payload: Payload, notify: Notify) {
  const pending = new Map<TransactionId, Set<string>>();
  const db = payload.db;
  const commit = db.commitTransaction.bind(db);
  const rollback = db.rollbackTransaction.bind(db);

  // afterChange/afterDelete run before commit. Notify only once the outer
  // transaction (including nested home-link updates) becomes visible.
  db.commitTransaction = async (id) => {
    const transactionId = await id;
    try {
      await commit(id);
    } catch (error) {
      pending.delete(transactionId);
      throw error;
    }
    const sources = pending.get(transactionId);
    pending.delete(transactionId);
    if (sources) await notify(payload, sources);
  };
  db.rollbackTransaction = async (id) => {
    try {
      await rollback(id);
    } finally {
      pending.delete(await id);
    }
  };
  return pending;
}

function appendContentHooks(config: Config, changed: ContentChanged) {
  for (const collection of config.collections ?? []) {
    if (!contentCollections.has(collection.slug)) continue;
    collection.hooks = {
      ...collection.hooks,
      afterChange: [
        ...(collection.hooks?.afterChange ?? []),
        async ({ req, doc }) => {
          await changed(req, collection.slug);
          return doc;
        },
      ],
      afterDelete: [
        ...(collection.hooks?.afterDelete ?? []),
        async ({ req, doc }) => {
          await changed(req, collection.slug);
          return doc;
        },
      ],
    };
  }
  for (const global of config.globals ?? []) {
    if (!contentGlobals.has(global.slug)) continue;
    global.hooks = {
      ...global.hooks,
      afterChange: [
        ...(global.hooks?.afterChange ?? []),
        async ({ req, doc }) => {
          await changed(req, global.slug);
          return doc;
        },
      ],
    };
  }
}

export function frontendCacheInvalidationPlugin(options: Options): Plugin {
  return (config) => {
    const pendingByAdapter = new WeakMap<
      Payload["db"],
      Map<TransactionId, Set<string>>
    >();
    const notify = createNotifier(options);

    function install(payload: Payload) {
      let pending = pendingByAdapter.get(payload.db);
      if (!pending) {
        pending = installTransactionHooks(payload, notify);
        pendingByAdapter.set(payload.db, pending);
      }
      return pending;
    }

    async function changed(req: PayloadRequest, source: string) {
      const pending = install(req.payload);
      const id = await req.transactionID;
      if (id === undefined || id === null) {
        await notify(req.payload, new Set([source]));
      } else {
        const sources = pending.get(id) ?? new Set<string>();
        sources.add(source);
        pending.set(id, sources);
      }
    }

    appendContentHooks(config, changed);
    const previousOnInit = config.onInit;
    config.onInit = async (payload) => {
      install(payload);
      if (!options.url || !options.secret) {
        payload.logger.warn(
          "CMS cache invalidation is disabled: configure FRONTEND_CACHE_INVALIDATION_URL and CMS_CACHE_INVALIDATION_SECRET",
        );
      }
      await previousOnInit?.(payload);
    };
    return config;
  };
}
