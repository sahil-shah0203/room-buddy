import type { Item, Room } from "@/types/room";

export function rectsOverlap(a: Item, b: Item): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.d &&
    a.y + a.d > b.y
  );
}

export function clampToRoom(room: Room, item: Item): Item {
  const x = Math.min(Math.max(0, item.x), Math.max(0, room.width - item.w));
  const y = Math.min(Math.max(0, item.y), Math.max(0, room.depth - item.d));
  return { ...item, x, y };
}
