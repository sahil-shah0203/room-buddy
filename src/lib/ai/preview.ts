import type { Item, RoomState } from "@/types/room";
import type { ProposedPlan } from "@/lib/ai/planSchema";
import { clampToRoom, rectsOverlap } from "@/lib/geometry/collision";

export function derivePreviewItems(
  state: RoomState,
  plan: ProposedPlan
): Item[] {
  let items = structuredClone(state.items);

  for (const action of plan.actions) {
    if (action.kind === "ADD_ITEM") {
      items.push({
        id: "preview-" + Math.random().toString(36).slice(2),
        type: action.type,
        label: action.label ?? action.type,
        w: action.w ?? 2,
        d: action.d ?? 2,
        x: action.x ?? 0,
        y: action.y ?? 0,
        rotation: action.rotation ?? 0,
      });
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
