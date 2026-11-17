import type { Block, BlocksField } from "payload";

import { FeaturesBlock } from "../blocks/features/config";
import { ImageWithFloatingTextBlock } from "../blocks/image-with-floating-text/config";
import { LeadTextBlock } from "../blocks/lead-text/config";
import { MapBlock } from "../blocks/map/config";
import { SeparatorBlock } from "../blocks/separator/config";
import { StoryBlock } from "../blocks/story/config";
import { testimonialsBlock } from "../blocks/testimonials/config";
import { TextColumnsWithImagesBlock } from "../blocks/text-columns-with-images/config";
import { WideImageBlock } from "../blocks/wide-image/config";

type ContentFieldOptions = {
  additionalBlocks?: Block[];
};

export function contentField({
  additionalBlocks,
}: ContentFieldOptions): BlocksField {
  return {
    name: "content",
    type: "blocks",
    admin: {
      description: {
        en: "Add blocks to fill the page with content. You can reorder the blocks by dragging and dropping them using the handle on the left side.",
        es: "Agrega bloques para llenar la página con contenido. Puedes reordenar los bloques arrastrándolos y soltándolos usando la manija en el lado izquierdo.",
      },
      initCollapsed: true,
    },
    blocks: [
      LeadTextBlock,
      ImageWithFloatingTextBlock,
      StoryBlock,
      FeaturesBlock,
      SeparatorBlock,
      WideImageBlock,
      TextColumnsWithImagesBlock,
      MapBlock,
      testimonialsBlock,
      ...(additionalBlocks ?? []),
    ],
    label: {
      en: "Content",
      es: "Contenido",
    },
    labels: {
      plural: {
        en: "Blocks",
        es: "Bloques",
      },
      singular: {
        en: "Block",
        es: "Bloque",
      },
    },
    maxRows: 20,
    minRows: 0,
  };
}
