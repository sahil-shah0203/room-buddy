import { z } from "zod";

export const ActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ADD_ITEM"),
    type: z.enum(["sofa", "bed", "desk", "chair", "table", "rug", "dresser", "tvStand"]),
    // v1: we allow optional size/position; you can tighten later
    w: z.number().positive().optional(),
    d: z.number().positive().optional(),
    x: z.number().min(0).optional(),
    y: z.number().min(0).optional(),
    rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
    label: z.string().optional(),
  }),
  z.object({
    kind: z.literal("MOVE_ITEM"),
    id: z.string().min(1),
    x: z.number().min(0),
    y: z.number().min(0),
  }),
  z.object({
    kind: z.literal("ROTATE_ITEM"),
    id: z.string().min(1),
  }),
  z.object({
    kind: z.literal("REMOVE_ITEM"),
    id: z.string().min(1),
  }),
]);

export const ProposedPlanSchema = z.object({
  summary: z.string().min(1),
  actions: z.array(ActionSchema).min(1),
});

export type ProposedPlan = z.infer<typeof ProposedPlanSchema>;
