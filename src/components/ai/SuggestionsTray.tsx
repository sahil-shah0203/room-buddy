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

  const [error, setError] = useState<string | null>(null);
  const [loadingAlt, setLoadingAlt] = useState(false);

  const chatLog = useRoomStore((s) => s.chatLog);

  // Build preview whenever we get a plan
  useEffect(() => {
    if (!aiPlan) {
      setPreviewItems(null);
      setError(null);
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
  }, [aiPlan, room, items, setPreviewItems]);

  async function requestAlternative(hint: string) {
    setLoadingAlt(true);
    setError(null);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "plan",
          messages: chatLog,
          roomState: { room, items },
          hint,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "AI error");
        return;
      }

      setAiPlan(data);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setLoadingAlt(false);
    }
  }

  function onApply() {
    if (!aiPlan) return;
    const res = applyPlan(aiPlan);
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    setError(null);
    // store.applyPlan already clears aiPlan + previewItems in your code, which is perfect
  }

  function onDismiss() {
    setAiPlan(null);
    setPreviewItems(null);
    setError(null);
  }

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

          <div className="grid grid-cols-1 gap-2">
            <button className="w-full rounded-xl border px-3 py-2 text-sm" onClick={onApply}>
              Apply changes
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-xl border px-3 py-2 text-sm"
                disabled={loadingAlt}
                onClick={() =>
                  requestAlternative(
                    "Try again with a different layout. Avoid overlaps. Use fewer items if needed. Prefer smaller furniture and more spacing."
                  )
                }
              >
                {loadingAlt ? "…" : "Try again"}
              </button>

              <button
                className="rounded-xl border px-3 py-2 text-sm"
                disabled={loadingAlt}
                onClick={() =>
                  requestAlternative(
                    "Make it fit at all costs. Avoid overlaps. If needed, REMOVE up to 2 existing items that block the layout, and explain why in reasons."
                  )
                }
              >
                {loadingAlt ? "…" : "Make it fit"}
              </button>
            </div>

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
