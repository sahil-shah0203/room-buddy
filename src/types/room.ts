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

// Geometry primitives for polygon support
export type Point = {
  x: number;
  y: number;
};

export type Vertex = Point & {
  id: string;
};

// Discriminated union for room shapes
export type RectangleShape = {
  type: "rectangle";
  width: number;
  depth: number;
};

export type PolygonShape = {
  type: "polygon";
  vertices: Vertex[];
};

export type RoomShape = RectangleShape | PolygonShape;

export type Room = {
  shape: RoomShape;
  unit: Unit;
};

export type EditMode = "furniture" | "shape" | "ceiling";

// Ceiling items (lights and fans)
export type CeilingItemType = "ceilingLight" | "ceilingFan";

export type CeilingItem = {
  id: string;
  type: CeilingItemType;
  label?: string;
  x: number;
  y: number;
  size: number;           // diameter in room units
  lightColor: string;     // hex color
  lightIntensity: number; // 0-1
  isOn: boolean;
};

// Wall openings (windows and doors)
export type OpeningType = "window" | "door";

export type WallOpening = {
  id: string;
  type: OpeningType;
  wallIndex: number; // which wall (edge) this opening is on
  position: number; // 0-1 position along the wall
  width: number; // in room units
  height: number; // in room units
  fromFloor: number; // distance from floor (0 for doors)
};

// Room appearance settings
export type FloorType = "wood" | "tile" | "carpet";

export type RoomAppearance = {
  wallColor: string;
  floorType: FloorType;
  floorColor: string;
  ceilingColor: string;
};

export type Item = {
  id: string;
  type: FurnitureType;
  label?: string;
  color?: string; // custom color override
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
  openings: WallOpening[];
  ceilingItems: CeilingItem[];
  appearance: RoomAppearance;
  selectedItemId: string | null;
  selectedVertexId: string | null;
  selectedOpeningId: string | null;
  selectedCeilingItemId: string | null;
  gridSize: number; // spacing in room units (e.g., 0.5 ft or 6 in)
  editMode: EditMode;
  aiPlan: import("@/lib/ai/planSchema").ProposedPlan | null;
};
