import type { Vec2, Vec3, Mat3 } from "../math/rotation.js";
import { rotate3D, project, normalize3, cross3 } from "../math/rotation.js";
import { drawEllipseWithHidden, type EllipseParams } from "../math/ellipse.js";
import { drawLine, applyHiddenEdgeStyle, resetEdgeStyle, type HiddenEdgeStyle } from "../shared.js";

export interface CylinderRenderOptions {
  center: Vec2;
  scale: number;
  sizeX: number; // radius multiplier
  sizeY: number; // height
  sizeZ: number; // radius multiplier (depth)
  matrix: Mat3;
  projection: "orthographic" | "weak-perspective";
  focalLength: number;
  showHidden: boolean;
  hiddenStyle: HiddenEdgeStyle;
  hiddenAlpha: number;
  edgeColor: string;
}

function projectVertex(v: Vec3, opts: CylinderRenderOptions): Vec2 {
  const rotated = rotate3D(v, opts.matrix);
  const p = project(rotated, opts.projection, opts.focalLength);
  return { x: opts.center.x + p.x * opts.scale, y: opts.center.y - p.y * opts.scale };
}

/**
 * Compute the 2D ellipse for a circle at a given height along the cylinder axis.
 * The cylinder axis is Y in local space. The circle lies in the XZ plane.
 */
function cylinderEllipseAt(
  yPos: number,
  opts: CylinderRenderOptions,
): { params: EllipseParams; axisDir: Vec2; topSideVisible: boolean } {
  const { matrix, center, scale, sizeX, sizeZ } = opts;

  // Center of the ellipse
  const center3D: Vec3 = { x: 0, y: yPos, z: 0 };
  const center2D = projectVertex(center3D, opts);

  // The circle normal is the Y axis in local space; transform it
  const yAxisRotated = rotate3D({ x: 0, y: 1, z: 0 }, matrix);
  const topSideVisible = yAxisRotated.z > 0; // Z > 0 means normal points toward viewer

  // The radius in X and Z determines the ellipse axes
  // We compute by transforming two points on the circle
  const px = projectVertex({ x: sizeX * 0.5, y: yPos, z: 0 }, opts);
  const pz = projectVertex({ x: 0, y: yPos, z: sizeZ * 0.5 }, opts);

  // Ellipse semi-axes from center to these projected points
  const ax = Math.sqrt((px.x - center2D.x) ** 2 + (px.y - center2D.y) ** 2);
  const az = Math.sqrt((pz.x - center2D.x) ** 2 + (pz.y - center2D.y) ** 2);

  // Rotation angle of the ellipse on screen
  const angle = Math.atan2(px.y - center2D.y, px.x - center2D.x);

  // Axis direction in 2D (for tangent lines)
  const topP = projectVertex({ x: 0, y: opts.sizeY / 2, z: 0 }, opts);
  const botP = projectVertex({ x: 0, y: -opts.sizeY / 2, z: 0 }, opts);
  const axisDir: Vec2 = {
    x: topP.x - botP.x,
    y: topP.y - botP.y,
  };

  return {
    params: { cx: center2D.x, cy: center2D.y, rx: Math.max(ax, az), ry: Math.min(ax, az), rotation: angle },
    axisDir,
    topSideVisible,
  };
}

export function renderCylinder(ctx: CanvasRenderingContext2D, opts: CylinderRenderOptions): void {
  const { showHidden, hiddenStyle, hiddenAlpha, edgeColor, sizeY } = opts;
  const halfH = sizeY / 2;

  ctx.strokeStyle = edgeColor;
  const savedAlpha = ctx.globalAlpha;

  // Top and bottom ellipses
  const topEllipse = cylinderEllipseAt(halfH, opts);
  const botEllipse = cylinderEllipseAt(-halfH, opts);

  const hiddenDash = hiddenStyle === "dotted" ? [2, 3] : [6, 4];

  // Determine which half of each ellipse is visible
  // Top ellipse: if viewer can see the top, the near half is front-facing
  const topFront: [number, number] = topEllipse.topSideVisible ? [0, Math.PI] : [Math.PI, Math.PI * 2];
  const botFront: [number, number] = !botEllipse.topSideVisible ? [0, Math.PI] : [Math.PI, Math.PI * 2];

  // Draw tangent lines connecting top and bottom ellipses
  // Use the leftmost and rightmost points of the ellipses
  const topLeft = ellipsePointAt(topEllipse.params, Math.PI);
  const topRight = ellipsePointAt(topEllipse.params, 0);
  const botLeft = ellipsePointAt(botEllipse.params, Math.PI);
  const botRight = ellipsePointAt(botEllipse.params, 0);

  ctx.setLineDash([]);
  ctx.globalAlpha = savedAlpha;
  drawLine(ctx, topLeft.x, topLeft.y, botLeft.x, botLeft.y);
  drawLine(ctx, topRight.x, topRight.y, botRight.x, botRight.y);

  // Draw ellipses with hidden portions
  if (showHidden) {
    drawEllipseWithHidden(ctx, topEllipse.params, topFront, hiddenAlpha, hiddenDash);
    drawEllipseWithHidden(ctx, botEllipse.params, botFront, hiddenAlpha, hiddenDash);
  } else {
    // Only draw visible arcs
    ctx.beginPath();
    ctx.ellipse(
      topEllipse.params.cx, topEllipse.params.cy,
      topEllipse.params.rx, topEllipse.params.ry,
      topEllipse.params.rotation, topFront[0], topFront[1],
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(
      botEllipse.params.cx, botEllipse.params.cy,
      botEllipse.params.rx, botEllipse.params.ry,
      botEllipse.params.rotation, botFront[0], botFront[1],
    );
    ctx.stroke();
  }
}

/** Get cross-contour ellipses along the cylinder axis. */
export function cylinderCrossContours(
  opts: CylinderRenderOptions,
  count: number,
): { params: EllipseParams; frontHalf: [number, number] }[] {
  const halfH = opts.sizeY / 2;
  const contours: { params: EllipseParams; frontHalf: [number, number] }[] = [];

  for (let i = 1; i < count; i++) {
    const t = i / count;
    const y = -halfH + t * opts.sizeY;
    const ellipse = cylinderEllipseAt(y, opts);
    const frontHalf: [number, number] = ellipse.topSideVisible ? [0, Math.PI] : [Math.PI, Math.PI * 2];
    contours.push({ params: ellipse.params, frontHalf });
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
