"use client";

import { useEffect, useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import { derivePreviewItems } from "@/lib/ai/preview";

interface SuggestionsTrayProps {
  compact?: boolean;
}

export default function SuggestionsTray({ compact = false }: SuggestionsTrayProps) {
  // ---- Zustand selectors (no object literals) ----
  const aiPlan = useRoomStore((s) => s.aiPlan);
  const applyPlan = useRoomStore((s) => s.applyPlan);
  const setPreviewItems = useRoomStore((s) => s.setPreviewItems);

  const room = useRoomStore((s) => s.room);
  const items = useRoomStore((s) => s.items);

  const [error, setError] = useState<string | null>(null);

  // ---- When a new AI plan arrives, derive ghost preview ----
  useEffect(() => {
    if (!aiPlan) {
      setPreviewItems(null);
      return;
    }

    try {
      const preview = derivePreviewItems(
        { room, items } as any,
        aiPlan
      );
      setPreviewItems(preview);
      setError(null);
    } catch (e: any) {
      setError("Could not generate preview.");
      setPreviewItems(null);
    }
  }, [aiPlan, room, items, setPreviewItems]);

  // ---- Apply plan (commit) ----
  function onApply() {
    if (!aiPlan) return;

    const res = applyPlan(aiPlan);
    if (!res.ok) {
      setError(res.reason);
      return;
    }

    // Clear preview + plan after successful apply
    setPreviewItems(null);
    useRoomStore.getState().setAiPlan(null);
    setError(null);
  }

  return (
    <div className={compact ? "space-y-2" : "rounded-2xl border bg-white p-4 shadow-sm space-y-3"}>
      <div className="text-sm font-medium">AI Suggestions</div>

      {!aiPlan ? (
        <div className="text-sm opacity-70">
          No suggestions yet. Ask the AI to design your room.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm">{aiPlan.summary}</div>
          <div className="text-xs opacity-70">
            {aiPlan.actions.length} proposed changes
          </div>

          <button
            className="w-full rounded-xl border px-3 py-2 text-sm"
            onClick={onApply}
          >
            Apply changes
          </button>

          {error && (
            <div className="text-xs text-red-600">{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
