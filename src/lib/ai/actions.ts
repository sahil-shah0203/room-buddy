import type { RoomState, Item, FurnitureType } from "@/types/room";
import type { ProposedPlan } from "@/lib/ai/planSchema";
import { clampToRoom, blocksOverlap, blocksDoorKeepout } from "@/lib/geometry/collision";


export type Action =
  | {
      kind: "ADD_ITEM";
      type: FurnitureType;
      w?: number;
      d?: number;
      x?: number;
      y?: number;
      rotation?: 0 | 90 | 180 | 270;
      label?: string;
    }
  | { kind: "MOVE_ITEM"; id: string; x: number; y: number }
  | { kind: "ROTATE_ITEM"; id: string }
  | { kind: "SET_ROTATION"; id: string; rotation: 0 | 90 | 180 | 270 }
  | { kind: "REMOVE_ITEM"; id: string };

export type ValidationIssue =
  | {
      kind: "OVERLAP";
      actionIndex: number;
      aId: string;
      bId: string;
      message: string;
    }
  | {
      kind: "OUT_OF_BOUNDS";
      actionIndex: number;
      id: string;
      message: string;
    }
  | {
      kind: "UNKNOWN_ITEM";
      actionIndex: number;
      id: string;
      message: string;
    };

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string; issues: ValidationIssue[] };

function displayName(it: Pick<Item, "label" | "type" | "id">) {
  return it.label ?? it.type ?? it.id;
}

function idsToItemMap(items: Item[]) {
  return new Map(items.map((i) => [i.id, i] as const));
}

function overlapsPair(items: Item[]): { a: Item; b: Item } | null {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (blocksOverlap(items[i], items[j])) return { a: items[i], b: items[j] };
    }
  }
  return null;
}

export function validateActions(state: RoomState, actions: ProposedPlan["actions"]): ValidationResult {
  // Apply to a copy and ensure bounds + no overlaps, collecting detailed issues.
  let items: Item[] = structuredClone(state.items);
  const issues: ValidationIssue[] = [];

  for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
    const a = actions[actionIndex];

    if (a.kind === "ADD_ITEM") {
      const id = `NEW:${actionIndex}`;
      const w = a.w ?? 3;
      const d = a.d ?? 2;

      const raw: Item = {
        id,
        type: a.type,
        label: a.label ?? a.type,
        w,
        d,
        x: a.x ?? 0,
        y: a.y ?? 0,
        rotation: a.rotation ?? 0,
      };

      const clamped = clampToRoom(state.room, raw);
      if (clamped.x !== raw.x || clamped.y !== raw.y) {
        issues.push({
          kind: "OUT_OF_BOUNDS",
          actionIndex,
          id,
          message: `Tried to add "${displayName(raw)}" out of bounds (would be clamped).`,
        });
        // Still add the clamped item to keep simulation consistent with actual behavior:
        items.push(clamped);
      } else {
        items.push(clamped);
      }
    }

    if (a.kind === "SET_ROTATION") {
      const m = idsToItemMap(items);
      const it = m.get(a.id);
      if (!it) {
        issues.push({
          kind: "UNKNOWN_ITEM",
          actionIndex,
          id: a.id,
          message: `Set rotation targets unknown item id: ${a.id}`,
        });
        continue;
      }

      const nextRot = a.rotation;
      const swapped = nextRot === 90 || nextRot === 270 ? { w: it.d, d: it.w } : { w: it.w, d: it.d };
      const raw = { ...it, ...swapped, rotation: nextRot };
      const clamped = clampToRoom(state.room, raw);

      if (clamped.x !== raw.x || clamped.y !== raw.y) {
        issues.push({
          kind: "OUT_OF_BOUNDS",
          actionIndex,
          id: it.id,
          message: `Tried to set rotation for "${displayName(it)}" out of bounds (would be clamped).`,
        });
      }

      items = items.map((x) => (x.id === a.id ? clamped : x));
    }

    if (a.kind === "MOVE_ITEM") {
      const m = idsToItemMap(items);
      const it = m.get(a.id);
      if (!it) {
        issues.push({
          kind: "UNKNOWN_ITEM",
          actionIndex,
          id: a.id,
          message: `Move targets unknown item id: ${a.id}`,
        });
        continue;
      }

      const raw = { ...it, x: a.x, y: a.y };
      const clamped = clampToRoom(state.room, raw);
      if (clamped.x !== raw.x || clamped.y !== raw.y) {
        issues.push({
          kind: "OUT_OF_BOUNDS",
          actionIndex,
          id: it.id,
          message: `Tried to move "${displayName(it)}" out of bounds (would be clamped).`,
        });
      }

      items = items.map((x) => (x.id === a.id ? clamped : x));
    }

    if (a.kind === "ROTATE_ITEM") {
      const m = idsToItemMap(items);
      const it = m.get(a.id);
      if (!it) {
        issues.push({
          kind: "UNKNOWN_ITEM",
          actionIndex,
          id: a.id,
          message: `Rotate targets unknown item id: ${a.id}`,
        });
        continue;
      }

      const nextRot = (((it.rotation + 90) % 360) as 0 | 90 | 180 | 270);
      const swapped = nextRot === 90 || nextRot === 270 ? { w: it.d, d: it.w } : { w: it.w, d: it.d };
      const raw = { ...it, ...swapped, rotation: nextRot };
      const clamped = clampToRoom(state.room, raw);

      if (clamped.x !== raw.x || clamped.y !== raw.y) {
        issues.push({
          kind: "OUT_OF_BOUNDS",
          actionIndex,
          id: it.id,
          message: `Tried to rotate "${displayName(it)}" out of bounds (would be clamped).`,
        });
      }

      items = items.map((x) => (x.id === a.id ? clamped : x));
    }

    if (a.kind === "REMOVE_ITEM") {
      items = items.filter((x) => x.id !== a.id);
    }

    // overlap check after each action
    const pair = overlapsPair(items);
    if (pair) {
      issues.push({
        kind: "OVERLAP",
        actionIndex,
        aId: pair.a.id,
        bId: pair.b.id,
        message: `"${displayName(pair.a)}" overlaps "${displayName(pair.b)}".`,
      });

      return {
        ok: false as const,
        reason: "Plan causes item overlap.",
        issues,
      };
    }
    // door keep-out check after each action
    for (const it of items) {
      if (blocksDoorKeepout(it, state.room, state.features)) {
        issues.push({
          kind: "OVERLAP",
          actionIndex,
          aId: it.id,
          bId: "DOOR_KEEP_OUT",
          message: `"${displayName(it)}" blocks a door clearance zone.`,
        });

        return {
          ok: false as const,
          reason: "Plan blocks a door clearance zone.",
          issues,
        };
      }
    }
  }

  if (issues.length) {
    // Non-fatal issues exist (like clamping); treat as failure for "fit" purposes
    return {
      ok: false as const,
      reason: "Plan violates room bounds or targets unknown items.",
      issues,
    };
  }

  return { ok: true as const };
}
