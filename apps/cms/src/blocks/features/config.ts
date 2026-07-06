import type { Block } from "payload";

import type { RowLabelProps } from "../../components/client/row-label";

import { callToActionField } from "../../fields/call-to-action";
import { elementIdField } from "../../fields/element-id";
import { imageField } from "../../fields/image";
import { moreOptionsField } from "../../fields/more-options";
import { richTextField } from "../../fields/rich-text";
import { textField } from "../../fields/text";

export const FeaturesBlock: Block = {
  slug: "Features",
  fields: [
    {
      name: "orientation",
      type: "radio",
      admin: {
        layout: "horizontal",
      },
      defaultValue: "first-image-left",
      label: {
        en: "Orientation",
        es: "Orientación",
      },
      options: [
        {
          label: {
            en: "First Image Left",
            es: "Primera imagen a la izquierda",
          },
          value: "first-image-left",
        },
        {
          label: {
            en: "First Image Right",
            es: "Primera imagen a la derecha",
          },
          value: "first-image-right",
        },
      ],
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
        initCollapsed: true,
      },
      fields: [
        imageField(),
        textField({ name: "heading", label: { en: "Heading", es: "Título" } }),
        richTextField(),
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
      minRows: 1,
      required: true,
    },
    moreOptionsField(elementIdField()),
  ],
  interfaceName: "Features",
  labels: {
    plural: {
      en: "Features",
      es: "Características",
    },
    singular: {
      en: "Features",
      es: "Características",
    },
  },
};
