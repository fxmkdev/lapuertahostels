import type { CollectionAdminOptions } from "payload";

import { allTranslations } from "./translations/translations";

// Admin groups don't provide a way to use a 't' function

export const adminGroup: CollectionAdminOptions["group"] = allTranslations(
  (v) => v.cmsPlugin.admin.groups.admin,
);

export const contentGroup: CollectionAdminOptions["group"] = allTranslations(
  (v) => v.cmsPlugin.admin.groups.content,
);
