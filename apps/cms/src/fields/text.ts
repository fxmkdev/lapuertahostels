import type { TextField } from "payload";

import { translated } from "../translations/translations";

type TextFieldConfig = {
  enableTranslationTools?: boolean;
} & Partial<TextField>;

export function optionalTextField(config: TextFieldConfig = {}): TextField {
  return textField({ ...config, required: false });
}

export function textField(config: TextFieldConfig = {}): TextField {
  const { enableTranslationTools = true, ...fieldConfig } = config;

  return {
    name: "text",
    type: "text",
    label: translated("cmsPlugin:fields:text:label"),
    localized: true,
    required: true,
    ...fieldConfig,
    admin: {
      ...fieldConfig.admin,
      components: {
        ...(enableTranslationTools
          ? { Label: "/src/components/client#TranslationsFieldLabel" }
          : {}),
        ...fieldConfig.admin?.components,
      },
    },
  } as TextField;
}
