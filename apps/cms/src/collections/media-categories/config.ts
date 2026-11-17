import type { CollectionConfig } from "payload";

import { canManageContent } from "../../common/access-control";
import { adminGroup } from "../../groups";
import { translated } from "../../translations/translations";

export const MediaCategories: CollectionConfig = {
  slug: "mediaCategory",
  access: {
    create: canManageContent,
    delete: canManageContent,
    update: canManageContent,
  },
  admin: {
    defaultColumns: ["name", "updatedAt"],
    description: translated("cmsPlugin:mediaCategories:admin:description"),
    group: adminGroup,
    listSearchableFields: ["id", "name"],
    useAsTitle: "name",
  },
  defaultPopulate: {
    name: true,
  },
  defaultSort: "name",
  fields: [
    {
      name: "name",
      type: "text",
      label: translated("cmsPlugin:mediaCategories:name:label"),
      required: true,
    },
    {
      name: "media",
      type: "join",
      collection: "media",
      label: translated("cmsPlugin:mediaCategories:media:label"),
      on: "category",
    },
  ],
  labels: {
    plural: translated("cmsPlugin:mediaCategories:labels:plural"),
    singular: translated("cmsPlugin:mediaCategories:labels:singular"),
  },
};
