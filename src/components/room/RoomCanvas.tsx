"use client";

import { useMemo, useRef, useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import type { Item, Vertex, FurnitureType, WallOpening, CeilingItem } from "@/types/room";
import { getBoundingBox, shapeToSvgPath } from "@/lib/geometry/polygon";
import { getItemBounds } from "@/lib/geometry/collision";

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
  | { type: "resize"; id: string; handle: string; startPx: { x: number; y: number }; startItem: { x: number; y: number; w: number; d: number; rotation: number } }
  | { type: "opening"; id: string; mode: "move" | "resize-left" | "resize-right"; wallIndex: number; startPx: { x: number; y: number }; startPos: number; startWidth: number }
  | { type: "ceiling"; id: string; startPx: { x: number; y: number }; startRoom: { x: number; y: number } };

export default function RoomCanvas() {
  const {
    room,
    items,
    openings,
    ceilingItems,
    selectedItemId,
    selectedVertexId,
    selectedOpeningId,
    selectedCeilingItemId,
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
    selectCeilingItem,
    moveCeilingItem,
  } = useRoomStore();

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>({ type: "none" });

  const canvasPx = 900;
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
      startItem: { x: item.x, y: item.y, w: item.w, d: item.d, rotation: item.rotation },
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

  function onPointerDownCeilingItem(e: React.PointerEvent, item: CeilingItem) {
    if (editMode !== "ceiling") return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    selectCeilingItem(item.id);

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 20, y: e.clientY - bounds.top - 20 };
    setDrag({
      type: "ceiling",
      id: item.id,
      startPx: px,
      startRoom: { x: item.x, y: item.y },
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
    } else if (drag.type === "ceiling") {
      const dxRoom = pxToRoom(px.x - drag.startPx.x);
      const dyRoom = pxToRoom(px.y - drag.startPx.y);
      moveCeilingItem(drag.id, drag.startRoom.x + dxRoom, drag.startRoom.y + dyRoom);
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

      // When rotated 90° or 270°, the visual axes are swapped:
      // - Visual width (e/w handles) corresponds to item.d
      // - Visual depth (n/s handles) corresponds to item.w
      const isRotated = drag.startItem.rotation === 90 || drag.startItem.rotation === 270;

      // Handle different resize handles, accounting for rotation
      if (drag.handle.includes("e")) {
        if (isRotated) {
          newD = Math.max(0.5, drag.startItem.d + dxRoom);
        } else {
          newW = Math.max(0.5, drag.startItem.w + dxRoom);
        }
      }
      if (drag.handle.includes("w")) {
        if (isRotated) {
          const delta = Math.min(dxRoom, drag.startItem.d - 0.5);
          newD = drag.startItem.d - delta;
          newX = drag.startItem.x + delta;
        } else {
          const delta = Math.min(dxRoom, drag.startItem.w - 0.5);
          newW = drag.startItem.w - delta;
          newX = drag.startItem.x + delta;
        }
      }
      if (drag.handle.includes("s")) {
        if (isRotated) {
          newW = Math.max(0.5, drag.startItem.w + dyRoom);
        } else {
          newD = Math.max(0.5, drag.startItem.d + dyRoom);
        }
      }
      if (drag.handle.includes("n")) {
        if (isRotated) {
          const delta = Math.min(dyRoom, drag.startItem.w - 0.5);
          newW = drag.startItem.w - delta;
          newY = drag.startItem.y + delta;
        } else {
          const delta = Math.min(dyRoom, drag.startItem.d - 0.5);
          newD = drag.startItem.d - delta;
          newY = drag.startItem.y + delta;
        }
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
    } else if (editMode === "ceiling") {
      selectCeilingItem(null);
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

  // Render furniture item with distinctive styling and rotation
  function renderFurnitureItem(item: Item) {
    const isSelected = item.id === selectedItemId && editMode === "furniture";
    const style = FURNITURE_STYLES[item.type];

    // Original dimensions (before rotation) in pixels
    const originalWidth = roomToPx(item.w);
    const originalDepth = roomToPx(item.d);

    // Bounding box dimensions (accounts for rotation) in pixels
    const bounds = getItemBounds(item);
    const boundsWidth = roomToPx(bounds.width);
    const boundsDepth = roomToPx(bounds.depth);

    // Center of the bounding box (used for rotation pivot)
    const centerX = boundsWidth / 2;
    const centerY = boundsDepth / 2;

    return (
      <g
        key={item.id}
        transform={`translate(${roomToPx(item.x)},${roomToPx(item.y)})`}
        onPointerDown={(e) => onPointerDownItem(e, item)}
        style={{ cursor: editMode === "furniture" ? "grab" : "default" }}
      >
        {/* Rotated content group - rotates around bounding box center */}
        <g transform={`translate(${centerX},${centerY}) rotate(${item.rotation}) translate(${-originalWidth / 2},${-originalDepth / 2})`}>
          {/* Main shape */}
          <rect
            width={originalWidth}
            height={originalDepth}
            rx={6}
            ry={6}
            fill={style.fill}
            stroke={isSelected ? "#000" : style.stroke}
            strokeWidth={isSelected ? 3 : 2}
          />

          {/* Direction indicator (triangle pointing "forward" / bottom of item) */}
          <polygon
            points={`${originalWidth / 2 - 6},${originalDepth - 4} ${originalWidth / 2 + 6},${originalDepth - 4} ${originalWidth / 2},${originalDepth - 12}`}
            fill="rgba(255,255,255,0.6)"
          />

          {/* Label */}
          <text
            x={originalWidth / 2}
            y={originalDepth / 2 - 4}
            fontSize={12}
            fontWeight={500}
            fill="white"
            textAnchor="middle"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
          >
            {item.label ?? item.type}
          </text>
          <text
            x={originalWidth / 2}
            y={originalDepth / 2 + 10}
            fontSize={10}
            fill="rgba(255,255,255,0.8)"
            textAnchor="middle"
          >
            {item.w}×{item.d}
          </text>
        </g>

        {/* Selection UI - resize handles stay axis-aligned on bounding box */}
        {isSelected && (
          <>
            {/* Corner resize handles */}
            {["nw", "ne", "sw", "se"].map((handle) => {
              const isLeft = handle.includes("w");
              const isTop = handle.includes("n");
              const handleX = isLeft ? 0 : boundsWidth;
              const handleY = isTop ? 0 : boundsDepth;
              const cursor = handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize";
              return (
                <rect
                  key={handle}
                  x={handleX - 5}
                  y={handleY - 5}
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
              let handleX = boundsWidth / 2;
              let handleY = boundsDepth / 2;
              let cursor = "ns-resize";
              if (handle === "n") { handleY = 0; }
              if (handle === "s") { handleY = boundsDepth; }
              if (handle === "e") { handleX = boundsWidth; cursor = "ew-resize"; }
              if (handle === "w") { handleX = 0; cursor = "ew-resize"; }
              return (
                <rect
                  key={handle}
                  x={handleX - 4}
                  y={handleY - 4}
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

  // Render ceiling item (light or fan)
  function renderCeilingItem(item: CeilingItem) {
    const isSelected = item.id === selectedCeilingItemId && editMode === "ceiling";
    const radiusPx = roomToPx(item.size / 2);
    const cx = roomToPx(item.x);
    const cy = roomToPx(item.y);

    const isFan = item.type === "ceilingFan";
    const baseColor = isFan ? "#4a5568" : "#e2e8f0";
    const iconColor = isFan ? "#718096" : item.lightColor;

    return (
      <g
        key={item.id}
        transform={`translate(${cx},${cy})`}
        onPointerDown={(e) => onPointerDownCeilingItem(e, item)}
        style={{ cursor: editMode === "ceiling" ? "grab" : "default" }}
      >
        {/* Glow effect for lights that are on (not for fans) */}
        {item.isOn && !isFan && (
          <circle
            r={radiusPx * 1.5}
            fill={item.lightColor}
            opacity={0.3}
            style={{ pointerEvents: "none" }}
          />
        )}

        {/* Selection ring */}
        {isSelected && (
          <circle
            r={radiusPx + 6}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={3}
            strokeDasharray="6 3"
          />
        )}

        {/* Main circle (fixture body) */}
        <circle
          r={radiusPx}
          fill={baseColor}
          stroke={isSelected ? "#000" : "#94a3b8"}
          strokeWidth={isSelected ? 2 : 1}
        />

        {/* Inner details */}
        {isFan ? (
          // Fan blades
          <>
            {[0, 72, 144, 216, 288].map((angle, i) => (
              <ellipse
                key={i}
                cx={0}
                cy={-radiusPx * 0.5}
                rx={radiusPx * 0.15}
                ry={radiusPx * 0.4}
                fill={iconColor}
                transform={`rotate(${angle})`}
                style={{ pointerEvents: "none" }}
              />
            ))}
            {/* Center hub */}
            <circle r={radiusPx * 0.2} fill="#2d3748" style={{ pointerEvents: "none" }} />
          </>
        ) : (
          // Light fixture
          <>
            <circle
              r={radiusPx * 0.6}
              fill={item.isOn ? item.lightColor : "#cbd5e0"}
              opacity={item.isOn ? 0.9 : 0.5}
              style={{ pointerEvents: "none" }}
            />
            {item.isOn && (
              <circle
                r={radiusPx * 0.3}
                fill="#ffffff"
                opacity={0.7}
                style={{ pointerEvents: "none" }}
              />
            )}
          </>
        )}

        {/* Label */}
        <text
          y={radiusPx + 16}
          fontSize={11}
          fontWeight={500}
          fill="#374151"
          textAnchor="middle"
          style={{ pointerEvents: "none" }}
        >
          {item.label ?? (isFan ? "Fan" : "Light")}
        </text>

        {/* On/Off indicator (only for lights, not fans) */}
        {!isFan && (
          <circle
            cx={radiusPx - 4}
            cy={-radiusPx + 4}
            r={5}
            fill={item.isOn ? "#10b981" : "#6b7280"}
            stroke="white"
            strokeWidth={1.5}
            style={{ pointerEvents: "none" }}
          />
        )}
      </g>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="select-none"
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

          {/* Furniture items - only show in furniture mode */}
          {editMode === "furniture" && items.map((it) => renderFurnitureItem(it))}

          {/* Ceiling items - only show in ceiling mode */}
          {editMode === "ceiling" && ceilingItems.map((it) => renderCeilingItem(it))}

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
