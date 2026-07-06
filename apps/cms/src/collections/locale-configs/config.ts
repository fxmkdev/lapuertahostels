import type { CollectionConfig } from "payload";

import locales from "../../common/locales.json" with { type: "json" };
import {
  deeplSourceLanguageCodes,
  deeplTargetLanguage as deeplTargetLanguageCodes,
} from "../../common/translation";
import { adminGroup } from "../../groups";
import { translated } from "../../translations/translations";
import { googleMapLanguageCodes } from "./google-maps-language-codes";

export const LocaleConfigs: CollectionConfig = {
  slug: "locale-configs",
  admin: {
    defaultColumns: ["locale", "displayLabel"],
    group: adminGroup,
    listSearchableFields: ["locale", "displayLabel"],
    useAsTitle: "locale",
  },
  defaultPopulate: {
    displayLabel: true,
    googleMapsLanguage: true,
  },
  defaultSort: "displayLabel",
  fields: [
    {
      name: "id",
      type: "text",
      admin: {
        hidden: true,
      },
      label: translated("cmsPlugin:common:id"),
    },
    {
      name: "locale",
      type: "select",
      access: {
        update: () => false,
      },
      label: translated("cmsPlugin:localeConfigs:locale:label"),
      options: locales
        .toSorted((a, b) => a.code.localeCompare(b.code))
        .map((locale) => ({
          label: Object.fromEntries(
            Object.entries(locale.label).map(([key, value]) => [
              key,
              `${value} (${locale.code})`,
            ]),
          ),
          value: locale.code,
        })),
      required: true,
    },
    {
      name: "displayLabel",
      type: "text",
      admin: {
        description: translated(
          "cmsPlugin:localeConfigs:displayLabel:description",
        ),
      },
      label: translated("cmsPlugin:localeConfigs:displayLabel:label"),
      required: true,
    },
    {
      name: "deeplSourceLanguage",
      type: "select",
      label: translated("cmsPlugin:localeConfigs:deeplSourceLanguage:label"),
      options: deeplSourceLanguageCodes
        .toSorted((a, b) => a.localeCompare(b))
        .map((languageCode) => ({
          label: Object.fromEntries(
            Object.entries(
              locales.find((l) => l.code === languageCode)!.label,
            ).map(([key, value]) => [key, `${value} (${languageCode})`]),
          ),
          value: languageCode,
        })),
    },
    {
      name: "deeplTargetLanguage",
      type: "select",
      label: translated("cmsPlugin:localeConfigs:deeplTargetLanguage:label"),
      options: deeplTargetLanguageCodes
        .toSorted((a, b) => a.localeCompare(b))
        .map((languageCode) => ({
          label: Object.fromEntries(
            Object.entries(
              locales.find((l) => l.code === languageCode)!.label,
            ).map(([key, value]) => [key, `${value} (${languageCode})`]),
          ),
          value: languageCode,
        })),
    },
    {
      name: "googleMapsLanguage",
      type: "select",
      label: translated("cmsPlugin:localeConfigs:googleMapsLanguage:label"),
      options: googleMapLanguageCodes
        .toSorted((a, b) => a.localeCompare(b))
        .map((languageCode) => ({
          label: Object.fromEntries(
            Object.entries(
              locales.find((l) => l.code === languageCode)!.label,
            ).map(([key, value]) => [key, `${value} (${languageCode})`]),
          ),
          value: languageCode,
        })),
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        data.id = data.locale;
      },
    ],
  },
  labels: {
    plural: translated("cmsPlugin:localeConfigs:labels:plural"),
    singular: translated("cmsPlugin:localeConfigs:labels:singular"),
  },
};
