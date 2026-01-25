export function snap(n: number, grid: number): number {
  return Math.round(n / grid) * grid;
}

export function snapPoint(p: { x: number; y: number }, grid: number) {
  return { x: snap(p.x, grid), y: snap(p.y, grid) };
}
