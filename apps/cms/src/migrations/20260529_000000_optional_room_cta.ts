import { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-mongodb";

type DataRecord = Record<string, unknown>;

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  const pages = await payload.db.connection
    .collection("pages")
    .find({ content: { $exists: true } })
    .toArray();

  for (const page of pages) {
    const result = addShowToRoomListCtas(page.content);

    if (!result.changed) {
      continue;
    }

    await payload.db.connection.collection("pages").updateOne(
      { _id: page._id },
      {
        $set: {
          content: result.content,
        },
      },
    );
  }
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Migration code
}

function addShowToRoomListCtas(content: unknown): {
  changed: boolean;
  content: unknown;
} {
  if (Array.isArray(content)) {
    const result = addShowToContentBlocks(content);
    return {
      changed: result.changed,
      content: result.changed ? result.blocks : content,
    };
  }

  if (!isRecord(content)) {
    return { changed: false, content };
  }

  let changed = false;
  const nextContent: DataRecord = { ...content };

  for (const [locale, blocks] of Object.entries(content)) {
    if (!Array.isArray(blocks)) {
      continue;
    }

    const result = addShowToContentBlocks(blocks);
    if (result.changed) {
      nextContent[locale] = result.blocks;
      changed = true;
    }
  }

  return {
    changed,
    content: changed ? nextContent : content,
  };
}

function addShowToContentBlocks(blocks: unknown[]): {
  blocks: unknown[];
  changed: boolean;
} {
  let changed = false;

  const nextBlocks = blocks.map((block) => {
    if (
      !isRecord(block) ||
      block.blockType !== "RoomList" ||
      !Array.isArray(block.rooms)
    ) {
      return block;
    }

    let roomChanged = false;
    const rooms = block.rooms.map((room) => {
      if (!isRecord(room) || !isRecord(room.cta) || "show" in room.cta) {
        return room;
      }

      if (!hasCallToActionData(room.cta)) {
        return room;
      }

      roomChanged = true;
      return {
        ...room,
        cta: {
          ...room.cta,
          show: true,
        },
      };
    });

    if (!roomChanged) {
      return block;
    }

    changed = true;
    return {
      ...block,
      rooms,
    };
  });

  return {
    blocks: changed ? nextBlocks : blocks,
    changed,
  };
}

function hasCallToActionData(cta: DataRecord): boolean {
  return Boolean(cta.label || cta.link || cta.variant);
}

function isRecord(value: unknown): value is DataRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
