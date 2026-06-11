import type { Block, BlocksField } from "payload";

import { HeroHeadingBlock } from "../blocks/hero-heading/config";
import { HeroSlidesBlock } from "../blocks/hero-slides/config";
import { HeroVideoBlock } from "../blocks/hero-video/config";

type HeroFieldOptions = {
  additionalBlocks?: Block[];
};

export function heroField({ additionalBlocks }: HeroFieldOptions): BlocksField {
  return {
    name: "hero",
    type: "blocks",
    admin: {
      description: {
        en: "A hero section is the first thing a user sees when they visit a page. Only one hero block can be added to a page. To replace the current hero block by a different block type, remove it and add a new one.",
        es: "Una sección de héroe es lo primero que ve un usuario cuando visita una página. Solo se puede añadir un bloque de héroe a una página. Para reemplazar el bloque de héroe actual por un tipo de bloque diferente, elimínalo y añade uno nuevo.",
      },
      initCollapsed: true,
    },
    blocks: [
      HeroSlidesBlock,
      HeroVideoBlock,
      HeroHeadingBlock,
      ...(additionalBlocks ?? []),
    ],
    label: {
      en: "Hero",
      es: "Héroe",
    },
    labels: {
      plural: {
        en: "Heroes",
        es: "Héroes",
      },
      singular: {
        en: "Hero",
        es: "Héroe",
      },
    },
    maxRows: 1,
    minRows: 0,
  };
}
