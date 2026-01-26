import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Item, RoomState, FurnitureType, RoomShape, Vertex, EditMode, WallOpening, OpeningType, RoomAppearance, FloorType, CeilingItem, CeilingItemType } from "@/types/room";
import { clampToRoom, rectsOverlap, isValidPlacement, getRoomDimensions } from "@/lib/geometry/collision";
import { snapPoint } from "@/lib/geometry/snap";
import { validateActions } from "@/lib/ai/actions";
import type { ProposedPlan } from "@/lib/ai/planSchema";
import { getBoundingBox } from "@/lib/geometry/polygon";

type PresetShape = "rectangle" | "l-shape" | "u-shape";

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

  // Edit mode
  editMode: EditMode;
  setEditMode: (mode: EditMode) => void;

  // Shape editing
  setRoomShape: (shape: RoomShape) => void;
  applyPresetShape: (preset: PresetShape) => void;
  selectVertex: (id: string | null) => void;
  addVertex: (afterVertexId: string, x: number, y: number) => void;
  moveVertex: (id: string, x: number, y: number) => void;
  removeVertex: (id: string) => void;
  convertToPolygon: () => void;

  // Wall openings (windows/doors)
  addOpening: (type: OpeningType, wallIndex: number) => void;
  removeOpening: (id: string) => void;
  selectOpening: (id: string | null) => void;
  updateOpening: (id: string, updates: Partial<Omit<WallOpening, "id">>) => void;

  // Room appearance
  setWallColor: (color: string) => void;
  setFloorType: (type: FloorType) => void;
  setFloorColor: (color: string) => void;
  setCeilingColor: (color: string) => void;
  setItemColor: (id: string, color: string) => void;

  // AI
  setAiPlan: (plan: ProposedPlan | null) => void;
  applyPlan: (plan: ProposedPlan) => { ok: true } | { ok: false; reason: string };
  previewItems: Item[] | null;
  setPreviewItems: (items: Item[] | null) => void;

  // Ceiling items
  addCeilingItem: (type: CeilingItemType) => void;
  moveCeilingItem: (id: string, x: number, y: number) => void;
  removeCeilingItem: (id: string) => void;
  selectCeilingItem: (id: string | null) => void;
  updateCeilingItem: (id: string, updates: Partial<Omit<CeilingItem, "id" | "type">>) => void;
  toggleCeilingLight: (id: string) => void;
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

const CEILING_ITEM_DEFAULTS: Record<CeilingItemType, { size: number; label: string }> = {
  ceilingLight: { size: 1.5, label: "Ceiling Light" },
  ceilingFan: { size: 4, label: "Ceiling Fan" },
};

function createPresetShape(preset: PresetShape, width: number, depth: number): RoomShape {
  switch (preset) {
    case "rectangle":
      return {
        type: "polygon",
        vertices: [
          { id: nanoid(), x: 0, y: 0 },
          { id: nanoid(), x: width, y: 0 },
          { id: nanoid(), x: width, y: depth },
          { id: nanoid(), x: 0, y: depth },
        ],
      };

    case "l-shape": {
      // L-shape: cut out top-right corner
      const cutWidth = width * 0.4;
      const cutDepth = depth * 0.5;
      return {
        type: "polygon",
        vertices: [
          { id: nanoid(), x: 0, y: 0 },
          { id: nanoid(), x: width - cutWidth, y: 0 },
          { id: nanoid(), x: width - cutWidth, y: cutDepth },
          { id: nanoid(), x: width, y: cutDepth },
          { id: nanoid(), x: width, y: depth },
          { id: nanoid(), x: 0, y: depth },
        ],
      };
    }

    case "u-shape": {
      // U-shape: cut out center top
      const armWidth = width * 0.3;
      const cutDepth = depth * 0.5;
      return {
        type: "polygon",
        vertices: [
          { id: nanoid(), x: 0, y: 0 },
          { id: nanoid(), x: armWidth, y: 0 },
          { id: nanoid(), x: armWidth, y: cutDepth },
          { id: nanoid(), x: width - armWidth, y: cutDepth },
          { id: nanoid(), x: width - armWidth, y: 0 },
          { id: nanoid(), x: width, y: 0 },
          { id: nanoid(), x: width, y: depth },
          { id: nanoid(), x: 0, y: depth },
        ],
      };
    }
  }
}

function wouldCollide(state: RoomState, candidate: Item): boolean {
  for (const it of state.items) {
    if (it.id === candidate.id) continue;
    if (rectsOverlap(it, candidate)) return true;
  }
  return false;
}

const DEFAULT_APPEARANCE: RoomAppearance = {
  wallColor: "#f5f5f4",
  floorType: "wood",
  floorColor: "#ddd5c8",
  ceilingColor: "#ffffff",
};

export const useRoomStore = create<RoomState & Actions>((set, get) => ({
  room: {
    shape: {
      type: "polygon",
      vertices: [
        { id: "v1", x: 0, y: 0 },
        { id: "v2", x: 12, y: 0 },
        { id: "v3", x: 12, y: 10 },
        { id: "v4", x: 0, y: 10 },
      ],
    },
    unit: "ft",
  },
  items: [],
  openings: [],
  ceilingItems: [],
  appearance: DEFAULT_APPEARANCE,
  selectedItemId: null,
  selectedVertexId: null,
  selectedOpeningId: null,
  selectedCeilingItemId: null,
  gridSize: 0.5,
  editMode: "furniture",

  // AI
  aiPlan: null,
  setAiPlan: (plan) => set((s) => ({ ...s, aiPlan: plan })),

  previewItems: null,

  setPreviewItems: (items) =>
    set((s) => ({ ...s, previewItems: items })),

  setEditMode: (mode) => set((s) => ({
    ...s,
    editMode: mode,
    selectedItemId: mode === "furniture" ? s.selectedItemId : null,
    selectedVertexId: mode === "shape" ? s.selectedVertexId : null,
    selectedCeilingItemId: mode === "ceiling" ? s.selectedCeilingItemId : null,
  })),

  setRoomShape: (shape) => set((s) => ({
    ...s,
    room: { ...s.room, shape },
  })),

  applyPresetShape: (preset) => {
    const s = get();
    const dims = getRoomDimensions(s.room);
    const shape = createPresetShape(preset, dims.width, dims.depth);
    set((state) => ({
      ...state,
      room: { ...state.room, shape },
      editMode: "shape",
    }));
  },

  selectVertex: (id) => set((s) => ({ ...s, selectedVertexId: id })),

  addVertex: (afterVertexId, x, y) => {
    const s = get();
    if (s.room.shape.type !== "polygon") return;

    const vertices = [...s.room.shape.vertices];
    const idx = vertices.findIndex((v) => v.id === afterVertexId);
    if (idx === -1) return;

    const newVertex: Vertex = { id: nanoid(), x, y };
    vertices.splice(idx + 1, 0, newVertex);

    set((state) => ({
      ...state,
      room: {
        ...state.room,
        shape: { type: "polygon", vertices },
      },
      selectedVertexId: newVertex.id,
    }));
  },

  moveVertex: (id, x, y) => {
    const s = get();
    if (s.room.shape.type !== "polygon") return;

    const vertices = s.room.shape.vertices.map((v) =>
      v.id === id ? { ...v, x: Math.max(0, x), y: Math.max(0, y) } : v
    );

    set((state) => ({
      ...state,
      room: {
        ...state.room,
        shape: { type: "polygon", vertices },
      },
    }));
  },

  removeVertex: (id) => {
    const s = get();
    if (s.room.shape.type !== "polygon") return;
    if (s.room.shape.vertices.length <= 3) return; // minimum 3 vertices for a polygon

    const vertices = s.room.shape.vertices.filter((v) => v.id !== id);

    set((state) => ({
      ...state,
      room: {
        ...state.room,
        shape: { type: "polygon", vertices },
      },
      selectedVertexId: null,
    }));
  },

  convertToPolygon: () => {
    const s = get();
    if (s.room.shape.type === "polygon") return;

    const { width, depth } = s.room.shape;
    const vertices: Vertex[] = [
      { id: nanoid(), x: 0, y: 0 },
      { id: nanoid(), x: width, y: 0 },
      { id: nanoid(), x: width, y: depth },
      { id: nanoid(), x: 0, y: depth },
    ];

    set((state) => ({
      ...state,
      room: {
        ...state.room,
        shape: { type: "polygon", vertices },
      },
      editMode: "shape",
    }));
  },

  addItemWithSpec: (spec) => {
    const s = get();
    const base = DEFAULT_SIZES[spec.type];
    const id = nanoid();
    const dims = getRoomDimensions(s.room);

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

    // keep inside room bounding box
    candidate = clampToRoom(s.room, candidate);

    // v1 rule: if it collides or invalid placement, try nudging it around
    let tries = 0;
    while (tries < 200 && (wouldCollide(s, candidate) || !isValidPlacement(s.room, candidate))) {
      candidate = { ...candidate, x: candidate.x + s.gridSize };
      candidate = clampToRoom(s.room, candidate);
      tries++;
      if (candidate.x >= dims.width - candidate.w) {
        candidate = { ...candidate, x: 0.5, y: candidate.y + s.gridSize };
        candidate = clampToRoom(s.room, candidate);
      }
    }

    // If we never found a valid spot, don't place it
    if (wouldCollide(s, candidate) || !isValidPlacement(s.room, candidate)) return "";

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

    if (!v.ok) return { ok: false as const, reason: v.reason };

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

        if (!newId) return { ok: false as const, reason: "Could not place an item without collisions." };
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
    }));
    return { ok: true as const };
  },

  setRoom: (width, depth, unit) =>
    set((s) => {
      // Scale polygon vertices to new dimensions
      const currentDims = getRoomDimensions(s.room);
      const scaleX = Math.max(1, width) / currentDims.width;
      const scaleY = Math.max(1, depth) / currentDims.depth;

      const shape: RoomShape = s.room.shape.type === "polygon"
        ? {
            type: "polygon",
            vertices: s.room.shape.vertices.map((v) => ({
              ...v,
              x: v.x * scaleX,
              y: v.y * scaleY,
            })),
          }
        : { type: "rectangle", width: Math.max(1, width), depth: Math.max(1, depth) };

      return {
        ...s,
        room: { shape, unit: unit ?? s.room.unit },
      };
    }),

  setGridSize: (gridSize) => set((s) => ({ ...s, gridSize: Math.max(0.1, gridSize) })),

  addItem: (type) => {
    const s = get();
    const base = DEFAULT_SIZES[type];
    const id = nanoid();
    const dims = getRoomDimensions(s.room);

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
    while (tries < 200 && (wouldCollide(s, candidate) || !isValidPlacement(s.room, candidate))) {
      candidate = { ...candidate, x: candidate.x + s.gridSize, y: candidate.y };
      candidate = clampToRoom(s.room, candidate);
      tries++;
      if (candidate.x >= dims.width - candidate.w) {
        candidate = { ...candidate, x: 0.5, y: candidate.y + s.gridSize };
        candidate = clampToRoom(s.room, candidate);
      }
    }

    // Don't add if no valid placement found
    if (wouldCollide(s, candidate) || !isValidPlacement(s.room, candidate)) return;

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

    // Check collision with other items
    const collides = nextItems.some((it) => it.id !== id && rectsOverlap(it, moved));
    if (collides) return;

    // Check if placement is valid within the room shape
    if (!isValidPlacement(s.room, moved)) return;

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

    const collides = next.some((it) => it.id !== id && rectsOverlap(it, rotated));
    if (collides) return;

    // Check if placement is valid within the room shape
    if (!isValidPlacement(s.room, rotated)) return;

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

    const collides = next.some((it) => it.id !== id && rectsOverlap(it, resized));
    if (collides) return;

    // Check if placement is valid within the room shape
    if (!isValidPlacement(s.room, resized)) return;

    set((prev) => ({ ...prev, items: next }));
  },

  // Wall openings
  addOpening: (type, wallIndex) => {
    const s = get();
    const existingOnWall = s.openings.filter(o => o.wallIndex === wallIndex);

    // Find a position that doesn't overlap with existing openings
    // Try positions from 0.2 to 0.8 in increments
    const width = type === "door" ? 3 : 4;
    const dims = getRoomDimensions(s.room);
    const wallLength = s.room.shape.type === "polygon"
      ? (() => {
          const verts = s.room.shape.vertices;
          const start = verts[wallIndex];
          const end = verts[(wallIndex + 1) % verts.length];
          return Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
        })()
      : wallIndex % 2 === 0 ? dims.width : dims.depth;

    const widthAsPercent = width / wallLength;

    // Find first non-overlapping position
    let position = 0.15;
    const step = 0.1;
    while (position < 0.85) {
      const overlaps = existingOnWall.some(o => {
        const oWidthPercent = o.width / wallLength;
        const oStart = o.position - oWidthPercent / 2;
        const oEnd = o.position + oWidthPercent / 2;
        const newStart = position - widthAsPercent / 2;
        const newEnd = position + widthAsPercent / 2;
        return !(newEnd < oStart || newStart > oEnd);
      });
      if (!overlaps) break;
      position += step;
    }

    const opening: WallOpening = {
      id: nanoid(),
      type,
      wallIndex,
      position: Math.min(0.85, Math.max(0.15, position)),
      width,
      height: type === "door" ? 7 : 3,
      fromFloor: type === "door" ? 0 : 3,
    };
    set((state) => ({
      ...state,
      openings: [...state.openings, opening],
      selectedOpeningId: opening.id,
    }));
  },

  removeOpening: (id) =>
    set((s) => ({
      ...s,
      openings: s.openings.filter((o) => o.id !== id),
      selectedOpeningId: s.selectedOpeningId === id ? null : s.selectedOpeningId,
    })),

  selectOpening: (id) => set((s) => ({ ...s, selectedOpeningId: id })),

  updateOpening: (id, updates) =>
    set((s) => ({
      ...s,
      openings: s.openings.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
    })),

  // Room appearance
  setWallColor: (color) =>
    set((s) => ({
      ...s,
      appearance: { ...s.appearance, wallColor: color },
    })),

  setFloorType: (type) =>
    set((s) => ({
      ...s,
      appearance: { ...s.appearance, floorType: type },
    })),

  setFloorColor: (color) =>
    set((s) => ({
      ...s,
      appearance: { ...s.appearance, floorColor: color },
    })),

  setCeilingColor: (color) =>
    set((s) => ({
      ...s,
      appearance: { ...s.appearance, ceilingColor: color },
    })),

  setItemColor: (id, color) =>
    set((s) => ({
      ...s,
      items: s.items.map((it) =>
        it.id === id ? { ...it, color } : it
      ),
    })),

  // Ceiling items
  addCeilingItem: (type) => {
    const s = get();
    const defaults = CEILING_ITEM_DEFAULTS[type];
    const dims = getRoomDimensions(s.room);
    const id = nanoid();

    // Place at room center
    const x = dims.width / 2;
    const y = dims.depth / 2;

    const newItem: CeilingItem = {
      id,
      type,
      label: defaults.label,
      x,
      y,
      size: defaults.size,
      lightColor: "#ffffff",
      lightIntensity: 0.8,
      isOn: true,
    };

    set((state) => ({
      ...state,
      ceilingItems: [...state.ceilingItems, newItem],
      selectedCeilingItemId: id,
    }));
  },

  moveCeilingItem: (id, x, y) => {
    const s = get();
    const dims = getRoomDimensions(s.room);
    const snapped = snapPoint({ x, y }, s.gridSize);

    // Clamp to room bounds
    const clampedX = Math.max(0, Math.min(dims.width, snapped.x));
    const clampedY = Math.max(0, Math.min(dims.depth, snapped.y));

    set((state) => ({
      ...state,
      ceilingItems: state.ceilingItems.map((item) =>
        item.id === id ? { ...item, x: clampedX, y: clampedY } : item
      ),
    }));
  },

  removeCeilingItem: (id) =>
    set((s) => ({
      ...s,
      ceilingItems: s.ceilingItems.filter((item) => item.id !== id),
      selectedCeilingItemId: s.selectedCeilingItemId === id ? null : s.selectedCeilingItemId,
    })),

  selectCeilingItem: (id) => set((s) => ({ ...s, selectedCeilingItemId: id })),

  updateCeilingItem: (id, updates) =>
    set((s) => ({
      ...s,
      ceilingItems: s.ceilingItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  toggleCeilingLight: (id) =>
    set((s) => ({
      ...s,
      ceilingItems: s.ceilingItems.map((item) =>
        item.id === id ? { ...item, isOn: !item.isOn } : item
      ),
    })),
}));
