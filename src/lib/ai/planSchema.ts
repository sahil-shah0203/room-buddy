import { z } from "zod";

export const FurnitureTypeSchema = z.enum([
  "sofa",
  "bed",
  "desk",
  "chair",
  "table",
  "rug",
  "dresser",
  "tvStand",
]);

const AddItem = z.object({
  kind: z.literal("ADD_ITEM"),
  type: FurnitureTypeSchema,
  w: z.number().optional(),
  d: z.number().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
  label: z.string().optional(),
});

const MoveItem = z.object({
  kind: z.literal("MOVE_ITEM"),
  id: z.string(),
  x: z.number(),
  y: z.number(),
});

const RotateItem = z.object({
  kind: z.literal("ROTATE_ITEM"),
  id: z.string(),
});

const RemoveItem = z.object({
  kind: z.literal("REMOVE_ITEM"),
  id: z.string(),
});

const SetRotation = z.object({
  kind: z.literal("SET_ROTATION"),
  id: z.string(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
});

export const ActionSchema = z.union([AddItem, MoveItem, RotateItem, RemoveItem, SetRotation]);

export const ProposedPlanSchema = z.object({
  summary: z.string(),
  reasons: z.array(z.string()).default([]), // ✅ new
  actions: z.array(ActionSchema).min(1),
});

export type ProposedPlan = z.infer<typeof ProposedPlanSchema>;
