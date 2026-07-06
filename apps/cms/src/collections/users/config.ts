import type { CollectionConfig } from "payload";

import { canManageContent, isAdmin, isSelf } from "../../common/access-control";
import { adminGroup } from "../../groups";
import { translated } from "../../translations/translations";

export const Users: CollectionConfig = {
  slug: "users",
  access: {
    admin: canManageContent,
    create: ({ req }) => isAdmin(req),
    delete: ({ req }) => isAdmin(req),
    read: ({ id, req }) => isSelf(req, id!, "users") || isAdmin(req),
    update: ({ id, req }) => isSelf(req, id!, "users") || isAdmin(req),
  },
  admin: {
    defaultColumns: ["email", "role", "updatedAt"],
    group: adminGroup,
    listSearchableFields: ["id", "email", "role"],
    useAsTitle: "email",
  },
  auth: true,
  defaultPopulate: {
    email: true,
    role: true,
  },
  defaultSort: "email",
  fields: [
    {
      name: "role",
      type: "radio",
      access: {
        create: ({ req }) => isAdmin(req),
        update: ({ req }) => isAdmin(req),
      },
      defaultValue: "editor",
      label: translated("cmsPlugin:users:role:label"),
      options: [
        {
          label: translated("cmsPlugin:users:role:options:editor"),
          value: "editor",
        },
        {
          label: translated("cmsPlugin:users:role:options:admin"),
          value: "admin",
        },
      ],
      required: true,
    },
  ],
  labels: {
    plural: translated("cmsPlugin:users:labels:plural"),
    singular: translated("cmsPlugin:users:labels:singular"),
  },
};
