import type { Block } from "payload";

import { elementIdField } from "../../fields/element-id";
import { imageField } from "../../fields/image";
import { moreOptionsField } from "../../fields/more-options";
import { overlayTitleField } from "../../fields/overlay-title";
import { richTextField } from "../../fields/rich-text";

export const ImageWithFloatingTextBlock: Block = {
  slug: "ImageWithFloatingText",
  fields: [
    imageField(),
    overlayTitleField({
      supportsCallToAction: false,
      supportsPositions: ["top-left", "top-right"],
      supportsSupportingText: false,
    }),
    richTextField(),
    moreOptionsField(elementIdField()),
  ],
  interfaceName: "ImageWithFloatingText",
  labels: {
    plural: {
      en: "Images with Floating Text",
      es: "Imágenes con texto flotante",
    },
    singular: {
      en: "Image with Floating Text",
      es: "Imagen con texto flotante",
    },
  },
};
