import type { GroupField } from "payload";

import { translated } from "../translations/translations";
import { callToActionField } from "./call-to-action";
import { richTextField } from "./rich-text";
import { showField } from "./show";
import { textField } from "./text";

const configuredCallToActionField = callToActionField({
  optional: true,
  showByDefault: false,
});

type OverlayTextBoxFieldOptions = {
  callToActionLabelOnly?: boolean;
  optional?: boolean;
};

export function overlayTextBoxField({
  callToActionLabelOnly = false,
  optional = true,
}: OverlayTextBoxFieldOptions = {}): GroupField {
  const condition = optional
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_: any, siblingData: any) => siblingData.show
    : undefined;
  return {
    name: "overlayTextBox",
    type: "group",
    fields: [
      ...(optional ? [showField()] : []),
      textField({
        name: "heading",
        admin: { condition },
        label: translated("cmsPlugin:fields:overlayTextBox:heading:label"),
      }),
      richTextField({ admin: { condition } }),
      callToActionLabelOnly
        ? textField({
            name: "callToActionLabel",
            admin: {
              description: translated(
                "cmsPlugin:fields:overlayTextBox:callToActionLabel:description",
              ),
            },
            label: translated(
              "cmsPlugin:fields:overlayTextBox:callToActionLabel:label",
            ),
            required: false,
          })
        : {
            ...configuredCallToActionField,
            admin: {
              ...configuredCallToActionField.admin,
              condition,
            },
          },
      {
        name: "position",
        type: "radio",
        admin: {
          condition,
        },
        label: translated("cmsPlugin:fields:overlayTextBox:position:label"),
        options: [
          {
            label: translated(
              "cmsPlugin:fields:overlayTextBox:position:options:topLeft",
            ),
            value: "top-left",
          },
          {
            label: translated(
              "cmsPlugin:fields:overlayTextBox:position:options:topRight",
            ),
            value: "top-right",
          },
          {
            label: translated(
              "cmsPlugin:fields:overlayTextBox:position:options:bottomLeft",
            ),
            value: "bottom-left",
          },
          {
            label: translated(
              "cmsPlugin:fields:overlayTextBox:position:options:bottomRight",
            ),
            value: "bottom-right",
          },
        ],
      },
    ],
    label: translated("cmsPlugin:fields:overlayTextBox:label"),
  };
}
