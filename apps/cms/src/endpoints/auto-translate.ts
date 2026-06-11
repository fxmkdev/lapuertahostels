import type {} from "@payloadcms/db-mongodb";
import type { SerializedEditorState } from "@payloadcms/richtext-lexical/lexical";
import type { SourceLanguageCode, TargetLanguageCode } from "deepl-node";
import type { Endpoint, TypedLocale } from "payload";

import { convertHTMLToLexical } from "@payloadcms/richtext-lexical";
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";
import { type ObjectId as ObjectIdType } from "bson";
import { JSDOM } from "jsdom";
import { addLocalesToRequestFromData } from "payload";

import { canManageContent } from "../common/access-control";
import { getEditorConfig } from "../common/editor";
import { translate } from "../common/translation";
import { getValueByPath } from "../common/utils";

export const autoTranslateEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) {
      return new Response(null, { status: 401, statusText: "Unauthorized" });
    }

    if (!canManageContent({ req })) {
      return new Response(null, { status: 403, statusText: "Forbidden" });
    }

    if (!req.json) {
      throw new Error("No JSON body");
    }

    const { targetLocaleCodes } = (await req.json()) as {
      targetLocaleCodes: TypedLocale[];
    };

    const { ObjectId } = await import("bson");

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
      return new Response(JSON.stringify({ message: "'id' is required" }), {
        status: 400,
        statusText: "Bad Request",
      });
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
    const _id = ObjectId.isValid(id!) ? new ObjectId(id!) : id!;

    const originalDoc = collection
      ? await req.payload.db.connection
          .collection<{ _id: ObjectIdType | string }>(collection)
          .findOne({ _id })
      : await req.payload.db.connection
          .collection("globals")
          .findOne({ globalType: global });
    if (!originalDoc) {
      throw new Error("Document not found");
    }

    addLocalesToRequestFromData(req);

    if (!req.locale || req.locale === "all") {
      return new Response("Concrete locale required (cannot be 'all')", {
        status: 400,
        statusText: "Bad Request",
      });
    }

    const textInAllLocales = getValueByPath(originalDoc, fieldPath) as
      | null
      | Record<string, SerializedEditorState | string>
      | undefined;

    const originalText = textInAllLocales && textInAllLocales[req.locale];

    if (!originalText) {
      console.log("Text not available in current locale");
      return new Response(null, { status: 204 });
    }

    const configuredLocales = await req.payload.find({
      collection: "locale-configs",
      pagination: false,
      req,
    });

    const availableTranslationLocales = configuredLocales.docs
      .map((l) => l.id)
      .filter((l) => l !== req.locale);

    if (
      targetLocaleCodes.some((tl) => !availableTranslationLocales.includes(tl!))
    ) {
      return new Response("Invalid target locales", {
        status: 400,
        statusText: "Bad Request",
      });
    }

    console.log(`Translation locales: ${availableTranslationLocales}`);
    console.log(`Target locales: ${targetLocaleCodes}`);

    const isRichText = typeof originalText !== "string";

    const sourceLanguageCode = getDeepLSourceLanguageCode(req.locale);
    const promises = await Promise.allSettled(
      targetLocaleCodes.map(async (tl) => {
        try {
          const resultText = (
            await translate(
              isRichText
                ? convertLexicalToHTML({ data: originalText })
                : originalText,
              sourceLanguageCode,
              getDeepLTargetLanguageCode(tl),
              isRichText,
            )
          ).text;

          textInAllLocales[tl!] = isRichText
            ? convertHTMLToLexical({
                editorConfig: await getEditorConfig(req.payload.config),
                html: resultText,
                JSDOM,
              })
            : resultText;
        } catch (e) {
          console.error(`Failed to translate to ${tl}: ${e}`);
          throw e;
        }
      }),
    );

    if (promises.some((p) => p.status === "rejected")) {
      throw new Error("Some texts failed to translate");
    }

    await req.payload.db.connection
      .collection<{ _id: ObjectIdType | string }>(collection || "globals")
      .updateOne(
        { _id: originalDoc._id },
        {
          $set: {
            [fieldPath]: textInAllLocales,
          },
        },
      );

    console.log("Text translated successfully");

    return new Response(null, { status: 204 });

    function getDeepLSourceLanguageCode(sourceLocaleCode: TypedLocale) {
      const sourceLocale = configuredLocales.docs.find(
        (l) => l.id === sourceLocaleCode,
      );
      if (!sourceLocale) {
        throw new Error(
          `Source locale ${sourceLocaleCode} not found in configured locales`,
        );
      }

      if (!sourceLocale.deeplSourceLanguage) {
        throw new Error(
          `Source locale ${sourceLocaleCode} does not have a DeepL source language configured`,
        );
      }

      return sourceLocale.deeplSourceLanguage as SourceLanguageCode;
    }

    function getDeepLTargetLanguageCode(targetLocaleCode: TypedLocale) {
      const targetLocale = configuredLocales.docs.find(
        (l) => l.id === targetLocaleCode,
      );
      if (!targetLocale) {
        throw new Error(
          `Target locale ${targetLocaleCode} not found in configured locales`,
        );
      }

      if (!targetLocale.deeplTargetLanguage) {
        throw new Error(
          `Source locale ${targetLocaleCode} does not have a DeepL target language configured`,
        );
      }

      return targetLocale.deeplTargetLanguage as TargetLanguageCode;
    }
  },
  method: "post",
  path: "/auto-translate",
};
