"use client";

import { useRoomStore } from "@/store/roomStore";
import { getRoomDimensions } from "@/lib/geometry/collision";

export default function Toolbar() {
  const {
    room,
    gridSize,
    editMode,
    selectedVertexId,
    setRoom,
    setGridSize,
    addItem,
    removeSelected,
    setEditMode,
    applyPresetShape,
    convertToPolygon,
    removeVertex,
  } = useRoomStore();

  const dims = getRoomDimensions(room);
  const isRectangle = room.shape.type === "rectangle";

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
            {room.shape.type === "rectangle" ? (
              <span className="text-sm text-gray-500">
                {room.shape.width} × {room.shape.depth} {room.unit}
              </span>
            ) : (
              <span className="text-sm text-gray-500">
                {dims.width.toFixed(1)} × {dims.depth.toFixed(1)} {room.unit}
              </span>
            )}

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
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-medium text-gray-700">Presets:</div>
          <button
            className={`rounded-xl border px-3 py-2 ${isRectangle ? "bg-gray-100" : ""}`}
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

          {isRectangle && (
            <button
              className="rounded-xl border px-3 py-2"
              onClick={convertToPolygon}
            >
              Custom Shape
            </button>
          )}

          {!isRectangle && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {room.shape.vertices.length} vertices
              </span>
              {selectedVertexId && room.shape.vertices.length > 3 && (
                <button
                  className="rounded-xl border border-red-300 px-3 py-2 text-red-600"
                  onClick={() => removeVertex(selectedVertexId)}
                >
                  Delete Vertex
                </button>
              )}
              <span className="text-xs text-gray-400">
                Click on edges to add vertices
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
