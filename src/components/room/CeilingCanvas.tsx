"use client";

import { useMemo, useRef, useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import type { CeilingItem } from "@/types/room";
import { getBoundingBox, shapeToSvgPath } from "@/lib/geometry/polygon";

type DragState =
  | { type: "none" }
  | { type: "drag"; id: string; startPx: { x: number; y: number }; startRoom: { x: number; y: number } };

export default function CeilingCanvas() {
  const {
    room,
    ceilingItems,
    selectedCeilingItemId,
    gridSize,
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

  function onPointerDownItem(e: React.PointerEvent, item: CeilingItem) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    selectCeilingItem(item.id);

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

  function onPointerMove(e: React.PointerEvent) {
    if (drag.type === "none") return;

    const bounds = wrapRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const px = { x: e.clientX - bounds.left - 20, y: e.clientY - bounds.top - 20 };

    if (drag.type === "drag") {
      const dxRoom = pxToRoom(px.x - drag.startPx.x);
      const dyRoom = pxToRoom(px.y - drag.startPx.y);
      moveCeilingItem(drag.id, drag.startRoom.x + dxRoom, drag.startRoom.y + dyRoom);
    }
  }

  function onPointerUp() {
    if (drag.type !== "none") setDrag({ type: "none" });
  }

  function onCanvasClick() {
    selectCeilingItem(null);
  }

  function renderCeilingItem(item: CeilingItem) {
    const isSelected = item.id === selectedCeilingItemId;
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
        onPointerDown={(e) => onPointerDownItem(e, item)}
        style={{ cursor: "grab" }}
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
          <clipPath id="ceiling-clip">
            <path d={roomPath} />
          </clipPath>
        </defs>

        <g transform="translate(20,20)">
          {/* Grid */}
          <g opacity={0.15} clipPath="url(#ceiling-clip)">
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

          {/* Room boundary (ceiling outline) */}
          <path
            d={roomPath}
            fill="#fafbfc"
            stroke="#64748b"
            strokeWidth={2}
            strokeDasharray="8 4"
          />

          {/* Ceiling items */}
          {ceilingItems.map((item) => renderCeilingItem(item))}
        </g>
      </svg>
    </div>
  );
}
