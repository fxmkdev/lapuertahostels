import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const root = new URL("../../apps/frontend/storybook-static/", import.meta.url);
const contentTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = new URL(
      pathname === "/" ? "index.html" : `.${pathname}`,
      root,
    );
    if (!file.href.startsWith(root.href)) {
      response.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    response
      .writeHead(200, {
        "Content-Type":
          contentTypes[extname(file.pathname)] ?? "application/octet-stream",
      })
      .end(body);
  } catch {
    response.writeHead(404).end();
  }
}).listen(6007, "127.0.0.1");
