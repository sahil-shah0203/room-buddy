"use client";

import { useEffect, useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import { derivePreviewItems } from "@/lib/ai/preview";

export default function SuggestionsTray() {
  const aiPlan = useRoomStore((s) => s.aiPlan);
  const applyPlan = useRoomStore((s) => s.applyPlan);
  const setAiPlan = useRoomStore((s) => s.setAiPlan);
  const setPreviewItems = useRoomStore((s) => s.setPreviewItems);

  const room = useRoomStore((s) => s.room);
  const items = useRoomStore((s) => s.items);

  const lastPlanValidation = useRoomStore((s) => s.lastPlanValidation);
  const clearLastPlanValidation = useRoomStore((s) => s.clearLastPlanValidation);

  const [error, setError] = useState<string | null>(null);

  // Build preview whenever we get a plan
  useEffect(() => {
    if (!aiPlan) {
      setPreviewItems(null);
      setError(null);
      clearLastPlanValidation();
      return;
    }

    try {
      const preview = derivePreviewItems({ room, items } as any, aiPlan);
      setPreviewItems(preview);
      setError(null);
    } catch {
      setPreviewItems(null);
      setError("Could not generate preview.");
    }
  }, [aiPlan, room, items, setPreviewItems, clearLastPlanValidation]);

  function onApply() {
    if (!aiPlan) return;

    const res = applyPlan(aiPlan);
    if (!res.ok) {
      setError(res.reason);
      return;
    }

    setError(null);
    // store.applyPlan clears aiPlan + previewItems (perfect)
  }

  function onDismiss() {
    setAiPlan(null);
    setPreviewItems(null);
    setError(null);
    clearLastPlanValidation();
  }

  const issues = lastPlanValidation?.issues ?? [];

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
      <div className="text-sm font-medium">AI Suggestions</div>

      {!aiPlan ? (
        <div className="text-sm opacity-70">No suggestions yet. Ask the AI to design your room.</div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm">{aiPlan.summary}</div>

          {!!aiPlan.reasons?.length && (
            <ul className="text-xs opacity-80 list-disc pl-5 space-y-1">
              {aiPlan.reasons.slice(0, 6).map((r: string, i: number) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}

          <div className="text-xs opacity-70">{aiPlan.actions.length} proposed changes</div>

          {issues.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-1">
              <div className="text-xs font-medium text-red-700">Apply failed because:</div>
              <ul className="text-xs text-red-700 list-disc pl-5 space-y-1">
                {issues.slice(0, 4).map((iss, idx) => (
                  <li key={idx}>{iss.message}</li>
                ))}
              </ul>
              {issues.length > 4 && <div className="text-[11px] text-red-600">+{issues.length - 4} more</div>}
              <div className="text-[11px] text-red-700 opacity-90 pt-1">
                Fix it via chat (e.g. “try a different layout”, “more spacing”, “rotate the sofa”, “don’t block the
                door”, “move TV to the top wall”).
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            <button className="w-full rounded-xl border px-3 py-2 text-sm" onClick={onApply}>
              Apply changes
            </button>

            <button className="w-full rounded-xl border px-3 py-2 text-sm" onClick={onDismiss}>
              Dismiss
            </button>
          </div>

          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
}
