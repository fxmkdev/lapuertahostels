import type { I18nClient } from "@payloadcms/translations";
import type { LabelFunction } from "payload";

export type LabelData = LabelFunction | Record<string, string> | string;

export function getLabelText(data: LabelData, i18n: I18nClient) {
  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object") {
    return data[i18n.language];
  }

  if (typeof data === "function") {
    return data({ i18n, t: i18n.t as Parameters<LabelFunction>[0]["t"] });
  }

  throw new Error("Invalid label type");
}
