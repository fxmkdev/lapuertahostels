import type { Endpoint } from "payload";

import { canManageContent } from "../common/access-control";
import { getValueByPath } from "../common/utils";
import { getTranslationTarget, isResponse } from "./translation-request";

export const translationsEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) {
      return new Response(null, { status: 401, statusText: "Unauthorized" });
    }

    if (!canManageContent({ req })) {
      return new Response(null, { status: 403, statusText: "Forbidden" });
    }

    const target = getTranslationTarget(req);
    if (isResponse(target)) {
      return target;
    }

    const data =
      target.collection && target.id
        ? await req.payload.findByID({
            id: target.id,
            collection: target.collection,
            locale: "all",
            req,
          })
        : await req.payload.findGlobal({
            slug: target.global!,
            locale: "all",
            req,
          });

    return new Response(
      JSON.stringify({ value: getValueByPath(data, target.fieldPath) }),
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
