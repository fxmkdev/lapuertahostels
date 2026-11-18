import type { LocaleConfig } from "@/payload-types";
import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const localeConfigs: Omit<LocaleConfig, "id" | "createdAt" | "updatedAt">[] =
    [
      {
        locale: "en",
        displayLabel: "English",
        deeplSourceLanguage: "en",
        deeplTargetLanguage: "en-US",
        googleMapsLanguage: "en",
      },
      {
        locale: "es",
        displayLabel: "Español",
        deeplSourceLanguage: "es",
        deeplTargetLanguage: "es-419",
        googleMapsLanguage: "es-419",
      },
      {
        locale: "de",
        displayLabel: "Deutsch",
        deeplSourceLanguage: "de",
        deeplTargetLanguage: "de",
        googleMapsLanguage: "de",
      },
      {
        locale: "fr",
        displayLabel: "Français",
        deeplSourceLanguage: "fr",
        deeplTargetLanguage: "fr",
        googleMapsLanguage: "fr",
      },
    ];

  for (const localeConfig of localeConfigs) {
    await payload.create({
      collection: "locale-configs",
      data: localeConfig,
      req,
    });
  }

  await payload.updateGlobal({
    slug: "settings",
    req,
    data: {
      publishedLocales: {
        publishedLocales: ["en", "es", "de", "fr"],
        fallbackLocale: "en",
      },
    },
  });
}

export async function down({}: MigrateDownArgs): Promise<void> {
  // Migration code
}
