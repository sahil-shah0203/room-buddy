import type { Point, Vertex, RoomShape, Item } from "@/types/room";

export type BoundingBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  depth: number;
};

/**
 * Calculate the bounding box for any room shape
 */
export function getBoundingBox(shape: RoomShape): BoundingBox {
  if (shape.type === "rectangle") {
    return {
      minX: 0,
      minY: 0,
      maxX: shape.width,
      maxY: shape.depth,
      width: shape.width,
      depth: shape.depth,
    };
  }

  const xs = shape.vertices.map((v) => v.x);
  const ys = shape.vertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    depth: maxY - minY,
  };
}

/**
 * Ray casting algorithm to determine if a point is inside a polygon
 * Cast a ray from the point to the right and count edge crossings
 * Odd crossings = inside, even = outside
 */
export function pointInPolygon(point: Point, vertices: Vertex[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;

  let inside = false;
  const { x, y } = point;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;

    // Check if ray from point crosses this edge
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if a point is inside the room shape (works for both rectangles and polygons)
 */
export function pointInShape(point: Point, shape: RoomShape): boolean {
  if (shape.type === "rectangle") {
    return (
      point.x >= 0 &&
      point.x <= shape.width &&
      point.y >= 0 &&
      point.y <= shape.depth
    );
  }
  return pointInPolygon(point, shape.vertices);
}

/**
 * Check if two line segments intersect
 * Uses cross product method
 */
function segmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  // Check collinear cases
  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;

  return false;
}

function direction(p1: Point, p2: Point, p3: Point): number {
  return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}

function onSegment(p1: Point, p2: Point, p: Point): boolean {
  return (
    Math.min(p1.x, p2.x) <= p.x &&
    p.x <= Math.max(p1.x, p2.x) &&
    Math.min(p1.y, p2.y) <= p.y &&
    p.y <= Math.max(p1.y, p2.y)
  );
}

/**
 * Check if a rectangle (furniture item) edge intersects any polygon edge
 * This catches items that span across concave corners
 */
export function rectangleIntersectsPolygonEdge(
  item: Item,
  vertices: Vertex[]
): boolean {
  const n = vertices.length;
  if (n < 3) return false;

  // Get the 4 corners of the item
  const corners: Point[] = [
    { x: item.x, y: item.y },
    { x: item.x + item.w, y: item.y },
    { x: item.x + item.w, y: item.y + item.d },
    { x: item.x, y: item.y + item.d },
  ];

  // Get the 4 edges of the item
  const itemEdges: [Point, Point][] = [
    [corners[0], corners[1]], // top
    [corners[1], corners[2]], // right
    [corners[2], corners[3]], // bottom
    [corners[3], corners[0]], // left
  ];

  // Check each item edge against each polygon edge
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const polyEdge: [Point, Point] = [vertices[j], vertices[i]];

    for (const itemEdge of itemEdges) {
      if (segmentsIntersect(itemEdge[0], itemEdge[1], polyEdge[0], polyEdge[1])) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a furniture item is completely inside the room shape
 * For concave shapes, we need to check:
 * 1. All 4 corners are inside the polygon
 * 2. No item edge intersects any wall edge
 */
export function isItemInsideShape(item: Item, shape: RoomShape): boolean {
  // Get the 4 corners of the item
  const corners: Point[] = [
    { x: item.x, y: item.y },
    { x: item.x + item.w, y: item.y },
    { x: item.x + item.w, y: item.y + item.d },
    { x: item.x, y: item.y + item.d },
  ];

  // All corners must be inside
  for (const corner of corners) {
    if (!pointInShape(corner, shape)) {
      return false;
    }
  }

  // For polygons, also check that no item edge crosses a wall edge
  if (shape.type === "polygon") {
    if (rectangleIntersectsPolygonEdge(item, shape.vertices)) {
      return false;
    }
  }

  return true;
}

/**
 * Convert polygon vertices to an SVG path string
 */
export function polygonToSvgPath(vertices: Vertex[], scale: number): string {
  if (vertices.length < 3) return "";

  const points = vertices.map((v) => `${v.x * scale},${v.y * scale}`);
  return `M ${points[0]} L ${points.slice(1).join(" L ")} Z`;
}

/**
 * Convert a room shape to an SVG path string
 */
export function shapeToSvgPath(shape: RoomShape, scale: number): string {
  if (shape.type === "rectangle") {
    const w = shape.width * scale;
    const h = shape.depth * scale;
    return `M 0,0 L ${w},0 L ${w},${h} L 0,${h} Z`;
  }
  return polygonToSvgPath(shape.vertices, scale);
}

/**
 * Get polygon edges as line segments (for rendering)
 */
export function getPolygonEdges(vertices: Vertex[]): { from: Vertex; to: Vertex }[] {
  const edges: { from: Vertex; to: Vertex }[] = [];
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    edges.push({
      from: vertices[i],
      to: vertices[(i + 1) % n],
    });
  }

  return edges;
}

/**
 * Find the closest point on a polygon edge to a given point
 * Returns the point and the edge index where a new vertex could be inserted
 */
export function findClosestPointOnEdge(
  point: Point,
  vertices: Vertex[]
): { point: Point; edgeIndex: number; distance: number } | null {
  if (vertices.length < 2) return null;

  let closest: { point: Point; edgeIndex: number; distance: number } | null = null;

  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];

    // Project point onto the line segment
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) continue;

    let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const distance = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);

    if (closest === null || distance < closest.distance) {
      closest = {
        point: { x: projX, y: projY },
        edgeIndex: i,
        distance,
      };
    }
  }

  return closest;
}
