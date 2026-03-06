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
  drawLine,
  drawDashedLine,
  drawPolyline,
  drawLabel,
  parseJSON,
} from "./shared.js";
import type { Vec2 } from "./math/rotation.js";
import { dist2 } from "./math/rotation.js";
import {
  computeEnvelope,
  envelopeAngles,
  plumbLine,
  levelLine,
  comparativeMeasure,
} from "./math/envelope.js";

const ENVELOPE_PROPERTIES: LayerPropertySchema[] = [
  { key: "envelopePath", label: "Envelope Points (JSON)", type: "string", default: "[]", group: "envelope" },
  {
    key: "envelopeStyle", label: "Envelope Style", type: "select", default: "tight",
    options: [
      { value: "tight", label: "Tight (Convex Hull)" },
      { value: "loose", label: "Loose (Expanded)" },
      { value: "fitted", label: "Fitted (As Given)" },
    ],
    group: "envelope",
  },
  { key: "showAngles", label: "Show Angles", type: "boolean", default: true, group: "display" },
  { key: "angleThreshold", label: "Angle Threshold", type: "number", default: 10, min: 5, max: 45, step: 5, group: "display" },
  { key: "showPlumbLine", label: "Show Plumb Line", type: "boolean", default: true, group: "display" },
  { key: "plumbLinePoint", label: "Plumb Line Point", type: "point", default: { x: 0.5, y: 0 }, group: "display" },
  { key: "showLevelLines", label: "Show Level Lines", type: "boolean", default: false, group: "display" },
  { key: "levelLinePoints", label: "Level Line Y Positions (JSON)", type: "string", default: "[]", group: "display" },
  { key: "showMeasurements", label: "Show Measurements", type: "boolean", default: false, group: "display" },
  { key: "measurementPairs", label: "Measurement Pairs (JSON)", type: "string", default: "[]", group: "display" },
  { key: "showSubdivisions", label: "Show Subdivisions", type: "boolean", default: false, group: "display" },
  { key: "subdivisionDepth", label: "Subdivision Depth", type: "number", default: 1, min: 0, max: 3, step: 1, group: "display" },
  { key: "envelopeColor", label: "Envelope Color", type: "color", default: "rgba(255,200,0,0.6)", group: "style" },
  { key: "plumbColor", label: "Plumb Color", type: "color", default: "rgba(0,255,0,0.4)", group: "style" },
  { key: "measureColor", label: "Measure Color", type: "color", default: "rgba(255,100,100,0.5)", group: "style" },
  ...COMMON_GUIDE_PROPERTIES,
];

export const envelopeLayerType: LayerTypeDefinition = {
  typeId: "construction:envelope",
  displayName: "Envelope Block-In",
  icon: "pentagon",
  category: "guide",
  properties: ENVELOPE_PROPERTIES,
  propertyEditorId: "construction:envelope-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const schema of ENVELOPE_PROPERTIES) {
      props[schema.key] = schema.default;
    }
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
  ): void {
    const pathNorm = parseJSON<Vec2[]>((properties.envelopePath as string) ?? "[]", []);
    if (pathNorm.length < 3) return;

    const style = (properties.envelopeStyle as "tight" | "loose" | "fitted") ?? "tight";
    const showAngles = (properties.showAngles as boolean) ?? true;
    const angleThreshold = (properties.angleThreshold as number) ?? 10;
    const showPlumb = (properties.showPlumbLine as boolean) ?? true;
    const plumbPt = properties.plumbLinePoint as { x: number; y: number } | undefined;
    const showLevel = (properties.showLevelLines as boolean) ?? false;
    const levelPts = parseJSON<{ y: number }[]>((properties.levelLinePoints as string) ?? "[]", []);
    const showMeasure = (properties.showMeasurements as boolean) ?? false;
    const measurePairs = parseJSON<{ from: Vec2; to: Vec2 }[]>((properties.measurementPairs as string) ?? "[]", []);
    const showSub = (properties.showSubdivisions as boolean) ?? false;
    const subDepth = (properties.subdivisionDepth as number) ?? 1;
    const envColor = (properties.envelopeColor as string) ?? "rgba(255,200,0,0.6)";
    const plumbColor = (properties.plumbColor as string) ?? "rgba(0,255,0,0.4)";
    const measureColor = (properties.measureColor as string) ?? "rgba(255,100,100,0.5)";
    const lineWidth = (properties.lineWidth as number) ?? 1;

    const toPixelPt = (p: Vec2): Vec2 => ({
      x: bounds.x + p.x * bounds.width,
      y: bounds.y + p.y * bounds.height,
    });

    const pixelPath = pathNorm.map(toPixelPt);
    const envelope = computeEnvelope(pixelPath, style);

    ctx.save();

    // Draw envelope
    ctx.strokeStyle = envColor;
    ctx.lineWidth = lineWidth * 1.5;
    ctx.setLineDash([]);
    drawPolyline(ctx, envelope, true);

    // Angle annotations
    if (showAngles) {
      const angles = envelopeAngles(envelope);
      for (const { vertex, angle } of angles) {
        if (Math.abs(angle - 180) > angleThreshold) {
          drawLabel(ctx, `${Math.round(angle)}°`, vertex.x + 12, vertex.y - 12, envColor, 9);
          // Small arc indicator
          ctx.beginPath();
          ctx.arc(vertex.x, vertex.y, 8, 0, Math.PI * 2);
          ctx.strokeStyle = envColor;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Plumb line
    if (showPlumb) {
      const plumbPixel = toPixelPt(plumbPt ?? { x: 0.5, y: 0 });
      const [p1, p2] = plumbLine(plumbPixel, bounds);
      ctx.strokeStyle = plumbColor;
      ctx.lineWidth = 0.75;
      drawDashedLine(ctx, p1.x, p1.y, p2.x, p2.y, [8, 6]);
    }

    // Level lines
    if (showLevel) {
      ctx.strokeStyle = plumbColor;
      ctx.lineWidth = 0.75;
      for (const lp of levelPts) {
        const py = bounds.y + lp.y * bounds.height;
        drawDashedLine(ctx, bounds.x, py, bounds.x + bounds.width, py, [8, 6]);
      }
    }

    // Measurement pairs
    if (showMeasure) {
      ctx.strokeStyle = measureColor;
      ctx.lineWidth = 1;
      for (const pair of measurePairs) {
        const from = toPixelPt(pair.from);
        const to = toPixelPt(pair.to);
        drawLine(ctx, from.x, from.y, to.x, to.y);
        const len = dist2(from, to);
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        drawLabel(ctx, `${Math.round(len)}px`, midX, midY - 8, measureColor, 8);
      }
    }

    // Subdivisions
    if (showSub && subDepth > 0) {
      ctx.strokeStyle = envColor;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 0.5;
      drawSubdivisions(ctx, envelope, subDepth);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  },

  validate(properties: LayerProperties): ValidationError[] | null {
    return null;
  },
};

function drawSubdivisions(ctx: CanvasRenderingContext2D, vertices: Vec2[], depth: number): void {
  if (depth <= 0 || vertices.length < 3) return;

  // Midpoints of each edge
  const midpoints: Vec2[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    midpoints.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }

  // Draw lines connecting midpoints
  ctx.setLineDash([3, 4]);
  for (let i = 0; i < midpoints.length; i++) {
    const a = midpoints[i]!;
    const b = midpoints[(i + 1) % midpoints.length]!;
    drawLine(ctx, a.x, a.y, b.x, b.y);
  }

  if (depth > 1) {
    drawSubdivisions(ctx, midpoints, depth - 1);
  }
}
