"use client";

import { useMemo } from "react";
import { useRoomStore } from "@/store/roomStore";
import type { FloorType } from "@/types/room";

// Default furniture colors (matching 3D view)
const FURNITURE_COLORS: Record<string, string> = {
  sofa: "#8b5cf6",
  bed: "#3b82f6",
  desk: "#f59e0b",
  chair: "#10b981",
  table: "#6366f1",
  rug: "#ec4899",
  dresser: "#78716c",
  tvStand: "#1f2937",
};

export default function PropertiesPanel() {
  const {
    items,
    openings,
    selectedItemId,
    selectedOpeningId,
    rotateItem,
    resizeItem,
    setItemColor,
    updateOpening,
    appearance,
    setWallColor,
    setFloorType,
    setFloorColor,
    setCeilingColor,
  } = useRoomStore();

  const selected = useMemo(() => items.find((i) => i.id === selectedItemId) ?? null, [items, selectedItemId]);
  const selectedOpening = useMemo(() => openings.find((o) => o.id === selectedOpeningId) ?? null, [openings, selectedOpeningId]);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
      {/* Selected item properties */}
      {selected ? (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">Selected Furniture</div>
          <div>
            <div className="text-sm font-medium">{selected.label ?? selected.type}</div>
            <div className="text-xs opacity-60">Rotation: {selected.rotation}°</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs opacity-70">Width</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                type="number"
                step="0.1"
                value={selected.w}
                onChange={(e) => resizeItem(selected.id, Number(e.target.value), selected.d)}
              />
            </div>
            <div>
              <label className="text-xs opacity-70">Depth</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                type="number"
                step="0.1"
                value={selected.d}
                onChange={(e) => resizeItem(selected.id, selected.w, Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs opacity-70">Color</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-12 cursor-pointer rounded border"
                value={selected.color || FURNITURE_COLORS[selected.type] || "#6366f1"}
                onChange={(e) => setItemColor(selected.id, e.target.value)}
              />
              <span className="text-xs text-gray-500">
                {selected.color || FURNITURE_COLORS[selected.type] || "#6366f1"}
              </span>
            </div>
          </div>

          <button className="w-full rounded-xl border px-3 py-2" onClick={() => rotateItem(selected.id)}>
            Rotate 90°
          </button>
        </div>
      ) : selectedOpening ? (
        /* Selected opening properties */
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">
            Selected {selectedOpening.type === "door" ? "Door" : "Window"}
          </div>
          <div className="text-xs opacity-60">Wall {selectedOpening.wallIndex + 1}</div>

          <div>
            <label className="text-xs opacity-70">Width (along wall)</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              type="number"
              step="0.5"
              min="1"
              value={selectedOpening.width}
              onChange={(e) => updateOpening(selectedOpening.id, { width: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="text-xs opacity-70">Height (3D only)</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              type="number"
              step="0.5"
              min="1"
              value={selectedOpening.height}
              onChange={(e) => updateOpening(selectedOpening.id, { height: Number(e.target.value) })}
            />
          </div>

          {selectedOpening.type === "window" && (
            <div>
              <label className="text-xs opacity-70">Height from floor (3D only)</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                type="number"
                step="0.5"
                min="0"
                value={selectedOpening.fromFloor}
                onChange={(e) => updateOpening(selectedOpening.id, { fromFloor: Number(e.target.value) })}
              />
            </div>
          )}

          <div className="text-xs text-gray-400">
            Drag in 2D view to reposition. Drag handles to resize width.
          </div>
        </div>
      ) : (
        <div className="text-sm opacity-70">Select an item or opening to edit its properties.</div>
      )}

      {/* Room appearance settings */}
      <div className="border-t pt-4 space-y-3">
        <div className="text-sm font-semibold text-gray-700">Room Appearance</div>

        <div>
          <label className="text-xs opacity-70">Wall Color</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-12 cursor-pointer rounded border"
              value={appearance.wallColor}
              onChange={(e) => setWallColor(e.target.value)}
            />
            <span className="text-xs text-gray-500">{appearance.wallColor}</span>
          </div>
        </div>

        <div>
          <label className="text-xs opacity-70">Floor Type</label>
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={appearance.floorType}
            onChange={(e) => setFloorType(e.target.value as FloorType)}
          >
            <option value="wood">Wood</option>
            <option value="tile">Tile</option>
            <option value="carpet">Carpet</option>
          </select>
        </div>

        <div>
          <label className="text-xs opacity-70">Floor Color</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-12 cursor-pointer rounded border"
              value={appearance.floorColor}
              onChange={(e) => setFloorColor(e.target.value)}
            />
            <span className="text-xs text-gray-500">{appearance.floorColor}</span>
          </div>
        </div>

        <div>
          <label className="text-xs opacity-70">Ceiling Color</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              className="h-9 w-12 cursor-pointer rounded border"
              value={appearance.ceilingColor}
              onChange={(e) => setCeilingColor(e.target.value)}
            />
            <span className="text-xs text-gray-500">{appearance.ceilingColor}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
