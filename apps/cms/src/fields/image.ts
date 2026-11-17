import type { UploadField } from "payload";

import { translated } from "../translations/translations";

export function imageField(config: Partial<UploadField> = {}): UploadField {
  return {
    name: "image",
    type: "upload",
    filterOptions: {
      mimeType: { contains: "image/" },
    },
    label: translated("cmsPlugin:fields:image:label"),
    relationTo: "media",
    required: true,
    ...config,
  } as UploadField;
}
