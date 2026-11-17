import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const common = await payload.db.connection
    .collection("globals")
    .findOne({ globalType: "common" });

  if (!common) {
    throw new Error("Common global not found");
  }

  await payload.db.connection.collection("globals").updateOne(
    { globalType: "footer" },
    {
      $set: common.footer || {},
    },
    { upsert: true },
  );

  await payload.db.connection.collection("globals").updateOne(
    { globalType: "common" },
    {
      $unset: { footer: "" },
    },
  );
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Migration code
}
