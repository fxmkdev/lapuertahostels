import type { Field, GroupField, RowField, TextField } from "payload";

import { validateUrl } from "@payloadcms/richtext-lexical";
import { text } from "payload/shared";

import { translated } from "../translations/translations";

type LinkFieldOptions = {
  allowedLinkTypes?: ("custom" | "internal")[];
  fieldConfig?: Partial<GroupField>;
  required?: boolean;
};

export function linkField({
  allowedLinkTypes,
  fieldConfig,
  required,
}: LinkFieldOptions = {}): GroupField {
  if (required === undefined) {
    required = true;
  }
  return {
    name: "link",
    type: "group",
    fields: [
      {
        name: "linkType",
        type: "radio",
        admin: {
          description: translated("cmsPlugin:fields:link:linkType:description"),
          position: "sidebar",
        },
        defaultValue: "internal",
        label: translated("cmsPlugin:fields:link:linkType:label"),
        options: [
          {
            label: translated("cmsPlugin:fields:link:linkType:options:custom"),
            value: "custom" as const,
          },
          {
            label: translated(
              "cmsPlugin:fields:link:linkType:options:internal",
            ),
            value: "internal" as const,
          },
        ].filter(
          (o) => !allowedLinkTypes || allowedLinkTypes.includes(o.value),
        ),
        required,
      },
      {
        name: "doc",
        type: "relationship",
        admin: {
          appearance: "drawer",
          condition: (_, siblingData) => siblingData.linkType === "internal",
        },
        label: translated("cmsPlugin:fields:link:doc:label"),
        relationTo: "pages",
        required,
      },
      queryStringAndFragmentField(),
      {
        name: "url",
        type: "text",
        admin: {
          condition: (_, siblingData) => siblingData.linkType === "custom",
        },
        label: translated("cmsPlugin:fields:link:url:label"),
        required,
        validate: (value, options) => {
          const textValidationResult = text(value, options);
          if (textValidationResult !== true) {
            return textValidationResult;
          }

          if (value) {
            if (!validateUrl(value)) {
              // @ts-expect-error t function is not typed with custom translations here
              return options.req.t("cmsPlugin:validation:mustBeValidUrl");
            }
          }

          return true;
        },
      } satisfies TextField,
      ...externalLinkFields(),
    ],
    interfaceName: "NewLink", // TODO rename interface once Link collection is removed
    label: translated("cmsPlugin:fields:link:label"),
    ...fieldConfig,
  };
}

export function queryStringAndFragmentField(): RowField {
  return {
    type: "row",
    fields: [
      {
        name: "queryString",
        type: "text",
        admin: {
          components: { Label: "/src/components/client#QueryStringLabel" },
          condition: (_, siblingData) => siblingData.linkType === "internal",
          description: translated(
            "cmsPlugin:fields:link:queryString:description",
          ),
          width: "50%",
        },
        label: translated("cmsPlugin:fields:link:queryString:label"),
      },
      {
        name: "fragment",
        type: "text",
        admin: {
          components: { Field: "/src/components/client#FragmentField" },
          condition: (_, siblingData) => siblingData.linkType === "internal",
          description: translated("cmsPlugin:fields:link:fragment:description"),
          width: "50%",
        },
        label: translated("cmsPlugin:fields:link:fragment:label"),
      },
    ],
  };
}

/** Shared by structured links and Lexical drawers; defaults remain renderer-specific. */
export function externalLinkFields(): Field[] {
  const admin = {
    condition: (_: unknown, siblingData: Record<string, unknown>) =>
      siblingData.linkType === "custom",
  };
  return [
    ...(["openInNewTab", "suppressReferrer"] as const).map((name) => ({
      name,
      type: "select" as const,
      defaultValue: "default",
      label: translated(`cmsPlugin:fields:link:${name}:label`),
      admin: {
        ...admin,
        description: translated(`cmsPlugin:fields:link:${name}:description`),
      },
      options: (["default", "yes", "no"] as const).map((value) => ({
        value,
        label: translated(`cmsPlugin:fields:link:behaviorOptions:${value}`),
      })),
    })),
    {
      name: "noFollow",
      type: "checkbox",
      defaultValue: false,
      label: translated("cmsPlugin:fields:link:noFollow:label"),
      admin: {
        ...admin,
        description: translated("cmsPlugin:fields:link:noFollow:description"),
      },
    },
  ];
}
