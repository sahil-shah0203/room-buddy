"use client";

import { useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import { getRoomDimensions } from "@/lib/geometry/collision";

export default function Toolbar() {
  const {
    room,
    gridSize,
    editMode,
    selectedVertexId,
    selectedOpeningId,
    openings,
    setGridSize,
    addItem,
    removeSelected,
    setEditMode,
    applyPresetShape,
    removeVertex,
    addOpening,
    removeOpening,
  } = useRoomStore();

  const [selectedWall, setSelectedWall] = useState(0);

  const dims = getRoomDimensions(room);
  const vertexCount = room.shape.type === "polygon" ? room.shape.vertices.length : 4;
  const wallCount = vertexCount;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      {/* Mode toggle */}
      <div className="mb-4 flex gap-2">
        <button
          className={`rounded-xl px-4 py-2 ${
            editMode === "furniture"
              ? "bg-gray-900 text-white"
              : "border bg-white text-gray-700"
          }`}
          onClick={() => setEditMode("furniture")}
        >
          Furniture
        </button>
        <button
          className={`rounded-xl px-4 py-2 ${
            editMode === "shape"
              ? "bg-gray-900 text-white"
              : "border bg-white text-gray-700"
          }`}
          onClick={() => setEditMode("shape")}
        >
          Room Shape
        </button>
      </div>

      {editMode === "furniture" ? (
        /* Furniture mode controls */
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-medium text-gray-700">Add:</div>
          <button className="rounded-xl border px-3 py-2" onClick={() => addItem("sofa")}>Sofa</button>
          <button className="rounded-xl border px-3 py-2" onClick={() => addItem("bed")}>Bed</button>
          <button className="rounded-xl border px-3 py-2" onClick={() => addItem("desk")}>Desk</button>
          <button className="rounded-xl border px-3 py-2" onClick={() => addItem("chair")}>Chair</button>
          <button className="rounded-xl border px-3 py-2" onClick={() => addItem("table")}>Table</button>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {dims.width.toFixed(1)} × {dims.depth.toFixed(1)} {room.unit}
            </span>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Grid:</span>
              <input
                className="w-16 rounded-lg border px-2 py-1 text-sm"
                type="number"
                step="0.1"
                value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
              />
            </div>

            <button
              className="rounded-xl border border-red-300 px-3 py-2 text-red-600"
              onClick={removeSelected}
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        /* Shape mode controls */
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm font-medium text-gray-700">Presets:</div>
            <button
              className="rounded-xl border px-3 py-2"
              onClick={() => applyPresetShape("rectangle")}
            >
              Rectangle
            </button>
            <button
              className="rounded-xl border px-3 py-2"
              onClick={() => applyPresetShape("l-shape")}
            >
              L-Shape
            </button>
            <button
              className="rounded-xl border px-3 py-2"
              onClick={() => applyPresetShape("u-shape")}
            >
              U-Shape
            </button>

            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {vertexCount} vertices
              </span>
              {selectedVertexId && vertexCount > 3 && (
                <button
                  className="rounded-xl border border-red-300 px-3 py-2 text-red-600"
                  onClick={() => removeVertex(selectedVertexId)}
                >
                  Delete Vertex
                </button>
              )}
              <span className="text-xs text-gray-400">
                Click edges to add vertices
              </span>
            </div>
          </div>

          {/* Openings (windows/doors) */}
          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            <div className="text-sm font-medium text-gray-700">Openings:</div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Wall:</span>
              <select
                className="rounded-lg border px-2 py-1 text-sm"
                value={selectedWall}
                onChange={(e) => setSelectedWall(Number(e.target.value))}
              >
                {Array.from({ length: wallCount }).map((_, i) => (
                  <option key={i} value={i}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="rounded-xl border px-3 py-2"
              onClick={() => addOpening("door", selectedWall)}
            >
              + Door
            </button>
            <button
              className="rounded-xl border px-3 py-2"
              onClick={() => addOpening("window", selectedWall)}
            >
              + Window
            </button>

            {openings.length > 0 && (
              <span className="text-sm text-gray-500">
                {openings.length} opening{openings.length !== 1 ? "s" : ""}
              </span>
            )}

            {selectedOpeningId && (
              <button
                className="rounded-xl border border-red-300 px-3 py-2 text-red-600"
                onClick={() => removeOpening(selectedOpeningId)}
              >
                Delete Opening
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
