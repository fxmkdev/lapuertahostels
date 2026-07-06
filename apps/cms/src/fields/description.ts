import type { UIField } from "payload";

import { allTranslations } from "../translations/translations";

export function descriptionField(description: Record<string, string>): UIField {
  return {
    name: "adminDescription",
    type: "ui",
    admin: {
      components: {
        Field: {
          exportName: "DescriptionField",
          path: "/src/components/rsc",
          serverProps: {
            description,
          },
        },
      },
    },
    // UIField doesn't seem to support a 't' function
    label: allTranslations((v) => v.cmsPlugin.fields.description.label),
  };
}
