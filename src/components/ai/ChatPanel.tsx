"use client";

import { useState } from "react";
import { useRoomStore } from "@/store/roomStore";

type Msg = { role: "user" | "assistant"; text: string };

export default function ChatPanel() {
  // ---- Zustand selectors (IMPORTANT: no object literals here) ----
  const setAiPlan = useRoomStore((s) => s.setAiPlan);

  const room = useRoomStore((s) => s.room);
  const items = useRoomStore((s) => s.items);
  const gridSize = useRoomStore((s) => s.gridSize);
  const selectedItemId = useRoomStore((s) => s.selectedItemId);
  const selectedVertexId = useRoomStore((s) => s.selectedVertexId);
  const editMode = useRoomStore((s) => s.editMode);

  // Construct snapshot OUTSIDE the selector to keep it stable
  const roomState = { room, items, gridSize, selectedItemId, selectedVertexId, editMode, aiPlan: null };

  // ---- Local state ----
  const [log, setLog] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Tell me what you want to design (cozy, modern, movie night, desk setup, etc).",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Send message to AI ----
  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setInput("");

    const nextLog: Msg[] = [...log, { role: "user", text }];
    setLog(nextLog);
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextLog,
          roomState,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "AI error");
        setLog((l) => [
          ...l,
          { role: "assistant" as const, text: "Something went wrong." },
        ]);
        return;
      }

      // 🔑 Store the AI plan globally
      setAiPlan(data);

      setLog((l) => [
        ...l,
        {
          role: "assistant" as const,
          text: "I’ve suggested a layout. Check the AI Suggestions panel to apply it.",
        },
      ]);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }

  // ---- UI ----
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm flex flex-col h-[520px]">
      <div className="text-sm font-medium mb-2">Chat</div>

      <div className="flex-1 overflow-auto space-y-2 pr-1">
        {log.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl px-3 py-2 text-sm ${
              m.role === "user" ? "border" : "bg-black/5"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}

      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded-xl border px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={loading ? "Thinking…" : "Describe your room or vibe"}
          disabled={loading}
        />
        <button
          className="rounded-xl border px-3 py-2 text-sm"
          onClick={send}
          disabled={loading}
        >
          {loading ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}