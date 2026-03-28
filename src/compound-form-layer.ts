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
  type FormType,
} from "./shared.js";
import { rotationMatrix, rotate3D, project as project3D } from "./math/rotation.js";
import { renderBox } from "./forms/box.js";
import { renderCylinder } from "./forms/cylinder.js";
import { renderSphere } from "./forms/sphere.js";
import { renderCone } from "./forms/cone.js";
import { renderEgg } from "./forms/egg.js";

/** A single component in a compound form. */
export interface CompoundComponent {
  type: FormType;
  /** Offset from parent center (in form-size units). */
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  /** Scale relative to parent form size. */
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

/** Named compound form presets. */
export const COMPOUND_PRESETS: Record<string, CompoundComponent[]> = {
  snowman: [
    { type: "sphere", offsetX: 0, offsetY: 0.35, offsetZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
    { type: "sphere", offsetX: 0, offsetY: -0.05, offsetZ: 0, scaleX: 0.75, scaleY: 0.75, scaleZ: 0.75 },
    { type: "sphere", offsetX: 0, offsetY: -0.35, offsetZ: 0, scaleX: 0.5, scaleY: 0.5, scaleZ: 0.5 },
  ],
  bottle: [
    { type: "cylinder", offsetX: 0, offsetY: 0.15, offsetZ: 0, scaleX: 1, scaleY: 0.7, scaleZ: 1 },
    { type: "cone", offsetX: 0, offsetY: -0.25, offsetZ: 0, scaleX: 0.6, scaleY: 0.3, scaleZ: 0.6 },
    { type: "cylinder", offsetX: 0, offsetY: -0.42, offsetZ: 0, scaleX: 0.3, scaleY: 0.15, scaleZ: 0.3 },
  ],
  mushroom: [
    { type: "sphere", offsetX: 0, offsetY: -0.2, offsetZ: 0, scaleX: 1.2, scaleY: 0.5, scaleZ: 1.2 },
    { type: "cylinder", offsetX: 0, offsetY: 0.2, offsetZ: 0, scaleX: 0.3, scaleY: 0.5, scaleZ: 0.3 },
  ],
  lamp: [
    { type: "cone", offsetX: 0, offsetY: -0.25, offsetZ: 0, scaleX: 1, scaleY: 0.5, scaleZ: 1 },
    { type: "cylinder", offsetX: 0, offsetY: 0.1, offsetZ: 0, scaleX: 0.15, scaleY: 0.5, scaleZ: 0.15 },
    { type: "cylinder", offsetX: 0, offsetY: 0.4, offsetZ: 0, scaleX: 0.5, scaleY: 0.05, scaleZ: 0.5 },
  ],
  tree: [
    { type: "cylinder", offsetX: 0, offsetY: 0.25, offsetZ: 0, scaleX: 0.2, scaleY: 0.5, scaleZ: 0.2 },
    { type: "egg", offsetX: 0, offsetY: -0.2, offsetZ: 0, scaleX: 0.8, scaleY: 0.6, scaleZ: 0.8 },
  ],
};

const COMPOUND_PROPERTIES: LayerPropertySchema[] = [
  {
    key: "preset",
    label: "Preset",
    type: "select",
    default: "snowman",
    options: Object.keys(COMPOUND_PRESETS).map((k) => ({ value: k, label: k.charAt(0).toUpperCase() + k.slice(1) })),
    group: "compound",
  },
  {
    key: "components",
    label: "Components (JSON)",
    type: "string",
    default: "",
    group: "compound",
  },
  {
    key: "position",
    label: "Position",
    type: "point",
    default: { x: 0.5, y: 0.5 },
    group: "compound",
  },
  {
    key: "formSize",
    label: "Size",
    type: "number",
    default: 0.25,
    min: 0.05,
    max: 0.6,
    step: 0.01,
    group: "compound",
  },
  {
    key: "rotX",
    label: "Rotation X (deg)",
    type: "number",
    default: 15,
    min: -90,
    max: 90,
    step: 5,
    group: "compound",
  },
  {
    key: "rotY",
    label: "Rotation Y (deg)",
    type: "number",
    default: 25,
    min: -180,
    max: 180,
    step: 5,
    group: "compound",
  },
  ...COMMON_GUIDE_PROPERTIES,
];

export const compoundFormLayerType: LayerTypeDefinition = {
  typeId: "construction:compound-form",
  displayName: "Compound Form",
  icon: "compound",
  category: "guide",
  properties: COMPOUND_PROPERTIES,
  propertyEditorId: "construction:compound-form-editor",

  createDefault(): LayerProperties {
    const props: LayerProperties = {};
    for (const schema of COMPOUND_PROPERTIES) {
      props[schema.key] = schema.default;
    }
    return props;
  },

  render(
    properties: LayerProperties,
    ctx: CanvasRenderingContext2D,
    bounds: LayerBounds,
    _resources: RenderResources,
  ): void {
    const preset = (properties.preset as string) ?? "snowman";
    const componentsJson = (properties.components as string) ?? "";
    const position = (properties.position as { x: number; y: number }) ?? { x: 0.5, y: 0.5 };
    const formSize = (properties.formSize as number) ?? 0.25;
    const rotX = (properties.rotX as number) ?? 15;
    const rotY = (properties.rotY as number) ?? 25;

    // Resolve components: custom JSON overrides preset
    let components: CompoundComponent[];
    if (componentsJson.trim()) {
      try {
        components = JSON.parse(componentsJson);
      } catch {
        components = COMPOUND_PRESETS[preset] ?? COMPOUND_PRESETS["snowman"]!;
      }
    } else {
      components = COMPOUND_PRESETS[preset] ?? COMPOUND_PRESETS["snowman"]!;
    }

    if (components.length === 0) return;

    const w = bounds.width;
    const h = bounds.height;
    const baseSize = Math.min(w, h) * formSize;
    const cx = bounds.x + w * position.x;
    const cy = bounds.y + h * position.y;

    ctx.save();
    const guideColor = (properties.guideColor as string) ?? "rgba(0,200,255,0.5)";
    const lineWidth = (properties.lineWidth as number) ?? 1;
    const dashPattern = (properties.dashPattern as string) ?? "";
    setupGuideStyle(ctx, guideColor, lineWidth, dashPattern);

    const mat = rotationMatrix(rotX, rotY, 0);

    // Render each component (back to front by z-depth)
    const sorted = components
      .map((comp, i) => {
        const p3d = rotate3D({ x: comp.offsetX * baseSize, y: comp.offsetY * baseSize, z: comp.offsetZ * baseSize }, mat);
        return { comp, z: p3d.z, index: i };
      })
      .sort((a, b) => b.z - a.z); // back first

    for (const { comp } of sorted) {
      const offset = rotate3D(
        { x: comp.offsetX * baseSize, y: comp.offsetY * baseSize, z: comp.offsetZ * baseSize },
        mat,
      );
      const compCx = cx + offset.x;
      const compCy = cy + offset.y;
      const compSize = baseSize * Math.max(comp.scaleX, comp.scaleY);

      // Draw as a simple ellipse representation of each form
      ctx.beginPath();
      const rx = compSize * comp.scaleX * 0.5;
      const ry = compSize * comp.scaleY * 0.5;
      ctx.ellipse(compCx, compCy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      ctx.stroke();

      // Center mark
      ctx.beginPath();
      ctx.arc(compCx, compCy, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  validate(properties: LayerProperties): ValidationError[] | null {
    const componentsJson = properties.components as string;
    if (componentsJson && componentsJson.trim()) {
      try {
        const parsed = JSON.parse(componentsJson);
        if (!Array.isArray(parsed)) {
          return [{ property: "components", message: "Components must be a JSON array" }];
        }
      } catch {
        return [{ property: "components", message: "Invalid JSON for components" }];
      }
    }
    return null;
  },
};
