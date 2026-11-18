import { createHash, randomUUID } from "node:crypto";
import { runRedisCommand } from "./redis";

function cacheNamespace() {
  const baseUrl = process.env.PAYLOAD_CMS_BASE_URL;
  if (!baseUrl) throw new Error("PAYLOAD_CMS_BASE_URL is not set");
  const cmsUrl = new URL(baseUrl).origin;
  const hash = createHash("sha256").update(cmsUrl).digest("hex");
  return `cms:v1:${hash}`;
}

export async function getCmsCachePrefix(): Promise<string | null> {
  const namespace = cacheNamespace();
  try {
    const generation = await runRedisCommand(async (redis) => {
      const key = `${namespace}:generation`;
      const existing = await redis.get(key);
      if (existing) return existing;
      const candidate = randomUUID();
      // GET returns a concurrently-created generation when NX prevents our SET.
      return (
        (await redis.set(key, candidate, { NX: true, GET: true })) ?? candidate
      );
    });
    return `${namespace}:${generation}`;
  } catch (error) {
    console.warn("Failed to read CMS cache generation; bypassing Redis", error);
    return null;
  }
}

export async function invalidateCmsCache() {
  const key = `${cacheNamespace()}:generation`;
  await runRedisCommand((redis) => redis.set(key, randomUUID()));
}
