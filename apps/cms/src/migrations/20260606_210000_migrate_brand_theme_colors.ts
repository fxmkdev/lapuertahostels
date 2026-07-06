import { migrateBrandThemeColors } from "../collections/brands/migrate-theme-colors";
import { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const result = await migrateBrandThemeColors({
    payload,
    req,
    defaultThemeColor: "puerta",
    themeColorByBrandId: {
      puerta: "puerta",
      aqua: "aqua",
      azul: "azul",
    },
  });

  console.log("Migrated brand theme colors", result);
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Migration code
}
