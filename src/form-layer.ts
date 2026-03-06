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
  toPixel,
  parseCSVColors,
  drawLine,
  drawDashedLine,
  drawPolyline,
  type HiddenEdgeStyle,
  type FormType,
} from "./shared.js";
import { rotationMatrix, rotate3D, project as project3D, type Mat3 } from "./math/rotation.js";
import { drawEllipseWithHidden } from "./math/ellipse.js";
import { renderBox, boxCrossContours } from "./forms/box.js";
import { renderCylinder, cylinderCrossContours } from "./forms/cylinder.js";
import { renderSphere, sphereCrossContours } from "./forms/sphere.js";
import { renderCone, coneCrossContours } from "./forms/cone.js";
import { renderWedge } from "./forms/wedge.js";
import { renderEgg, eggCrossContours } from "./forms/egg.js";

const FORM_PROPERTIES: LayerPropertySchema[] = [
  {
    key: "formType",
    label: "Form Type",
    type: "select",
    default: "box",
    options: [
      { value: "box", label: "Box" },
      { value: "cylinder", label: "Cylinder" },
      { value: "sphere", label: "Sphere" },
      { value: "cone", label: "Cone" },
      { value: "wedge", label: "Wedge" },
      { value: "egg", label: "Egg / Ovoid" },
    ],
    group: "form",
  },
  {
    key: "position",
    label: "Position",
    type: "point",
    default: { x: 0.5, y: 0.5 },
    group: "form",
  },
  {
    key: "formSize",
    label: "Size",
    type: "number",
    default: 0.25,
    min: 0.05,
    max: 0.6,
    step: 0.01,
    group: "form",
  },
  {
    key: "sizeX",
    label: "Width Scale",
    type: "number",
    default: 1.0,
    min: 0.2,
    max: 3.0,
    step: 0.1,
    group: "form",
  },
  {
    key: "sizeY",
    label: "Height Scale",
    type: "number",
    default: 1.0,
    min: 0.2,
    max: 3.0,
    step: 0.1,
    group: "form",
  },
  {
    key: "sizeZ",
    label: "Depth Scale",
    type: "number",
    default: 1.0,
    min: 0.2,
    max: 3.0,
    step: 0.1,
    group: "form",
  },
  {
    key: "rotationX",
    label: "Rotation X",
    type: "number",
    default: 15,
    min: -90,
    max: 90,
    step: 5,
    group: "rotation",
  },
  {
    key: "rotationY",
    label: "Rotation Y",
    type: "number",
    default: 30,
    min: -180,
    max: 180,
    step: 5,
    group: "rotation",
  },
  {
    key: "rotationZ",
    label: "Rotation Z",
    type: "number",
    default: 0,
    min: -180,
    max: 180,
    step: 5,
    group: "rotation",
  },
  {
    key: "projection",
    label: "Projection",
    type: "select",
    default: "orthographic",
    options: [
      { value: "orthographic", label: "Orthographic" },
      { value: "weak-perspective", label: "Weak Perspective" },
    ],
    group: "projection",
  },
  {
    key: "showCrossContours",
    label: "Show Cross-Contours",
    type: "boolean",
    default: true,
    group: "contours",
  },
  {
    key: "crossContourCount",
    label: "Cross-Contour Count",
    type: "number",
    default: 5,
    min: 1,
    max: 12,
    step: 1,
    group: "contours",
  },
  {
    key: "showAxes",
    label: "Show Axes",
    type: "boolean",
    default: true,
    group: "display",
  },
  {
    key: "axisLength",
    label: "Axis Length",
    type: "number",
    default: 1.2,
    min: 0.5,
    max: 2.0,
    step: 0.1,
    group: "display",
  },
  {
    key: "showHiddenEdges",
    label: "Show Hidden Edges",
    type: "boolean",
    default: true,
    group: "display",
  },
  {
    key: "hiddenEdgeStyle",
    label: "Hidden Edge Style",
    type: "select",
    default: "dashed",
    options: [
      { value: "dashed", label: "Dashed" },
      { value: "dotted", label: "Dotted" },
      { value: "faint", label: "Faint" },
      { value: "hidden", label: "Hidden" },
    ],
    group: "display",
  },
  {
    key: "hiddenEdgeAlpha",
    label: "Hidden Edge Alpha",
    type: "number",
    default: 0.3,
    min: 0,
    max: 0.8,
    step: 0.05,
    group: "display",
  },
  {
    key: "edgeColor",
    label: "Edge Color",
    type: "color",
    default: "rgba(0,200,255,0.7)",
    group: "style",
  },
  {
    key: "contourColor",
    label: "Contour Color",
    type: "color",
    default: "rgba(100,255,100,0.5)",
    group: "style",
  },
  {
    key: "axisColors",
    label: "Axis Colors (X,Y,Z)",
    type: "string",
    default: "red,green,blue",
    group: "style",
  },
  ...COMMON_GUIDE_PROPERTIES,
];

export const formLayerType: LayerTypeDefinition = {
  typeId: "construction:form",
  displayName: "Construction Form",
  icon: "cube",
  category: "guide",
  properties: FORM_PROPERTIES,
  propertyEditorId: "construction:form-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const schema of FORM_PROPERTIES) {
      props[schema.key] = schema.default;
    }
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
  ): void {
    const formType = (properties.formType as FormType) ?? "box";
    const pos = properties.position as { x: number; y: number } | undefined;
    const center = toPixel(pos ?? { x: 0.5, y: 0.5 }, bounds);
    const formSize = (properties.formSize as number) ?? 0.25;
    const sizeX = (properties.sizeX as number) ?? 1.0;
    const sizeY = (properties.sizeY as number) ?? 1.0;
    const sizeZ = (properties.sizeZ as number) ?? 1.0;
    const rxDeg = (properties.rotationX as number) ?? 15;
    const ryDeg = (properties.rotationY as number) ?? 30;
    const rzDeg = (properties.rotationZ as number) ?? 0;
    const proj = (properties.projection as "orthographic" | "weak-perspective") ?? "orthographic";
    const showContours = (properties.showCrossContours as boolean) ?? true;
    const contourCount = (properties.crossContourCount as number) ?? 5;
    const showAxes = (properties.showAxes as boolean) ?? true;
    const axisLen = (properties.axisLength as number) ?? 1.2;
    const showHidden = (properties.showHiddenEdges as boolean) ?? true;
    const hiddenStyle = (properties.hiddenEdgeStyle as HiddenEdgeStyle) ?? "dashed";
    const hiddenAlpha = (properties.hiddenEdgeAlpha as number) ?? 0.3;
    const edgeColor = (properties.edgeColor as string) ?? "rgba(0,200,255,0.7)";
    const contourColor = (properties.contourColor as string) ?? "rgba(100,255,100,0.5)";
    const axisColorsCSV = (properties.axisColors as string) ?? "red,green,blue";

    const scale = Math.min(bounds.width, bounds.height) * formSize;
    const matrix = rotationMatrix(rxDeg, ryDeg, rzDeg);
    const focalLength = 5;

    ctx.save();

    const baseOpts = {
      center,
      scale,
      sizeX,
      sizeY,
      sizeZ,
      matrix,
      projection: proj,
      focalLength,
      showHidden,
      hiddenStyle,
      hiddenAlpha,
      edgeColor,
    };

    // Render the form
    switch (formType) {
      case "box":
        renderBox(ctx, baseOpts);
        break;
      case "cylinder":
        renderCylinder(ctx, baseOpts);
        break;
      case "sphere":
        renderSphere(ctx, { ...baseOpts, radius: 0.5 });
        break;
      case "cone":
        renderCone(ctx, baseOpts);
        break;
      case "wedge":
        renderWedge(ctx, baseOpts);
        break;
      case "egg":
        renderEgg(ctx, baseOpts);
        break;
    }

    // Draw cross-contours
    if (showContours) {
      ctx.strokeStyle = contourColor;
      ctx.lineWidth = 0.75;
      const hiddenDash = hiddenStyle === "dotted" ? [2, 3] : [6, 4];

      switch (formType) {
        case "box": {
          const contours = boxCrossContours(baseOpts, contourCount);
          for (const line of contours.front) {
            drawPolyline(ctx, line);
          }
          if (showHidden) {
            ctx.globalAlpha = hiddenAlpha;
            ctx.setLineDash(hiddenDash);
            for (const line of contours.hidden) {
              drawPolyline(ctx, line);
            }
            ctx.globalAlpha = 1;
            ctx.setLineDash([]);
          }
          break;
        }
        case "cylinder": {
          const contours = cylinderCrossContours(baseOpts, contourCount + 1);
          for (const c of contours) {
            drawEllipseWithHidden(ctx, c.params, c.frontHalf, hiddenAlpha, hiddenDash);
          }
          break;
        }
        case "sphere": {
          const latCount = Math.ceil(contourCount / 2);
          const lonCount = Math.floor(contourCount / 2);
          const contours = sphereCrossContours({ ...baseOpts, radius: 0.5 }, latCount + 1, lonCount);
          for (const c of contours) {
            drawEllipseWithHidden(ctx, c.params, c.frontHalf, hiddenAlpha, hiddenDash);
          }
          break;
        }
        case "cone": {
          const contours = coneCrossContours(baseOpts, contourCount + 1);
          for (const c of contours) {
            drawEllipseWithHidden(ctx, c.params, c.frontHalf, hiddenAlpha, hiddenDash);
          }
          break;
        }
        case "egg": {
          const contours = eggCrossContours(baseOpts, contourCount + 1);
          for (const c of contours) {
            drawEllipseWithHidden(ctx, c.params, c.frontHalf, hiddenAlpha, hiddenDash);
          }
          break;
        }
        // wedge: no elliptical contours (uses parallel lines like box)
      }
    }

    // Draw axes
    if (showAxes) {
      const axisColors = parseCSVColors(axisColorsCSV, 3);
      const axisScale = scale * axisLen;

      const axes = [
        { dir: { x: 1, y: 0, z: 0 } as const, color: axisColors[0]! },
        { dir: { x: 0, y: 1, z: 0 } as const, color: axisColors[1]! },
        { dir: { x: 0, y: 0, z: 1 } as const, color: axisColors[2]! },
      ];

      for (const axis of axes) {
        const rotated = rotate3D(axis.dir, matrix);
        const p = project3D(rotated, proj, focalLength);
        const endX = center.x + p.x * axisScale;
        const endY = center.y - p.y * axisScale;

        ctx.strokeStyle = axis.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        drawLine(ctx, center.x, center.y, endX, endY);
      }
    }

    ctx.restore();
  },

  validate(properties: LayerProperties): ValidationError[] | null {
    const errors: ValidationError[] = [];
    const formType = properties.formType as string;
    if (!["box", "cylinder", "sphere", "cone", "wedge", "egg"].includes(formType)) {
      errors.push({ property: "formType", message: "Invalid form type" });
    }
    const rx = properties.rotationX;
    if (typeof rx === "number" && (rx < -90 || rx > 90)) {
      errors.push({ property: "rotationX", message: "Must be -90 to 90" });
    }
    return errors.length > 0 ? errors : null;
  },
};
