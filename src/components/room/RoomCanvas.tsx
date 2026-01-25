"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import type { Item } from "@/types/room";
import { rectsOverlap } from "@/lib/geometry/collision";

type DragState =
  | { type: "none" }
  | { type: "drag"; id: string; startPx: { x: number; y: number }; startRoom: { x: number; y: number } };

function isCollision(items: Item[], idx: number): boolean {
  const a = items[idx];
  if (!a) return false;
  for (let j = 0; j < items.length; j++) {
    if (j === idx) continue;
    if (rectsOverlap(a, items[j])) return true;
  }
  return false;
}

export default function RoomCanvas() {
  // ---- Stable selectors (avoid getServerSnapshot loops) ----
  const room = useRoomStore((s) => s.room);
  const items = useRoomStore((s) => s.items);
  const previewItems = useRoomStore((s) => s.previewItems);
  const selectedItemId = useRoomStore((s) => s.selectedItemId);
  const gridSize = useRoomStore((s) => s.gridSize);

  const selectItem = useRoomStore((s) => s.selectItem);
  const moveItem = useRoomStore((s) => s.moveItem);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>({ type: "none" });

  // canvas pixel size (responsive-ish)
  const canvasPx = 640;

  // scale: room-units -> px
  const scale = useMemo(() => {
    const maxDim = Math.max(room.width, room.depth);
    return (canvasPx - 40) / maxDim; // padding
  }, [room.width, room.depth]);

  function roomToPx(v: number) {
    return v * scale;
  }
  function pxToRoom(v: number) {
    return v / scale;
  }

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let x = 0; x <= room.width; x += gridSize) {
      lines.push({ x1: roomToPx(x), y1: 0, x2: roomToPx(x), y2: roomToPx(room.depth) });
    }
    for (let y = 0; y <= room.depth; y += gridSize) {
      lines.push({ x1: 0, y1: roomToPx(y), x2: roomToPx(room.width), y2: roomToPx(y) });
    }
    return lines;
  }, [room.width, room.depth, gridSize, scale]);

  // Preview collision map (only for preview layer)
  const previewCollision = useMemo(() => {
    if (!previewItems || previewItems.length === 0) return null;
    return previewItems.map((_, idx) => isCollision(previewItems, idx));
  }, [previewItems]);

  function onPointerDownItem(e: React.PointerEvent, item: Item) {
    e.stopPropagation();
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);

    selectItem(item.id);

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 20, y: e.clientY - bounds.top - 20 }; // padding
    setDrag({
      type: "drag",
      id: item.id,
      startPx: px,
      startRoom: { x: item.x, y: item.y },
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (drag.type !== "drag") return;
    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 20, y: e.clientY - bounds.top - 20 };
    const dxRoom = pxToRoom(px.x - drag.startPx.x);
    const dyRoom = pxToRoom(px.y - drag.startPx.y);

    moveItem(drag.id, drag.startRoom.x + dxRoom, drag.startRoom.y + dyRoom, { snap: true });
  }

  function onPointerUp() {
    if (drag.type !== "none") setDrag({ type: "none" });
  }

  function onPointerDownCanvas() {
    selectItem(null);
  }

  return (
    <div
      ref={wrapRef}
      className="rounded-2xl border bg-white p-5 shadow-sm select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerDown={onPointerDownCanvas}
    >
      <svg width={canvasPx} height={canvasPx} className="block">
        {/* translate to add padding */}
        <g transform="translate(20,20)">
          {/* grid */}
          <g opacity={0.25}>
            {gridLines.map((ln, i) => (
              <line
                key={i}
                x1={ln.x1}
                y1={ln.y1}
                x2={ln.x2}
                y2={ln.y2}
                stroke="currentColor"
                strokeWidth={1}
              />
            ))}
          </g>

          {/* room boundary */}
          <rect
            x={0}
            y={0}
            width={roomToPx(room.width)}
            height={roomToPx(room.depth)}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={2}
          />

          {/* --- GHOST PREVIEW LAYER --- */}
          {previewItems && previewItems.length > 0 && (
            <g>
              {previewItems.map((it, i) => {
                const collides = previewCollision ? previewCollision[i] : false;

                // Styling strategy:
                // - Keep "currentColor" but change opacity & dash.
                // - If collision: use red-ish stroke/fill for clarity.
                const stroke = collides ? "#dc2626" : "currentColor"; // tailwind red-600
                const fill = collides ? "#dc2626" : "currentColor";

                return (
                  <g
                    key={it.id}
                    transform={`translate(${roomToPx(it.x)},${roomToPx(it.y)})`}
                    style={{ pointerEvents: "none" }}
                  >
                    <rect
                      width={roomToPx(it.w)}
                      height={roomToPx(it.d)}
                      rx={10}
                      ry={10}
                      fill={fill}
                      opacity={collides ? 0.12 : 0.08}
                      stroke={stroke}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                    />
                    <text x={10} y={22} fontSize={14} fill={stroke} opacity={0.9}>
                      {it.label ?? it.type}
                    </text>
                    <text x={10} y={42} fontSize={12} fill={stroke} opacity={0.65}>
                      {it.w}×{it.d} {room.unit} (preview)
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* --- REAL ITEMS (interactive) --- */}
          {items.map((it) => {
            const isSel = it.id === selectedItemId;
            return (
              <g
                key={it.id}
                transform={`translate(${roomToPx(it.x)},${roomToPx(it.y)})`}
                onPointerDown={(e) => onPointerDownItem(e, it)}
                style={{ cursor: "grab" }}
              >
                <rect
                  width={roomToPx(it.w)}
                  height={roomToPx(it.d)}
                  rx={10}
                  ry={10}
                  fill="currentColor"
                  opacity={isSel ? 0.18 : 0.10}
                  stroke="currentColor"
                  strokeWidth={isSel ? 3 : 1.5}
                />
                <text x={10} y={22} fontSize={14} fill="currentColor" opacity={0.9}>
                  {it.label ?? it.type}
                </text>
                <text x={10} y={42} fontSize={12} fill="currentColor" opacity={0.65}>
                  {it.w}×{it.d} {room.unit}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
