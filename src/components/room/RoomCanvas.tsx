"use client";

import { useMemo, useRef, useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import type { Item, Vertex, FurnitureType, WallOpening } from "@/types/room";
import { getBoundingBox, shapeToSvgPath } from "@/lib/geometry/polygon";

// Furniture styling configuration
const FURNITURE_STYLES: Record<FurnitureType, { fill: string; stroke: string; icon: string }> = {
  sofa: { fill: "#8b5cf6", stroke: "#7c3aed", icon: "sofa" },
  bed: { fill: "#3b82f6", stroke: "#2563eb", icon: "bed" },
  desk: { fill: "#f59e0b", stroke: "#d97706", icon: "desk" },
  chair: { fill: "#10b981", stroke: "#059669", icon: "chair" },
  table: { fill: "#6366f1", stroke: "#4f46e5", icon: "table" },
  rug: { fill: "#ec4899", stroke: "#db2777", icon: "rug" },
  dresser: { fill: "#78716c", stroke: "#57534e", icon: "dresser" },
  tvStand: { fill: "#1f2937", stroke: "#111827", icon: "tv" },
};

type DragState =
  | { type: "none" }
  | { type: "drag"; id: string; startPx: { x: number; y: number }; startRoom: { x: number; y: number } }
  | { type: "vertex"; id: string; startPx: { x: number; y: number }; startRoom: { x: number; y: number } }
  | { type: "resize"; id: string; handle: string; startPx: { x: number; y: number }; startItem: { x: number; y: number; w: number; d: number } }
  | { type: "opening"; id: string; mode: "move" | "resize-left" | "resize-right"; wallIndex: number; startPx: { x: number; y: number }; startPos: number; startWidth: number };

export default function RoomCanvas() {
  const {
    room,
    items,
    openings,
    selectedItemId,
    selectedVertexId,
    selectedOpeningId,
    gridSize,
    editMode,
    selectItem,
    moveItem,
    resizeItem,
    selectVertex,
    moveVertex,
    addVertex,
    selectOpening,
    updateOpening,
  } = useRoomStore();

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>({ type: "none" });

  const canvasPx = 640;
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

  const vertices: Vertex[] = room.shape.type === "polygon" ? room.shape.vertices : [];

  function onPointerDownItem(e: React.PointerEvent, item: Item) {
    if (editMode !== "furniture") return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    selectItem(item.id);

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 20, y: e.clientY - bounds.top - 20 };
    setDrag({
      type: "drag",
      id: item.id,
      startPx: px,
      startRoom: { x: item.x, y: item.y },
    });
  }

  function onPointerDownResize(e: React.PointerEvent, item: Item, handle: string) {
    if (editMode !== "furniture") return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 20, y: e.clientY - bounds.top - 20 };
    setDrag({
      type: "resize",
      id: item.id,
      handle,
      startPx: px,
      startItem: { x: item.x, y: item.y, w: item.w, d: item.d },
    });
  }

  function onPointerDownVertex(e: React.PointerEvent, vertex: Vertex) {
    if (editMode !== "shape") return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    selectVertex(vertex.id);

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 20, y: e.clientY - bounds.top - 20 };
    setDrag({
      type: "vertex",
      id: vertex.id,
      startPx: px,
      startRoom: { x: vertex.x, y: vertex.y },
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (drag.type === "none") return;

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 20, y: e.clientY - bounds.top - 20 };

    if (drag.type === "drag") {
      const dxRoom = pxToRoom(px.x - drag.startPx.x);
      const dyRoom = pxToRoom(px.y - drag.startPx.y);
      moveItem(drag.id, drag.startRoom.x + dxRoom, drag.startRoom.y + dyRoom, { snap: true });
    } else if (drag.type === "vertex") {
      const dxRoom = pxToRoom(px.x - drag.startPx.x);
      const dyRoom = pxToRoom(px.y - drag.startPx.y);
      const snappedX = Math.round((drag.startRoom.x + dxRoom) / gridSize) * gridSize;
      const snappedY = Math.round((drag.startRoom.y + dyRoom) / gridSize) * gridSize;
      moveVertex(drag.id, snappedX, snappedY);
    } else if (drag.type === "resize") {
      const dxRoom = pxToRoom(px.x - drag.startPx.x);
      const dyRoom = pxToRoom(px.y - drag.startPx.y);

      let newW = drag.startItem.w;
      let newD = drag.startItem.d;
      let newX = drag.startItem.x;
      let newY = drag.startItem.y;

      // Handle different resize handles
      if (drag.handle.includes("e")) {
        newW = Math.max(0.5, drag.startItem.w + dxRoom);
      }
      if (drag.handle.includes("w")) {
        const deltaW = Math.min(dxRoom, drag.startItem.w - 0.5);
        newW = drag.startItem.w - deltaW;
        newX = drag.startItem.x + deltaW;
      }
      if (drag.handle.includes("s")) {
        newD = Math.max(0.5, drag.startItem.d + dyRoom);
      }
      if (drag.handle.includes("n")) {
        const deltaD = Math.min(dyRoom, drag.startItem.d - 0.5);
        newD = drag.startItem.d - deltaD;
        newY = drag.startItem.y + deltaD;
      }

      // Snap to grid
      newW = Math.round(newW / gridSize) * gridSize || gridSize;
      newD = Math.round(newD / gridSize) * gridSize || gridSize;
      newX = Math.round(newX / gridSize) * gridSize;
      newY = Math.round(newY / gridSize) * gridSize;

      // Update position if changed
      if (newX !== drag.startItem.x || newY !== drag.startItem.y) {
        moveItem(drag.id, newX, newY, { snap: false });
      }
      resizeItem(drag.id, newW, newD);
    } else if (drag.type === "opening") {
      const mouseRoom = { x: pxToRoom(px.x), y: pxToRoom(px.y) };
      const opening = openings.find(o => o.id === drag.id);
      if (!opening) return;

      if (drag.mode === "move") {
        // Find closest point on perimeter and which wall it's on
        const { wallIndex, position } = findClosestWallPosition(mouseRoom, opening.width);
        updateOpening(drag.id, { wallIndex, position });
      } else {
        // Resize mode - stay on same wall
        const wall = getWallInfo(drag.wallIndex);
        const dxPx = px.x - drag.startPx.x;
        const dyPx = px.y - drag.startPx.y;

        // Project movement onto wall direction
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
    if (editMode !== "shape" || room.shape.type !== "polygon") return;
    e.stopPropagation();

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 20, y: e.clientY - bounds.top - 20 };
    const roomPoint = { x: pxToRoom(px.x), y: pxToRoom(px.y) };

    const snappedX = Math.round(roomPoint.x / gridSize) * gridSize;
    const snappedY = Math.round(roomPoint.y / gridSize) * gridSize;

    const startVertex = room.shape.vertices[edgeIndex];
    addVertex(startVertex.id, snappedX, snappedY);
  }

  function onPointerDownOpening(e: React.PointerEvent, opening: WallOpening, mode: "move" | "resize-left" | "resize-right") {
    if (editMode !== "shape") return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    selectOpening(opening.id);

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 20, y: e.clientY - bounds.top - 20 };
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

  function onCanvasClick() {
    if (editMode === "furniture") {
      selectItem(null);
    } else {
      selectVertex(null);
      selectOpening(null);
    }
  }

  // Get wall info for opening calculations
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

  // Find the closest wall and position for a point (used for dragging openings around corners)
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

      if (wallLength < 0.1) continue; // Skip degenerate walls

      // Project point onto wall line
      const t = Math.max(0, Math.min(1,
        ((point.x - start.x) * wallDx + (point.y - start.y) * wallDy) / (wallLength * wallLength)
      ));

      // Closest point on wall
      const closestX = start.x + t * wallDx;
      const closestY = start.y + t * wallDy;

      // Distance from point to wall
      const dist = Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);

      if (dist < bestDistance) {
        bestDistance = dist;
        bestWall = i;

        // Calculate position along wall (0-1), clamped so opening stays within bounds
        const halfWidthRatio = (openingWidth / 2) / wallLength;
        bestPosition = Math.max(halfWidthRatio, Math.min(1 - halfWidthRatio, t));
      }
    }

    return { wallIndex: bestWall, position: bestPosition };
  }

  // Render wall opening (door or window)
  function renderOpening(opening: WallOpening) {
    const wall = getWallInfo(opening.wallIndex);
    const isSelected = opening.id === selectedOpeningId && editMode === "shape";

    // Calculate position on wall
    const centerAlongWall = wall.length * opening.position;
    const halfWidth = opening.width / 2;
    const startAlongWall = centerAlongWall - halfWidth;

    // Calculate actual coordinates
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
          style={{ cursor: editMode === "shape" ? "grab" : "default" }}
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
        {isDoor && (
          <path
            d={`M ${roomToPx(startX)} ${roomToPx(startY)}
                A ${roomToPx(opening.width)} ${roomToPx(opening.width)} 0 0 1
                ${roomToPx(startX + cos * opening.width - sin * opening.width * 0.7)}
                ${roomToPx(startY + sin * opening.width + cos * opening.width * 0.7)}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Window cross pattern */}
        {!isDoor && (
          <>
            <line
              x1={roomToPx(centerX)}
              y1={roomToPx(centerY - 0.15)}
              x2={roomToPx(centerX)}
              y2={roomToPx(centerY + 0.15)}
              stroke="white"
              strokeWidth={2}
              style={{ pointerEvents: "none" }}
            />
          </>
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

  // Render furniture item with distinctive styling
  function renderFurnitureItem(item: Item) {
    const isSel = item.id === selectedItemId && editMode === "furniture";
    const style = FURNITURE_STYLES[item.type];
    const w = roomToPx(item.w);
    const h = roomToPx(item.d);

    return (
      <g
        key={item.id}
        transform={`translate(${roomToPx(item.x)},${roomToPx(item.y)})`}
        onPointerDown={(e) => onPointerDownItem(e, item)}
        style={{ cursor: editMode === "furniture" ? "grab" : "default" }}
      >
        {/* Main shape with color */}
        <rect
          width={w}
          height={h}
          rx={6}
          ry={6}
          fill={style.fill}
          stroke={isSel ? "#000" : style.stroke}
          strokeWidth={isSel ? 3 : 2}
        />

        {/* Label */}
        <text
          x={w / 2}
          y={h / 2 - 4}
          fontSize={12}
          fontWeight={500}
          fill="white"
          textAnchor="middle"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
        >
          {item.label ?? item.type}
        </text>
        <text
          x={w / 2}
          y={h / 2 + 10}
          fontSize={10}
          fill="rgba(255,255,255,0.8)"
          textAnchor="middle"
        >
          {item.w}×{item.d}
        </text>

        {/* Selection UI - resize handles and rotate button */}
        {isSel && (
          <>
            {/* Corner resize handles */}
            {["nw", "ne", "sw", "se"].map((handle) => {
              const isLeft = handle.includes("w");
              const isTop = handle.includes("n");
              const cx = isLeft ? 0 : w;
              const cy = isTop ? 0 : h;
              const cursor = handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize";
              return (
                <rect
                  key={handle}
                  x={cx - 5}
                  y={cy - 5}
                  width={10}
                  height={10}
                  rx={2}
                  fill="white"
                  stroke="#000"
                  strokeWidth={1.5}
                  style={{ cursor }}
                  onPointerDown={(e) => onPointerDownResize(e, item, handle)}
                />
              );
            })}

            {/* Edge resize handles */}
            {["n", "s", "e", "w"].map((handle) => {
              let cx = w / 2, cy = h / 2;
              let cursor = "ns-resize";
              if (handle === "n") { cy = 0; }
              if (handle === "s") { cy = h; }
              if (handle === "e") { cx = w; cursor = "ew-resize"; }
              if (handle === "w") { cx = 0; cursor = "ew-resize"; }
              return (
                <rect
                  key={handle}
                  x={cx - 4}
                  y={cy - 4}
                  width={8}
                  height={8}
                  rx={1}
                  fill="white"
                  stroke="#000"
                  strokeWidth={1}
                  style={{ cursor }}
                  onPointerDown={(e) => onPointerDownResize(e, item, handle)}
                />
              );
            })}

          </>
        )}
      </g>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="rounded-2xl border bg-white p-5 shadow-sm select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerDown={onCanvasClick}
    >
      <svg width={canvasPx} height={canvasPx} className="block overflow-visible">
        <defs>
          <clipPath id="room-clip">
            <path d={roomPath} />
          </clipPath>
        </defs>

        <g transform="translate(20,20)">
          {/* grid */}
          <g opacity={0.2} clipPath="url(#room-clip)">
            {gridLines.map((ln, i) => (
              <line
                key={i}
                x1={ln.x1}
                y1={ln.y1}
                x2={ln.x2}
                y2={ln.y2}
                stroke="#94a3b8"
                strokeWidth={1}
              />
            ))}
          </g>

          {/* room boundary */}
          <path
            d={roomPath}
            fill="#f8fafc"
            stroke="#334155"
            strokeWidth={2}
          />

          {/* Edge click targets for adding vertices (rendered first, below openings) */}
          {editMode === "shape" && room.shape.type === "polygon" && (
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
          )}

          {/* Wall openings (doors/windows) - rendered on top of edge targets */}
          {openings.map((opening) => renderOpening(opening))}

          {/* Furniture items */}
          {items.map((it) => renderFurnitureItem(it))}

          {/* Vertex handles */}
          {editMode === "shape" && room.shape.type === "polygon" && (
            <g>
              {vertices.map((v) => {
                const isSelected = v.id === selectedVertexId;
                return (
                  <circle
                    key={v.id}
                    cx={roomToPx(v.x)}
                    cy={roomToPx(v.y)}
                    r={isSelected ? 10 : 8}
                    fill={isSelected ? "#3b82f6" : "#6b7280"}
                    stroke="white"
                    strokeWidth={2}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => onPointerDownVertex(e, v)}
                  />
                );
              })}
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
