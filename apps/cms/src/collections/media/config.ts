import type {
  CollectionConfig,
  CollectionSlug,
  Field,
  UploadConfig,
} from "payload";

import { canManageContent } from "../../common/access-control";
import { textareaField } from "../../fields/textarea";
import { contentGroup } from "../../groups";
import { translated } from "../../translations/translations";
import { generateAltTextEndpoint } from "./generate-alt-text-endpoint";
import { mediaUsagesField } from "./usages";

function categoryField({ hidden }: { hidden: boolean }): Field {
  const relationTo = "mediaCategory" as unknown as CollectionSlug;

  return {
    name: "category",
    type: "relationship",
    admin: {
      description: translated("cmsPlugin:media:category:description"),
      hidden,
      position: "sidebar",
    },
    label: translated("cmsPlugin:media:category:label"),
    relationTo,
  };
}

/** Payload refetches its original upload when an editor changes the focal point. */
export function mediaFileFetchOptions(
  serverUrl: string | undefined,
  apiRoute = "/api",
): Pick<UploadConfig, "skipSafeFetch" | "externalFileHeaderFilter"> {
  if (!serverUrl) return {};
  const url = new URL(serverUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") return {};
  return {
    skipSafeFetch: [
      {
        hostname: url.hostname,
        protocol: url.protocol === "https:" ? "https" : "http",
        port: url.port,
        pathname: `${url.pathname.replace(/\/$/, "")}${apiRoute}/media/file/*`,
      },
    ],
    // Payload does not recognize its absolute file URLs as same-origin. Only
    // forward authentication to the configured CMS origin, never elsewhere.
    externalFileHeaderFilter: (headers, context): Record<string, string> => {
      if (!context || new URL(context.url).origin !== url.origin) return {};
      const filtered: Record<string, string> = {};
      if (headers.cookie) {
        filtered.cookie = headers.cookie;
        // Payload's cookie authentication requires a trusted Origin header.
        filtered.origin = url.origin;
      }
      if (headers.authorization) filtered.authorization = headers.authorization;
      return filtered;
    },
  };
}

export function Media({
  generateAltTextOptions,
  organization = "categories",
  retainLegacyCategories = false,
  serverUrl,
  apiRoute,
}: {
  generateAltTextOptions?: { publicMediaBaseUrl: string };
  organization?: "categories" | "folders" | "none";
  retainLegacyCategories?: boolean;
  serverUrl?: string;
  apiRoute?: string;
} = {}): CollectionConfig {
  const includeCategoryField =
    organization === "categories" || retainLegacyCategories;
  const fields: Field[] = [
    ...(includeCategoryField
      ? [categoryField({ hidden: organization !== "categories" })]
      : []),

    {
      name: "comment",
      type: "textarea",
      admin: {
        description: translated("cmsPlugin:media:comment:description"),
        position: "sidebar",
      },
      label: translated("cmsPlugin:media:comment:label"),
    },

    {
      type: "tabs",
      tabs: [
        {
          fields: [
            textareaField({
              name: "alt",
              admin: {
                components: {
                  afterInput: ["/src/components/client#GenerateAltTextButton"],
                },
                description: translated("cmsPlugin:media:alt:description"),
              },
              label: translated("cmsPlugin:media:alt:label"),
              required: false,
            }),
          ],
          label: translated("cmsPlugin:media:alt:label"),
        },
        {
          fields: [mediaUsagesField()],
          label: translated("cmsPlugin:common:usages:label"),
        },
      ],
    },
  ];

  return {
    slug: "media",
    access: {
      create: canManageContent,
      delete: canManageContent,
      update: canManageContent,
    },
    admin: {
      defaultColumns:
        organization === "categories"
          ? ["filename", "category", "comment", "updatedAt"]
          : ["filename", "comment", "updatedAt"],
      group: contentGroup,
      listSearchableFields: ["id", "filename", "comment", "alt"],
    },
    defaultPopulate: {
      alt: true,
      filename: true,
      focalX: true,
      focalY: true,
      height: true,
      mimeType: true,
      sizes: {
        thumbnail: {
          filename: true,
          height: true,
          url: true,
          width: true,
        },
      },
      thumbnailURL: true,
      url: true,
      width: true,
    },
    defaultSort: "filename",
    endpoints: generateAltTextOptions
      ? [generateAltTextEndpoint(generateAltTextOptions)]
      : [],
    fields,
    folders: organization === "folders" ? true : undefined,
    labels: {
      plural: translated("cmsPlugin:media:labels:plural"),
      singular: translated("cmsPlugin:media:labels:singular"),
    },
    upload: {
      adminThumbnail: "thumbnail",
      crop: false,
      disableLocalStorage: true,
      displayPreview: true,
      focalPoint: true,
      imageSizes: [
        {
          name: "thumbnail",
          width: 400,
        },
      ],
      mimeTypes: ["image/*", "video/*"],
      ...mediaFileFetchOptions(serverUrl, apiRoute),
    },
  };
}
