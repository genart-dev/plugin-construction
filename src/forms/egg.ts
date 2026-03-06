import type { Vec2, Vec3, Mat3 } from "../math/rotation.js";
import { rotate3D, project } from "../math/rotation.js";
import { drawEllipseWithHidden, type EllipseParams } from "../math/ellipse.js";
import type { HiddenEdgeStyle } from "../shared.js";

export interface EggRenderOptions {
  center: Vec2;
  scale: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  matrix: Mat3;
  projection: "orthographic" | "weak-perspective";
  focalLength: number;
  showHidden: boolean;
  hiddenStyle: HiddenEdgeStyle;
  hiddenAlpha: number;
  edgeColor: string;
}

function projectVertex(v: Vec3, opts: EggRenderOptions): Vec2 {
  const rotated = rotate3D(v, opts.matrix);
  const p = project(rotated, opts.projection, opts.focalLength);
  return { x: opts.center.x + p.x * opts.scale, y: opts.center.y - p.y * opts.scale };
}

/**
 * Egg radius at a given height along the Y axis.
 * Wider at bottom (y=-0.5), narrower at top (y=0.5).
 * Uses a cosine profile with asymmetric scaling.
 */
function eggRadius(t: number): number {
  // t in [0,1], 0=bottom, 1=top
  // Bottom half is wider, top half is narrower
  const base = Math.sin(t * Math.PI); // 0 at top and bottom, 1 at middle
  const asymmetry = 1 - t * 0.3; // Wider at bottom
  return base * asymmetry;
}

/**
 * Render an egg/ovoid outline using a series of projected points.
 */
export function renderEgg(ctx: CanvasRenderingContext2D, opts: EggRenderOptions): void {
  const { center, scale, sizeX, sizeY, sizeZ, matrix, projection, focalLength, edgeColor } = opts;
  const segments = 48;

  ctx.strokeStyle = edgeColor;

  // Generate egg outline by sweeping around the Y axis
  const outlinePoints: Vec2[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    // For each angle around Y, compute the egg profile at each height
    // We trace the silhouette in 3D then project
    const t = (Math.sin(angle) + 1) / 2; // 0 to 1 for bottom to top
    const y = (t - 0.5) * sizeY;
    const r = eggRadius(t);
    const x = Math.cos(angle) * r * sizeX * 0.5;
    const z = 0; // Silhouette lies in the XY plane initially

    const rotated = rotate3D({ x, y, z }, matrix);
    const p = project(rotated, projection, focalLength);
    outlinePoints.push({ x: center.x + p.x * scale, y: center.y - p.y * scale });
  }

  // Generate full 3D egg surface points for a proper silhouette
  // Sample the surface and find the outermost points at each screen-Y
  const surfacePoints: Vec2[] = [];
  const ySteps = 32;
  const aSteps = 24;

  for (let yi = 0; yi <= ySteps; yi++) {
    const t = yi / ySteps;
    const y = (t - 0.5) * sizeY;
    const r = eggRadius(t);

    let leftmost = Infinity;
    let rightmost = -Infinity;
    let leftP: Vec2 = { x: 0, y: 0 };
    let rightP: Vec2 = { x: 0, y: 0 };

    for (let ai = 0; ai <= aSteps; ai++) {
      const a = (ai / aSteps) * Math.PI * 2;
      const x3d = Math.cos(a) * r * sizeX * 0.5;
      const z3d = Math.sin(a) * r * sizeZ * 0.5;
      const p3d: Vec3 = { x: x3d, y, z: z3d };
      const rotated = rotate3D(p3d, matrix);
      const p = project(rotated, projection, focalLength);
      const sx = center.x + p.x * scale;
      const sy = center.y - p.y * scale;

      if (sx < leftmost) { leftmost = sx; leftP = { x: sx, y: sy }; }
      if (sx > rightmost) { rightmost = sx; rightP = { x: sx, y: sy }; }
    }

    surfacePoints.push(leftP, rightP);
  }

  // Build left and right silhouette paths
  const leftPath: Vec2[] = [];
  const rightPath: Vec2[] = [];
  for (let i = 0; i < surfacePoints.length; i += 2) {
    leftPath.push(surfacePoints[i]!);
    rightPath.push(surfacePoints[i + 1]!);
  }

  // Draw the silhouette as a smooth curve
  ctx.beginPath();
  if (leftPath.length > 1) {
    ctx.moveTo(leftPath[0]!.x, leftPath[0]!.y);
    for (let i = 1; i < leftPath.length; i++) {
      ctx.lineTo(leftPath[i]!.x, leftPath[i]!.y);
    }
  }
  // Continue with right path in reverse
  for (let i = rightPath.length - 1; i >= 0; i--) {
    ctx.lineTo(rightPath[i]!.x, rightPath[i]!.y);
  }
  ctx.closePath();
  ctx.stroke();
}

/** Cross-contour ellipses for egg — similar to sphere but with varying radius. */
export function eggCrossContours(
  opts: EggRenderOptions,
  count: number,
): { params: EllipseParams; frontHalf: [number, number] }[] {
  const { center, scale, sizeX, sizeY, sizeZ, matrix, projection, focalLength } = opts;
  const contours: { params: EllipseParams; frontHalf: [number, number] }[] = [];

  for (let i = 1; i < count; i++) {
    const t = i / count;
    const y = (t - 0.5) * sizeY;
    const r = eggRadius(t);
    const rx = r * sizeX * 0.5;
    const rz = r * sizeZ * 0.5;

    if (rx < 0.001 || rz < 0.001) continue;

    const cc = projectVertex({ x: 0, y, z: 0 }, opts);
    const px = projectVertex({ x: rx, y, z: 0 }, opts);
    const pz = projectVertex({ x: 0, y, z: rz }, opts);

    const ax = Math.sqrt((px.x - cc.x) ** 2 + (px.y - cc.y) ** 2);
    const az = Math.sqrt((pz.x - cc.x) ** 2 + (pz.y - cc.y) ** 2);
    const angle = Math.atan2(px.y - cc.y, px.x - cc.x);

    const normalZ = rotate3D({ x: 0, y: 1, z: 0 }, matrix).z;
    const topVisible = normalZ > 0;
    const isAboveCenter = t > 0.5;
    const frontHalf: [number, number] = (isAboveCenter === topVisible)
      ? [0, Math.PI]
      : [Math.PI, Math.PI * 2];

    contours.push({
      params: { cx: cc.x, cy: cc.y, rx: Math.max(ax, az), ry: Math.min(ax, az), rotation: angle },
      frontHalf,
    });
  }

  return contours;
}
