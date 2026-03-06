import type { Vec2, Vec3, Mat3 } from "../math/rotation.js";
import { rotate3D, project } from "../math/rotation.js";
import { drawEllipseWithHidden, type EllipseParams } from "../math/ellipse.js";
import type { HiddenEdgeStyle } from "../shared.js";

export interface SphereRenderOptions {
  center: Vec2;
  scale: number;
  radius: number;
  matrix: Mat3;
  projection: "orthographic" | "weak-perspective";
  focalLength: number;
  showHidden: boolean;
  hiddenStyle: HiddenEdgeStyle;
  hiddenAlpha: number;
  edgeColor: string;
}

function projectVertex(v: Vec3, opts: SphereRenderOptions): Vec2 {
  const rotated = rotate3D(v, opts.matrix);
  const p = project(rotated, opts.projection, opts.focalLength);
  return { x: opts.center.x + p.x * opts.scale, y: opts.center.y - p.y * opts.scale };
}

export function renderSphere(ctx: CanvasRenderingContext2D, opts: SphereRenderOptions): void {
  const { center, scale, radius, edgeColor } = opts;
  const screenRadius = radius * scale;

  ctx.strokeStyle = edgeColor;

  // Outline circle (always circular in orthographic projection)
  ctx.beginPath();
  ctx.arc(center.x, center.y, screenRadius, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Generate cross-contour ellipses for a sphere.
 * Produces latitude lines (horizontal cross-sections) and longitude lines (vertical slices).
 */
export function sphereCrossContours(
  opts: SphereRenderOptions,
  latCount: number,
  lonCount: number,
): { params: EllipseParams; frontHalf: [number, number] }[] {
  const { center, scale, radius, matrix, projection, focalLength } = opts;
  const contours: { params: EllipseParams; frontHalf: [number, number] }[] = [];
  const r = radius;

  // Latitude lines (circles in XZ plane at different Y heights)
  for (let i = 1; i < latCount; i++) {
    const t = i / latCount;
    const y = -r + t * 2 * r;
    const circleRadius = Math.sqrt(r * r - y * y);

    // Project the circle center and a point on the circle
    const circleCenter: Vec3 = { x: 0, y, z: 0 };
    const cc2D = projectVertex(circleCenter, opts);

    // Project two points on the circle to get ellipse axes
    const px = projectVertex({ x: circleRadius, y, z: 0 }, opts);
    const pz = projectVertex({ x: 0, y, z: circleRadius }, opts);

    const ax = Math.sqrt((px.x - cc2D.x) ** 2 + (px.y - cc2D.y) ** 2);
    const az = Math.sqrt((pz.x - cc2D.x) ** 2 + (pz.y - cc2D.y) ** 2);
    const angle = Math.atan2(px.y - cc2D.y, px.x - cc2D.x);

    // The circle's normal (Y axis) transformed — Z component determines visibility
    const normalZ = rotate3D({ x: 0, y: 1, z: 0 }, matrix).z;
    const topVisible = normalZ > 0;

    // For latitude lines above equator: front-facing depends on tilt
    const isAboveEquator = y > 0;
    const frontHalf: [number, number] = (isAboveEquator === topVisible)
      ? [0, Math.PI]
      : [Math.PI, Math.PI * 2];

    contours.push({
      params: { cx: cc2D.x, cy: cc2D.y, rx: Math.max(ax, az), ry: Math.min(ax, az), rotation: angle },
      frontHalf,
    });
  }

  // Longitude lines (circles in XY plane at different Z angles)
  for (let i = 0; i < lonCount; i++) {
    const angle = (i / lonCount) * Math.PI;

    // Circle lies in a plane defined by Y axis and a direction in XZ
    const nx = Math.cos(angle);
    const nz = Math.sin(angle);

    // Project two points on this great circle
    const p1 = projectVertex({ x: nx * r, y: 0, z: nz * r }, opts);
    const p2 = projectVertex({ x: -nx * r, y: 0, z: -nz * r }, opts);
    const pTop = projectVertex({ x: 0, y: r, z: 0 }, opts);
    const pBot = projectVertex({ x: 0, y: -r, z: 0 }, opts);

    // The great circle center is sphere center
    const cc2D = { x: center.x, y: center.y };

    // Compute axes from projected points
    const ax1 = Math.sqrt((p1.x - cc2D.x) ** 2 + (p1.y - cc2D.y) ** 2);
    const ax2 = Math.sqrt((pTop.x - cc2D.x) ** 2 + (pTop.y - cc2D.y) ** 2);
    const rot = Math.atan2(p1.y - cc2D.y, p1.x - cc2D.x);

    // Normal to this slice is perpendicular in XZ plane
    const sliceNormalZ = rotate3D({ x: -nz, y: 0, z: nx }, matrix).z;
    const frontHalf: [number, number] = sliceNormalZ > 0
      ? [0, Math.PI]
      : [Math.PI, Math.PI * 2];

    contours.push({
      params: { cx: cc2D.x, cy: cc2D.y, rx: Math.max(ax1, ax2), ry: Math.min(ax1, ax2), rotation: rot },
      frontHalf,
    });
  }

  return contours;
}
