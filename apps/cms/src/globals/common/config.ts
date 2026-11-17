import type { Field, GlobalConfig } from "payload";

import { canManageContent } from "../../common/access-control";
import { descriptionField } from "../../fields/description";
import { optionalRichTextField } from "../../fields/rich-text";
import { optionalTextField } from "../../fields/text";
import { optionalTextareaField } from "../../fields/textarea";
import { contentGroup } from "../../groups";
import { allTranslations, translated } from "../../translations/translations";

type CommonOptions = {
  additionalUiLabelFields?: Field[];
};

export function Common({
  additionalUiLabelFields,
}: CommonOptions): GlobalConfig {
  return {
    slug: "common",
    access: {
      update: canManageContent,
    },
    admin: {
      group: contentGroup,
    },
    fields: [
      {
        type: "tabs",
        tabs: [
          {
            name: "pageNotFoundScreen",
            fields: [
              descriptionField(
                allTranslations(
                  (v) =>
                    v.cmsPlugin.globals.common.pageNotFoundScreen.description,
                ),
              ),
              optionalTextField({
                name: "heading",
                label: translated(
                  "cmsPlugin:globals:common:pageNotFoundScreen:heading:label",
                ),
              }),
              optionalRichTextField(),
            ],
            label: translated(
              "cmsPlugin:globals:common:pageNotFoundScreen:label",
            ),
          },
          {
            name: "errorScreen",
            fields: [
              descriptionField({
                en: "This screen is shown when the server encounters an error.",
                es: "Esta pantalla se muestra cuando el servidor encuentra un error.",
              }),
              optionalTextField({
                name: "heading",
                label: { en: "Heading", es: "Título" },
              }),
              optionalRichTextField(),
            ],
            label: {
              en: "Internal Server Error Screen",
              es: "Pantalla de Error Interno del Servidor",
            },
          },
          {
            name: "uiLabels",
            fields: [
              {
                name: "banner",
                type: "group",
                fields: [
                  optionalTextField({
                    name: "dismiss",
                    label: { en: "Dismiss", es: "Descartar" },
                  }),
                ],
                label: { en: "Banner", es: "Banner" },
              },
              {
                name: "slidesBlock",
                type: "group",
                fields: [
                  optionalTextField({
                    name: "goToSlide",
                    admin: {
                      description: {
                        en: "Use the {{slide}} placeholder to display the slide number.",
                        es: "Usa el marcador {{slide}} para mostrar el número de diapositiva.",
                      },
                    },
                    label: { en: "Go to Slide", es: "Ir a la Diapositiva" },
                  }),
                ],
              },
              {
                name: "errorBoundary",
                type: "group",
                fields: [
                  optionalTextField({
                    name: "title",
                    label: { en: "Title", es: "Título" },
                  }),
                  optionalTextareaField({
                    name: "text",
                    label: { en: "Text (HTML)", es: "Texto (HTML)" },
                  }),
                ],
                label: {
                  en: "Error Boundary",
                  es: "Límite de Error",
                },
              },
              {
                name: "maintenanceScreen",
                type: "group",
                fields: [
                  optionalTextField({
                    name: "login",
                    label: { en: "Login", es: "Iniciar sesión" },
                  }),
                ],
                label: {
                  en: "Maintenance Screen",
                  es: "Pantalla de Mantenimiento",
                },
              },
              {
                name: "login",
                type: "group",
                fields: [
                  optionalTextField({
                    name: "email",
                    label: { en: "Email", es: "Correo electrónico" },
                  }),
                  optionalTextField({
                    name: "password",
                    label: { en: "Password", es: "Contraseña" },
                  }),
                  optionalTextField({
                    name: "submit",
                    label: { en: "Submit", es: "Enviar" },
                  }),
                ],
                label: { en: "Login", es: "Iniciar sesión" },
              },
              ...(additionalUiLabelFields || []),
            ],
            label: {
              en: "UI Labels",
              es: "Etiquetas de la Interfaz de Usuario",
            },
          },
        ],
      },
    ],
    label: translated("cmsPlugin:globals:common:label"),
  };
}
