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
  toPixel,
  drawLine,
  drawLabel,
  fillPolyline,
  parseJSON,
  type FormDefinition,
} from "./shared.js";
import { rotationMatrix } from "./math/rotation.js";
import {
  sphereTerminator,
  castShadow,
  sphereValueZones,
  lightDirection2D,
  type LightSource,
  type ValueGrouping,
} from "./math/shadow.js";
import { drawEllipse } from "./math/ellipse.js";

const VALUE_SHAPES_PROPERTIES: LayerPropertySchema[] = [
  {
    key: "formData",
    label: "Forms (JSON)",
    type: "string",
    default: "[]",
    group: "forms",
  },
  {
    key: "lightAzimuth",
    label: "Light Azimuth",
    type: "number",
    default: 315,
    min: 0,
    max: 360,
    step: 15,
    group: "light",
  },
  {
    key: "lightElevation",
    label: "Light Elevation",
    type: "number",
    default: 45,
    min: 10,
    max: 80,
    step: 5,
    group: "light",
  },
  {
    key: "lightIntensity",
    label: "Light Intensity",
    type: "number",
    default: 0.8,
    min: 0.1,
    max: 1.0,
    step: 0.05,
    group: "light",
  },
  {
    key: "showLightIndicator",
    label: "Show Light Indicator",
    type: "boolean",
    default: true,
    group: "display",
  },
  {
    key: "valueGrouping",
    label: "Value Grouping",
    type: "select",
    default: "three-value",
    options: [
      { value: "two-value", label: "2-Value (Light/Shadow)" },
      { value: "three-value", label: "3-Value (Light/Half/Shadow)" },
      { value: "five-value", label: "5-Value (Full Anatomy)" },
    ],
    group: "display",
  },
  {
    key: "shadowColor",
    label: "Shadow Color",
    type: "color",
    default: "rgba(0,0,0,0.3)",
    group: "style",
  },
  {
    key: "lightColor",
    label: "Light Color",
    type: "color",
    default: "rgba(255,255,200,0.15)",
    group: "style",
  },
  {
    key: "halftoneColor",
    label: "Halftone Color",
    type: "color",
    default: "rgba(0,0,0,0.12)",
    group: "style",
  },
  {
    key: "highlightColor",
    label: "Highlight Color",
    type: "color",
    default: "rgba(255,255,255,0.25)",
    group: "style",
  },
  {
    key: "reflectedLightColor",
    label: "Reflected Light Color",
    type: "color",
    default: "rgba(100,100,120,0.15)",
    group: "style",
  },
  {
    key: "showTerminator",
    label: "Show Terminator",
    type: "boolean",
    default: true,
    group: "display",
  },
  {
    key: "terminatorWidth",
    label: "Terminator Width",
    type: "number",
    default: 2,
    min: 1,
    max: 5,
    step: 0.5,
    group: "display",
  },
  {
    key: "showCastShadow",
    label: "Show Cast Shadow",
    type: "boolean",
    default: true,
    group: "display",
  },
  {
    key: "showOcclusionShadow",
    label: "Show Occlusion Shadow",
    type: "boolean",
    default: true,
    group: "display",
  },
  {
    key: "showZoneLabels",
    label: "Show Zone Labels",
    type: "boolean",
    default: false,
    group: "display",
  },
  {
    key: "groundPlaneY",
    label: "Ground Plane Y",
    type: "number",
    default: 0.8,
    min: 0,
    max: 1,
    step: 0.05,
    group: "light",
  },
  ...COMMON_GUIDE_PROPERTIES,
];

export const valueShapesLayerType: LayerTypeDefinition = {
  typeId: "construction:value-shapes",
  displayName: "Value Shapes Study",
  icon: "sun",
  category: "guide",
  properties: VALUE_SHAPES_PROPERTIES,
  propertyEditorId: "construction:value-shapes-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const schema of VALUE_SHAPES_PROPERTIES) {
      props[schema.key] = schema.default;
    }
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
  ): void {
    const formDataJSON = (properties.formData as string) ?? "[]";
    const forms = parseJSON<FormDefinition[]>(formDataJSON, []);

    const lightAzimuth = (properties.lightAzimuth as number) ?? 315;
    const lightElevation = (properties.lightElevation as number) ?? 45;
    const lightIntensity = (properties.lightIntensity as number) ?? 0.8;
    const showIndicator = (properties.showLightIndicator as boolean) ?? true;
    const grouping = (properties.valueGrouping as ValueGrouping) ?? "three-value";
    const shadowColor = (properties.shadowColor as string) ?? "rgba(0,0,0,0.3)";
    const lightColor = (properties.lightColor as string) ?? "rgba(255,255,200,0.15)";
    const halftoneColor = (properties.halftoneColor as string) ?? "rgba(0,0,0,0.12)";
    const highlightColor = (properties.highlightColor as string) ?? "rgba(255,255,255,0.25)";
    const reflectedLightColor = (properties.reflectedLightColor as string) ?? "rgba(100,100,120,0.15)";
    const showTerminator = (properties.showTerminator as boolean) ?? true;
    const terminatorWidth = (properties.terminatorWidth as number) ?? 2;
    const showCastShadow = (properties.showCastShadow as boolean) ?? true;
    const showOcclusion = (properties.showOcclusionShadow as boolean) ?? true;
    const showLabels = (properties.showZoneLabels as boolean) ?? false;
    const groundPlaneY = (properties.groundPlaneY as number) ?? 0.8;

    const light: LightSource = {
      azimuth: lightAzimuth,
      elevation: lightElevation,
      intensity: lightIntensity,
    };

    ctx.save();

    // If no forms provided, use a default sphere
    const effectiveForms = forms.length > 0
      ? forms
      : [{ type: "sphere" as const, position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, rotation: { x: 0, y: 0, z: 0 } }];

    for (const form of effectiveForms) {
      const centerNorm = {
        x: 0.5 + form.position.x * 0.3,
        y: 0.5 - form.position.y * 0.3,
      };
      const center = toPixel(centerNorm, bounds);
      const radius = Math.min(bounds.width, bounds.height) * 0.15 * form.size.x;
      const matrix = rotationMatrix(form.rotation.x, form.rotation.y, form.rotation.z);
      const groundPx = bounds.y + groundPlaneY * bounds.height;

      // Compute and render value zones
      const zones = sphereValueZones(center, radius, light, matrix, grouping);
      const colorMap: Record<string, string> = {
        "highlight": highlightColor,
        "light": lightColor,
        "halftone": halftoneColor,
        "core-shadow": shadowColor,
        "reflected-light": reflectedLightColor,
        "cast-shadow": shadowColor,
        "occlusion-shadow": shadowColor,
      };

      for (const zone of zones) {
        fillPolyline(ctx, zone.path, colorMap[zone.type] ?? shadowColor);
      }

      // Draw terminator
      if (showTerminator) {
        const term = sphereTerminator(center, radius, light, matrix);
        ctx.strokeStyle = "rgba(255,100,0,0.6)";
        ctx.lineWidth = terminatorWidth;
        ctx.setLineDash([]);
        drawEllipse(
          ctx,
          term.terminatorEllipse.cx,
          term.terminatorEllipse.cy,
          term.terminatorEllipse.rx,
          term.terminatorEllipse.ry,
          term.terminatorEllipse.rotation,
        );
      }

      // Cast shadow
      if (showCastShadow) {
        const shadow = castShadow(center, radius, light, groundPx);
        fillPolyline(ctx, shadow, "rgba(0,0,0,0.15)");
      }

      // Occlusion shadow (small dark arc at base)
      if (showOcclusion) {
        const occRadius = radius * 0.15;
        ctx.beginPath();
        ctx.ellipse(center.x, center.y + radius, occRadius * 3, occRadius, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fill();
      }

      // Zone labels
      if (showLabels) {
        for (const zone of zones) {
          if (zone.path.length > 2) {
            // Label at centroid of zone
            let cx = 0, cy = 0;
            for (const p of zone.path) { cx += p.x; cy += p.y; }
            cx /= zone.path.length;
            cy /= zone.path.length;
            drawLabel(ctx, zone.label, cx, cy, "rgba(255,255,255,0.8)", 9);
          }
        }
      }

      // Sphere outline
      ctx.strokeStyle = "rgba(0,200,255,0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Light direction indicator
    if (showIndicator) {
      const ld2d = lightDirection2D(light);
      const indX = bounds.x + bounds.width - 30;
      const indY = bounds.y + 30;
      const indLen = 15;

      ctx.strokeStyle = "rgba(255,220,50,0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      drawLine(ctx, indX, indY, indX + ld2d.x * indLen, indY + ld2d.y * indLen);

      // Sun circle
      ctx.beginPath();
      ctx.arc(indX, indY, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,220,50,0.6)";
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  },

  validate(properties: LayerProperties): ValidationError[] | null {
    const errors: ValidationError[] = [];
    const el = properties.lightElevation;
    if (typeof el === "number" && (el < 10 || el > 80)) {
      errors.push({ property: "lightElevation", message: "Must be 10-80" });
    }
    return errors.length > 0 ? errors : null;
  },
};
