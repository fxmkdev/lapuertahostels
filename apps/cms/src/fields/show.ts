import type { CheckboxField } from "payload";

import { translated } from "../translations/translations";

export function showField(config: Partial<CheckboxField> = {}): CheckboxField {
  return {
    name: "show",
    type: "checkbox",
    label: translated("cmsPlugin:fields:show:label"),
    ...config,
  };
}
