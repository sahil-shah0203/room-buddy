"use client";

import { useMemo, useRef, useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import type { Item, Vertex, FurnitureType } from "@/types/room";
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
  | { type: "resize"; id: string; handle: string; startPx: { x: number; y: number }; startItem: { x: number; y: number; w: number; d: number } };

export default function RoomCanvas() {
  const {
    room,
    items,
    selectedItemId,
    selectedVertexId,
    gridSize,
    editMode,
    selectItem,
    moveItem,
    resizeItem,
    selectVertex,
    moveVertex,
    addVertex,
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

  function onCanvasClick() {
    if (editMode === "furniture") {
      selectItem(null);
    } else {
      selectVertex(null);
    }
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

          {/* Edge click targets for adding vertices */}
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
