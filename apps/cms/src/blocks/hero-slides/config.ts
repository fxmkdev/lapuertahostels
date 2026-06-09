import type { Block } from "payload";

import type { RowLabelProps } from "../../components/client/row-label";

import { imageField } from "../../fields/image";
import { moreOptionsField } from "../../fields/more-options";
import { overlayTitleField } from "../../fields/overlay-title";
import { textField } from "../../fields/text";

export const HeroSlidesBlock: Block = {
  slug: "HeroSlides",
  fields: [
    textField({
      name: "seoPageHeading",
      admin: {
        description: {
          en: "This heading is only used for SEO purposes and is not shown on the page. Since the slide overlay titles semantically don't define the page's main heading, you can use this field to define the main heading of the page.",
          es: "Este título se utiliza solo con fines de SEO y no se muestra en la página. Dado que los títulos superpuestos de las diapositivas no definen semánticamente el título principal de la página, puedes utilizar este campo para definir el título principal de la página.",
        },
      },
      label: {
        en: "Page Heading (SEO-only)",
        es: "Título de la página (solo SEO)",
      },
    }),
    {
      name: "slides",
      type: "array",
      admin: {
        components: {
          RowLabel: {
            clientProps: {
              fallbackLabelKey: "cmsPlugin:heroSlides:slideRowLabel",
              textProp: "overlayTitle.text",
            } as RowLabelProps,
            exportName: "RowLabel",
            path: "/src/components/client",
          },
        },
        description: {
          en: "You can use this either for a single hero image or a slideshow with multiple images. Each slide can have an overlay title and a call-to-action button. You can add up to six slides.",
          es: "Puedes usar esto para una sola imagen de héroe o una presentación de diapositivas con varias imágenes. Cada diapositiva puede tener un título superpuesto y un botón de call to action. Puedes agregar hasta seis diapositivas.",
        },
        initCollapsed: true,
      },
      fields: [
        imageField(),
        {
          // TODO consider to support this in other blocks/groups as well and add more values (together with imageField?)
          name: "imageAlignment",
          type: "radio",
          admin: {
            description: {
              en: "Depending on the user’s device or window size, the slide often has a different aspect ratio than the image. This setting defines how the image is aligned within the slide area.",
              es: "Dependiendo del dispositivo del usuario o del tamaño de la ventana, la diapositiva a menudo tiene una relación de aspecto diferente a la de la imagen. Este ajuste define cómo se alinea la imagen dentro del área de la diapositiva.",
            },
          },
          defaultValue: "center",
          label: {
            en: "Image Alignment",
            es: "Alineación de la imagen",
          },
          options: [
            { label: { en: "Center", es: "Centro" }, value: "center" },
            { label: { en: "Bottom", es: "Abajo" }, value: "bottom" },
          ],
        },
        overlayTitleField({ optional: true }),
      ],
      label: {
        en: "Slides",
        es: "Diapositivas",
      },
      labels: {
        plural: {
          en: "Slides",
          es: "Diapositivas",
        },
        singular: {
          en: "Slide",
          es: "Diapositiva",
        },
      },
      maxRows: 6,
      minRows: 1,
      required: true,
    },
    moreOptionsField({
      name: "autoplayIntervalInSeconds",
      type: "number",
      admin: {
        description: {
          en: "Depending on the amount of information in the slides (title, CTA), different intervals might be more suitable. The default value is 7 seconds.",
          es: "Dependiendo de la cantidad de información en las diapositivas (título, CTA), pueden ser más adecuados diferentes intervalos. El valor predeterminado es de 7 segundos.",
        },
      },
      defaultValue: 7,
      label: {
        en: "Autoplay Interval in Seconds",
        es: "Intervalo de reproducción automática en segundos",
      },
    }),
  ],
  interfaceName: "HeroSlides",
  labels: {
    plural: {
      en: "Hero Slides",
      es: "Diapositivas de héroe",
    },
    singular: {
      en: "Hero Slides",
      es: "Diapositivas de héroe",
    },
  },
};
