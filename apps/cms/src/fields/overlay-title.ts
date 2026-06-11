import type { GroupField, RadioField } from "payload";

import { callToActionField } from "./call-to-action";
import { richTextField } from "./rich-text";
import { showField } from "./show";

type OverlayTitleFieldOptions = {
  optional?: boolean;
  supportsCallToAction?: boolean;
  supportsPositions?: Position[];
  supportsSupportingText?: boolean;
};

type Position =
  | "bottom-left"
  | "bottom-right"
  | "center"
  | "top-left"
  | "top-right";

const configuredCallToActionField = callToActionField({
  optional: true,
  showByDefault: false,
  variant: { default: "primary" },
});

export function overlayTitleField({
  optional = false,
  supportsCallToAction = true,
  supportsPositions,
  supportsSupportingText = true,
}: OverlayTitleFieldOptions = {}): GroupField {
  const condition = optional
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_: any, siblingData: any) => siblingData.show
    : undefined;

  return {
    name: "overlayTitle",
    type: "group",
    fields: [
      ...(optional ? [showField()] : []),
      richTextField({ admin: { condition } }),
      ...(supportsSupportingText
        ? [
            richTextField({
              name: "supportingText",
              admin: { condition },
              label: {
                en: "Supporting Text",
                es: "Texto de apoyo",
              },
              required: false,
            }),
          ]
        : []),
      ...(supportsCallToAction
        ? [
            {
              ...configuredCallToActionField,
              admin: {
                ...configuredCallToActionField.admin,
                condition,
              },
            },
          ]
        : []),
      getPositionField(),
      {
        name: "overlay",
        type: "radio",
        admin: {
          condition,
          description: {
            en: "The overlay is a semi-transparent black layer that is placed on top of the image to make the text more readable. Choose the intensity that is the best trade-off between readability of the text and brightness of the image.",
            es: "La superposición es una capa negra semitransparente que se coloca sobre la imagen para que el texto sea más legible. Elige la intensidad que sea el mejor compromiso entre la legibilidad del texto y el brillo de la imagen.",
          },
        },
        defaultValue: "moderate",
        label: {
          en: "Overlay",
          es: "Superposición",
        },
        options: [
          { label: { en: "Subtle", es: "Sutil" }, value: "subtle" },
          { label: { en: "Moderate", es: "Moderado" }, value: "moderate" },
          { label: { en: "Intense", es: "Intenso" }, value: "intense" },
        ],
      },
    ],
    label: {
      en: "Overlay Title",
      es: "Título superpuesto",
    },
  };

  function getPositionField(): RadioField {
    const options = getPositionOptions();

    return {
      name: "position",
      type: "radio",
      admin: {
        condition,
        layout: options.length > 2 ? "vertical" : "horizontal",
      },
      defaultValue: "center",
      label: {
        en: "Position",
        es: "Posición",
      },
      options,
    };
  }

  function getPositionOptions(): RadioField["options"] {
    const allOptions = [
      { label: { en: "Center", es: "Centro" }, value: "center" as Position },
      {
        label: { en: "Top Left", es: "Arriba a la Izquierda" },
        value: "top-left" as Position,
      },
      {
        label: { en: "Top Right", es: "Arriba a la Derecha" },
        value: "top-right" as Position,
      },
      {
        label: { en: "Bottom Right", es: "Abajo a la Derecha" },
        value: "bottom-right" as Position,
      },
      {
        label: { en: "Bottom Left", es: "Abajo a la Izquierda" },
        value: "bottom-left" as Position,
      },
    ];

    return supportsPositions
      ? allOptions.filter((option) => supportsPositions.includes(option.value))
      : allOptions;
  }
}
