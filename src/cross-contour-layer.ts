import type {
  LayerTypeDefinition,
  LayerPropertySchema,
  LayerProperties,
  LayerBounds,
  RenderResources,
  ValidationError,
} from "@genart-dev/core";
import {
  COMMON_GUIDE_PROPERTIES,
  setupGuideStyle,
  drawPolyline,
  parseJSON,
} from "./shared.js";
import type { Vec2 } from "./math/rotation.js";
import { dist2, lerp2 } from "./math/rotation.js";

const CROSS_CONTOUR_PROPERTIES: LayerPropertySchema[] = [
  { key: "outline", label: "Outline Points (JSON)", type: "string", default: "[]", group: "shape" },
  { key: "axis", label: "Axis Points (JSON)", type: "string", default: "[]", group: "shape" },
  { key: "contourCount", label: "Contour Count", type: "number", default: 8, min: 2, max: 20, step: 1, group: "contours" },
  { key: "curvature", label: "Curvature", type: "number", default: 0.5, min: 0, max: 1, step: 0.05, group: "contours" },
  { key: "curvatureVariation", label: "Curvature Variation (JSON)", type: "string", default: "[]", group: "contours" },
  {
    key: "contourStyle", label: "Contour Style", type: "select", default: "elliptical",
    options: [
      { value: "elliptical", label: "Elliptical" },
      { value: "angular", label: "Angular" },
      { value: "organic", label: "Organic" },
    ],
    group: "contours",
  },
  { key: "showAxis", label: "Show Axis", type: "boolean", default: true, group: "display" },
  { key: "showOutline", label: "Show Outline", type: "boolean", default: true, group: "display" },
  {
    key: "wrapDirection", label: "Wrap Direction", type: "select", default: "perpendicular",
    options: [{ value: "perpendicular", label: "Perpendicular" }, { value: "custom", label: "Custom" }],
    group: "contours",
  },
  {
    key: "contourSpacing", label: "Contour Spacing", type: "select", default: "even",
    options: [{ value: "even", label: "Even" }, { value: "perspective", label: "Perspective" }],
    group: "contours",
  },
  ...COMMON_GUIDE_PROPERTIES,
];

export const crossContourLayerType: LayerTypeDefinition = {
  typeId: "construction:cross-contour",
  displayName: "Cross-Contour Lines",
  icon: "waves",
  category: "guide",
  properties: CROSS_CONTOUR_PROPERTIES,
  propertyEditorId: "construction:cross-contour-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const schema of CROSS_CONTOUR_PROPERTIES) {
      props[schema.key] = schema.default;
    }
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
  ): void {
    const outlineNorm = parseJSON<Vec2[]>((properties.outline as string) ?? "[]", []);
    const axisNorm = parseJSON<Vec2[]>((properties.axis as string) ?? "[]", []);
    if (axisNorm.length < 2) return;

    const contourCount = (properties.contourCount as number) ?? 8;
    const curvature = (properties.curvature as number) ?? 0.5;
    const curvatureVar = parseJSON<number[]>((properties.curvatureVariation as string) ?? "[]", []);
    const contourStyle = (properties.contourStyle as string) ?? "elliptical";
    const showAxis = (properties.showAxis as boolean) ?? true;
    const showOutline = (properties.showOutline as boolean) ?? true;
    const spacing = (properties.contourSpacing as string) ?? "even";
    const color = (properties.guideColor as string) ?? "rgba(0,200,255,0.5)";
    const lineWidth = (properties.lineWidth as number) ?? 1;

    const toPixelPt = (p: Vec2): Vec2 => ({
      x: bounds.x + p.x * bounds.width,
      y: bounds.y + p.y * bounds.height,
    });

    const outline = outlineNorm.map(toPixelPt);
    const axis = axisNorm.map(toPixelPt);

    ctx.save();

    if (showOutline && outline.length >= 2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * 0.7;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([4, 3]);
      drawPolyline(ctx, outline, true);
      ctx.globalAlpha = 1;
    }

    if (showAxis && axis.length >= 2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * 0.5;
      ctx.setLineDash([3, 5]);
      ctx.globalAlpha = 0.4;
      drawPolyline(ctx, axis);
      ctx.globalAlpha = 1;
    }

    const axisPoints = interpolatePolyline(axis, 200);

    setupGuideStyle(ctx, color, lineWidth, "");
    ctx.setLineDash([]);

    for (let i = 0; i < contourCount; i++) {
      let t: number;
      if (spacing === "perspective") {
        const raw = (i + 1) / (contourCount + 1);
        t = 0.5 + (raw - 0.5) * Math.sqrt(Math.abs(raw - 0.5) * 2) * Math.sign(raw - 0.5);
      } else {
        t = (i + 1) / (contourCount + 1);
      }

      const axisIdx = Math.floor(t * (axisPoints.length - 1));
      const axisPoint = axisPoints[Math.min(axisIdx, axisPoints.length - 1)]!;

      const prevIdx = Math.max(0, axisIdx - 1);
      const nextIdx = Math.min(axisPoints.length - 1, axisIdx + 1);
      const tangent = {
        x: axisPoints[nextIdx]!.x - axisPoints[prevIdx]!.x,
        y: axisPoints[nextIdx]!.y - axisPoints[prevIdx]!.y,
      };
      const tangentLen = Math.sqrt(tangent.x ** 2 + tangent.y ** 2);
      if (tangentLen < 0.001) continue;

      const perpX = -tangent.y / tangentLen;
      const perpY = tangent.x / tangentLen;

      const leftEdge = findOutlineIntersection(axisPoint, { x: perpX, y: perpY }, outline);
      const rightEdge = findOutlineIntersection(axisPoint, { x: -perpX, y: -perpY }, outline);
      if (!leftEdge || !rightEdge) continue;

      const curv = curvatureVar[i] ?? curvature;
      const contourLine = generateContourLine(leftEdge, rightEdge, axisPoint, curv, contourStyle);
      drawPolyline(ctx, contourLine);
    }

    ctx.restore();
  },

  validate(properties: LayerProperties): ValidationError[] | null {
    const errors: ValidationError[] = [];
    const count = properties.contourCount;
    if (typeof count === "number" && (count < 2 || count > 20)) {
      errors.push({ property: "contourCount", message: "Must be 2-20" });
    }
    return errors.length > 0 ? errors : null;
  },
};

function polylineLength(points: Vec2[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist2(points[i - 1]!, points[i]!);
  return len;
}

function interpolatePolyline(points: Vec2[], targetCount: number): Vec2[] {
  if (points.length < 2) return points;
  const totalLen = polylineLength(points);
  if (totalLen < 0.001) return points;

  const result: Vec2[] = [];
  const step = totalLen / (targetCount - 1);
  let segIdx = 0;
  let segStart = 0;

  for (let i = 0; i < targetCount; i++) {
    const target = i * step;
    while (segIdx < points.length - 2) {
      const segLen = dist2(points[segIdx]!, points[segIdx + 1]!);
      if (segStart + segLen >= target) break;
      segStart += segLen;
      segIdx++;
    }
    const segLen = dist2(points[segIdx]!, points[segIdx + 1]!);
    const t = segLen > 0 ? (target - segStart) / segLen : 0;
    result.push(lerp2(points[segIdx]!, points[segIdx + 1]!, Math.min(1, Math.max(0, t))));
  }
  return result;
}

function findOutlineIntersection(origin: Vec2, direction: Vec2, outline: Vec2[]): Vec2 | null {
  let bestT = Infinity;
  let bestPoint: Vec2 | null = null;

  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const denom = direction.x * dy - direction.y * dx;
    if (Math.abs(denom) < 1e-10) continue;

    const t = ((a.x - origin.x) * dy - (a.y - origin.y) * dx) / denom;
    const u = ((a.x - origin.x) * direction.y - (a.y - origin.y) * direction.x) / denom;

    if (t > 0 && u >= 0 && u <= 1 && t < bestT) {
      bestT = t;
      bestPoint = { x: origin.x + direction.x * t, y: origin.y + direction.y * t };
    }
  }
  return bestPoint;
}

function generateContourLine(
  left: Vec2, right: Vec2, axisPoint: Vec2, curvature: number, style: string,
): Vec2[] {
  const segments = 20;
  const points: Vec2[] = [];
  const lrDx = right.x - left.x, lrDy = right.y - left.y;
  const lrLen = Math.sqrt(lrDx * lrDx + lrDy * lrDy);

  if (lrLen < 0.001) return [left, right];

  const perpX = -lrDy / lrLen, perpY = lrDx / lrLen;
  const toAxisX = axisPoint.x - (left.x + right.x) / 2;
  const toAxisY = axisPoint.y - (left.y + right.y) / 2;
  const sign = (perpX * toAxisX + perpY * toAxisY) > 0 ? 1 : -1;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const baseX = left.x + (right.x - left.x) * t;
    const baseY = left.y + (right.y - left.y) * t;

    let offset: number;
    if (style === "angular") {
      offset = curvature * (1 - Math.abs(t - 0.5) * 2) * lrLen * 0.3 * sign;
    } else {
      offset = curvature * Math.sin(t * Math.PI) * lrLen * 0.3 * sign;
    }
    points.push({ x: baseX + perpX * offset, y: baseY + perpY * offset });
  }
  return points;
}
