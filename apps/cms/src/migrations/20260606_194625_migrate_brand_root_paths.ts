import { migrateBrandHomeLinksToRootPaths } from "../collections/brands/migrate-home-links-to-root-paths";
import { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const result = await migrateBrandHomeLinksToRootPaths({
    payload,
    req,
  });

  console.log("Migrated brand root paths", result);
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Migration code
}
