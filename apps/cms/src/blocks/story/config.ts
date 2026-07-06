import type { Block } from "payload";

import { elementIdField } from "../../fields/element-id";
import { imageField } from "../../fields/image";
import { moreOptionsField } from "../../fields/more-options";
import { richTextField } from "../../fields/rich-text";
import { textField } from "../../fields/text";

const optionalImageField = imageField({ required: false });

export const StoryBlock: Block = {
  slug: "Story",
  fields: [
    textField({
      name: "heading",
      label: { en: "Heading", es: "Título" },
      required: false,
    }),
    richTextField(),
    optionalImageField,
    {
      name: "imagePosition",
      type: "radio",
      admin: {
        condition: (_, siblingData) => !!siblingData?.image,
      },
      label: {
        en: "Image Position",
        es: "Posición de la imagen",
      },
      options: [
        { label: { en: "Left", es: "Izquierda" }, value: "left" },
        { label: { en: "Right", es: "Derecha" }, value: "right" },
      ],
    },
    {
      name: "grayscaleImage",
      type: "checkbox",
      admin: {
        condition: (_, siblingData) => !!siblingData?.image,
        description: {
          en: "Check this box to display the image in grayscale.",
          es: "Marca esta casilla para mostrar la imagen en escala de grises.",
        },
      },
      label: {
        en: "Grayscale Image",
        es: "Imagen en escala de grises",
      },
    },
    moreOptionsField(elementIdField()),
  ],
  interfaceName: "Story",
  labels: {
    plural: {
      en: "Stories",
      es: "Historias",
    },
    singular: {
      en: "Story",
      es: "Historia",
    },
  },
};
