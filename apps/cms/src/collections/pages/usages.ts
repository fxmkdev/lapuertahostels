import type { UsagesConfig } from "../../fields/usages/types";

import { usagesField } from "../../fields/usages/config";

const usagesConfig: UsagesConfig = {
  collections: ["pages", "banners", "redirects", "brands"],
  collectionToFind: "pages",
  fieldType: "relationship",
  globals: ["common"],
};

export function pageUsagesField() {
  return usagesField(usagesConfig);
}
