import { timingSafeEqual } from "node:crypto";
import type { ActionFunctionArgs } from "react-router";
import { invalidateCmsCache } from "~/cms-cache.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }
  const secret = process.env.CMS_CACHE_INVALIDATION_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const supplied = Buffer.from(request.headers.get("Authorization") ?? "");
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    return new Response(null, { status: 401 });
  }
  try {
    await invalidateCmsCache();
    return new Response(null, { status: 204 });
  } catch (error) {
    console.warn("CMS cache invalidation failed", error);
    return new Response(null, { status: 503 });
  }
}
