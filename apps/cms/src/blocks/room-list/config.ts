import { Block } from "payload";
import {
  textField,
  richTextField,
  callToActionField,
  imageField,
} from "../../fields/index";

export const RoomListBlock: Block = {
  slug: "RoomList",
  interfaceName: "RoomList",
  labels: {
    singular: {
      en: "Room List",
      es: "Lista de habitaciones",
    },
    plural: {
      en: "Room Lists",
      es: "Listas de habitaciones",
    },
  },
  fields: [
    {
      name: "rooms",
      type: "array",
      required: true,
      label: {
        en: "Rooms",
        es: "Habitaciones",
      },
      labels: {
        singular: {
          en: "Room",
          es: "Habitación",
        },
        plural: {
          en: "Rooms",
          es: "Habitaciones",
        },
      },
      minRows: 1,
      fields: [
        textField({ name: "heading", label: { en: "Heading", es: "Título" } }),
        richTextField({ required: false }),
        {
          name: "images",
          type: "array",
          required: true,
          labels: {
            singular: {
              en: "Image",
              es: "Imagen",
            },
            plural: {
              en: "Images",
              es: "Imágenes",
            },
          },
          minRows: 1,
          fields: [
            imageField(),
            textField({
              name: "caption",
              label: {
                en: "Caption",
                es: "Pie de foto",
              },
              required: false,
            }),
          ],
        },
        callToActionField({ optional: true }),
      ],
      admin: {
        components: {
          RowLabel: {
            path: "/src/components/client",
            exportName: "RowLabel",
            clientProps: {
              textProp: "heading",
              fallbackLabelKey: "custom:roomList:roomRowLabel",
            },
          },
        },
      },
    },
  ],
};
