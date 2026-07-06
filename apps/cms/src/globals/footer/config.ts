import {
  linkField,
  optionalRichTextField,
  showField,
  textareaField,
  textField,
} from "../../fields/index";
import { canManageContent } from "../../common/access-control";
import { contentGroup } from "../../groups";
import { GlobalConfig } from "payload";
import { socialPlatformOptions } from "./social-platforms";
import { SocialPlatformRowLabelProps } from "./social-platform-row-label";

export function footer(): GlobalConfig {
  return {
    slug: "footer",
    label: {
      en: "Footer",
      es: "Pie de página",
    },
    access: {
      update: canManageContent,
    },
    admin: {
      group: contentGroup,
    },
    fields: [
      optionalRichTextField({
        name: "address",
        label: {
          en: "Address",
          es: "Dirección",
        },
      }),
      optionalRichTextField({
        name: "copyright",
        label: {
          en: "Copyright",
          es: "Derechos de autor",
        },
      }),
      {
        type: "array",
        name: "socialLinks",
        label: {
          en: "Social Links",
          es: "Enlaces sociales",
        },
        labels: {
          singular: {
            en: "Social Link",
            es: "Enlace social",
          },
          plural: {
            en: "Social Links",
            es: "Enlaces sociales",
          },
        },
        fields: [
          {
            name: "platform",
            type: "select",
            label: {
              en: "Platform",
              es: "Plataforma",
            },
            options: socialPlatformOptions,
            required: true,
          },
          linkField(),
        ],
        admin: {
          initCollapsed: true,
          components: {
            RowLabel: {
              path: "/src/globals/footer/social-platform-row-label",
              exportName: "SocialPlatformRowLabel",
              clientProps: {
                fallbackLabelKey: "custom:common:socialLinkRowLabel",
              } as SocialPlatformRowLabelProps,
            },
          },
        },
      },
      {
        name: "newsletter",
        label: {
          en: "Newsletter Form",
          es: "Formulario de Boletín",
        },
        type: "group",
        fields: [
          showField(),
          textField({
            name: "title",
            label: { en: "Title", es: "Título" },
            admin: {
              condition: (data) => !!data.footer?.newsletter?.show,
            },
          }),
          textareaField({
            name: "description",
            label: { en: "Description", es: "Descripción" },
            admin: {
              condition: (data) => !!data?.footer?.newsletter?.show,
            },
          }),
          textField({
            name: "emailPlaceholder",
            label: {
              en: "Email Placeholder",
              es: "Marcador de correo electrónico",
            },
            admin: {
              condition: (data) => data.footer.newsletter.show,
            },
          }),
          textField({
            name: "buttonLabel",
            label: { en: "Button Label", es: "Etiqueta del botón" },
            admin: {
              condition: (data) => data.footer.newsletter.show,
            },
          }),
        ],
        admin: {
          description: {
            en: "For demo purposes only. This form is not enabled yet.",
            es: "Solo para fines de demostración. Este formulario aún no está habilitado.",
          },
        },
      },
    ],
  };
}
