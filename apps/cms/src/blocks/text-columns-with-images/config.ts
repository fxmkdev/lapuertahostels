import type { Block } from "payload";

import type { RowLabelProps } from "../../components/client/row-label";

import { callToActionField } from "../../fields/call-to-action";
import { elementIdField } from "../../fields/element-id";
import { imageField } from "../../fields/image";
import { moreOptionsField } from "../../fields/more-options";
import { richTextField } from "../../fields/rich-text";
import { textField } from "../../fields/text";

export const TextColumnsWithImagesBlock: Block = {
  slug: "TextColumnsWithImages",
  fields: [
    textField({
      name: "heading",
      label: { en: "Heading", es: "Título" },
      required: false,
    }),
    richTextField({ required: false }),
    {
      name: "numberOfColumns",
      type: "number",
      admin: {
        description: {
          en: "Note that the specified number of columns per row is for standard desktop screens (width of 1280px or more) and will be reduced automatically on smaller screens.",
          es: "Ten en cuenta que el número de columnas por fila especificado es para pantallas de escritorio estándar (con un ancho de 1280px o más) y se reducirá automáticamente en pantallas más pequeñas.",
        },
      },
      defaultValue: 3,
      label: {
        en: "Number of columns",
        es: "Número de columnas",
      },
      max: 4,
      min: 2,
    },
    {
      name: "items",
      type: "array",
      admin: {
        components: {
          RowLabel: {
            clientProps: {
              textProp: "heading",
            } as RowLabelProps,
            exportName: "RowLabel",
            path: "/src/components/client",
          },
        },
      },
      fields: [
        imageField({ required: false }),
        {
          name: "size",
          type: "radio",
          admin: {
            layout: "horizontal",
          },
          defaultValue: "full",
          label: {
            en: "Size",
            es: "Tamaño",
          },
          options: [
            { label: { en: "Full", es: "Completo" }, value: "full" },
            { label: { en: "Medium", es: "Mediano" }, value: "medium" },
            { label: { en: "Small", es: "Pequeño" }, value: "small" },
          ],
        },
        textField({
          name: "heading",
          label: { en: "Heading", es: "Título" },
          required: false,
        }),
        richTextField({ required: false }),
        callToActionField({ optional: true, showByDefault: false }),
      ],
      label: {
        en: "Items",
        es: "Elementos",
      },
      labels: {
        plural: {
          en: "Items",
          es: "Elementos",
        },
        singular: {
          en: "Item",
          es: "Elemento",
        },
      },
      required: true,
    },
    moreOptionsField(elementIdField()),
  ],
  interfaceName: "TextColumnsWithImages",
  labels: {
    plural: {
      en: "Text Columns with Images",
      es: "Columnas de texto con imágenes",
    },
    singular: {
      en: "Text Columns with Images",
      es: "Columnas de texto con imágenes",
    },
  },
};
