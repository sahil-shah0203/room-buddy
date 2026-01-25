import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ProposedPlanSchema, type ProposedPlan } from "@/lib/ai/planSchema";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ChatMsg = { role: "user" | "assistant"; text: string };

type Body =
  | { mode: "chat"; messages: ChatMsg[]; roomState: unknown }
  | { mode: "plan"; messages: ChatMsg[]; roomState: unknown; hint?: string };

const PROPOSED_PLAN_JSON_SCHEMA = {
  name: "proposed_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "reasons", "actions"],
    properties: {
      summary: { type: "string" },
      reasons: {
        type: "array",
        items: { type: "string" },
      },
      actions: {
        type: "array",
        minItems: 1,
        items: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["kind", "type", "w", "d", "x", "y", "rotation", "label"],
              properties: {
                kind: { type: "string", enum: ["ADD_ITEM"] },
                type: {
                  type: "string",
                  enum: ["sofa", "bed", "desk", "chair", "table", "rug", "dresser", "tvStand"],
                },
                w: { type: "number" },
                d: { type: "number" },
                x: { type: "number" },
                y: { type: "number" },
                rotation: { type: "number", enum: [0, 90, 180, 270] },
                label: { type: "string" },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["kind", "id", "x", "y"],
              properties: {
                kind: { type: "string", enum: ["MOVE_ITEM"] },
                id: { type: "string" },
                x: { type: "number" },
                y: { type: "number" },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["kind", "id"],
              properties: {
                kind: { type: "string", enum: ["ROTATE_ITEM"] },
                id: { type: "string" },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["kind", "id"],
              properties: {
                kind: { type: "string", enum: ["REMOVE_ITEM"] },
                id: { type: "string" },
              },
            },
          ],
        },
      },
    },
  },
} as const;

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = (await req.json()) as Body;
    const { mode, messages, roomState } = body;

    // ----- CHAT MODE -----
    if (mode === "chat") {
      const input = [
        {
          role: "system" as const,
          content:
            "You are Room Buddy, a friendly but knowledgeable interior design assistant. " +
            "Answer conversationally. Be concise and practical. " +
            "You can reference the current room and items from roomState.",
        },
        {
          role: "user" as const,
          content:
            "Room state JSON:\n" +
            JSON.stringify(roomState) +
            "\n\nConversation:\n" +
            messages.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n"),
        },
      ];

      const resp = await client.responses.create({
        model: "gpt-5.2",
        input,
      });

      const reply = resp.output_text?.trim() ?? "";
      return NextResponse.json({ reply: reply || "Got it." });
    }

    // ----- PLAN MODE -----
    const hint = body.hint ?? "";

    const input = [
      {
        role: "system" as const,
        content:
          "You are Room Buddy, an interior design copilot. " +
          "Return ONLY valid JSON matching the schema. " +
          "Propose a SMALL plan (max 6 actions). " +
          "Prefer ADD_ITEM with x/y/w/d/rotation/label. " +
          "Only use MOVE/ROTATE/REMOVE with ids that appear in roomState.items. " +
          "Also include `reasons`: 2-5 short bullets explaining the layout.",
      },
      {
        role: "user" as const,
        content:
          "Room state JSON:\n" +
          JSON.stringify(roomState) +
          "\n\nConversation:\n" +
          messages.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n") +
          (hint ? `\n\nExtra constraints:\n${hint}` : ""),
      },
    ];

    const resp = await client.responses.create({
      model: "gpt-5.2",
      input,
      text: {
        format: {
          type: "json_schema",
          name: "proposed_plan",
          strict: true,
          schema: PROPOSED_PLAN_JSON_SCHEMA.schema,
        },
      },
    });

    const text = resp.output_text;
    if (!text) return NextResponse.json({ error: "No output_text from model." }, { status: 500 });

    let parsed: ProposedPlan;
    try {
      parsed = ProposedPlanSchema.parse(JSON.parse(text));
    } catch {
      return NextResponse.json({ error: "Model returned invalid JSON for ProposedPlan.", raw: text }, { status: 400 });
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json({ error: "Server error", detail: err?.message ?? String(err) }, { status: 500 });
  }
}
