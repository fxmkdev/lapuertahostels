// Keep this function self-contained: it is also serialized and executed inside
// each frontend VM so that its credential never leaves that VM.
export async function invalidateFrontendCache({
  fetcher = globalThis.fetch,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  secret = process.env.CMS_CACHE_INVALIDATION_SECRET,
  attempts = 15,
} = {}) {
  if (!secret) throw new Error("Frontend cache invalidation secret is missing");
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetcher(
        "http://127.0.0.1:3000/api/invalidate-cms-cache",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(3000),
        },
      );
      await response.body?.cancel().catch(() => undefined);
      if (response.ok) return;
      if ([401, 403].includes(response.status))
        throw Object.assign(
          new Error("Frontend rejected cache invalidation credentials"),
          { permanent: true },
        );
    } catch (error) {
      if (error.permanent) throw error;
    }
    if (attempt + 1 < attempts) await wait(1000);
  }
  throw new Error("Frontend cache invalidation did not become ready");
}
