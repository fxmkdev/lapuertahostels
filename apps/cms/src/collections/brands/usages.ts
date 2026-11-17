import type { UsagesConfig } from "../../fields/usages/types";

import { usagesField } from "../../fields/usages/config";

const usagesConfig: UsagesConfig = {
  collections: ["pages"],
  collectionToFind: "brands",
  fieldType: "relationship",
};

export function brandUsagesField() {
  return usagesField(usagesConfig);
}
