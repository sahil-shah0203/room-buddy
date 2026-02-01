"use client";

import { useMemo } from "react";
import { useRoomStore } from "@/store/roomStore";
import type { FloorType, FurnitureType, CeilingItemType } from "@/types/room";
import {
  getVariantsForType,
  getCeilingVariantsForType,
  type VariantInfo,
} from "@/lib/furniture/variants";

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

interface PropertiesPanelProps {
  compact?: boolean;
}

// Variant selector component
function VariantSelector({
  variants,
  currentVariant,
  onChange,
}: {
  variants: VariantInfo[];
  currentVariant: string;
  onChange: (variant: string) => void;
}) {
  if (variants.length <= 1) return null;

  return (
    <div>
      <label className="text-xs opacity-70">Style Variant</label>
      <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
        {variants.map((variant) => {
          const isSelected = variant.id === currentVariant;
          return (
            <button
              key={variant.id}
              onClick={() => onChange(variant.id)}
              className={`flex-shrink-0 rounded-lg border-2 px-3 py-2 text-left transition-all ${
                isSelected
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
              title={variant.description}
            >
              <div className={`text-xs font-medium ${isSelected ? "text-blue-700" : "text-gray-700"}`}>
                {variant.label}
              </div>
              <div className="text-xs text-gray-500 truncate max-w-20">
                {variant.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PropertiesPanel({ compact = false }: PropertiesPanelProps) {
  const {
    items,
    openings,
    ceilingItems,
    selectedItemId,
    selectedOpeningId,
    selectedCeilingItemId,
    editMode,
    rotateItem,
    resizeItem,
    setItemColor,
    setItemVariant,
    setCeilingItemVariant,
    updateOpening,
    updateCeilingItem,
    toggleCeilingLight,
    removeCeilingItem,
    appearance,
    setWallColor,
    setFloorType,
    setFloorColor,
    setCeilingColor,
  } = useRoomStore();

  const selected = useMemo(() => items.find((i) => i.id === selectedItemId) ?? null, [items, selectedItemId]);
  const selectedOpening = useMemo(() => openings.find((o) => o.id === selectedOpeningId) ?? null, [openings, selectedOpeningId]);
  const selectedCeilingItem = useMemo(() => ceilingItems.find((c) => c.id === selectedCeilingItemId) ?? null, [ceilingItems, selectedCeilingItemId]);

  return (
    <div className={compact ? "space-y-3" : "rounded-2xl border bg-white p-4 shadow-sm space-y-4"}>
      {/* Selected item properties */}
      {selected ? (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">Selected Furniture</div>
          <div>
            <div className="text-sm font-medium">{selected.label ?? selected.type}</div>
            <div className="text-xs opacity-60">Rotation: {selected.rotation}°</div>
          </div>

          {/* Variant selector */}
          <VariantSelector
            variants={getVariantsForType(selected.type as FurnitureType)}
            currentVariant={selected.variant || "default"}
            onChange={(variant) => setItemVariant(selected.id, variant)}
          />

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
      ) : selectedCeilingItem ? (
        /* Selected ceiling item properties */
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">
            Selected {selectedCeilingItem.type === "ceilingFan" ? "Ceiling Fan" : "Ceiling Light"}
          </div>

          {/* Variant selector */}
          <VariantSelector
            variants={getCeilingVariantsForType(selectedCeilingItem.type as CeilingItemType)}
            currentVariant={selectedCeilingItem.variant || "default"}
            onChange={(variant) => setCeilingItemVariant(selectedCeilingItem.id, variant)}
          />

          <div>
            <label className="text-xs opacity-70">Size (diameter)</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              type="number"
              step="0.5"
              min="0.5"
              max="8"
              value={selectedCeilingItem.size}
              onChange={(e) => updateCeilingItem(selectedCeilingItem.id, { size: Number(e.target.value) })}
            />
          </div>

          {/* Light controls only for ceiling lights, not fans */}
          {selectedCeilingItem.type === "ceilingLight" && (
            <>
              <div>
                <label className="text-xs opacity-70">Light Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-12 cursor-pointer rounded border"
                    value={selectedCeilingItem.lightColor}
                    onChange={(e) => updateCeilingItem(selectedCeilingItem.id, { lightColor: e.target.value })}
                  />
                  <span className="text-xs text-gray-500">{selectedCeilingItem.lightColor}</span>
                </div>
              </div>

              <div>
                <label className="text-xs opacity-70">Light Intensity ({Math.round(selectedCeilingItem.lightIntensity * 100)}%)</label>
                <input
                  className="mt-1 w-full"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedCeilingItem.lightIntensity}
                  onChange={(e) => updateCeilingItem(selectedCeilingItem.id, { lightIntensity: Number(e.target.value) })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs opacity-70">Light</label>
                <button
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium ${
                    selectedCeilingItem.isOn
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                  onClick={() => toggleCeilingLight(selectedCeilingItem.id)}
                >
                  {selectedCeilingItem.isOn ? "On" : "Off"}
                </button>
              </div>
            </>
          )}

          <button
            className="w-full rounded-xl border border-red-300 px-3 py-2 text-red-600"
            onClick={() => removeCeilingItem(selectedCeilingItem.id)}
          >
            Delete
          </button>
        </div>
      ) : (
        <div className="text-sm opacity-70">
          Select an item to edit its properties.
        </div>
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
