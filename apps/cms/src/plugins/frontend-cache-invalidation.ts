import type { Payload, PayloadRequest, Plugin } from "payload";

type Options = { url?: string; secret?: string };
type TransactionId = number | string;

const contentCollections = new Set([
  "pages",
  "brands",
  "banners",
  "redirects",
  "media",
  "locale-configs",
]);
const contentGlobals = new Set(["common", "footer", "settings"]);

export function frontendCacheInvalidationPlugin({
  url,
  secret,
}: Options): Plugin {
  return (config) => {
    const pendingByAdapter = new WeakMap<
      Payload["db"],
      Map<TransactionId, Set<string>>
    >();

    async function notify(payload: Payload, sources: Set<string>) {
      if (!url || !secret) return;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(3000),
          redirect: "error",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        payload.logger.warn({
          msg: "CMS content saved, but frontend cache invalidation failed",
          sources: [...sources],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    function install(payload: Payload) {
      const db = payload.db;
      let pending = pendingByAdapter.get(db);
      if (pending) return pending;
      pending = new Map<TransactionId, Set<string>>();
      pendingByAdapter.set(db, pending);
      const transactions = pending;
      const commit = db.commitTransaction.bind(db);
      const rollback = db.rollbackTransaction.bind(db);

      // afterChange/afterDelete run before commit. Notify only once the outer
      // transaction (including nested home-link updates) becomes visible.
      db.commitTransaction = async (id) => {
        const transactionId = await id;
        try {
          await commit(id);
        } catch (error) {
          transactions.delete(transactionId);
          throw error;
        }
        const sources = transactions.get(transactionId);
        transactions.delete(transactionId);
        if (sources) await notify(payload, sources);
      };
      db.rollbackTransaction = async (id) => {
        try {
          await rollback(id);
        } finally {
          transactions.delete(await id);
        }
      };
      return transactions;
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
    const previousOnInit = config.onInit;
    config.onInit = async (payload) => {
      install(payload);
      if (!url || !secret) {
        payload.logger.warn(
          "CMS cache invalidation is disabled: configure FRONTEND_CACHE_INVALIDATION_URL and CMS_CACHE_INVALIDATION_SECRET",
        );
      }
      await previousOnInit?.(payload);
    };
    return config;
  };
}
