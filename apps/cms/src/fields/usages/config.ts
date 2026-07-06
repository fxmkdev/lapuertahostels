import type { UIField } from "payload";

import type { UsagesConfig } from "./types";

import { allTranslations } from "../../translations/translations";

export function usagesField(config: UsagesConfig): UIField {
  return {
    name: "usages",
    type: "ui",
    admin: {
      components: {
        Field: {
          exportName: "UsagesField",
          path: "/src/components/rsc",
          serverProps: { config },
        },
      },
    },
    // UIField doesn't seem to support a 't' function
    label: allTranslations((v) => v.cmsPlugin.fields.usages.label),
  };
}
