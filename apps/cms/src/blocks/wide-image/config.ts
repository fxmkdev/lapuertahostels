import type { Block } from "payload";

import { imageField } from "../../fields/image";
import { overlayTextBoxField } from "../../fields/overlay-text-box";

export const WideImageBlock: Block = {
  slug: "WideImage",
  fields: [imageField(), overlayTextBoxField()],
  interfaceName: "WideImage",
  labels: {
    plural: {
      en: "Wide Images",
      es: "Imágenes anchas",
    },
    singular: {
      en: "Wide Image",
      es: "Imagen ancha",
    },
  },
};
