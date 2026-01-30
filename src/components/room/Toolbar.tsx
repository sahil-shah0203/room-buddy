"use client";

import { useRoomStore } from "@/store/roomStore";

interface ToolbarProps {
  expanded: boolean;
  editMode: "furniture" | "ceiling";
  setEditMode: (mode: "furniture" | "ceiling") => void;
}

export default function Toolbar({ expanded, editMode, setEditMode }: ToolbarProps) {
  const {
    selectedItemId,
    selectedCeilingItemId,
    addItem,
    removeSelected,
    addCeilingItem,
    removeCeilingItem,
  } = useRoomStore();

  const furnitureItems = [
    { type: "sofa", label: "Sofa", icon: "M4 18V6a2 2 0 012-2h12a2 2 0 012 2v12M4 18h16M4 18v2M20 18v2M8 10h8" },
    { type: "bed", label: "Bed", icon: "M3 12V6a2 2 0 012-2h14a2 2 0 012 2v6M3 12h18M3 12v6h18v-6M7 16v2m10-2v2" },
    { type: "desk", label: "Desk", icon: "M4 6h16M4 6v12M20 6v12M8 6v4m8-4v4M4 14h16" },
    { type: "chair", label: "Chair", icon: "M7 18v-6a2 2 0 012-2h6a2 2 0 012 2v6M5 18h14M9 10V6h6v4" },
    { type: "table", label: "Table", icon: "M4 8h16M6 8v10M18 8v10M4 14h16" },
    { type: "rug", label: "Rug", icon: "M4 6h16v12H4zM7 9h10M7 12h10M7 15h10" },
    { type: "dresser", label: "Dresser", icon: "M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM4 9h16M4 14h16M10 6v2M14 6v2M10 11v2M14 11v2M10 16v2M14 16v2" },
    { type: "tvStand", label: "TV Stand", icon: "M4 16h16M6 16V6h12v10M8 12h8M8 8h8" },
  ];

  const ceilingItems = [
    { type: "ceilingLight", label: "Light", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
    { type: "ceilingFan", label: "Fan", icon: "M12 12m-3 0a3 3 0 106 0 3 3 0 00-6 0M12 3v3M12 18v3M3 12h3M18 12h3M5.636 5.636l2.122 2.122M16.243 16.243l2.121 2.121M5.636 18.364l2.122-2.122M16.243 7.757l2.121-2.121" },
  ];

  return (
    <div className="flex flex-col gap-1 px-2">
      {/* Mode toggle */}
      <div className="flex flex-col gap-1 mb-3">
        <button
          onClick={() => setEditMode("furniture")}
          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
            editMode === "furniture"
              ? "bg-blue-500 text-white"
              : "text-gray-400 hover:bg-gray-700 hover:text-white"
          }`}
          title="Furniture Mode"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          {expanded && <span className="text-sm font-medium">Furniture</span>}
        </button>
        <button
          onClick={() => setEditMode("ceiling")}
          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
            editMode === "ceiling"
              ? "bg-blue-500 text-white"
              : "text-gray-400 hover:bg-gray-700 hover:text-white"
          }`}
          title="Ceiling Mode"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          {expanded && <span className="text-sm font-medium">Ceiling</span>}
        </button>
      </div>

      <div className="w-full h-px bg-gray-600 mb-3" />

      {/* Context-sensitive items */}
      {editMode === "furniture" ? (
        <div className="flex flex-col gap-1">
          {expanded && <div className="text-xs text-gray-500 px-2 mb-1">Add Furniture</div>}
          {furnitureItems.map((item) => (
            <button
              key={item.type}
              onClick={() => addItem(item.type as any)}
              className="flex items-center gap-3 p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              title={item.label}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              {expanded && <span className="text-sm">{item.label}</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {expanded && <div className="text-xs text-gray-500 px-2 mb-1">Add Ceiling Item</div>}
          {ceilingItems.map((item) => (
            <button
              key={item.type}
              onClick={() => addCeilingItem(item.type as any)}
              className="flex items-center gap-3 p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              title={item.label}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              {expanded && <span className="text-sm">{item.label}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* Delete button */}
      <button
        onClick={() => {
          if (editMode === "furniture" && selectedItemId) removeSelected();
          else if (editMode === "ceiling" && selectedCeilingItemId) removeCeilingItem(selectedCeilingItemId);
        }}
        className="flex items-center gap-3 p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors mt-4"
        title="Delete Selected"
      >
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        {expanded && <span className="text-sm">Delete</span>}
      </button>
    </div>
  );
}
