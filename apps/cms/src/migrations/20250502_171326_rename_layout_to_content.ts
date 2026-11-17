import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const pages = await payload.db.connection
    .collection("pages")
    .find({})
    .toArray();

  for (const page of pages) {
    await payload.db.connection.collection("pages").updateOne(
      { _id: page._id },
      {
        $set: {
          content: page.layout,
        },
        $unset: {
          layout: "",
        },
      },
    );
  }
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Migration code
}
