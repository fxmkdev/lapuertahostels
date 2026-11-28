import { optionalTextField } from "./fields/index";
import type { Field } from "payload";

export const additionalUiLabelFields: Field[] = [
  {
    name: "languageSuggestion",
    label: { en: "Language suggestion", es: "Sugerencia de idioma" },
    type: "group",
    fields: [
      optionalTextField({
        name: "message",
        label: { en: "Message", es: "Mensaje" },
        admin: {
          description: {
            en: "Use {{language}} for the native language name.",
            es: "Usa {{language}} para el nombre nativo del idioma.",
          },
        },
      }),
      optionalTextField({
        name: "switch",
        label: { en: "Switch language", es: "Cambiar idioma" },
        admin: {
          description: {
            en: "Use {{language}} for the suggested language.",
            es: "Usa {{language}} para el idioma sugerido.",
          },
        },
      }),
      optionalTextField({
        name: "keep",
        label: { en: "Keep language", es: "Mantener idioma" },
        admin: {
          description: {
            en: "Use {{language}} for the current page language.",
            es: "Usa {{language}} para el idioma actual de la página.",
          },
        },
      }),
    ],
  },
  {
    name: "footer",
    label: { en: "Footer", es: "Pie de página" },
    type: "group",
    fields: [
      optionalTextField({
        name: "heading",
        label: { en: "Heading", es: "Título" },
      }),
      {
        name: "newsletter",
        label: { en: "Newsletter", es: "Boletín" },
        type: "group",
        fields: [
          optionalTextField({
            name: "emailLabel",
            label: {
              en: "Email Label",
              es: "Etiqueta de correo electrónico",
            },
          }),
        ],
      },
    ],
  },
  {
    name: "imageViewer",
    label: { en: "Image Viewer", es: "Visor de Imágenes" },
    type: "group",
    fields: [
      optionalTextField({
        name: "previous",
        label: { en: "Previous", es: "Anterior" },
      }),
      optionalTextField({
        name: "next",
        label: { en: "Next", es: "Siguiente" },
      }),
      optionalTextField({
        name: "fullscreen",
        label: { en: "Full Screen", es: "Pantalla Completa" },
      }),
      optionalTextField({
        name: "exitFullscreen",
        label: {
          en: "Exit Full Screen",
          es: "Salir de Pantalla Completa",
        },
      }),
      optionalTextField({
        name: "close",
        label: { en: "Close", es: "Cerrar" },
      }),
      optionalTextField({
        name: "seeMoreImages_one",
        label: {
          en: "See More Images (singular)",
          es: "Ver Más Imágenes (singular)",
        },
        admin: {
          description: {
            en: "Use the {{count}} placeholder to display the number of images.",
            es: "Usa el marcador {{count}} para mostrar el número de imágenes.",
          },
        },
      }),
      optionalTextField({
        name: "seeMoreImages_other",
        label: {
          en: "See More Images (plural)",
          es: "Ver Más Imágenes (plural)",
        },
        admin: {
          description: {
            en: "Use the {{count}} placeholder to display the number of images.",
            es: "Usa el marcador {{count}} para mostrar el número de imágenes.",
          },
        },
      }),
    ],
  },
];
