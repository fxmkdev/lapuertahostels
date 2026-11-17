import type { UsagesConfig } from "../../fields/usages/types";

import { usagesField } from "../../fields/usages/config";

const usagesConfig: UsagesConfig = {
  collections: ["pages", "brands"],
  collectionToFind: "media",
  fieldType: "upload",
};

export function mediaUsagesField() {
  return usagesField(usagesConfig);
}
