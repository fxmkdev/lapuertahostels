import { migrateMediaCategoriesToFolders } from "@fxmk/cms-plugin";
import { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const result = await migrateMediaCategoriesToFolders({
    payload,
    req,
  });

  console.log("Migrated media categories to folders", result);
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Migration code
}
