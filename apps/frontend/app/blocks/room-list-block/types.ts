import type { RoomList } from "@lapuertahostels/payload-types";

export type RoomListBlock = RoomList;

export type Room = RoomListBlock["rooms"][number];
