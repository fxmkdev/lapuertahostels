import type { Block, FieldHook, GroupField, TextareaField } from "payload";

import { elementIdField } from "../../fields/element-id";
import { moreOptionsField } from "../../fields/more-options";
import { overlayTextBoxField } from "../../fields/overlay-text-box";

// Keep legacy fields in the schema so old documents and versions remain readable.
const addressField: TextareaField = {
  name: "address",
  type: "textarea",
  admin: {
    description: {
      en: "Enter the address to display on the map, including the business name. It should resolve unambiguously to a place on Google Maps.",
      es: "Ingresa la dirección para mostrar en el mapa, incluyendo el nombre del negocio. Debería resolver inequívocamente a un lugar en Google Maps.",
    },
  },
  label: {
    en: "Address",
    es: "Dirección",
  },
  required: true,
};
const overlayField = overlayTextBoxField({
  callToActionLabelOnly: true,
  optional: false,
});
const legacyOverlayField: GroupField = {
  ...overlayField,
  admin: { hidden: true },
  fields: overlayField.fields.map((field) => ({ ...field, required: false })),
};

export const readLegacyLocations: FieldHook = ({ value, siblingData }) => {
  if (Array.isArray(value) && value.length > 0) return value;
  if (!siblingData?.address) return value;
  return [
    {
      id: siblingData.id ?? "000000000000000000000000",
      address: siblingData.address,
      overlayTextBox: structuredClone(siblingData.overlayTextBox),
    },
  ];
};

export const writeLegacyLocations: FieldHook = (args) => {
  // An explicit empty array must fail validation rather than restore a deleted row.
  return args.value == null ? readLegacyLocations(args) : args.value;
};

// Give Payload's locale merge the same original row exposed by afterRead.
// Otherwise the first save in one locale would discard the other translations.
export const preserveLegacyLocales: FieldHook = (args) => {
  const original = args.siblingDocWithLocales;
  if (
    original?.address &&
    (!Array.isArray(original.locations) || !original.locations.length)
  ) {
    original.locations = readLegacyLocations({
      ...args,
      value: undefined,
      siblingData: original,
    });
  }
  return args.value;
};

export const MapBlock: Block = {
  slug: "Map",
  fields: [
    {
      name: "locations",
      type: "array",
      label: { en: "Locations", es: "Ubicaciones" },
      labels: {
        singular: { en: "Location", es: "Ubicación" },
        plural: { en: "Locations", es: "Ubicaciones" },
      },
      required: true,
      minRows: 1,
      hooks: {
        afterRead: [readLegacyLocations],
        beforeValidate: [writeLegacyLocations],
        beforeChange: [preserveLegacyLocales],
      },
      fields: [addressField, overlayField],
    },
    { ...addressField, required: false, admin: { hidden: true } },
    legacyOverlayField,
    {
      name: "zoomLevel",
      type: "number",
      admin: {
        description: {
          en: "For multiple locations, this is the maximum automatic zoom. Enter a number from 0 to 22. The level of detail for the different zoom levels is approximately: 1—World, 5—Landmass/continent, 10—City, 15—Streets, 20—Buildings. Floating point numbers are allowed, e.g. 14.5.",
          es: "Para varias ubicaciones, este es el zoom automático máximo. Ingresa un número de 0 a 22. El nivel de detalle para los diferentes niveles de zoom es aproximadamente: 1—Mundo, 5—Masa de tierra/continente, 10—Ciudad, 15—Calles, 20—Edificios. Se permiten números decimales, por ejemplo 14.5.",
        },
      },
      defaultValue: 14,
      label: {
        en: "Zoom Level",
        es: "Nivel de Zoom",
      },
      max: 22,
      min: 0,
      required: true,
    },
    moreOptionsField(elementIdField()),
  ],
  interfaceName: "Map",
  labels: {
    plural: {
      en: "Maps",
      es: "Mapas",
    },
    singular: {
      en: "Map",
      es: "Mapa",
    },
  },
};
