import type {
  DefaultTranslationKeys,
  NestedKeysStripped,
} from "@payloadcms/translations";

import type { en } from "./locales/en";

export type TranslationsObject = typeof en;

export type TranslationsKey =
  | DefaultTranslationKeys
  | NestedKeysStripped<TranslationsObject>;
