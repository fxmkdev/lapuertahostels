import { Block } from "payload";
import {
  textField,
  richTextField,
  moreOptionsField,
  elementIdField,
  imageField,
  linkField,
} from "@fxmk/cms-plugin";

export const AccommodationSelectorBlock: Block = {
  slug: "AccommodationSelector",
  interfaceName: "AccommodationSelector",
  labels: {
    singular: {
      en: "Accommodation Selector",
      es: "Selector de alojamiento",
    },
    plural: {
      en: "Accommodation Selectors",
      es: "Selectores de alojamiento",
    },
  },
  fields: [
    textField({ name: "heading", label: { en: "Heading", es: "Título" } }),
    richTextField(),
    {
      name: "cards",
      label: {
        en: "Cards",
        es: "Tarjetas",
      },
      labels: {
        singular: {
          en: "Card",
          es: "Tarjeta",
        },
        plural: {
          en: "Cards",
          es: "Tarjetas",
        },
      },
      type: "array",
      minRows: 1,
      required: true,
      fields: [
        textField({
          name: "title",
          label: { en: "Title", es: "Título" },
          required: true,
        }),
        linkField(),
        {
          name: "color",
          label: {
            en: "Color",
            es: "Color",
          },
          type: "select",
          required: true,
          options: [
            {
              label: "Puerta",
              value: "puerta",
            },
            {
              label: "Aqua",
              value: "aqua",
            },
            {
              label: "Azul",
              value: "azul",
            },
          ],
        },
        imageField(),
        richTextField({
          name: "description",
          label: {
            en: "Description",
            es: "Descripción",
          },
        }),
      ],
      admin: {
        initCollapsed: true,
        description: {
          en: "Each card represents a linked accommodation page. You can change their order, target, color, image, and description here.",
          es: "Cada tarjeta representa una página de alojamiento enlazada. Puedes cambiar su orden, destino, color, imagen y descripción aquí.",
        },
      },
    },
    moreOptionsField(elementIdField()),
  ],
};
