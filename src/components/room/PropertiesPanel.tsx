"use client";

import { useMemo } from "react";
import { useRoomStore } from "@/store/roomStore";

export default function PropertiesPanel() {
  const { items, selectedItemId, rotateItem, resizeItem } = useRoomStore();
  const selected = useMemo(() => items.find((i) => i.id === selectedItemId) ?? null, [items, selectedItemId]);

  if (!selected) {
    return (
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="text-sm opacity-70">Select an item to edit.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
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

      <button className="w-full rounded-xl border px-3 py-2" onClick={() => rotateItem(selected.id)}>
        Rotate 90°
      </button>

      <div className="text-xs opacity-60">
        v1 behavior: resizing/rotating that causes overlap is blocked.
      </div>
    </div>
  );
}
