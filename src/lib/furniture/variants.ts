import type { FurnitureType, CeilingItemType } from "@/types/room";

export type VariantInfo = {
  id: string;
  label: string;
  description: string;
  defaultSize?: { w: number; d: number };
};

// Furniture variants for each type
export const FURNITURE_VARIANTS: Record<FurnitureType, VariantInfo[]> = {
  sofa: [
    { id: "default", label: "Standard", description: "Sectional with armrests" },
    { id: "modern", label: "Modern", description: "Low-profile, minimalist" },
    { id: "lshaped", label: "L-Shaped", description: "Corner sectional" },
  ],
  bed: [
    { id: "default", label: "Platform", description: "Standard with headboard" },
    { id: "canopy", label: "Canopy", description: "Four-poster frame" },
    { id: "storage", label: "Storage", description: "Drawers underneath" },
  ],
  desk: [
    { id: "default", label: "Standard", description: "Desk with drawers" },
    { id: "standing", label: "Standing", description: "Taller, minimalist" },
    { id: "ldesk", label: "L-Desk", description: "Corner desk" },
  ],
  chair: [
    { id: "default", label: "Dining", description: "Simple wooden chair" },
    { id: "office", label: "Office", description: "Rolling, high-back" },
    { id: "armchair", label: "Armchair", description: "Cushioned, wide" },
  ],
  table: [
    { id: "default", label: "Rectangular", description: "Standard dining table" },
    { id: "round", label: "Round", description: "Circular table" },
    { id: "coffee", label: "Coffee", description: "Lower height", defaultSize: { w: 4, d: 2.5 } },
  ],
  rug: [
    { id: "default", label: "Rectangular", description: "Standard area rug" },
    { id: "round", label: "Round", description: "Circular rug" },
    { id: "runner", label: "Runner", description: "Narrow, long", defaultSize: { w: 2.5, d: 8 } },
  ],
  dresser: [
    { id: "default", label: "Tall", description: "4 drawer dresser" },
    { id: "wide", label: "Wide", description: "Low, 6 drawers", defaultSize: { w: 6, d: 2 } },
    { id: "nightstand", label: "Nightstand", description: "Small, 2 drawers", defaultSize: { w: 2, d: 2 } },
  ],
  tvStand: [
    { id: "default", label: "Cabinet", description: "Standard TV cabinet" },
    { id: "wallMount", label: "Wall Mount", description: "Floating shelf" },
    { id: "entertainment", label: "Entertainment", description: "Large center", defaultSize: { w: 7, d: 2 } },
  ],
};

// Ceiling item variants
export const CEILING_VARIANTS: Record<CeilingItemType, VariantInfo[]> = {
  ceilingLight: [
    { id: "default", label: "Flush Mount", description: "Dome fixture" },
    { id: "pendant", label: "Pendant", description: "Hanging light" },
    { id: "chandelier", label: "Chandelier", description: "Decorative fixture" },
  ],
  ceilingFan: [
    { id: "default", label: "Standard", description: "Fan without light" },
    { id: "withLight", label: "With Light", description: "Integrated light" },
    { id: "industrial", label: "Industrial", description: "Larger blades" },
  ],
};

/**
 * Get all available variants for a furniture type
 */
export function getVariantsForType(type: FurnitureType): VariantInfo[] {
  return FURNITURE_VARIANTS[type] || [];
}

/**
 * Get all available variants for a ceiling item type
 */
export function getCeilingVariantsForType(type: CeilingItemType): VariantInfo[] {
  return CEILING_VARIANTS[type] || [];
}

/**
 * Get the display label for a variant
 */
export function getVariantLabel(type: FurnitureType, variantId: string): string {
  const variants = FURNITURE_VARIANTS[type];
  const variant = variants?.find((v) => v.id === variantId);
  return variant?.label || "Standard";
}

/**
 * Get the display label for a ceiling variant
 */
export function getCeilingVariantLabel(type: CeilingItemType, variantId: string): string {
  const variants = CEILING_VARIANTS[type];
  const variant = variants?.find((v) => v.id === variantId);
  return variant?.label || "Standard";
}

/**
 * Get variant info by ID
 */
export function getVariantInfo(type: FurnitureType, variantId: string): VariantInfo | undefined {
  const variants = FURNITURE_VARIANTS[type];
  return variants?.find((v) => v.id === variantId);
}

/**
 * Get ceiling variant info by ID
 */
export function getCeilingVariantInfo(type: CeilingItemType, variantId: string): VariantInfo | undefined {
  const variants = CEILING_VARIANTS[type];
  return variants?.find((v) => v.id === variantId);
}
