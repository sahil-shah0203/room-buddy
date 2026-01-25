"use client";

import { useRoomStore } from "@/store/roomStore";

export default function Toolbar() {
  const { room, gridSize, setRoom, setGridSize, addItem, removeSelected } = useRoomStore();

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs opacity-70">Width ({room.unit})</label>
          <input
            className="mt-1 w-28 rounded-lg border px-3 py-2"
            type="number"
            value={room.width}
            onChange={(e) => setRoom(Number(e.target.value), room.depth)}
          />
        </div>

        <div>
          <label className="text-xs opacity-70">Depth ({room.unit})</label>
          <input
            className="mt-1 w-28 rounded-lg border px-3 py-2"
            type="number"
            value={room.depth}
            onChange={(e) => setRoom(room.width, Number(e.target.value))}
          />
        </div>

        <div>
          <label className="text-xs opacity-70">Grid</label>
          <input
            className="mt-1 w-28 rounded-lg border px-3 py-2"
            type="number"
            step="0.1"
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value))}
          />
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <button className="rounded-xl border px-3 py-2" onClick={() => addItem("sofa")}>+ Sofa</button>
          <button className="rounded-xl border px-3 py-2" onClick={() => addItem("bed")}>+ Bed</button>
          <button className="rounded-xl border px-3 py-2" onClick={() => addItem("desk")}>+ Desk</button>
          <button className="rounded-xl border px-3 py-2" onClick={removeSelected}>Delete Selected</button>
        </div>
      </div>
    </div>
  );
}
