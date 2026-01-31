"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRoomStore, type RoomTemplate } from "@/store/roomStore";
import { getRoomDimensions } from "@/lib/geometry/collision";
import { getBoundingBox, shapeToSvgPath } from "@/lib/geometry/polygon";
import type { FloorType, Vertex, WallOpening } from "@/types/room";
import { nanoid } from "nanoid";

// Room templates
// Rules: No furniture overlaps except rug (which can be under other furniture)
// All labels use standard component names (no custom labels)
const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "bedroom",
    name: "Bedroom",
    shape: {
      type: "polygon",
      vertices: [
        { id: "v1", x: 0, y: 0 },
        { id: "v2", x: 14, y: 0 },
        { id: "v3", x: 14, y: 12 },
        { id: "v4", x: 0, y: 12 },
      ],
    },
    items: [
      { type: "rug", label: "Rug", x: 3, y: 5, w: 8, d: 5, rotation: 0 },
      { type: "bed", label: "Bed", x: 4.5, y: 0.5, w: 5, d: 6.5, rotation: 0 },
      { type: "table", label: "Table", x: 2, y: 0.5, w: 2, d: 2, rotation: 0 },
      // Dresser flush with right and bottom walls, drawers facing left (toward bed) - rotation 90
      { type: "dresser", label: "Dresser", x: 12, y: 8, w: 2, d: 4, rotation: 90 },
    ],
    ceilingItems: [
      { type: "ceilingLight", label: "Ceiling Light", x: 7, y: 6, size: 1.5, lightColor: "#fff5e6", lightIntensity: 0.8, isOn: true },
    ],
    openings: [
      { type: "door", wallIndex: 3, position: 0.2, width: 3, height: 7, fromFloor: 0, swingDirection: "left" },
      { type: "window", wallIndex: 1, position: 0.5, width: 4, height: 4, fromFloor: 3 },
    ],
    appearance: { floorType: "wood", floorColor: "#c4a77d" },
  },
  {
    id: "living-room",
    name: "Living Room",
    shape: {
      type: "polygon",
      vertices: [
        { id: "v1", x: 0, y: 0 },
        { id: "v2", x: 10, y: 0 },
        { id: "v3", x: 10, y: 6 },
        { id: "v4", x: 18, y: 6 },
        { id: "v5", x: 18, y: 14 },
        { id: "v6", x: 0, y: 14 },
      ],
    },
    items: [
      { type: "rug", label: "Rug", x: 1, y: 4, w: 8, d: 6, rotation: 0 },
      { type: "tvStand", label: "TV Stand", x: 2.5, y: 0.5, w: 5, d: 1.5, rotation: 0 },
      // Sofa facing TV (rotation 180)
      { type: "sofa", label: "Sofa", x: 1.5, y: 7, w: 7, d: 3, rotation: 180 },
      { type: "table", label: "Table", x: 3, y: 4, w: 4, d: 2, rotation: 0 },
      // Desk and chair moved left to make room for door
      { type: "desk", label: "Desk", x: 10.5, y: 6.5, w: 4, d: 2, rotation: 0 },
      { type: "chair", label: "Chair", x: 11.5, y: 9, w: 2, d: 2, rotation: 0 },
    ],
    ceilingItems: [
      { type: "ceilingLight", label: "Ceiling Light", x: 5, y: 7, size: 2, lightColor: "#ffffff", lightIntensity: 0.9, isOn: true },
      { type: "ceilingFan", label: "Ceiling Fan", x: 14, y: 10, size: 4, lightColor: "#ffffff", lightIntensity: 0, isOn: false },
    ],
    openings: [
      { type: "door", wallIndex: 3, position: 0.7, width: 3, height: 7, fromFloor: 0, swingDirection: "right" },
      { type: "window", wallIndex: 5, position: 0.5, width: 6, height: 4, fromFloor: 3 },
    ],
    appearance: { floorType: "wood", floorColor: "#b89470" },
  },
  {
    id: "home-office",
    name: "Home Office",
    shape: {
      type: "polygon",
      vertices: [
        { id: "v1", x: 0, y: 0 },
        { id: "v2", x: 12, y: 0 },
        { id: "v3", x: 12, y: 10 },
        { id: "v4", x: 0, y: 10 },
      ],
    },
    items: [
      { type: "rug", label: "Rug", x: 1, y: 4, w: 6, d: 5, rotation: 0 },
      { type: "desk", label: "Desk", x: 0.5, y: 0.5, w: 5, d: 2.5, rotation: 0 },
      // Chair centered with desk, rotated 180 to face the desk
      { type: "chair", label: "Chair", x: 2, y: 3.5, w: 2, d: 2, rotation: 180 },
      { type: "dresser", label: "Dresser", x: 9, y: 0.5, w: 2.5, d: 2, rotation: 0 },
      { type: "table", label: "Table", x: 9, y: 7, w: 2.5, d: 2.5, rotation: 0 },
    ],
    ceilingItems: [
      { type: "ceilingLight", label: "Ceiling Light", x: 6, y: 5, size: 1.5, lightColor: "#f5f5f5", lightIntensity: 1, isOn: true },
    ],
    openings: [
      { type: "door", wallIndex: 2, position: 0.8, width: 3, height: 7, fromFloor: 0, swingDirection: "left" },
      { type: "window", wallIndex: 0, position: 0.35, width: 4, height: 4, fromFloor: 3 },
    ],
    appearance: { floorType: "carpet", floorColor: "#8b9dc3" },
  },
  {
    id: "studio",
    name: "Studio Apartment",
    shape: {
      type: "polygon",
      vertices: [
        // U-shape: top-left room, top-right room, connected at bottom
        { id: "v1", x: 0, y: 0 },
        { id: "v2", x: 6, y: 0 },
        { id: "v3", x: 6, y: 5 },
        { id: "v4", x: 14, y: 5 },
        { id: "v5", x: 14, y: 0 },
        { id: "v6", x: 20, y: 0 },
        { id: "v7", x: 20, y: 16 },
        { id: "v8", x: 0, y: 16 },
      ],
    },
    items: [
      // Rug in living area only
      { type: "rug", label: "Rug", x: 1, y: 7, w: 7, d: 6, rotation: 0 },
      // Bedroom area (top right)
      { type: "bed", label: "Bed", x: 14.5, y: 0.5, w: 5, d: 6.5, rotation: 0 },
      // Dresser flush against top wall (y=5 is the internal wall)
      { type: "dresser", label: "Dresser", x: 8, y: 5, w: 4, d: 2, rotation: 0 },
      // Top left room: dining area - chairs rotated 180 to face table, positioned above table
      { type: "table", label: "Table", x: 1, y: 1.5, w: 4, d: 2.5, rotation: 0 },
      { type: "chair", label: "Chair", x: 1.5, y: 0, w: 2, d: 1.5, rotation: 180 },
      { type: "chair", label: "Chair", x: 3.5, y: 0, w: 2, d: 1.5, rotation: 180 },
      // Living area: sofa facing TV (bottom wall), TV flush against bottom wall
      { type: "tvStand", label: "TV Stand", x: 2, y: 14.5, w: 5, d: 1.5, rotation: 0 },
      { type: "sofa", label: "Sofa", x: 1.5, y: 10, w: 6, d: 3, rotation: 0 },
    ],
    ceilingItems: [
      { type: "ceilingLight", label: "Ceiling Light", x: 4, y: 11, size: 2, lightColor: "#fff8e7", lightIntensity: 0.8, isOn: true },
      { type: "ceilingLight", label: "Ceiling Light", x: 17, y: 4, size: 1.5, lightColor: "#fff5e6", lightIntensity: 0.7, isOn: true },
      { type: "ceilingLight", label: "Ceiling Light", x: 3, y: 2.5, size: 1.2, lightColor: "#ffffff", lightIntensity: 0.7, isOn: true },
    ],
    openings: [
      // Door bottom right
      { type: "door", wallIndex: 6, position: 0.15, width: 3, height: 7, fromFloor: 0, swingDirection: "right" },
      { type: "window", wallIndex: 0, position: 0.5, width: 3, height: 4, fromFloor: 3 },
      { type: "window", wallIndex: 5, position: 0.5, width: 5, height: 4, fromFloor: 3 },
    ],
    appearance: { floorType: "wood", floorColor: "#d4b896" },
  },
];

interface RoomSetupModalProps {
  onClose: () => void;
}

type DragState =
  | { type: "none" }
  | { type: "vertex"; id: string; startPx: { x: number; y: number }; startRoom: { x: number; y: number } }
  | { type: "opening"; id: string; mode: "move" | "resize-left" | "resize-right"; wallIndex: number; startPx: { x: number; y: number }; startPos: number; startWidth: number };

export default function RoomSetupModal({ onClose }: RoomSetupModalProps) {
  const {
    room,
    openings,
    gridSize,
    appearance,
    setGridSize,
    applyPresetShape,
    addOpening,
    removeOpening,
    updateOpening,
    setWallColor,
    setFloorType,
    setFloorColor,
    setCeilingColor,
    selectVertex,
    moveVertex,
    addVertex,
    removeVertex,
    selectedVertexId,
    selectedOpeningId,
    selectOpening,
    setEditMode,
    applyTemplate,
  } = useRoomStore();

  const [activeTab, setActiveTab] = useState<"templates" | "shape" | "openings" | "appearance">("templates");
  const [selectedWall, setSelectedWall] = useState(0);
  const [drag, setDrag] = useState<DragState>({ type: "none" });
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const dims = getRoomDimensions(room);
  const vertices: Vertex[] = room.shape.type === "polygon" ? room.shape.vertices : [];
  const vertexCount = vertices.length || 4;
  const wallCount = vertexCount;

  // Canvas and coordinate setup - EXACT same logic as original RoomCanvas
  const canvasPx = 700;
  const bbox = useMemo(() => getBoundingBox(room.shape), [room.shape]);

  const scale = useMemo(() => {
    const maxDim = Math.max(bbox.width, bbox.depth);
    return (canvasPx - 40) / maxDim;
  }, [bbox.width, bbox.depth]);

  function roomToPx(v: number) {
    return v * scale;
  }
  function pxToRoom(v: number) {
    return v / scale;
  }

  const roomPath = useMemo(() => shapeToSvgPath(room.shape, scale), [room.shape, scale]);

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let x = bbox.minX; x <= bbox.maxX; x += gridSize) {
      lines.push({
        x1: roomToPx(x),
        y1: roomToPx(bbox.minY),
        x2: roomToPx(x),
        y2: roomToPx(bbox.maxY),
      });
    }
    for (let y = bbox.minY; y <= bbox.maxY; y += gridSize) {
      lines.push({
        x1: roomToPx(bbox.minX),
        y1: roomToPx(y),
        x2: roomToPx(bbox.maxX),
        y2: roomToPx(y),
      });
    }
    return lines;
  }, [bbox, gridSize, scale]);

  // Enable shape editing mode and handle keyboard
  useEffect(() => {
    setEditMode("shape");

    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedVertexId && vertexCount > 3) {
        e.preventDefault();
        removeVertex(selectedVertexId);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedOpeningId) {
        e.preventDefault();
        removeOpening(selectedOpeningId);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      setEditMode("furniture");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [setEditMode, selectedVertexId, selectedOpeningId, vertexCount, removeVertex, removeOpening]);

  // Get wall info for opening calculations - EXACT same as original
  function getWallInfo(wallIndex: number) {
    const verts = room.shape.type === "polygon" ? room.shape.vertices : [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 10 },
      { x: 0, y: 10 },
    ];
    const start = verts[wallIndex];
    const end = verts[(wallIndex + 1) % verts.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    return { start, end, dx, dy, length, angle };
  }

  // Find the closest wall and position for a point - EXACT same as original
  function findClosestWallPosition(point: { x: number; y: number }, openingWidth: number): { wallIndex: number; position: number } {
    const verts = room.shape.type === "polygon" ? room.shape.vertices : [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 10 },
      { x: 0, y: 10 },
    ];

    let bestWall = 0;
    let bestPosition = 0.5;
    let bestDistance = Infinity;

    for (let i = 0; i < verts.length; i++) {
      const start = verts[i];
      const end = verts[(i + 1) % verts.length];
      const wallDx = end.x - start.x;
      const wallDy = end.y - start.y;
      const wallLength = Math.sqrt(wallDx * wallDx + wallDy * wallDy);

      if (wallLength < 0.1) continue;

      const t = Math.max(0, Math.min(1,
        ((point.x - start.x) * wallDx + (point.y - start.y) * wallDy) / (wallLength * wallLength)
      ));

      const closestX = start.x + t * wallDx;
      const closestY = start.y + t * wallDy;
      const dist = Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);

      if (dist < bestDistance) {
        bestDistance = dist;
        bestWall = i;
        const halfWidthRatio = (openingWidth / 2) / wallLength;
        bestPosition = Math.max(halfWidthRatio, Math.min(1 - halfWidthRatio, t));
      }
    }

    return { wallIndex: bestWall, position: bestPosition };
  }

  // Pointer handlers - EXACT same logic as original
  function onPointerDownVertex(e: React.PointerEvent, vertex: Vertex) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    selectVertex(vertex.id);

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 40, y: e.clientY - bounds.top - 40 };
    setDrag({
      type: "vertex",
      id: vertex.id,
      startPx: px,
      startRoom: { x: vertex.x, y: vertex.y },
    });
  }

  function onPointerDownOpening(e: React.PointerEvent, opening: WallOpening, mode: "move" | "resize-left" | "resize-right") {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    selectOpening(opening.id);

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 40, y: e.clientY - bounds.top - 40 };
    setDrag({
      type: "opening",
      id: opening.id,
      mode,
      wallIndex: opening.wallIndex,
      startPx: px,
      startPos: opening.position,
      startWidth: opening.width,
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (drag.type === "none") return;

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 40, y: e.clientY - bounds.top - 40 };

    if (drag.type === "vertex") {
      const dxRoom = pxToRoom(px.x - drag.startPx.x);
      const dyRoom = pxToRoom(px.y - drag.startPx.y);
      const snappedX = Math.round((drag.startRoom.x + dxRoom) / gridSize) * gridSize;
      const snappedY = Math.round((drag.startRoom.y + dyRoom) / gridSize) * gridSize;
      moveVertex(drag.id, snappedX, snappedY);
    } else if (drag.type === "opening") {
      const mouseRoom = { x: pxToRoom(px.x), y: pxToRoom(px.y) };
      const opening = openings.find(o => o.id === drag.id);
      if (!opening) return;

      if (drag.mode === "move") {
        const { wallIndex, position } = findClosestWallPosition(mouseRoom, opening.width);
        updateOpening(drag.id, { wallIndex, position });
      } else {
        const wall = getWallInfo(drag.wallIndex);
        const dxPx = px.x - drag.startPx.x;
        const dyPx = px.y - drag.startPx.y;

        const wallDirX = Math.cos(wall.angle);
        const wallDirY = Math.sin(wall.angle);
        const moveAlongWall = (pxToRoom(dxPx) * wallDirX + pxToRoom(dyPx) * wallDirY);

        if (drag.mode === "resize-left") {
          const widthDelta = -moveAlongWall;
          const newWidth = Math.max(1, drag.startWidth + widthDelta);
          const halfWidthRatio = (newWidth / 2) / wall.length;
          const posDelta = (newWidth - drag.startWidth) / wall.length / 2;
          const newPos = Math.max(halfWidthRatio, Math.min(1 - halfWidthRatio, drag.startPos - posDelta));
          updateOpening(drag.id, { width: newWidth, position: newPos });
        } else if (drag.mode === "resize-right") {
          const widthDelta = moveAlongWall;
          const newWidth = Math.max(1, drag.startWidth + widthDelta);
          const halfWidthRatio = (newWidth / 2) / wall.length;
          const posDelta = (newWidth - drag.startWidth) / wall.length / 2;
          const newPos = Math.max(halfWidthRatio, Math.min(1 - halfWidthRatio, drag.startPos + posDelta));
          updateOpening(drag.id, { width: newWidth, position: newPos });
        }
      }
    }
  }

  function onPointerUp() {
    if (drag.type !== "none") setDrag({ type: "none" });
  }

  function onEdgeClick(e: React.PointerEvent, edgeIndex: number) {
    if (room.shape.type !== "polygon") return;
    e.stopPropagation();

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 40, y: e.clientY - bounds.top - 40 };
    const roomPoint = { x: pxToRoom(px.x), y: pxToRoom(px.y) };

    const snappedX = Math.round(roomPoint.x / gridSize) * gridSize;
    const snappedY = Math.round(roomPoint.y / gridSize) * gridSize;

    const startVertex = room.shape.vertices[edgeIndex];
    addVertex(startVertex.id, snappedX, snappedY);
  }

  function onCanvasClick() {
    selectVertex(null);
    selectOpening(null);
  }

  // Render wall opening - EXACT same as original
  function renderOpening(opening: WallOpening) {
    const wall = getWallInfo(opening.wallIndex);
    const isSelected = opening.id === selectedOpeningId;

    const centerAlongWall = wall.length * opening.position;
    const halfWidth = opening.width / 2;
    const startAlongWall = centerAlongWall - halfWidth;

    const cos = Math.cos(wall.angle);
    const sin = Math.sin(wall.angle);

    const centerX = wall.start.x + cos * centerAlongWall;
    const centerY = wall.start.y + sin * centerAlongWall;

    const startX = wall.start.x + cos * startAlongWall;
    const startY = wall.start.y + sin * startAlongWall;
    const endX = wall.start.x + cos * (startAlongWall + opening.width);
    const endY = wall.start.y + sin * (startAlongWall + opening.width);

    const isDoor = opening.type === "door";
    const color = isDoor ? "#8B4513" : "#87ceeb";
    const strokeColor = isDoor ? "#654321" : "#4a90d9";

    return (
      <g key={opening.id}>
        {/* Invisible wide hit area for easier dragging */}
        <line
          x1={roomToPx(startX)}
          y1={roomToPx(startY)}
          x2={roomToPx(endX)}
          y2={roomToPx(endY)}
          stroke="transparent"
          strokeWidth={24}
          strokeLinecap="round"
          style={{ cursor: "grab" }}
          onPointerDown={(e) => onPointerDownOpening(e, opening, "move")}
        />

        {/* Border/highlight */}
        <line
          x1={roomToPx(startX)}
          y1={roomToPx(startY)}
          x2={roomToPx(endX)}
          y2={roomToPx(endY)}
          stroke={isSelected ? "#000" : strokeColor}
          strokeWidth={isSelected ? 10 : 8}
          strokeLinecap="round"
          style={{ pointerEvents: "none" }}
        />
        {/* Opening line on wall (visible) */}
        <line
          x1={roomToPx(startX)}
          y1={roomToPx(startY)}
          x2={roomToPx(endX)}
          y2={roomToPx(endY)}
          stroke={color}
          strokeWidth={isSelected ? 6 : 4}
          strokeLinecap="round"
          style={{ pointerEvents: "none" }}
        />

        {/* Door swing arc indicator */}
        {isDoor && (() => {
          const swingLeft = opening.swingDirection !== "right";
          const hingeX = swingLeft ? startX : endX;
          const hingeY = swingLeft ? startY : endY;
          const swingDir = swingLeft ? 1 : -1;
          return (
            <path
              d={`M ${roomToPx(hingeX)} ${roomToPx(hingeY)}
                  A ${roomToPx(opening.width)} ${roomToPx(opening.width)} 0 0 ${swingLeft ? 1 : 0}
                  ${roomToPx(hingeX + cos * opening.width * swingDir - sin * opening.width * 0.7)}
                  ${roomToPx(hingeY + sin * opening.width * swingDir + cos * opening.width * 0.7)}`}
              fill="none"
              stroke={strokeColor}
              strokeWidth={1.5}
              strokeDasharray="4 2"
              style={{ pointerEvents: "none" }}
            />
          );
        })()}

        {/* Window cross pattern */}
        {!isDoor && (
          <line
            x1={roomToPx(centerX)}
            y1={roomToPx(centerY - 0.15)}
            x2={roomToPx(centerX)}
            y2={roomToPx(centerY + 0.15)}
            stroke="white"
            strokeWidth={2}
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Label */}
        <text
          x={roomToPx(centerX)}
          y={roomToPx(centerY) - 12}
          fontSize={10}
          fill="#333"
          textAnchor="middle"
          style={{ pointerEvents: "none" }}
        >
          {isDoor ? "Door" : "Window"} ({opening.width.toFixed(1)})
        </text>

        {/* Resize handles when selected */}
        {isSelected && (
          <>
            <circle
              cx={roomToPx(startX)}
              cy={roomToPx(startY)}
              r={6}
              fill="white"
              stroke="#000"
              strokeWidth={2}
              style={{ cursor: "ew-resize" }}
              onPointerDown={(e) => onPointerDownOpening(e, opening, "resize-left")}
            />
            <circle
              cx={roomToPx(endX)}
              cy={roomToPx(endY)}
              r={6}
              fill="white"
              stroke="#000"
              strokeWidth={2}
              style={{ cursor: "ew-resize" }}
              onPointerDown={(e) => onPointerDownOpening(e, opening, "resize-right")}
            />
          </>
        )}
      </g>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full h-full max-w-[1600px] max-h-[950px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between shrink-0 bg-gray-50">
          <div>
            <h2 className="text-xl font-semibold">Room Setup</h2>
            <p className="text-sm text-gray-500 mt-0.5">{dims.width.toFixed(1)} × {dims.depth.toFixed(1)} {room.unit} · {vertexCount} vertices · {openings.length} openings</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Canvas - ref on the SVG wrapper, not outer div */}
          <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-auto">
            <div
              ref={wrapRef}
              className="bg-white rounded-xl shadow-sm border select-none"
              style={{ padding: 20 }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerDown={onCanvasClick}
            >
              <svg width={canvasPx} height={canvasPx} className="block overflow-visible">
                <defs>
                  <clipPath id="room-clip-setup">
                    <path d={roomPath} />
                  </clipPath>
                </defs>

                <g transform="translate(20,20)">
                  {/* Grid */}
                  <g opacity={0.2} clipPath="url(#room-clip-setup)">
                    {gridLines.map((ln, i) => (
                      <line key={i} x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} stroke="#94a3b8" strokeWidth={1} />
                    ))}
                  </g>

                  {/* Room boundary */}
                  <path d={roomPath} fill="#f8fafc" stroke="#334155" strokeWidth={2} />

                  {/* Edge click targets for adding vertices */}
                  <g>
                    {vertices.map((v, i) => {
                      const next = vertices[(i + 1) % vertices.length];
                      return (
                        <line
                          key={`edge-${i}`}
                          x1={roomToPx(v.x)}
                          y1={roomToPx(v.y)}
                          x2={roomToPx(next.x)}
                          y2={roomToPx(next.y)}
                          stroke="transparent"
                          strokeWidth={16}
                          style={{ cursor: "crosshair" }}
                          onPointerDown={(e) => onEdgeClick(e, i)}
                        />
                      );
                    })}
                  </g>

                  {/* Wall openings */}
                  {openings.map((opening) => renderOpening(opening))}

                  {/* Wall labels */}
                  {vertices.map((v, i) => {
                    const next = vertices[(i + 1) % vertices.length];
                    return (
                      <text
                        key={`w-${i}`}
                        x={roomToPx((v.x + next.x) / 2)}
                        y={roomToPx((v.y + next.y) / 2)}
                        fontSize={13}
                        fill="#9ca3af"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ pointerEvents: "none" }}
                      >
                        W{i + 1}
                      </text>
                    );
                  })}

                  {/* Vertex handles */}
                  <g>
                    {vertices.map((v, i) => {
                      const isSelected = v.id === selectedVertexId;
                      return (
                        <g key={v.id}>
                          <circle
                            cx={roomToPx(v.x)}
                            cy={roomToPx(v.y)}
                            r={isSelected ? 10 : 8}
                            fill={isSelected ? "#3b82f6" : "#6b7280"}
                            stroke="white"
                            strokeWidth={2}
                            style={{ cursor: "grab" }}
                            onPointerDown={(e) => onPointerDownVertex(e, v)}
                          />
                          <text
                            x={roomToPx(v.x)}
                            y={roomToPx(v.y) - 14}
                            fontSize={11}
                            fill="#374151"
                            textAnchor="middle"
                            fontWeight={600}
                            style={{ pointerEvents: "none" }}
                          >
                            {i + 1}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </g>
              </svg>
            </div>
          </div>

          {/* Right panel */}
          <div className="w-[380px] flex flex-col border-l shrink-0 bg-white">
            {/* Tabs */}
            <div className="flex border-b shrink-0">
              {[
                { id: "templates", label: "Templates" },
                { id: "shape", label: "Shape" },
                { id: "openings", label: "Doors & Windows" },
                { id: "appearance", label: "Colors" },
              ].map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)} className={`flex-1 px-3 py-3 text-sm font-medium ${activeTab === tab.id ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === "templates" && (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-700">
                    Choose a template to quickly set up your room with furniture, lighting, and openings.
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {ROOM_TEMPLATES.map((template) => {
                      // Generate mini SVG preview
                      const templateBbox = getBoundingBox(template.shape);
                      const previewSize = 120;
                      const previewScale = (previewSize - 20) / Math.max(templateBbox.width, templateBbox.depth);
                      const previewPath = shapeToSvgPath(template.shape, previewScale);

                      return (
                        <button
                          key={template.id}
                          onClick={() => applyTemplate(template)}
                          className="flex flex-col items-center p-3 border-2 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all group"
                        >
                          <div className="bg-gray-100 rounded-lg p-2 mb-2 group-hover:bg-white transition-colors">
                            <svg width={previewSize} height={previewSize} className="block">
                              <g transform="translate(10,10)">
                                {/* Room shape */}
                                <path d={previewPath} fill="#f1f5f9" stroke="#64748b" strokeWidth={1.5} />

                                {/* Furniture dots */}
                                {template.items.map((item, i) => (
                                  <rect
                                    key={i}
                                    x={(item.x + item.w / 2) * previewScale - 3}
                                    y={(item.y + item.d / 2) * previewScale - 3}
                                    width={6}
                                    height={6}
                                    rx={1}
                                    fill={item.type === "bed" ? "#3b82f6" : item.type === "sofa" ? "#8b5cf6" : item.type === "desk" ? "#f59e0b" : "#6b7280"}
                                  />
                                ))}

                                {/* Ceiling light indicators */}
                                {template.ceilingItems.filter(c => c.type === "ceilingLight").map((item, i) => (
                                  <circle
                                    key={`light-${i}`}
                                    cx={item.x * previewScale}
                                    cy={item.y * previewScale}
                                    r={4}
                                    fill="#fbbf24"
                                    stroke="#f59e0b"
                                    strokeWidth={1}
                                  />
                                ))}
                              </g>
                            </svg>
                          </div>
                          <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700">{template.name}</span>
                          <span className="text-xs text-gray-400">{template.items.length} items · {template.ceilingItems.length} lights</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === "shape" && (
                <div className="space-y-5">
                  <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                    Click edges to add vertices · Drag vertices to move · Delete key to remove
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Presets</div>
                    <div className="flex gap-2">
                      <button onClick={() => applyPresetShape("rectangle")} className="flex-1 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm">Rectangle</button>
                      <button onClick={() => applyPresetShape("l-shape")} className="flex-1 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm">L-Shape</button>
                      <button onClick={() => applyPresetShape("u-shape")} className="flex-1 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm">U-Shape</button>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Grid Snap</div>
                    <div className="flex items-center gap-2">
                      <input type="number" step="0.5" min="0.5" value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))} className="w-20 px-3 py-2 border rounded-lg text-sm" />
                      <span className="text-sm text-gray-500">{room.unit}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "openings" && (
                <div className="space-y-5">
                  <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-700">
                    Drag to move (works around corners) · Drag handles to resize · Delete key to remove
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Add to Wall</div>
                    <div className="flex items-center gap-2">
                      <select value={selectedWall} onChange={(e) => setSelectedWall(Number(e.target.value))} className="px-3 py-2 border rounded-lg text-sm">
                        {Array.from({ length: wallCount }).map((_, i) => <option key={i} value={i}>Wall {i + 1}</option>)}
                      </select>
                      <button onClick={() => addOpening("door", selectedWall)} className="px-3 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 text-sm">+ Door</button>
                      <button onClick={() => addOpening("window", selectedWall)} className="px-3 py-2 bg-sky-100 text-sky-800 rounded-lg hover:bg-sky-200 text-sm">+ Window</button>
                    </div>
                  </div>
                  {openings.length > 0 && (
                    <div className="space-y-2">
                      {openings.map((o) => (
                        <div key={o.id} onClick={() => selectOpening(o.id)} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${o.id === selectedOpeningId ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"}`}>
                          <span className="text-sm font-medium capitalize">{o.type} · Wall {o.wallIndex + 1}</span>
                          <span className="text-xs text-gray-500">{o.width.toFixed(1)} × {o.height.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Door swing controls */}
                  {(() => {
                    const selectedOpening = openings.find(o => o.id === selectedOpeningId);
                    if (!selectedOpening || selectedOpening.type !== "door") return null;
                    return (
                      <div className="pt-4 border-t">
                        <div className="text-sm font-medium text-gray-700 mb-2">Door Swing</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateOpening(selectedOpening.id, { swingDirection: "left" })}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${selectedOpening.swingDirection !== "right" ? "bg-blue-100 text-blue-800 border-2 border-blue-500" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                          >
                            ↰ Swing Left
                          </button>
                          <button
                            onClick={() => updateOpening(selectedOpening.id, { swingDirection: "right" })}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${selectedOpening.swingDirection === "right" ? "bg-blue-100 text-blue-800 border-2 border-blue-500" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                          >
                            Swing Right ↱
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === "appearance" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Wall Color</span>
                    <div className="flex items-center gap-2">
                      <input type="color" value={appearance.wallColor} onChange={(e) => setWallColor(e.target.value)} className="w-10 h-8 rounded border cursor-pointer" />
                      <span className="text-xs text-gray-400 w-16">{appearance.wallColor}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Floor</span>
                    <div className="flex items-center gap-2">
                      <select value={appearance.floorType} onChange={(e) => setFloorType(e.target.value as FloorType)} className="px-2 py-1 border rounded text-sm">
                        <option value="wood">Wood</option>
                        <option value="tile">Tile</option>
                        <option value="carpet">Carpet</option>
                      </select>
                      <input type="color" value={appearance.floorColor} onChange={(e) => setFloorColor(e.target.value)} className="w-10 h-8 rounded border cursor-pointer" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Ceiling Color</span>
                    <div className="flex items-center gap-2">
                      <input type="color" value={appearance.ceilingColor} onChange={(e) => setCeilingColor(e.target.value)} className="w-10 h-8 rounded border cursor-pointer" />
                      <span className="text-xs text-gray-400 w-16">{appearance.ceilingColor}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t shrink-0">
              <button onClick={onClose} className="w-full px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-medium">
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
