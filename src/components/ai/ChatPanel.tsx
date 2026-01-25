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

  // Construct snapshot OUTSIDE the selector to keep it stable
  const roomState = { room, items, gridSize, selectedItemId };

  // ---- Local state ----
  const chatLog = useRoomStore((s) => s.chatLog);
  const setChatLog = useRoomStore((s) => s.setChatLog);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Send message to AI ----
  function shouldPlan(text: string) {
    return /(add|place|move|rotate|remove|layout|design|decorate|cozy|modern|minimal|rug|sofa|bed|desk|chair|table|tv)/i.test(
      text
    );
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setInput("");

    const nextLog: Msg[] = [...chatLog, { role: "user", text }];
    setChatLog(nextLog);
    setLoading(true);

    try {
      const mode = shouldPlan(text) ? "plan" : "chat";

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, messages: nextLog, roomState }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "AI error");
        setChatLog([...nextLog, { role: "assistant", text: "Something went wrong." }]);
        return;
      }

      if (mode === "chat") {
        setChatLog([...nextLog, { role: "assistant", text: data.reply }]);
        return;
      }

      // plan mode
      setAiPlan(data);
      setChatLog([
        ...nextLog,
        {
          role: "assistant",
          text: "I suggested a layout — review it in AI Suggestions, then apply if you like it.",
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
        {chatLog.map((m, i) => (
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