import type { UsagesConfig } from "../../fields/usages/types";

import { usagesField } from "../../fields/usages/config";

const usagesConfig: UsagesConfig = {
  collections: ["brands"],
  collectionToFind: "banners",
  fieldType: "relationship",
};

export function bannerUsagesField() {
  return usagesField(usagesConfig);
}
