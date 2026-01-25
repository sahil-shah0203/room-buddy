"use client";

import { useEffect } from "react";
import RoomCanvas from "./RoomCanvas";
import Toolbar from "./Toolbar";
import PropertiesPanel from "./PropertiesPanel";
import ChatPanel from "@/components/ai/ChatPanel";
import SuggestionsTray from "@/components/ai/SuggestionsTray";
import { useRoomStore } from "@/store/roomStore";
import { isTypingInInput } from "@/lib/ui/keyboard";

export default function RoomEditor() {
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

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
          <RoomCanvas />
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
