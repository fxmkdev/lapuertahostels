import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const common = await payload.db.connection
    .collection("globals")
    .findOne({ globalType: "common" });
  if (!common) {
    throw new Error("Common global not found");
  }

  await payload.db.connection.collection("globals").updateOne(
    { globalType: "maintenance" },
    {
      $set: {
        maps: common.maps,
      },
    },
  );
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Migration code
}
