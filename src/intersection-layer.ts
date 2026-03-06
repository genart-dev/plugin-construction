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
  drawPolyline,
  drawLabel,
  parseJSON,
  toPixel,
  type FormDefinition,
  type FormType,
} from "./shared.js";
import { rotationMatrix, rotate3D, project as project3D } from "./math/rotation.js";
import { renderBox } from "./forms/box.js";
import { renderCylinder } from "./forms/cylinder.js";
import { renderSphere } from "./forms/sphere.js";
import { renderCone } from "./forms/cone.js";
import { renderWedge } from "./forms/wedge.js";
import { renderEgg } from "./forms/egg.js";
import { approximateIntersection } from "./math/intersection.js";

const INTERSECTION_PROPERTIES: LayerPropertySchema[] = [
  { key: "forms", label: "Forms (JSON)", type: "string", default: "[]", group: "forms" },
  { key: "showForms", label: "Show Forms", type: "boolean", default: true, group: "display" },
  { key: "showIntersectionLines", label: "Show Intersection Lines", type: "boolean", default: true, group: "display" },
  { key: "intersectionWidth", label: "Intersection Width", type: "number", default: 2.5, min: 1, max: 6, step: 0.5, group: "style" },
  { key: "intersectionColor", label: "Intersection Color", type: "color", default: "rgba(255,50,50,0.8)", group: "style" },
  {
    key: "intersectionStyle", label: "Intersection Style", type: "select", default: "solid",
    options: [
      { value: "solid", label: "Solid" },
      { value: "bold", label: "Bold" },
      { value: "emphasized", label: "Emphasized" },
    ],
    group: "style",
  },
  { key: "showFormLabels", label: "Show Form Labels", type: "boolean", default: false, group: "display" },
  {
    key: "transitionType", label: "Transition Type", type: "select", default: "hard",
    options: [
      { value: "hard", label: "Hard" },
      { value: "soft", label: "Soft" },
      { value: "mixed", label: "Mixed" },
    ],
    group: "display",
  },
  ...COMMON_GUIDE_PROPERTIES,
];

export const intersectionLayerType: LayerTypeDefinition = {
  typeId: "construction:intersection",
  displayName: "Form Intersection",
  icon: "intersect",
  category: "guide",
  properties: INTERSECTION_PROPERTIES,
  propertyEditorId: "construction:intersection-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const schema of INTERSECTION_PROPERTIES) {
      props[schema.key] = schema.default;
    }
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
  ): void {
    const forms = parseJSON<FormDefinition[]>((properties.forms as string) ?? "[]", []);
    if (forms.length < 2) return;

    const showForms = (properties.showForms as boolean) ?? true;
    const showIntersections = (properties.showIntersectionLines as boolean) ?? true;
    const intWidth = (properties.intersectionWidth as number) ?? 2.5;
    const intColor = (properties.intersectionColor as string) ?? "rgba(255,50,50,0.8)";
    const intStyle = (properties.intersectionStyle as string) ?? "solid";
    const showLabels = (properties.showFormLabels as boolean) ?? false;
    const transition = (properties.transitionType as string) ?? "hard";
    const guideColor = (properties.guideColor as string) ?? "rgba(0,200,255,0.5)";
    const lineWidth = (properties.lineWidth as number) ?? 1;

    const scale = Math.min(bounds.width, bounds.height) * 0.15;

    ctx.save();

    // Render each form
    if (showForms) {
      for (let fi = 0; fi < forms.length; fi++) {
        const form = forms[fi]!;
        const centerNorm = {
          x: 0.5 + form.position.x * 0.3,
          y: 0.5 - form.position.y * 0.3,
        };
        const center = toPixel(centerNorm, bounds);
        const matrix = rotationMatrix(form.rotation.x, form.rotation.y, form.rotation.z);

        const baseOpts = {
          center,
          scale,
          sizeX: form.size.x,
          sizeY: form.size.y,
          sizeZ: form.size.z,
          matrix,
          projection: "orthographic" as const,
          focalLength: 5,
          showHidden: true,
          hiddenStyle: "dashed" as const,
          hiddenAlpha: 0.2,
          edgeColor: guideColor,
        };

        switch (form.type) {
          case "box": renderBox(ctx, baseOpts); break;
          case "cylinder": renderCylinder(ctx, baseOpts); break;
          case "sphere": renderSphere(ctx, { ...baseOpts, radius: 0.5 }); break;
          case "cone": renderCone(ctx, baseOpts); break;
          case "wedge": renderWedge(ctx, baseOpts); break;
          case "egg": renderEgg(ctx, baseOpts); break;
        }

        if (showLabels) {
          const label = String.fromCharCode(65 + fi); // A, B, C...
          drawLabel(ctx, label, center.x, center.y - scale * 0.6, guideColor, 12);
        }
      }
    }

    // Compute and render intersection lines between all pairs
    if (showIntersections) {
      ctx.strokeStyle = intColor;
      ctx.lineWidth = intStyle === "bold" ? intWidth * 1.5 : intWidth;
      ctx.setLineDash(intStyle === "emphasized" ? [2, 0] : []);

      for (let i = 0; i < forms.length - 1; i++) {
        for (let j = i + 1; j < forms.length; j++) {
          const curve = approximateIntersection(forms[i]!, forms[j]!, 16);
          if (curve.length < 2) continue;

          // Convert from form-local space to screen space
          const screenCurve = curve.map((p) => ({
            x: bounds.x + bounds.width / 2 + p.x * scale,
            y: bounds.y + bounds.height / 2 - p.y * scale,
          }));

          if (transition === "soft") {
            // Wider, semi-transparent for soft transitions
            ctx.lineWidth = intWidth * 2;
            ctx.globalAlpha = 0.4;
            drawPolyline(ctx, screenCurve);
            ctx.globalAlpha = 1;
            ctx.lineWidth = intWidth;
          }

          drawPolyline(ctx, screenCurve);
        }
      }
    }

    ctx.restore();
  },

  validate(properties: LayerProperties): ValidationError[] | null {
    return null;
  },
};
