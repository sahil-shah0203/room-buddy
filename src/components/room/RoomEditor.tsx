"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import RoomCanvas from "./RoomCanvas";
import Toolbar from "./Toolbar";
import PropertiesPanel from "./PropertiesPanel";
import ChatPanel from "@/components/ai/ChatPanel";
import SuggestionsTray from "@/components/ai/SuggestionsTray";
import { useRoomStore } from "@/store/roomStore";
import { isTypingInInput } from "@/lib/ui/keyboard";

// Dynamic import for 3D view to avoid SSR issues with Three.js
const Room3DView = dynamic(() => import("./Room3DView"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border bg-gray-100 shadow-sm flex items-center justify-center" style={{ height: 640 }}>
      <div className="text-gray-500">Loading 3D view...</div>
    </div>
  ),
});

type ViewMode = "2d" | "3d";

export default function RoomEditor() {
  const [viewMode, setViewMode] = useState<ViewMode>("2d");

  // ---- Stable Zustand selectors (NO object literals) ----
  const selectedItemId = useRoomStore((s) => s.selectedItemId);
  const removeSelected = useRoomStore((s) => s.removeSelected);
  const rotateItem = useRoomStore((s) => s.rotateItem);
  const moveItem = useRoomStore((s) => s.moveItem);
  const items = useRoomStore((s) => s.items);
  const gridSize = useRoomStore((s) => s.gridSize);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingInInput(e.target)) return;
      if (!selectedItemId) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
        return;
      }

      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        rotateItem(selectedItemId);
        return;
      }

      const it = items.find((x) => x.id === selectedItemId);
      if (!it) return;

      const step = gridSize;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveItem(it.id, it.x - step, it.y, { snap: true });
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        moveItem(it.id, it.x + step, it.y, { snap: true });
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveItem(it.id, it.x, it.y - step, { snap: true });
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveItem(it.id, it.x, it.y + step, { snap: true });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedItemId, removeSelected, rotateItem, moveItem, items, gridSize]);

  // ---- Layout ----
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <Toolbar />

        {/* View mode toggle */}
        <div className="flex gap-2">
          <button
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === "2d"
                ? "bg-gray-900 text-white"
                : "border bg-white text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setViewMode("2d")}
          >
            2D View
          </button>
          <button
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === "3d"
                ? "bg-gray-900 text-white"
                : "border bg-white text-gray-700 hover:bg-gray-50"
            }`}
            onClick={() => setViewMode("3d")}
          >
            3D View
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
          {viewMode === "2d" ? <RoomCanvas /> : <Room3DView />}
          <PropertiesPanel />
        </div>
      </div>

      <div className="space-y-4">
        <SuggestionsTray />
        <ChatPanel />
      </div>
    </div>
  );
}
