// @vitest-environment node
import { createServer, request as httpRequest } from "node:http";
import { createReadableStreamFromReadable } from "@react-router/node";
import { expect, test, vi } from "vitest";
import { proxyAnalyticsEvent } from "./analytics-proxy.server";

test("sends HTTP 413 through the Node request bridge without resetting the socket", async () => {
  vi.stubEnv("ANALYTICS_SCRIPT_URL", "https://plausible.io/js/pa-test.js");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const server = createProxyServer();

  try {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test server address");
    const result = await sendOversizedUpload(
      `http://127.0.0.1:${address.port}/api/event`,
    );
    expect(result).toEqual({
      status: 413,
      body: "Analytics event body exceeds 64 KiB",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});

function createProxyServer() {
  return createServer(async (incoming, outgoing) => {
    try {
      const response = await proxyAnalyticsEvent(
        new Request("http://localhost/api/event", {
          method: "POST",
          headers: {
            "Fly-Client-IP": "198.51.100.42",
            "Content-Type": "text/plain",
          },
          body: createReadableStreamFromReadable(incoming),
          ...{ duplex: "half" },
        }),
      );
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(await response.text());
    } catch (error) {
      outgoing.destroy(error as Error);
    }
  });
}

function sendOversizedUpload(url: string) {
  return new Promise<{ status?: number; body: string }>((resolve, reject) => {
    const request = httpRequest(url, { method: "POST" }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        body += chunk;
      });
      response.on("end", () => {
        request.destroy();
        resolve({ status: response.statusCode, body });
      });
      response.on("error", reject);
    });
    request.on("error", reject);
    // Keep a chunked upload open: the server must respond before EOF.
    request.write(Buffer.alloc(64 * 1024 + 1));
  });
}
