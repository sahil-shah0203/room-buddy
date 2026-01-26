import type { Item, Room, RoomFeatures, Wall } from "@/types/room";

export type Rect = { x: number; y: number; w: number; d: number };

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y;
}

export function clampToRoom(room: Room, item: Item): Item {
  const x = Math.min(Math.max(0, item.x), Math.max(0, room.width - item.w));
  const y = Math.min(Math.max(0, item.y), Math.max(0, room.depth - item.d));
  return { ...item, x, y };
}

/**
 * Doors/windows are "features" on walls.
 * We model a door keep-out rectangle extending into the room.
 *
 * v1: a simple inward rectangle (depth = DOOR_CLEARANCE).
 * This works even without exact swing arcs and is VERY effective.
 */
const DOOR_CLEARANCE = 3; // in room units (ft for now)

function wallLen(room: Room, wall: Wall) {
  return wall === "top" || wall === "bottom" ? room.width : room.depth;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(Math.max(n, lo), hi);
}

/**
 * Returns rectangles that represent "do not place furniture here"
 * zones for doors (clearance inward from the wall).
 */
export function doorKeepouts(room: Room, features?: RoomFeatures | null): Rect[] {
  const doors = features?.doors ?? [];
  const keepouts: Rect[] = [];

  for (const d of doors) {
    const len = wallLen(room, d.wall);
    const width = clamp(d.width, 0, len);
    const offset = clamp(d.offset, 0, Math.max(0, len - width));

    // Create an inward rectangle along the wall segment
    if (d.wall === "top") {
      keepouts.push({
        x: offset,
        y: 0,
        w: width,
        d: Math.min(DOOR_CLEARANCE, room.depth),
      });
    } else if (d.wall === "bottom") {
      keepouts.push({
        x: offset,
        y: Math.max(0, room.depth - DOOR_CLEARANCE),
        w: width,
        d: Math.min(DOOR_CLEARANCE, room.depth),
      });
    } else if (d.wall === "left") {
      keepouts.push({
        x: 0,
        y: offset,
        w: Math.min(DOOR_CLEARANCE, room.width),
        d: width,
      });
    } else if (d.wall === "right") {
      keepouts.push({
        x: Math.max(0, room.width - DOOR_CLEARANCE),
        y: offset,
        w: Math.min(DOOR_CLEARANCE, room.width),
        d: width,
      });
    }
  }

  return keepouts;
}

/**
 * "Blocking overlap" rules:
 * - Rugs are allowed to overlap furniture (so rugs are non-blocking).
 * - Everything else is blocking (bed/sofa/etc.).
 */
export function blocksOverlap(a: Item, b: Item): boolean {
  // Allow rugs to overlap anything (including other rugs)
  if (a.type === "rug" || b.type === "rug") return false;
  return rectsOverlap(a, b);
}

/**
 * True if an item blocks any door keep-out zone.
 * Rugs do NOT count as blocking.
 */
export function blocksDoorKeepout(item: Item, room: Room, features?: RoomFeatures | null): boolean {
  if (item.type === "rug") return false;
  const keepouts = doorKeepouts(room, features);
  return keepouts.some((k) => rectsOverlap(item, k));
}
