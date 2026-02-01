import type { Item, Room, RoomShape } from "@/types/room";
import { getBoundingBox, isItemInsideShape } from "./polygon";

/**
 * Get the bounding box dimensions for an item, accounting for rotation.
 * When rotated 90° or 270°, the bounding box width/depth are swapped.
 *
 * Use this for:
 * - Collision detection
 * - Positioning calculations
 * - Both 2D and 3D views should use this for consistent bounds
 */
export function getItemBounds(item: Item): { width: number; depth: number } {
  const isRotated = item.rotation === 90 || item.rotation === 270;
  return {
    width: isRotated ? item.d : item.w,
    depth: isRotated ? item.w : item.d,
  };
}

export function rectsOverlap(a: Item, b: Item): boolean {
  const boundsA = getItemBounds(a);
  const boundsB = getItemBounds(b);
  return (
    a.x < b.x + boundsB.width &&
    a.x + boundsA.width > b.x &&
    a.y < b.y + boundsB.depth &&
    a.y + boundsA.depth > b.y
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
  const roomBox = getBoundingBox(room.shape);
  const itemBounds = getItemBounds(item);
  const x = Math.min(Math.max(roomBox.minX, item.x), Math.max(roomBox.minX, roomBox.maxX - itemBounds.width));
  const y = Math.min(Math.max(roomBox.minY, item.y), Math.max(roomBox.minY, roomBox.maxY - itemBounds.depth));
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
