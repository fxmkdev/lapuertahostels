import type { CollectionConfig } from "payload";

import { isAdmin } from "../../common/access-control";
import { adminGroup } from "../../groups";
import { translated } from "../../translations/translations";

export const ApiKeys: CollectionConfig = {
  slug: "api-keys",
  access: {
    create: ({ req }) => isAdmin(req),
    delete: ({ req }) => isAdmin(req),
    read: ({ req }) => isAdmin(req),
    update: ({ req }) => isAdmin(req),
  },
  admin: {
    defaultColumns: ["name", "role", "remark", "createdAt", "updatedAt"],
    group: adminGroup,
    useAsTitle: "id",
  },
  auth: {
    disableLocalStrategy: true,
    useAPIKey: true,
  },
  fields: [
    {
      name: "role",
      type: "radio",
      access: {
        create: ({ req }) => isAdmin(req),
        read: () => true,
        update: ({ req }) => isAdmin(req),
      },
      defaultValue: "editor",
      label: translated("cmsPlugin:apiKeys:role:label"),
      options: [
        {
          label: translated("cmsPlugin:apiKeys:role:options:cicd"),
          value: "cicd",
        },
        {
          label: translated("cmsPlugin:apiKeys:role:options:frontend"),
          value: "frontend",
        },
        {
          label: translated("cmsPlugin:apiKeys:role:options:e2eTests"),
          value: "e2e-tests",
        },
      ],
      required: true,
    },
    {
      name: "remark",
      type: "text",
      label: translated("cmsPlugin:apiKeys:remark:label"),
    },
  ],
  labels: {
    plural: translated("cmsPlugin:apiKeys:labels:plural"),
    singular: translated("cmsPlugin:apiKeys:labels:singular"),
  },
};
