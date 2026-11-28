import type { Common } from "@lapuertahostels/payload-types";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createInstance } from "i18next";
import {
  I18nextProvider,
  initReactI18next,
  useTranslation,
} from "react-i18next";

export function PreviewTranslations({
  common,
  children,
}: {
  common: Common;
  children: ReactNode;
}) {
  const { i18n: parent } = useTranslation();
  const [instance] = useState(() => {
    const preview = createInstance();
    void preview.use(initReactI18next).init({
      ...parent.options,
      resources: structuredClone(parent.store.data),
      lng: parent.language,
      initAsync: false,
      fallbackLng: false,
      react: {
        useSuspense: false,
        bindI18n: "languageChanged",
        bindI18nStore: "added removed",
      },
    });
    return preview;
  });
  useEffect(() => {
    // Replace rather than merge so removed values cannot survive the next edit.
    instance.removeResourceBundle(parent.language, "ui-labels");
    instance.addResourceBundle(
      parent.language,
      "ui-labels",
      common.uiLabels ?? {},
    );
  }, [common.uiLabels, instance, parent.language]);
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
