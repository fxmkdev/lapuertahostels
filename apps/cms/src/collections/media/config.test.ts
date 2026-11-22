import { expect, test, vi } from "vitest";
import type { PayloadRequest } from "payload";
import { getExternalFile } from "payload/internal";
import { mediaFileFetchOptions } from "./config";

test("allows only the configured CMS media-file endpoint for focal refetches", () => {
  expect(mediaFileFetchOptions("http://localhost:3001").skipSafeFetch).toEqual([
    {
      hostname: "localhost",
      protocol: "http",
      port: "3001",
      pathname: "/api/media/file/*",
    },
  ]);
  expect(
    mediaFileFetchOptions("https://cms.example.com/base/", "/custom-api")
      .skipSafeFetch,
  ).toEqual([
    {
      hostname: "cms.example.com",
      protocol: "https",
      port: "",
      pathname: "/base/custom-api/media/file/*",
    },
  ]);
  expect(mediaFileFetchOptions(undefined)).toEqual({});
  expect(mediaFileFetchOptions("file:///tmp/media")).toEqual({});
});

test("forwards authentication only to the configured CMS origin", () => {
  const { externalFileHeaderFilter: filter } = mediaFileFetchOptions(
    "http://localhost:3001",
  );
  const headers = {
    cookie: "payload-token=editor-session",
    authorization: "private-api-key",
  };
  expect(
    filter!(headers, {
      isSameOrigin: false,
      url: "http://localhost:3001/api/media/file/photo.jpg",
    }),
  ).toEqual({ ...headers, origin: "http://localhost:3001" });
  for (const url of [
    "https://other.example.com/photo.jpg",
    "http://localhost:9999/api/media/file/photo.jpg",
    "https://localhost:3001/api/media/file/photo.jpg",
  ]) {
    expect(filter!(headers, { isSameOrigin: false, url })).toEqual({});
  }
  expect(filter!(headers)).toEqual({});
  expect(
    filter!(
      {},
      {
        isSameOrigin: false,
        url: "http://localhost:3001/api/media/file/photo.jpg",
      },
    ),
  ).toEqual({});
});

test("Payload refetches retain actual file size without Content-Length", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const fetch = vi.fn().mockResolvedValue(new Response(bytes));
  vi.stubGlobal("fetch", fetch);
  try {
    const file = await getExternalFile({
      data: {
        filename: "photo.jpg",
        url: "http://localhost:3001/api/media/file/photo.jpg",
      },
      req: {
        headers: new Headers({ cookie: "payload-token=test-editor" }),
        payload: {
          config: {
            cookiePrefix: "payload",
            serverURL: "http://localhost:3001",
          },
        },
      } as PayloadRequest,
      uploadConfig: mediaFileFetchOptions("http://localhost:3001"),
    });
    expect(file.size).toBe(bytes.byteLength);
    expect(file.data).toEqual(Buffer.from(bytes));
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/media/file/photo.jpg",
      expect.objectContaining({
        headers: {
          cookie: "payload-token=test-editor",
          origin: "http://localhost:3001",
        },
      }),
    );
  } finally {
    vi.unstubAllGlobals();
  }
});

test("a default CMS port does not allow private refetches on other ports", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1])));
  vi.stubGlobal("fetch", fetch);
  try {
    await expect(
      getExternalFile({
        data: {
          filename: "photo.jpg",
          url: "http://127.0.0.1:9876/api/media/file/photo.jpg",
        },
        req: {
          headers: new Headers(),
          payload: {
            config: { cookiePrefix: "payload", serverURL: "http://127.0.0.1" },
          },
        } as PayloadRequest,
        uploadConfig: mediaFileFetchOptions("http://127.0.0.1"),
      }),
    ).rejects.toThrow(/unsafe attempt/);
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

test.each([
  ["http://127.0.0.1", "http://127.0.0.1:80"],
  ["https://127.0.0.1", "https://127.0.0.1:443"],
])(
  "allows the normalized default CMS port: %s",
  async (serverUrl, fileOrigin) => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1])));
    vi.stubGlobal("fetch", fetch);
    try {
      const file = await getExternalFile({
        data: {
          filename: "photo.jpg",
          url: `${fileOrigin}/api/media/file/photo.jpg`,
        },
        req: {
          headers: new Headers(),
          payload: {
            config: { cookiePrefix: "payload", serverURL: serverUrl },
          },
        } as PayloadRequest,
        uploadConfig: mediaFileFetchOptions(serverUrl),
      });
      expect(file.size).toBe(1);
      expect(fetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
