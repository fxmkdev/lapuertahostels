import type { Block } from "payload";

import { elementIdField } from "../../fields/element-id";
import { moreOptionsField } from "../../fields/more-options";
import { overlayTextBoxField } from "../../fields/overlay-text-box";

export const MapBlock: Block = {
  slug: "Map",
  fields: [
    {
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
    },
    {
      name: "zoomLevel",
      type: "number",
      admin: {
        description: {
          en: "Enter a number from 0 to 22. The level of detail for the different zoom levels is approximately: 1—World, 5—Landmass/continent, 10—City, 15—Streets, 20—Buildings. Floating point numbers are allowed, e.g. 14.5.",
          es: "Ingresa un número de 0 a 22. El nivel de detalle para los diferentes niveles de zoom es aproximadamente: 1—Mundo, 5—Masa de tierra/continente, 10—Ciudad, 15—Calles, 20—Edificios. Se permiten números decimales, por ejemplo 14.5.",
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
    overlayTextBoxField({ callToActionLabelOnly: true, optional: false }),
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
