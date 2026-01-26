import type { Item, RoomState } from "@/types/room";
import type { ProposedPlan } from "@/lib/ai/planSchema";
import { clampToRoom, rectsOverlap, blocksOverlap } from "@/lib/geometry/collision";

export function derivePreviewItems(
  state: RoomState,
  plan: ProposedPlan
): Item[] {
  let items = structuredClone(state.items);

  function dimsForRotation(w: number, d: number, rotation: 0 | 90 | 180 | 270) {
    return rotation === 90 || rotation === 270 ? { w: d, d: w } : { w, d };
  }

  for (const action of plan.actions) {
    if (action.kind === "ADD_ITEM") {
      const rotation = action.rotation ?? 0;
      const baseW = action.w ?? 2;
      const baseD = action.d ?? 2;
      const dims = dimsForRotation(baseW, baseD, rotation);

      items.push(
        clampToRoom(state.room, {
          id: "preview-" + Math.random().toString(36).slice(2),
          type: action.type,
          label: action.label ?? action.type,
          w: dims.w,
          d: dims.d,
          x: action.x ?? 0,
          y: action.y ?? 0,
          rotation,
        })
      );
    }

    if (action.kind === "MOVE_ITEM") {
      items = items.map((it) =>
        it.id === action.id
          ? clampToRoom(state.room, { ...it, x: action.x, y: action.y })
          : it
      );
    }

    if (action.kind === "ROTATE_ITEM") {
      items = items.map((it) =>
        it.id === action.id
          ? { ...it, rotation: ((it.rotation + 90) % 360) as any }
          : it
      );
    }

    if (action.kind === "REMOVE_ITEM") {
      items = items.filter((it) => it.id !== action.id);
    }
  }

  return items;
}
