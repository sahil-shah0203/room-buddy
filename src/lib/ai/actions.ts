import type { RoomState, Item, FurnitureType } from "@/types/room";
import { clampToRoom, rectsOverlap, isValidPlacement } from "@/lib/geometry/collision";
import { nanoid } from "nanoid";
import type { ProposedPlan } from "@/lib/ai/planSchema";

export type Action =
  | { kind: "ADD_ITEM"; type: FurnitureType; w?: number; d?: number; x?: number; y?: number; rotation?: 0 | 90 | 180 | 270; label?: string }
  | { kind: "MOVE_ITEM"; id: string; x: number; y: number }
  | { kind: "ROTATE_ITEM"; id: string }
  | { kind: "REMOVE_ITEM"; id: string };

export function validateActions(state: RoomState, actions: ProposedPlan["actions"]) {
  // simple sim: apply to a copy and ensure bounds + no overlaps
  let items: Item[] = structuredClone(state.items);

  const byId = () => new Map(items.map((i) => [i.id, i]));

  for (const a of actions) {
    if (a.kind === "ADD_ITEM") {
      const id = nanoid();
      const w = a.w ?? 3;
      const d = a.d ?? 2;
      const candidate: Item = clampToRoom(state.room, {
        id,
        type: a.type,
        label: a.label ?? a.type,
        w,
        d,
        x: a.x ?? 0,
        y: a.y ?? 0,
        rotation: a.rotation ?? 0,
      });

      // Check if placement is valid within the room shape (polygon-aware)
      if (!isValidPlacement(state.room, candidate)) {
        return { ok: false, reason: `Item placement is outside the room bounds or crosses a wall.` };
      }

      items.push(candidate);
    }

    if (a.kind === "MOVE_ITEM") {
      const m = byId();
      const it = m.get(a.id);
      if (!it) return { ok: false, reason: `Unknown item id: ${a.id}` };
      const moved = clampToRoom(state.room, { ...it, x: a.x, y: a.y });

      // Check if placement is valid within the room shape (polygon-aware)
      if (!isValidPlacement(state.room, moved)) {
        return { ok: false, reason: `Move would place item outside the room bounds or across a wall.` };
      }

      items = items.map((x) => (x.id === a.id ? moved : x));
    }

    if (a.kind === "ROTATE_ITEM") {
      const m = byId();
      const it = m.get(a.id);
      if (!it) return { ok: false, reason: `Unknown item id: ${a.id}` };
      const nextRot = (((it.rotation + 90) % 360) as 0 | 90 | 180 | 270);
      const swapped = nextRot === 90 || nextRot === 270 ? { w: it.d, d: it.w } : { w: it.w, d: it.d };
      const rotated = clampToRoom(state.room, { ...it, ...swapped, rotation: nextRot });

      // Check if placement is valid within the room shape (polygon-aware)
      if (!isValidPlacement(state.room, rotated)) {
        return { ok: false, reason: `Rotation would place item outside the room bounds or across a wall.` };
      }

      items = items.map((x) => (x.id === a.id ? rotated : x));
    }

    if (a.kind === "REMOVE_ITEM") {
      items = items.filter((x) => x.id !== a.id);
    }

    // overlap check after each action
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (rectsOverlap(items[i], items[j])) {
          return { ok: false, reason: "Plan causes item overlap." };
        }
      }
    }
  }

  return { ok: true as const };
}
