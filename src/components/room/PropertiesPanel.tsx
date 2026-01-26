"use client";

import { useMemo } from "react";
import { useRoomStore } from "@/store/roomStore";
import type { DoorSwing, Wall } from "@/types/room";

function clamp(n: number, lo: number, hi: number) {
  if (Number.isNaN(n)) return lo;
  return Math.min(Math.max(n, lo), hi);
}

export default function PropertiesPanel() {
  // Items
  const items = useRoomStore((s) => s.items);
  const selectedItemId = useRoomStore((s) => s.selectedItemId);
  const rotateItem = useRoomStore((s) => s.rotateItem);
  const resizeItem = useRoomStore((s) => s.resizeItem);

  // Room + Features
  const room = useRoomStore((s) => s.room);
  const features = useRoomStore((s) => s.features);

  const addDoor = useRoomStore((s) => s.addDoor);
  const updateDoor = useRoomStore((s) => s.updateDoor);
  const removeDoor = useRoomStore((s) => s.removeDoor);

  const addWindow = useRoomStore((s) => s.addWindow);
  const updateWindow = useRoomStore((s) => s.updateWindow);
  const removeWindow = useRoomStore((s) => s.removeWindow);

  const selected = useMemo(() => items.find((i) => i.id === selectedItemId) ?? null, [items, selectedItemId]);

  // Wall length helper (offset is measured along the wall)
  const wallLen = (wall: Wall) => (wall === "top" || wall === "bottom" ? room.width : room.depth);

  return (
    <div className="space-y-3">
      {/* Selected item editor */}
      {!selected ? (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-medium">Properties</div>
          <div className="text-sm opacity-70 mt-1">Select an item to edit.</div>
        </div>
      ) : (
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
                min={0.5}
                value={selected.w}
                onChange={(e) => resizeItem(selected.id, Math.max(0.5, Number(e.target.value)), selected.d)}
              />
            </div>
            <div>
              <label className="text-xs opacity-70">Depth</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                type="number"
                step="0.1"
                min={0.5}
                value={selected.d}
                onChange={(e) => resizeItem(selected.id, selected.w, Math.max(0.5, Number(e.target.value)))}
              />
            </div>
          </div>

          <button className="w-full rounded-xl border px-3 py-2" onClick={() => rotateItem(selected.id)}>
            Rotate 90°
          </button>

          <div className="text-xs opacity-60">v1 behavior: resizing/rotating that causes overlap is blocked.</div>
        </div>
      )}

      {/* Doors & Windows editor */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Doors & Windows</div>
            <div className="text-xs opacity-60">
              Room: {room.width}×{room.depth} {room.unit}
            </div>
          </div>
        </div>

        {/* Doors */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium opacity-80">Doors</div>
            <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => addDoor()}>
              + Add door
            </button>
          </div>

          {features.doors.length === 0 ? (
            <div className="text-xs opacity-60">No doors added.</div>
          ) : (
            <div className="space-y-2">
              {features.doors.map((d) => {
                const maxOffset = Math.max(0, wallLen(d.wall) - d.width);
                return (
                  <div key={d.id} className="rounded-xl border p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium">Door</div>
                      <button className="text-xs text-red-600" onClick={() => removeDoor(d.id)}>
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">
                        Wall
                        <select
                          className="mt-1 w-full rounded-lg border px-2 py-1 text-xs"
                          value={d.wall}
                          onChange={(e) => {
                            const wall = e.target.value as Wall;
                            const maxOff = Math.max(0, wallLen(wall) - d.width);
                            updateDoor(d.id, { wall, offset: clamp(d.offset, 0, maxOff) });
                          }}
                        >
                          <option value="top">Top</option>
                          <option value="right">Right</option>
                          <option value="bottom">Bottom</option>
                          <option value="left">Left</option>
                        </select>
                      </label>

                      <label className="text-xs">
                        Swing
                        <select
                          className="mt-1 w-full rounded-lg border px-2 py-1 text-xs"
                          value={d.swing}
                          onChange={(e) => updateDoor(d.id, { swing: e.target.value as DoorSwing })}
                        >
                          <option value="in_left">In - Left</option>
                          <option value="in_right">In - Right</option>
                          <option value="out_left">Out - Left</option>
                          <option value="out_right">Out - Right</option>
                        </select>
                      </label>

                      <label className="text-xs">
                        Width (ft)
                        <input
                          className="mt-1 w-full rounded-lg border px-2 py-1 text-xs"
                          type="number"
                          step="0.5"
                          min={1}
                          value={d.width}
                          onChange={(e) => {
                            const width = Math.max(1, Number(e.target.value));
                            const maxOff = Math.max(0, wallLen(d.wall) - width);
                            updateDoor(d.id, { width, offset: clamp(d.offset, 0, maxOff) });
                          }}
                        />
                      </label>

                      <label className="text-xs">
                        Offset (ft)
                        <input
                          className="mt-1 w-full rounded-lg border px-2 py-1 text-xs"
                          type="number"
                          step="0.5"
                          min={0}
                          max={maxOffset}
                          value={d.offset}
                          onChange={(e) => updateDoor(d.id, { offset: clamp(Number(e.target.value), 0, maxOffset) })}
                        />
                      </label>
                    </div>

                    <div className="text-[11px] opacity-60">
                      Offset is measured along the wall: top/bottom uses X (0→{room.width}), left/right uses Y (0→{room.depth})
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Windows */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium opacity-80">Windows</div>
            <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => addWindow()}>
              + Add window
            </button>
          </div>

          {features.windows.length === 0 ? (
            <div className="text-xs opacity-60">No windows added.</div>
          ) : (
            <div className="space-y-2">
              {features.windows.map((w) => {
                const maxOffset = Math.max(0, wallLen(w.wall) - w.width);
                return (
                  <div key={w.id} className="rounded-xl border p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium">Window</div>
                      <button className="text-xs text-red-600" onClick={() => removeWindow(w.id)}>
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">
                        Wall
                        <select
                          className="mt-1 w-full rounded-lg border px-2 py-1 text-xs"
                          value={w.wall}
                          onChange={(e) => {
                            const wall = e.target.value as Wall;
                            const maxOff = Math.max(0, wallLen(wall) - w.width);
                            updateWindow(w.id, { wall, offset: clamp(w.offset, 0, maxOff) });
                          }}
                        >
                          <option value="top">Top</option>
                          <option value="right">Right</option>
                          <option value="bottom">Bottom</option>
                          <option value="left">Left</option>
                        </select>
                      </label>

                      <label className="text-xs">
                        Width (ft)
                        <input
                          className="mt-1 w-full rounded-lg border px-2 py-1 text-xs"
                          type="number"
                          step="0.5"
                          min={1}
                          value={w.width}
                          onChange={(e) => {
                            const width = Math.max(1, Number(e.target.value));
                            const maxOff = Math.max(0, wallLen(w.wall) - width);
                            updateWindow(w.id, { width, offset: clamp(w.offset, 0, maxOff) });
                          }}
                        />
                      </label>

                      <label className="text-xs col-span-2">
                        Offset (ft)
                        <input
                          className="mt-1 w-full rounded-lg border px-2 py-1 text-xs"
                          type="number"
                          step="0.5"
                          min={0}
                          max={maxOffset}
                          value={w.offset}
                          onChange={(e) => updateWindow(w.id, { offset: clamp(Number(e.target.value), 0, maxOffset) })}
                        />
                      </label>
                    </div>

                    <div className="text-[11px] opacity-60">
                      Offset is measured along the wall: top/bottom uses X (0→{room.width}), left/right uses Y (0→{room.depth})
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-xs opacity-60">
          v1: doors/windows are constraints for AI recommendations; the AI does not edit them.
        </div>
      </div>
    </div>
  );
}
