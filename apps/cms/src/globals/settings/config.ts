import type { GlobalConfig } from "payload";

import { canManageContent } from "../../common/access-control";
import { showField } from "../../fields/show";
import { textField } from "../../fields/text";
import { adminGroup } from "../../groups";

export const Settings: GlobalConfig = {
  slug: "settings",
  access: {
    update: canManageContent,
  },
  admin: {
    group: adminGroup,
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          name: "publishedLocales",
          fields: [
            {
              name: "publishedLocales",
              type: "relationship",
              admin: {
                description: {
                  en: "Select locales with completely translated content to make them available to the user on the website. To add a new locale, it must be first added to the 'Locale Configurations' collection.",
                  es: "Selecciona los idiomas con contenido completamente traducido para hacerlos disponibles al usuario en el sitio web. Para agregar un nuevo idioma, primero debe agregarse a la colección 'Configuraciones de Idioma'.",
                },
              },
              hasMany: true,
              label: { en: "Published Locales", es: "Idiomas Publicados" },
              relationTo: "locale-configs",
              required: true,
            },
            {
              name: "fallbackLocale",
              type: "relationship",
              admin: {
                description: {
                  en: "The fallback locale is used when a translation is not available in the requested locale. It must be one of the published locales.",
                  es: "El idioma predeterminado se utiliza cuando no hay una traducción disponible en el idioma solicitado. Debe ser uno de los idiomas publicados.",
                },
              },
              filterOptions: ({ siblingData }) => ({
                id: {
                  in: (siblingData as Record<string, unknown>).publishedLocales,
                },
              }),
              label: {
                en: "Fallback Locale",
                es: "Idioma predeterminado",
              },
              relationTo: "locale-configs",
              required: true,
            },
          ],
          label: {
            en: "Published Locales",
            es: "Idiomas Publicados",
          },
        },
        {
          name: "maintenanceScreen",
          admin: {
            description: {
              en: "Hide the complete website and show a maintenance screen instead.",
              es: "Oculta el sitio web completo y muestra una pantalla de mantenimiento en su lugar.",
            },
          },
          fields: [
            showField(),
            textField({
              name: "message",
              admin: {
                condition: (_, siblingData) => siblingData.show,
              },
              label: { en: "Message", es: "Mensaje" },
            }),
          ],
          label: {
            en: "Maintenance Screen",
            es: "Pantalla de Mantenimiento",
          },
        },
        {
          name: "maps",
          fields: [
            {
              name: "region",
              type: "text",
              admin: {
                description: {
                  en: "Enter the region code for maps, e.g. CO for Colombia. Must be two letters in uppercase. See https://developers.google.com/maps/coverage#coverage-legend",
                  es: "Ingresa el código de región para mapas, por ejemplo CO para Colombia. Debe ser de dos letras en mayúsculas. Consulta https://developers.google.com/maps/coverage#coverage-legend",
                },
              },
              label: {
                en: "Region Code",
                es: "Código de región",
              },
              maxLength: 2,
              minLength: 2,
            },
            {
              name: "mapId",
              type: "text",
              admin: {
                description: {
                  en: "Enter the ID of the map to display. This is the ID of the map in the Google Maps Platform and defines styling and POI settings.",
                  es: "Ingresa el ID del mapa a mostrar. Este es el ID del mapa en Google Maps Platform y define la configuración de estilo y POI.",
                },
              },
              label: {
                en: "Map ID",
                es: "ID de mapa",
              },
            },
          ],
          label: {
            en: "Maps",
            es: "Mapas",
          },
        },
      ],
    },
  ],
  label: {
    en: "Settings",
    es: "Configuración",
  },
  typescript: {
    interface: "Settings",
  },
};
