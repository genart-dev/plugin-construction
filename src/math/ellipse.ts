import type { Vec2 } from "./rotation.js";

export interface EllipseParams {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotation: number; // radians
}

const DEG2RAD = Math.PI / 180;

/**
 * Compute ellipse parameters from a circle viewed at an angle.
 *
 * A circle of `radius` whose normal is tilted by `normalTilt` degrees from
 * the viewer becomes an ellipse with:
 *   - major axis = radius (unchanged)
 *   - minor axis = radius * |cos(normalTilt)|
 *
 * `axisRotation` is the rotation of the ellipse's major axis on the 2D plane (degrees).
 */
export function projectedEllipse(
  center: Vec2,
  radius: number,
  normalTilt: number,
  axisRotation: number,
): EllipseParams {
  const tiltRad = normalTilt * DEG2RAD;
  const minor = radius * Math.abs(Math.cos(tiltRad));
  return {
    cx: center.x,
    cy: center.y,
    rx: radius,
    ry: minor,
    rotation: axisRotation * DEG2RAD,
  };
}

/**
 * Draw an ellipse (or partial arc) on a Canvas2D context.
 * Strokes the path — caller should set strokeStyle/lineWidth beforehand.
 *
 * @param startAngle - Arc start in radians (default 0)
 * @param endAngle - Arc end in radians (default 2π)
 * @param counterclockwise - Direction of arc (default false)
 */
export function drawEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation: number,
  startAngle = 0,
  endAngle = Math.PI * 2,
  counterclockwise = false,
): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), rotation, startAngle, endAngle, counterclockwise);
  ctx.stroke();
}

/**
 * Draw an ellipse with separate visible and hidden arcs.
 * The "front" half (facing viewer) is drawn solid;
 * the "back" half is drawn with the provided hidden style.
 *
 * @param frontHalf - Angle range in radians for the visible portion [start, end]
 * @param hiddenAlpha - Alpha for hidden portion
 * @param hiddenDash - Dash pattern for hidden portion
 */
export function drawEllipseWithHidden(
  ctx: CanvasRenderingContext2D,
  params: EllipseParams,
  frontHalf: [number, number],
  hiddenAlpha: number,
  hiddenDash: number[],
): void {
  const { cx, cy, rx, ry, rotation } = params;
  if (rx < 0.5 || ry < 0.5) return;

  const savedAlpha = ctx.globalAlpha;
  const savedDash = ctx.getLineDash();

  // Draw visible arc
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rotation, frontHalf[0], frontHalf[1], false);
  ctx.stroke();

  // Draw hidden arc
  ctx.globalAlpha = hiddenAlpha;
  ctx.setLineDash(hiddenDash);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rotation, frontHalf[1], frontHalf[0] + Math.PI * 2, false);
  ctx.stroke();

  // Restore
  ctx.globalAlpha = savedAlpha;
  ctx.setLineDash(savedDash);
}

/**
 * Compute points along an ellipse for use in path construction.
 */
export function ellipsePoints(
  params: EllipseParams,
  segments: number,
  startAngle = 0,
  endAngle = Math.PI * 2,
): Vec2[] {
  const { cx, cy, rx, ry, rotation } = params;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const points: Vec2[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + (endAngle - startAngle) * t;
    const px = rx * Math.cos(angle);
    const py = ry * Math.sin(angle);
    points.push({
      x: cx + px * cos - py * sin,
      y: cy + px * sin + py * cos,
    });
  }
  return points;
}

/**
 * Compute the tangent points where lines from an external point touch an ellipse.
 * Returns two angles on the ellipse (approximate — uses sampling).
 */
export function ellipseTangentAngles(
  params: EllipseParams,
  externalPoint: Vec2,
  samples = 72,
): [number, number] {
  const points = ellipsePoints(params, samples);
  let bestLeft = 0;
  let bestRight = 0;
  let maxCross = -Infinity;
  let minCross = Infinity;

  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const dx = p.x - externalPoint.x;
    const dy = p.y - externalPoint.y;
    // Cross product with reference direction (from external to center)
    const refDx = params.cx - externalPoint.x;
    const refDy = params.cy - externalPoint.y;
    const cross = dx * refDy - dy * refDx;
    if (cross > maxCross) {
      maxCross = cross;
      bestLeft = i;
    }
    if (cross < minCross) {
      minCross = cross;
      bestRight = i;
    }
  }

  const step = (Math.PI * 2) / samples;
  return [bestLeft * step, bestRight * step];
}
