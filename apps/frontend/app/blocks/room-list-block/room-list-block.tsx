import { RoomCard } from "./room-card";
import { type RoomListBlock } from "./types";

export type RoomListBlockProps = Partial<RoomListBlock>;

export function RoomListBlock({ rooms }: RoomListBlockProps) {
  return (
    <div className="mx-auto my-36 flex flex-row flex-wrap justify-center gap-32">
      {rooms?.map((room) => (
        <RoomCard key={room.id} {...room} />
      ))}
    </div>
  );
}
