import type { CollectionSlug, GlobalSlug, LabelFunction } from "payload";

export type RelationshipFieldType = "relationship" | "upload";

export type UsagesConfig = {
  collections?: CollectionSlug[];
  collectionToFind: CollectionSlug;
  fieldType: RelationshipFieldType;
  globals?: GlobalSlug[];
};
export type Usage = {
  fieldPath: string;
  label: LabelFunction | Record<string, string> | string;
} & (
  | {
      collection: CollectionSlug;
      id: number | string;
      title: string;
      type: "collection";
    }
  | {
      global: GlobalSlug;
      type: "global";
    }
);
export type LinkElementNode = {
  fields:
    | {
        doc: {
          relationTo: CollectionSlug;
          value: string;
        };
        linkType: "internal";
      }
    | {
        linkType: "other";
      };
};
