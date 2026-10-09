import { expect, test as setup } from "@playwright/test";
import {
  getPuertaBrand,
  createPuertaBrand,
  mockUiLabelTranslations,
  initializeLocale,
} from "../common/cms";

setup("setting up CMS", async ({ request }) => {
  await setup.step(
    "CMS initializes default locales and the test API key",
    async () => {
      // On an empty database, this first request runs the plugin's onInit hook.
      // Relationship validation must preserve the trusted bootstrap's access override.
      const localeUrl = new URL(
        "/api/locale-configs/en",
        process.env.CMS_BASE_URL,
      );
      const locale = await request.get(localeUrl.toString());
      expect(locale.status(), await locale.text()).toBe(200);
      expect((await locale.json()).id).toBe("en");

      const settingsUrl = new URL(
        "/api/globals/settings?depth=0",
        process.env.CMS_BASE_URL,
      );
      const settings = await request.get(settingsUrl.toString());
      expect(settings.status(), await settings.text()).toBe(200);
      expect((await settings.json()).publishedLocales).toMatchObject({
        fallbackLocale: "en",
        publishedLocales: expect.arrayContaining(["en"]),
      });

      // Fixing trusted initialization must not open locale reads to anonymous users.
      const anonymousLocale = await request.get(localeUrl.toString(), {
        headers: { Authorization: "" },
      });
      expect(anonymousLocale.status()).toBe(403);
    },
  );

  await initializeLocale();

  const puertaBrand = await getPuertaBrand();
  if (!puertaBrand) {
    console.log("Puerta brand not found, creating it");

    await createPuertaBrand();
  }

  await mockUiLabelTranslations();
});
