import type { Item, Room, RoomShape } from "@/types/room";
import { getBoundingBox, isItemInsideShape } from "./polygon";

export function rectsOverlap(a: Item, b: Item): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.d &&
    a.y + a.d > b.y
  );
}

/**
 * Get the effective width and depth for a room (uses bounding box for polygons)
 */
export function getRoomDimensions(room: Room): { width: number; depth: number } {
  const bbox = getBoundingBox(room.shape);
  return { width: bbox.width, depth: bbox.depth };
}

/**
 * Clamp an item to stay within the room's bounding box
 * For polygons, this is just a first pass - isValidPlacement does the real check
 */
export function clampToRoom(room: Room, item: Item): Item {
  const bbox = getBoundingBox(room.shape);
  const x = Math.min(Math.max(bbox.minX, item.x), Math.max(bbox.minX, bbox.maxX - item.w));
  const y = Math.min(Math.max(bbox.minY, item.y), Math.max(bbox.minY, bbox.maxY - item.d));
  return { ...item, x, y };
}

/**
 * Check if an item placement is valid within the room shape
 * For rectangles, just checks bounds
 * For polygons, checks that item is fully inside and doesn't cross edges
 */
export function isValidPlacement(room: Room, item: Item): boolean {
  return isItemInsideShape(item, room.shape);
}

/**
 * Legacy helper for backward compatibility - extracts width/depth from shape
 */
export function getShapeWidth(shape: RoomShape): number {
  return getBoundingBox(shape).width;
}

export function getShapeDepth(shape: RoomShape): number {
  return getBoundingBox(shape).depth;
}
