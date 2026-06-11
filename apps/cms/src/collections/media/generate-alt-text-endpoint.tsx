import { addLocalesToRequestFromData, type Endpoint } from "payload";

import { generateAltText } from "../../common/openai";

export function generateAltTextEndpoint({
  publicMediaBaseUrl,
}: {
  publicMediaBaseUrl: string;
}): Endpoint {
  return {
    handler: async (req) => {
      if (!req.user) {
        return new Response(null, { status: 401, statusText: "Unauthorized" });
      }

      if (!req.routeParams) {
        throw new Error("No route params");
      }
      if (!req.json) {
        throw new Error("No JSON body");
      }

      addLocalesToRequestFromData(req);

      if (!req.locale || req.locale === "all") {
        return new Response(
          JSON.stringify({
            message: "'locale' must be set to a concrete locale (not 'all')",
          }),
          { status: 400, statusText: "Bad Request" },
        );
      }

      const { id } = req.routeParams as { id: string };

      const media = await req.payload.findByID({
        id,
        collection: "media",
        depth: 0,
        req,
      });

      if (!media.mimeType?.includes("image/")) {
        throw new Error("Only images are supported");
      }

      const publicImageUrl = `${publicMediaBaseUrl}/${media.filename!}`;

      console.log(
        `Generating alt text for ${publicImageUrl} in locale ${req.locale}`,
      );
      const altText = await generateAltText(publicImageUrl, req.locale);

      console.log(`Updating media ${id} with generated alt text`);
      await req.payload.update({
        id,
        collection: "media",
        data: { alt: altText },
        req,
      });

      return new Response(null, { status: 204 });
    },
    method: "post",
    path: "/:id/update-alt-text",
  };
}
