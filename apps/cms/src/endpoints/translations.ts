import type { CollectionSlug, Endpoint, GlobalSlug } from "payload";

import { getValueByPath } from "../common/utils";

export const translationsEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) {
      return new Response(null, { status: 401, statusText: "Unauthorized" });
    }

    const collection = req.searchParams.get("collection");
    const global = req.searchParams.get("global");
    const id = req.searchParams.get("id");

    if (!collection && !global) {
      return new Response(
        JSON.stringify({ message: "'collection' or 'global' is required" }),
        {
          status: 400,
          statusText: "Bad Request",
        },
      );
    }

    if (collection && !id) {
      return new Response(
        JSON.stringify({ message: "'id' is required for collections" }),
        {
          status: 400,
          statusText: "Bad Request",
        },
      );
    }

    const fieldPath = req.searchParams.get("fieldPath");
    if (!fieldPath) {
      return new Response(
        JSON.stringify({ message: "'fieldPath' is required" }),
        {
          status: 400,
          statusText: "Bad Request",
        },
      );
    }
    const data =
      collection && id
        ? await req.payload.findByID({
            id,
            collection: collection as CollectionSlug,
            locale: "all",
          })
        : await req.payload.findGlobal({
            slug: global as GlobalSlug,
            locale: "all",
          });

    return new Response(
      JSON.stringify({ value: getValueByPath(data, fieldPath) }),
      {
        headers: {
          "content-type": "application/json",
        },
        status: 200,
      },
    );
  },
  method: "get",
  path: "/translations",
};
