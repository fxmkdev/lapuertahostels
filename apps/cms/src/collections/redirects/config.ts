import type { CollectionConfig } from "payload";

import { canManageContent } from "../../common/access-control";
import { adminGroup } from "../../groups";
import { translated } from "../../translations/translations";

export const Redirects: CollectionConfig = {
  slug: "redirects",
  access: {
    create: canManageContent,
    delete: canManageContent,
    update: canManageContent,
  },
  admin: {
    defaultColumns: ["fromPathname", "locales", "to"],
    group: adminGroup,
    listSearchableFields: ["id", "fromPathname", "to.page.pathname"],
    useAsTitle: "fromPathname",
  },
  fields: [
    {
      name: "fromPathname",
      type: "text",
      access: { update: () => false },
      index: true,
      label: translated("cmsPlugin:redirects:fromPathname:label"),
      required: true,
      unique: true,
    },
    {
      name: "to",
      type: "group",
      admin: {
        components: { Cell: "/src/components/client#ToCell" },
      },
      fields: [
        {
          name: "page",
          type: "relationship",
          admin: {
            appearance: "drawer",
          },
          label: translated("cmsPlugin:redirects:to:page:label"),
          relationTo: "pages",
          required: true,
        },
        {
          type: "row",
          fields: [
            {
              name: "queryString",
              type: "text",
              admin: {
                description: translated(
                  "cmsPlugin:redirects:to:queryString:description",
                ),
                width: "50%",
              },
              label: translated("cmsPlugin:redirects:to:queryString:label"),
            },
            {
              name: "fragment",
              type: "text",
              admin: {
                description: translated(
                  "cmsPlugin:redirects:to:fragment:description",
                ),
                width: "50%",
              },
              label: translated("cmsPlugin:redirects:to:fragment:label"),
            },
          ],
        },
      ],
      label: translated("cmsPlugin:redirects:to:label"),
    },
  ],
  labels: {
    plural: translated("cmsPlugin:redirects:labels:plural"),
    singular: translated("cmsPlugin:redirects:labels:singular"),
  },
};
