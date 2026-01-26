import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Item, RoomState, FurnitureType } from "@/types/room";
import { clampToRoom, rectsOverlap, blocksOverlap } from "@/lib/geometry/collision";
import { snapPoint } from "@/lib/geometry/snap";
import { validateActions, type ValidationIssue } from "@/lib/ai/actions";
import type { ProposedPlan } from "@/lib/ai/planSchema";

type Msg = { role: "user" | "assistant"; text: string };

type Actions = {
  setRoom: (width: number, depth: number, unit?: RoomState["room"]["unit"]) => void;
  setGridSize: (gridSize: number) => void;
  addItem: (type: FurnitureType) => void;
  addItemWithSpec: (spec: {
    type: FurnitureType;
    w?: number;
    d?: number;
    x?: number;
    y?: number;
    rotation?: 0 | 90 | 180 | 270;
    label?: string;
  }) => string;

  removeSelected: () => void;

  selectItem: (id: string | null) => void;
  moveItem: (id: string, x: number, y: number, opts?: { snap?: boolean }) => void;
  rotateItem: (id: string) => void;
  resizeItem: (id: string, w: number, d: number) => void;

  // AI
  setAiPlan: (plan: ProposedPlan | null) => void;
  applyPlan: (plan: ProposedPlan) => { ok: true } | { ok: false; reason: string; issues?: ValidationIssue[] };
  aiPlan: ProposedPlan | null;
  previewItems: Item[] | null;
  setPreviewItems: (items: Item[] | null) => void;

  lastPlanValidation: { reason: string; issues: ValidationIssue[] } | null;
  clearLastPlanValidation: () => void;

  chatLog: Msg[];
  setChatLog: (log: Msg[]) => void;

  addDoor: (door?: Partial<Omit<import("@/types/room").Door, "id">>) => void;
  updateDoor: (id: string, patch: Partial<Omit<import("@/types/room").Door, "id">>) => void;
  removeDoor: (id: string) => void;

  addWindow: (win?: Partial<Omit<import("@/types/room").Window, "id">>) => void;
  updateWindow: (id: string, patch: Partial<Omit<import("@/types/room").Window, "id">>) => void;
  removeWindow: (id: string) => void;
};

const DEFAULT_SIZES: Record<FurnitureType, { w: number; d: number; label: string }> = {
  sofa: { w: 7, d: 3, label: "Sofa" },
  bed: { w: 5, d: 6.5, label: "Queen Bed" },
  desk: { w: 4, d: 2, label: "Desk" },
  chair: { w: 2, d: 2, label: "Chair" },
  table: { w: 4, d: 3, label: "Table" },
  rug: { w: 8, d: 10, label: "Rug" },
  dresser: { w: 5, d: 2, label: "Dresser" },
  tvStand: { w: 5, d: 1.5, label: "TV Stand" },
};

function wouldCollide(state: RoomState, candidate: Item): boolean {
  for (const it of state.items) {
    if (it.id === candidate.id) continue;
    if (blocksOverlap(it, candidate)) return true;
  }
  return false;
}

export const useRoomStore = create<RoomState & Actions>((set, get) => ({
  room: { width: 12, depth: 10, unit: "ft" },
  items: [],
  selectedItemId: null,
  gridSize: 0.5,
  features: { doors: [], windows: [] },

  // Chat
  chatLog: [
    {
      role: "assistant",
      text: "Tell me what you want to design (cozy, modern, movie night, desk setup, etc).",
    },
  ],
  setChatLog: (log) => set((s) => ({ ...s, chatLog: log })),

  // AI
  aiPlan: null as ProposedPlan | null,
  setAiPlan: (plan) => set((s) => ({ ...s, aiPlan: plan })),

  previewItems: null,
  setPreviewItems: (items) => set((s) => ({ ...s, previewItems: items })),

  lastPlanValidation: null,
  clearLastPlanValidation: () => set((s) => ({ ...s, lastPlanValidation: null })),

  addItemWithSpec: (spec) => {
    const s = get();
    const base = DEFAULT_SIZES[spec.type];
    const id = nanoid();

    let candidate: Item = {
      id,
      type: spec.type,
      label: spec.label ?? base.label,
      w: spec.w ?? base.w,
      d: spec.d ?? base.d,
      x: spec.x ?? 0.5,
      y: spec.y ?? 0.5,
      rotation: spec.rotation ?? 0,
    };

    candidate = clampToRoom(s.room, candidate);

    let tries = 0;
    while (tries < 200 && wouldCollide(s, candidate)) {
      candidate = { ...candidate, x: candidate.x + s.gridSize };
      candidate = clampToRoom(s.room, candidate);
      tries++;
      if (candidate.x >= s.room.width - candidate.w) {
        candidate = { ...candidate, x: 0.5, y: candidate.y + s.gridSize };
        candidate = clampToRoom(s.room, candidate);
      }
    }

    if (wouldCollide(s, candidate)) return "";

    set((prev) => ({
      ...prev,
      items: [...prev.items, candidate],
      selectedItemId: id,
    }));

    return id;
  },

  applyPlan: (plan) => {
    const state = get();
    const v = validateActions(state, plan.actions);

    if (!v.ok) {
      set((s) => ({
        ...s,
        lastPlanValidation: { reason: v.reason, issues: v.issues },
      }));
      return { ok: false as const, reason: v.reason, issues: v.issues };
    }

    // Apply in order using existing store methods so behavior stays consistent.
    for (const a of plan.actions) {
      if (a.kind === "ADD_ITEM") {
        const newId = get().addItemWithSpec({
          type: a.type,
          w: a.w,
          d: a.d,
          x: a.x,
          y: a.y,
          rotation: a.rotation,
          label: a.label,
        });

        if (!newId) {
          const reason = "Could not place an item without collisions.";
          set((s) => ({
            ...s,
            lastPlanValidation: { reason, issues: [] },
          }));
          return { ok: false as const, reason, issues: [] };
        }
      } else if (a.kind === "MOVE_ITEM") {
        get().moveItem(a.id, a.x, a.y, { snap: true });
      } else if (a.kind === "ROTATE_ITEM") {
        get().rotateItem(a.id);
      } else if (a.kind === "REMOVE_ITEM") {
        get().selectItem(a.id);
        get().removeSelected();
      }
    }

    set((s) => ({
      ...s,
      previewItems: null,
      aiPlan: null,
      lastPlanValidation: null,
    }));

    return { ok: true as const };
  },

  setRoom: (width, depth, unit) =>
    set((s) => ({
      ...s,
      room: { width: Math.max(1, width), depth: Math.max(1, depth), unit: unit ?? s.room.unit },
    })),

  setGridSize: (gridSize) => set((s) => ({ ...s, gridSize: Math.max(0.1, gridSize) })),

  addDoor: (door) =>
    set((s) => ({
      ...s,
      features: {
        ...s.features,
        doors: [
          ...s.features.doors,
          {
            id: nanoid(),
            wall: door?.wall ?? "bottom",
            offset: door?.offset ?? 1,
            width: door?.width ?? 3,
            swing: door?.swing ?? "in_left",
          },
        ],
      },
    })),

  updateDoor: (id, patch) =>
    set((s) => ({
      ...s,
      features: {
        ...s.features,
        doors: s.features.doors.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      },
    })),

  removeDoor: (id) =>
    set((s) => ({
      ...s,
      features: {
        ...s.features,
        doors: s.features.doors.filter((d) => d.id !== id),
      },
    })),

  addWindow: (win) =>
    set((s) => ({
      ...s,
      features: {
        ...s.features,
        windows: [
          ...s.features.windows,
          {
            id: nanoid(),
            wall: win?.wall ?? "top",
            offset: win?.offset ?? 2,
            width: win?.width ?? 4,
          },
        ],
      },
    })),

  updateWindow: (id, patch) =>
    set((s) => ({
      ...s,
      features: {
        ...s.features,
        windows: s.features.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      },
    })),

  removeWindow: (id) =>
    set((s) => ({
      ...s,
      features: {
        ...s.features,
        windows: s.features.windows.filter((w) => w.id !== id),
      },
    })),

  addItem: (type) => {
    const s = get();
    const base = DEFAULT_SIZES[type];
    const id = nanoid();

    let candidate: Item = {
      id,
      type,
      label: base.label,
      w: base.w,
      d: base.d,
      x: 0.5,
      y: 0.5,
      rotation: 0,
    };

    candidate = clampToRoom(s.room, candidate);

    let tries = 0;
    while (tries < 200 && wouldCollide(s, candidate)) {
      candidate = { ...candidate, x: candidate.x + s.gridSize, y: candidate.y };
      candidate = clampToRoom(s.room, candidate);
      tries++;
      if (candidate.x >= s.room.width - candidate.w) {
        candidate = { ...candidate, x: 0.5, y: candidate.y + s.gridSize };
        candidate = clampToRoom(s.room, candidate);
      }
    }

    set((prev) => ({
      ...prev,
      items: [...prev.items, candidate],
      selectedItemId: id,
    }));
  },

  removeSelected: () =>
    set((s) => ({
      ...s,
      items: s.items.filter((it) => it.id !== s.selectedItemId),
      selectedItemId: null,
    })),

  selectItem: (id) => set((s) => ({ ...s, selectedItemId: id })),

  moveItem: (id, x, y, opts) => {
    const s = get();
    const snap = opts?.snap ?? true;

    const nextItems = s.items.map((it) => {
      if (it.id !== id) return it;
      const p = snap ? snapPoint({ x, y }, s.gridSize) : { x, y };
      return clampToRoom(s.room, { ...it, x: p.x, y: p.y });
    });

    const moved = nextItems.find((it) => it.id === id);
    if (!moved) return;

    const collides = nextItems.some((it) => it.id !== id && blocksOverlap(it, moved));
    if (collides) return;

    set((prev) => ({ ...prev, items: nextItems }));
  },

  rotateItem: (id) => {
    const s = get();

    const next = s.items.map((it) => {
      if (it.id !== id) return it;
      const nextRot = (((it.rotation + 90) % 360) as 0 | 90 | 180 | 270);
      const swapped = nextRot === 90 || nextRot === 270 ? { w: it.d, d: it.w } : { w: it.w, d: it.d };
      return clampToRoom(s.room, { ...it, ...swapped, rotation: nextRot });
    });

    const rotated = next.find((it) => it.id === id);
    if (!rotated) return;

    const collides = next.some((it) => it.id !== id && blocksOverlap(it, rotated));
    if (collides) return;

    set((prev) => ({ ...prev, items: next }));
  },

  resizeItem: (id, w, d) => {
    const s = get();

    const next = s.items.map((it) => {
      if (it.id !== id) return it;
      return clampToRoom(s.room, { ...it, w: Math.max(0.5, w), d: Math.max(0.5, d) });
    });

    const resized = next.find((it) => it.id === id);
    if (!resized) return;

    const collides = next.some((it) => it.id !== id && blocksOverlap(it, resized));
    if (collides) return;

    set((prev) => ({ ...prev, items: next }));
  },
}));
