import type { LayerPropertySchema } from "@genart-dev/core";
import type { Vec2, Vec3 } from "./math/rotation.js";

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

export type FormType = "box" | "cylinder" | "sphere" | "cone" | "wedge" | "egg";

export interface FormDefinition {
  type: FormType;
  position: Vec3;
  size: Vec3; // width, height, depth
  rotation: Vec3; // Euler angles (degrees)
}

export interface ProjectedForm {
  type: FormType;
  center: Vec2;
  bounds: { x: number; y: number; width: number; height: number };
  vertices: Vec2[];
  silhouette: Vec2[];
}

// ---------------------------------------------------------------------------
// Common guide properties (matches plugin-perspective pattern)
// ---------------------------------------------------------------------------

export const COMMON_GUIDE_PROPERTIES: LayerPropertySchema[] = [
  {
    key: "guideColor",
    label: "Guide Color",
    type: "color",
    default: "rgba(0,200,255,0.5)",
    group: "style",
  },
  {
    key: "lineWidth",
    label: "Line Width",
    type: "number",
    default: 1,
    min: 0.5,
    max: 5,
    step: 0.5,
    group: "style",
  },
  {
    key: "dashPattern",
    label: "Dash Pattern",
    type: "string",
    default: "6,4",
    group: "style",
  },
];

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

export function setupGuideStyle(
  ctx: CanvasRenderingContext2D,
  color: string,
  lineWidth: number,
  dashPattern: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  const dashes = dashPattern
    .split(",")
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);
  ctx.setLineDash(dashes.length > 0 ? dashes : [6, 4]);
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dash: number[],
): void {
  const saved = ctx.getLineDash();
  ctx.setLineDash(dash);
  drawLine(ctx, x1, y1, x2, y2);
  ctx.setLineDash(saved);
}

export function drawPolyline(ctx: CanvasRenderingContext2D, points: Vec2[], close = false): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  if (close) ctx.closePath();
  ctx.stroke();
}

export function fillPolyline(ctx: CanvasRenderingContext2D, points: Vec2[], fillStyle: string): void {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

/** Draw text label at a position. */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  fontSize = 10,
): void {
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/** Convert normalized [0,1] position to pixel position within bounds. */
export function toPixel(
  norm: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number },
): Vec2 {
  return {
    x: bounds.x + norm.x * bounds.width,
    y: bounds.y + norm.y * bounds.height,
  };
}

/** Convert pixel position to normalized [0,1] within bounds. */
export function toNorm(
  px: Vec2,
  bounds: { x: number; y: number; width: number; height: number },
): Vec2 {
  return {
    x: (px.x - bounds.x) / bounds.width,
    y: (px.y - bounds.y) / bounds.height,
  };
}

/** Parse a JSON string safely, returning fallback on error. */
export function parseJSON<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/** Parse a comma-separated color list. */
export function parseCSVColors(csv: string, count: number): string[] {
  const parts = csv.split(",").map((s) => s.trim());
  const result: string[] = [];
  const defaults = ["red", "green", "blue"];
  for (let i = 0; i < count; i++) {
    result.push(parts[i] || defaults[i % defaults.length]!);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Hidden edge styles
// ---------------------------------------------------------------------------

export type HiddenEdgeStyle = "dashed" | "dotted" | "faint" | "hidden";

export function applyHiddenEdgeStyle(
  ctx: CanvasRenderingContext2D,
  style: HiddenEdgeStyle,
  alpha: number,
): void {
  switch (style) {
    case "dashed":
      ctx.setLineDash([6, 4]);
      ctx.globalAlpha = alpha;
      break;
    case "dotted":
      ctx.setLineDash([2, 3]);
      ctx.globalAlpha = alpha;
      break;
    case "faint":
      ctx.setLineDash([]);
      ctx.globalAlpha = alpha * 0.5;
      break;
    case "hidden":
      ctx.globalAlpha = 0;
      break;
  }
}

export function resetEdgeStyle(
  ctx: CanvasRenderingContext2D,
  savedAlpha: number,
): void {
  ctx.setLineDash([]);
  ctx.globalAlpha = savedAlpha;
}
