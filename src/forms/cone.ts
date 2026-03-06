import type { Vec2, Vec3, Mat3 } from "../math/rotation.js";
import { rotate3D, project } from "../math/rotation.js";
import { drawEllipseWithHidden, type EllipseParams } from "../math/ellipse.js";
import { drawLine, applyHiddenEdgeStyle, resetEdgeStyle, type HiddenEdgeStyle } from "../shared.js";

export interface ConeRenderOptions {
  center: Vec2;
  scale: number;
  sizeX: number; // base radius X
  sizeY: number; // height
  sizeZ: number; // base radius Z
  matrix: Mat3;
  projection: "orthographic" | "weak-perspective";
  focalLength: number;
  showHidden: boolean;
  hiddenStyle: HiddenEdgeStyle;
  hiddenAlpha: number;
  edgeColor: string;
}

function projectVertex(v: Vec3, opts: ConeRenderOptions): Vec2 {
  const rotated = rotate3D(v, opts.matrix);
  const p = project(rotated, opts.projection, opts.focalLength);
  return { x: opts.center.x + p.x * opts.scale, y: opts.center.y - p.y * opts.scale };
}

export function renderCone(ctx: CanvasRenderingContext2D, opts: ConeRenderOptions): void {
  const { sizeX, sizeY, sizeZ, edgeColor, showHidden, hiddenStyle, hiddenAlpha, matrix } = opts;
  const halfH = sizeY / 2;

  ctx.strokeStyle = edgeColor;
  const savedAlpha = ctx.globalAlpha;

  // Apex at top
  const apex = projectVertex({ x: 0, y: halfH, z: 0 }, opts);

  // Base ellipse at bottom
  const baseCenter = projectVertex({ x: 0, y: -halfH, z: 0 }, opts);
  const basePx = projectVertex({ x: sizeX * 0.5, y: -halfH, z: 0 }, opts);
  const basePz = projectVertex({ x: 0, y: -halfH, z: sizeZ * 0.5 }, opts);

  const ax = Math.sqrt((basePx.x - baseCenter.x) ** 2 + (basePx.y - baseCenter.y) ** 2);
  const az = Math.sqrt((basePz.x - baseCenter.x) ** 2 + (basePz.y - baseCenter.y) ** 2);
  const angle = Math.atan2(basePx.y - baseCenter.y, basePx.x - baseCenter.x);

  const baseEllipse: EllipseParams = {
    cx: baseCenter.x,
    cy: baseCenter.y,
    rx: Math.max(ax, az),
    ry: Math.min(ax, az),
    rotation: angle,
  };

  // Base visibility: bottom normal
  const bottomNormalZ = rotate3D({ x: 0, y: -1, z: 0 }, matrix).z;
  const baseVisible = bottomNormalZ > 0;
  const baseFront: [number, number] = baseVisible ? [0, Math.PI] : [Math.PI, Math.PI * 2];

  const hiddenDash = hiddenStyle === "dotted" ? [2, 3] : [6, 4];

  // Draw tangent lines from apex to base ellipse edges
  const leftPoint = ellipsePointAt(baseEllipse, Math.PI);
  const rightPoint = ellipsePointAt(baseEllipse, 0);

  ctx.setLineDash([]);
  ctx.globalAlpha = savedAlpha;
  drawLine(ctx, apex.x, apex.y, leftPoint.x, leftPoint.y);
  drawLine(ctx, apex.x, apex.y, rightPoint.x, rightPoint.y);

  // Draw base ellipse with hidden portions
  if (showHidden) {
    drawEllipseWithHidden(ctx, baseEllipse, baseFront, hiddenAlpha, hiddenDash);
  } else {
    ctx.beginPath();
    ctx.ellipse(
      baseEllipse.cx, baseEllipse.cy,
      baseEllipse.rx, baseEllipse.ry,
      baseEllipse.rotation, baseFront[0], baseFront[1],
    );
    ctx.stroke();
  }
}

/** Cross-contour ellipses tapering from base toward apex. */
export function coneCrossContours(
  opts: ConeRenderOptions,
  count: number,
): { params: EllipseParams; frontHalf: [number, number] }[] {
  const { sizeX, sizeY, sizeZ, matrix } = opts;
  const halfH = sizeY / 2;
  const contours: { params: EllipseParams; frontHalf: [number, number] }[] = [];

  for (let i = 1; i < count; i++) {
    const t = i / count;
    const y = -halfH + t * sizeY;
    // Radius tapers linearly from base to apex
    const taper = 1 - (y + halfH) / sizeY;
    const rx = sizeX * 0.5 * taper;
    const rz = sizeZ * 0.5 * taper;

    if (rx < 0.001 || rz < 0.001) continue;

    const cc = projectVertex({ x: 0, y, z: 0 }, opts);
    const px = projectVertex({ x: rx, y, z: 0 }, opts);
    const pz = projectVertex({ x: 0, y, z: rz }, opts);

    const ax = Math.sqrt((px.x - cc.x) ** 2 + (px.y - cc.y) ** 2);
    const az = Math.sqrt((pz.x - cc.x) ** 2 + (pz.y - cc.y) ** 2);
    const angle = Math.atan2(px.y - cc.y, px.x - cc.x);

    const normalZ = rotate3D({ x: 0, y: 1, z: 0 }, matrix).z;
    const frontHalf: [number, number] = normalZ > 0 ? [0, Math.PI] : [Math.PI, Math.PI * 2];

    contours.push({
      params: { cx: cc.x, cy: cc.y, rx: Math.max(ax, az), ry: Math.min(ax, az), rotation: angle },
      frontHalf,
    });
  }

  return contours;
}

function ellipsePointAt(params: EllipseParams, angle: number): Vec2 {
  const cos = Math.cos(params.rotation);
  const sin = Math.sin(params.rotation);
  const px = params.rx * Math.cos(angle);
  const py = params.ry * Math.sin(angle);
  return {
    x: params.cx + px * cos - py * sin,
    y: params.cy + px * sin + py * cos,
  };
}
