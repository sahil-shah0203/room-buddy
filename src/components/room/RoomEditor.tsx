"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import RoomCanvas from "./RoomCanvas";
import Toolbar from "./Toolbar";
import PropertiesPanel from "./PropertiesPanel";
import ChatPanel from "@/components/ai/ChatPanel";
import SuggestionsTray from "@/components/ai/SuggestionsTray";
import RoomSetupModal from "./RoomSetupModal";
import { useRoomStore } from "@/store/roomStore";
import { isTypingInInput } from "@/lib/ui/keyboard";

// Dynamic import for 3D view to avoid SSR issues with Three.js
const Room3DView = dynamic(() => import("./Room3DView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900/50 flex items-center justify-center rounded-2xl">
      <div className="text-gray-400">Loading 3D view...</div>
    </div>
  ),
});

type ViewMode = "design" | "3d";
type EditMode = "furniture" | "ceiling";

export default function RoomEditor() {
  const [viewMode, setViewMode] = useState<ViewMode>("design");
  const [editMode, setEditMode] = useState<EditMode>("furniture");
  const [toolbarExpanded, setToolbarExpanded] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);

  // ---- Stable Zustand selectors ----
  const selectedItemId = useRoomStore((s) => s.selectedItemId);
  const selectedCeilingItemId = useRoomStore((s) => s.selectedCeilingItemId);
  const removeSelected = useRoomStore((s) => s.removeSelected);
  const rotateItem = useRoomStore((s) => s.rotateItem);
  const moveItem = useRoomStore((s) => s.moveItem);
  const moveCeilingItem = useRoomStore((s) => s.moveCeilingItem);
  const removeCeilingItem = useRoomStore((s) => s.removeCeilingItem);
  const items = useRoomStore((s) => s.items);
  const ceilingItems = useRoomStore((s) => s.ceilingItems);
  const gridSize = useRoomStore((s) => s.gridSize);
  const setStoreEditMode = useRoomStore((s) => s.setEditMode);

  // Sync local edit mode with store
  useEffect(() => {
    setStoreEditMode(editMode);
  }, [editMode, setStoreEditMode]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingInInput(e.target)) return;

      if (selectedItemId && editMode === "furniture") {
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
        if (e.key === "ArrowLeft") { e.preventDefault(); moveItem(it.id, it.x - step, it.y, { snap: true }); }
        if (e.key === "ArrowRight") { e.preventDefault(); moveItem(it.id, it.x + step, it.y, { snap: true }); }
        if (e.key === "ArrowUp") { e.preventDefault(); moveItem(it.id, it.x, it.y - step, { snap: true }); }
        if (e.key === "ArrowDown") { e.preventDefault(); moveItem(it.id, it.x, it.y + step, { snap: true }); }
      }

      if (selectedCeilingItemId && editMode === "ceiling") {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          removeCeilingItem(selectedCeilingItemId);
          return;
        }
        const ci = ceilingItems.find((x) => x.id === selectedCeilingItemId);
        if (!ci) return;
        const step = gridSize;
        if (e.key === "ArrowLeft") { e.preventDefault(); moveCeilingItem(ci.id, ci.x - step, ci.y); }
        if (e.key === "ArrowRight") { e.preventDefault(); moveCeilingItem(ci.id, ci.x + step, ci.y); }
        if (e.key === "ArrowUp") { e.preventDefault(); moveCeilingItem(ci.id, ci.x, ci.y - step); }
        if (e.key === "ArrowDown") { e.preventDefault(); moveCeilingItem(ci.id, ci.x, ci.y + step); }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedItemId, selectedCeilingItemId, editMode, removeSelected, rotateItem, moveItem, moveCeilingItem, removeCeilingItem, items, ceilingItems, gridSize]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="h-12 bg-gray-900 text-white px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold">Room Buddy</h1>

          {/* View toggle: Design | 3D View */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              className={`px-4 py-1 text-sm font-medium rounded-md transition-all ${
                viewMode === "design" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
              }`}
              onClick={() => setViewMode("design")}
            >
              Design
            </button>
            <button
              className={`px-4 py-1 text-sm font-medium rounded-md transition-all ${
                viewMode === "3d" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
              }`}
              onClick={() => setViewMode("3d")}
            >
              3D View
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowSetupModal(true)}
          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Room Setup
        </button>
      </header>

      {/* Main content: Left toolbar | Workspace | Properties | Chat */}
      <div className="flex-1 flex min-h-0">
        {/* Left toolbar - expandable */}
        <aside className={`bg-gray-800 flex flex-col shrink-0 transition-all duration-200 ${toolbarExpanded ? "w-44" : "w-14"}`}>
          <button
            onClick={() => setToolbarExpanded(!toolbarExpanded)}
            className="h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 border-b border-gray-700"
          >
            <svg className={`w-4 h-4 transition-transform ${toolbarExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
          <div className="flex-1 overflow-y-auto py-2">
            <Toolbar expanded={toolbarExpanded} editMode={editMode} setEditMode={setEditMode} />
          </div>
        </aside>

        {/* Workspace - takes remaining space */}
        <div className="flex-1 bg-gray-200 overflow-auto p-4 min-w-0">
          <div className="h-full flex items-center justify-center">
            {viewMode === "design" ? <RoomCanvas /> : <Room3DView />}
          </div>
        </div>

        {/* Properties panel - vertical on right */}
        <aside className="w-96 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-medium text-gray-700">Properties</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <PropertiesPanel compact />
          </div>
        </aside>

        {/* AI panel - Suggestions + Chat vertical split */}
        <aside className="w-96 bg-gray-50 border-l border-gray-200 flex flex-col shrink-0 overflow-hidden">
          {/* AI Suggestions - top half */}
          <div className="flex-1 flex flex-col overflow-hidden border-b border-gray-200">
            <div className="p-3 border-b border-gray-100 bg-white">
              <span className="text-sm font-medium text-gray-700">AI Suggestions</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <SuggestionsTray compact />
            </div>
          </div>
          {/* Chat - bottom half */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-white">
              <span className="text-sm font-medium text-gray-700">AI Chat</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatPanel compact />
            </div>
          </div>
        </aside>
      </div>

      {/* Room Setup Modal */}
      {showSetupModal && <RoomSetupModal onClose={() => setShowSetupModal(false)} />}
    </div>
  );
}
