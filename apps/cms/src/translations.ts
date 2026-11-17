import type { Config } from "payload";
import type { NestedKeysStripped } from "@payloadcms/translations";

export const translations = {
  en: {
    custom: {
      common: {
        socialLinkRowLabel: "Social Link {{ n }}",
      },
      roomList: {
        roomRowLabel: "Room {{ n }}",
      },
    },
  },
  es: {
    custom: {
      common: {
        socialLinkRowLabel: "Enlace social {{ n }}",
      },
      roomList: {
        roomRowLabel: "Habitación {{ n }}",
      },
    },
  },
} satisfies NonNullable<Config["i18n"]>["translations"];

export type TranslationsObject = typeof translations.en;
export type TranslationsKey = NestedKeysStripped<TranslationsObject>;
