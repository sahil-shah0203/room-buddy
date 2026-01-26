import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ProposedPlanSchema, type ProposedPlan } from "@/lib/ai/planSchema";
import type { ValidationIssue } from "@/lib/ai/actions";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ChatMsg = { role: "user" | "assistant"; text: string };

type PlanGoal = "retry" | "make_it_fit";

type Body =
  | { mode: "chat"; messages: ChatMsg[]; roomState: unknown }
  | {
      mode: "plan";
      messages: ChatMsg[];
      roomState: unknown;
      hint?: string;
      goal?: PlanGoal;
      previousPlan?: ProposedPlan;
      validationIssues?: ValidationIssue[];
    };

const COORDS_EXPLAINER =
  "Coordinate system for roomState.items (IMPORTANT):\n" +
  "- Units are the room’s unit (usually feet).\n" +
  "- Origin (0,0) is the TOP-LEFT corner of the room.\n" +
  "- +x goes RIGHT, +y goes DOWN.\n" +
  "- (x,y) is the item's TOP-LEFT corner.\n" +
  "- Touching walls:\n" +
  "  • left wall: x ≈ 0\n" +
  "  • top wall: y ≈ 0\n" +
  "  • right wall: x ≈ (room.width - item.w)\n" +
  "  • bottom wall: y ≈ (room.depth - item.d)\n" +
  "Never describe (0,0) as bottom-left in this app.\n";

const PLANNING_RULES =
  "Layout rules (non-negotiable):\n" +
  "- DO NOT block doors. Doors in roomState.features.doors must have a clear buffer inside the room.\n" +
  "- Treat door-to-room circulation as a FIRST-CLASS zone. Do not place large items in the circulation path.\n" +
  "- No overlaps between non-rug items.\n" +
  "- Rugs MAY overlap furniture (that is allowed), but rugs should not span across door clearance/circulation.\n" +
  "- Keep plans small and realistic: max 6 actions total.\n" +
  "- Prefer moving/rotating existing items before adding many new ones.\n" +
  "If you change an item's orientation, you MUST emit a SET_ROTATION action for that item.\n" +
  "Do not rely on “it should be rotated” in labels/reasons.\n" +
  "- If you must remove items, remove at most 2 and explain why.\n";

const OUTPUT_RULES =
  "Output rules:\n" +
  "- Return ONLY valid JSON matching the schema.\n" +
  "- For rotations, prefer SET_ROTATION (explicit) over ROTATE_ITEM.\n" +
  "- Only reference ids that exist in roomState.items.\n";

const PROPOSED_PLAN_JSON_SCHEMA = {
  name: "proposed_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "reasons", "actions"],
    properties: {
      summary: { type: "string" },
      reasons: { type: "array", items: { type: "string" } },
      actions: {
        type: "array",
        minItems: 1,
        items: {
          anyOf: [
            // ADD_ITEM
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

            // MOVE_ITEM
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

            // ROTATE_ITEM (legacy +90)
            {
              type: "object",
              additionalProperties: false,
              required: ["kind", "id"],
              properties: {
                kind: { type: "string", enum: ["ROTATE_ITEM"] },
                id: { type: "string" },
              },
            },

            // SET_ROTATION (explicit)
            {
              type: "object",
              additionalProperties: false,
              required: ["kind", "id", "rotation"],
              properties: {
                kind: { type: "string", enum: ["SET_ROTATION"] },
                id: { type: "string" },
                rotation: { type: "number", enum: [0, 90, 180, 270] },
              },
            },

            // REMOVE_ITEM
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

function formatConversation(messages: ChatMsg[]) {
  return messages.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join("\n");
}

function formatDoorSemantics(roomState: any) {
  const doors = roomState?.features?.doors;
  if (!Array.isArray(doors) || doors.length === 0) return "";

  // We can't truly know semantics unless the user said it.
  // Still: provide a structured reminder to treat doors as circulation anchors.
  const lines = doors.map((d: any) => {
    const id = d?.id ?? "door";
    const wall = d?.wall ?? "?";
    const offset = d?.offset ?? "?";
    const width = d?.width ?? "?";
    const swing = d?.swing ?? "?";
    return `- ${id}: wall=${wall}, offset=${offset}, width=${width}, swing=${swing}`;
  });

  return (
    "\nDoors (do not block; keep circulation clear):\n" +
    lines.join("\n") +
    "\n"
  );
}

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
            "When referencing coordinates, use the app’s coordinate system.\n\n" +
            COORDS_EXPLAINER,
        },
        {
          role: "user" as const,
          content:
            COORDS_EXPLAINER +
            "\nRoom state JSON:\n" +
            JSON.stringify(roomState) +
            "\n" +
            formatDoorSemantics(roomState) +
            "\nConversation:\n" +
            formatConversation(messages),
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
    const goal: PlanGoal | undefined = body.goal;

    const makeItFitBlock =
      goal === "make_it_fit"
        ? "\n\n" +
          "You are revising a previous plan that failed validation.\n" +
          "Fix the listed issues exactly; keep intent; minimal edits.\n\n" +
          `Previous plan JSON:\n${JSON.stringify(body.previousPlan ?? null)}\n\n` +
          `Validation issues (MUST fix):\n${JSON.stringify(body.validationIssues ?? [])}\n`
        : "";

    const systemPrompt =
      "You are Room Buddy, an interior design copilot that proposes safe, buildable 2D layouts.\n\n" +
      OUTPUT_RULES +
      "\n" +
      COORDS_EXPLAINER +
      "\n" +
      PLANNING_RULES +
      makeItFitBlock +
      "\n" +
      "Before you output JSON, do a quick sanity check:\n" +
      "- Door clearance respected for every non-rug item\n" +
      "- No overlaps between non-rug items\n" +
      "- Items are inside room bounds\n" +
      "- Plan <= 6 actions\n";

    const userPrompt =
      COORDS_EXPLAINER +
      "\nRoom state JSON:\n" +
      JSON.stringify(roomState) +
      "\n" +
      formatDoorSemantics(roomState) +
      "\nConversation:\n" +
      formatConversation(messages) +
      (hint ? `\n\nExtra constraints:\n${hint}` : "");

    const resp = await client.responses.create({
      model: "gpt-5.2",
      input: [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt },
      ],
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
