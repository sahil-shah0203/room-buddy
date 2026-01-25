import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ProposedPlanSchema, type ProposedPlan } from "@/lib/ai/planSchema";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * IMPORTANT OPENAI RULES (non-standard JSON Schema):
 * - Every schema MUST have a "type"
 * - Every enum MUST also specify a "type"
 * - If additionalProperties = false, ALL properties MUST be listed in "required"
 * - Optional fields must be represented via `null`
 */
const PROPOSED_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "actions"],
  properties: {
    summary: {
      type: "string",
    },
    actions: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        anyOf: [
          // ---------- ADD_ITEM ----------
          {
            type: "object",
            additionalProperties: false,
            required: ["kind", "type", "w", "d", "x", "y", "rotation", "label"],
            properties: {
              kind: {
                type: "string",
                enum: ["ADD_ITEM"],
              },
              type: {
                type: "string",
                enum: ["sofa", "bed", "desk", "chair", "table", "rug", "dresser", "tvStand"],
              },
              w: { type: ["number", "null"] },
              d: { type: ["number", "null"] },
              x: { type: ["number", "null"] },
              y: { type: ["number", "null"] },
              rotation: {
                type: ["number", "null"],
                enum: [0, 90, 180, 270, null],
              },
              label: { type: ["string", "null"] },
            },
          },

          // ---------- MOVE_ITEM ----------
          {
            type: "object",
            additionalProperties: false,
            required: ["kind", "id", "x", "y"],
            properties: {
              kind: {
                type: "string",
                enum: ["MOVE_ITEM"],
              },
              id: { type: "string" },
              x: { type: "number" },
              y: { type: "number" },
            },
          },

          // ---------- ROTATE_ITEM ----------
          {
            type: "object",
            additionalProperties: false,
            required: ["kind", "id"],
            properties: {
              kind: {
                type: "string",
                enum: ["ROTATE_ITEM"],
              },
              id: { type: "string" },
            },
          },

          // ---------- REMOVE_ITEM ----------
          {
            type: "object",
            additionalProperties: false,
            required: ["kind", "id"],
            properties: {
              kind: {
                type: "string",
                enum: ["REMOVE_ITEM"],
              },
              id: { type: "string" },
            },
          },
        ],
      },
    },
  },
} as const;

type ChatMsg = { role: "user" | "assistant"; text: string };

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as {
      messages: ChatMsg[];
      roomState: unknown;
    };

    const { messages, roomState } = body;

    const input = [
      {
        role: "system" as const,
        content:
          "You are Room Buddy, an interior design copilot. " +
          "Propose a SMALL plan (max 6 actions). " +
          "Prefer ADD_ITEM with x/y/w/d/rotation when adding furniture. " +
          "Only use MOVE/ROTATE/REMOVE with ids that exist in roomState.items. " +
          "Return ONLY a JSON object that matches the provided schema.",
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
      text: {
        format: {
          type: "json_schema",
          name: "proposed_plan",
          strict: true,
          schema: PROPOSED_PLAN_JSON_SCHEMA,
        },
      },
    });

    const text = resp.output_text;
    if (!text) {
      return NextResponse.json(
        { error: "No output_text from model." },
        { status: 500 }
      );
    }

    let parsed: ProposedPlan;
    try {
      parsed = ProposedPlanSchema.parse(JSON.parse(text));
    } catch {
      return NextResponse.json(
        {
          error: "Model returned invalid JSON for ProposedPlan.",
          raw: text,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
