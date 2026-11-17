import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const maintenance = await payload.db.connection
    .collection("globals")
    .findOne({
      globalType: "maintenance",
    });

  if (!maintenance) {
    throw new Error("Maintenance global not found");
  }

  await payload.db.connection.collection("globals").updateOne(
    {
      _id: maintenance._id,
    },
    {
      $set: {
        globalType: "settings",
      },
    },
  );
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Migration code
}
