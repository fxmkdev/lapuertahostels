import { isIP } from "node:net";

const EVENT_URL = "https://plausible.io/api/event";
const MAX_EVENT_BODY_BYTES = 64 * 1024;

class EventBodyTooLarge extends Error {}

export function getAnalyticsScriptUrl() {
  const value = process.env.ANALYTICS_SCRIPT_URL;
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (
      url.origin === "https://plausible.io" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/js\/[^/]+\.js$/.test(url.pathname)
    ) {
      return url.href;
    }
  } catch {
    // Invalid configuration disables analytics without breaking the website.
  }
  return undefined;
}

function errorResponse(status: number, message: string, allow?: string) {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(allow ? { Allow: allow } : {}),
    },
  });
}

export async function proxyAnalyticsScript(request: Request) {
  const scriptUrl = getAnalyticsScriptUrl();
  if (!scriptUrl) return errorResponse(404, "Not found");
  if (!["GET", "HEAD"].includes(request.method)) {
    return errorResponse(405, "Method not allowed", "GET, HEAD");
  }

  return proxy(request, scriptUrl, new Headers(), [
    "Content-Type",
    "Cache-Control",
    "ETag",
    "Last-Modified",
  ]);
}

export async function proxyAnalyticsEvent(request: Request) {
  if (!getAnalyticsScriptUrl()) return errorResponse(404, "Not found");
  if (request.method !== "POST") {
    return errorResponse(405, "Method not allowed", "POST");
  }

  // Fly Proxy supplies this header. Do not trust caller-supplied forwarding
  // chains or CF-Connecting-IP; this deployment is directly behind Fly Proxy.
  const visitorIp = request.headers.get("Fly-Client-IP")?.trim();
  if (!visitorIp || !isIP(visitorIp)) {
    return errorResponse(400, "Missing or invalid visitor IP");
  }

  const headers = new Headers({ "X-Forwarded-For": visitorIp });
  for (const [name, value] of request.headers) {
    if (
      [
        "content-type",
        "user-agent",
        "accept",
        "accept-language",
        "origin",
        "referer",
        "pragma",
        "cache-control",
        "x-debug-request",
      ].includes(name) ||
      name.startsWith("sec-ch-ua") ||
      name.startsWith("sec-fetch-")
    ) {
      headers.set(name, value);
    }
  }

  return proxy(request, EVENT_URL, headers, [
    "Content-Type",
    "x-plausible-dropped",
  ]);
}

async function readEventBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return undefined;

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_EVENT_BODY_BYTES) {
        // Do not cancel: the Node adapter would destroy the incoming socket
        // before the 413 can be sent. Its response closes the connection instead.
        throw new EventBodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function proxy(
  request: Request,
  url: string,
  headers: Headers,
  responseHeaderNames: string[],
) {
  const timeout = AbortSignal.timeout(10_000);
  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body:
        request.method === "POST" ? await readEventBody(request) : undefined,
      signal: AbortSignal.any([timeout, request.signal]),
      redirect: "error",
    });
    const responseHeaders = new Headers();
    for (const name of responseHeaderNames) {
      const value = response.headers.get(name);
      if (value !== null) responseHeaders.set(name, value);
    }
    if (request.method === "POST" || !response.ok) {
      responseHeaders.set("Cache-Control", "no-store");
    }

    const body =
      request.method === "HEAD" || [204, 205, 304].includes(response.status)
        ? null
        : await response.arrayBuffer();
    return new Response(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof EventBodyTooLarge) {
      const response = errorResponse(
        413,
        "Analytics event body exceeds 64 KiB",
      );
      response.headers.set("Connection", "close");
      return response;
    }
    return timeout.aborted
      ? errorResponse(504, "Analytics upstream timed out")
      : errorResponse(502, "Analytics upstream unavailable");
  }
}
