import { act, render, screen } from "@testing-library/react";
import { createInstance } from "i18next";
import {
  I18nextProvider,
  initReactI18next,
  useTranslation,
} from "react-i18next";
import { expect, test } from "vitest";
import { PreviewTranslations } from "./preview-translations";

function Label() {
  const { t } = useTranslation("ui-labels");
  return <span data-testid="label">{t("banner.dismiss")}</span>;
}

test("live labels rerender and clear without changing the application's resources", async () => {
  const parent = createInstance();
  await parent.use(initReactI18next).init({
    lng: "en",
    resources: { en: { "ui-labels": { banner: { dismiss: "Saved" } } } },
    react: { useSuspense: false },
  });
  const subject = (dismiss: string) => (
    <I18nextProvider i18n={parent}>
      <PreviewTranslations
        common={{ id: "common", uiLabels: { banner: { dismiss } } }}
      >
        <Label />
      </PreviewTranslations>
    </I18nextProvider>
  );
  const view = render(subject("Unsaved"));
  expect(screen.getByTestId("label")).toHaveTextContent("Unsaved");
  view.rerender(subject("Updated"));
  expect(screen.getByTestId("label")).toHaveTextContent("Updated");
  view.rerender(subject(""));
  expect(screen.getByTestId("label")).toBeEmptyDOMElement();
  expect(parent.getResource("en", "ui-labels", "banner.dismiss")).toBe("Saved");
  await act(async () => view.unmount());
});
