export type Unit = "in" | "ft" | "cm" | "m";

export type FurnitureType =
  | "sofa"
  | "bed"
  | "desk"
  | "chair"
  | "table"
  | "rug"
  | "dresser"
  | "tvStand";

export type Room = {
  width: number;  // in chosen unit
  depth: number;  // in chosen unit
  unit: Unit;
};

export type Item = {
  id: string;
  type: FurnitureType;
  label?: string;
  // dimensions in room units
  w: number;
  d: number;
  // position is top-left corner in room units
  x: number;
  y: number;
  // rotation in degrees: 0 | 90 | 180 | 270 for v1
  rotation: 0 | 90 | 180 | 270;
};

export type RoomState = {
  room: Room;
  items: Item[];
  selectedItemId: string | null;
  gridSize: number; // spacing in room units (e.g., 0.5 ft or 6 in)
  aiPlan: import("@/lib/ai/planSchema").ProposedPlan | null;
};
