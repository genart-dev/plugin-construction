import type { Vec2 } from "./rotation.js";
import { dist2 } from "./rotation.js";

/**
 * Compute a convex hull of the given points (Andrew's monotone chain).
 */
export function convexHull(points: Vec2[]): Vec2[] {
  if (points.length < 3) return [...points];

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Vec2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Vec2[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function cross(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/**
 * Compute envelope from points based on style.
 * - "tight": convex hull
 * - "loose": convex hull expanded outward
 * - "fitted": the original polygon (straight lines connecting input points in order)
 */
export function computeEnvelope(
  points: Vec2[],
  style: "tight" | "loose" | "fitted",
): Vec2[] {
  if (points.length < 3) return [...points];

  if (style === "fitted") return [...points];

  const hull = convexHull(points);

  if (style === "loose") {
    const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
    const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
    const expand = 0.05;
    return hull.map((p) => ({
      x: p.x + (p.x - cx) * expand,
      y: p.y + (p.y - cy) * expand,
    }));
  }

  return hull;
}

/**
 * Compute angles at each vertex of an envelope polygon.
 * Returns the interior angle in degrees at each vertex.
 */
export function envelopeAngles(vertices: Vec2[]): Array<{ vertex: Vec2; angle: number }> {
  const n = vertices.length;
  if (n < 3) return [];

  const result: Array<{ vertex: Vec2; angle: number }> = [];
  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n]!;
    const curr = vertices[i]!;
    const next = vertices[(i + 1) % n]!;

    const dx1 = prev.x - curr.x, dy1 = prev.y - curr.y;
    const dx2 = next.x - curr.x, dy2 = next.y - curr.y;

    const dot = dx1 * dx2 + dy1 * dy2;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (len1 < 1e-10 || len2 < 1e-10) {
      result.push({ vertex: curr, angle: 180 });
      continue;
    }

    const cosAngle = Math.max(-1, Math.min(1, dot / (len1 * len2)));
    const angle = Math.acos(cosAngle) * (180 / Math.PI);
    result.push({ vertex: curr, angle });
  }
  return result;
}

/** Vertical plumb line through a reference point, clipped to bounds. */
export function plumbLine(
  referencePoint: Vec2,
  bounds: { x: number; y: number; width: number; height: number },
): [Vec2, Vec2] {
  return [
    { x: referencePoint.x, y: bounds.y },
    { x: referencePoint.x, y: bounds.y + bounds.height },
  ];
}

/** Horizontal level line through a reference point, clipped to bounds. */
export function levelLine(
  referencePoint: Vec2,
  bounds: { x: number; y: number; width: number; height: number },
): [Vec2, Vec2] {
  return [
    { x: bounds.x, y: referencePoint.y },
    { x: bounds.x + bounds.width, y: referencePoint.y },
  ];
}

/** Comparative measurement between two segments. Returns ratio and label. */
export function comparativeMeasure(
  segment1: [Vec2, Vec2],
  segment2: [Vec2, Vec2],
): { ratio: number; label: string } {
  const len1 = dist2(segment1[0], segment1[1]);
  const len2 = dist2(segment2[0], segment2[1]);
  if (len2 < 1e-10) return { ratio: Infinity, label: "∞" };
  const ratio = len1 / len2;
  return { ratio, label: `1 : ${ratio.toFixed(2)}` };
}
