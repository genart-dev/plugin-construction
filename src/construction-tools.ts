import type {
  McpToolDefinition,
  McpToolContext,
  McpToolResult,
  JsonSchema,
  DesignLayer,
  LayerTransform,
  LayerProperties,
} from "@genart-dev/core";
import { formLayerType } from "./form-layer.js";
import { crossContourLayerType } from "./cross-contour-layer.js";
import { valueShapesLayerType } from "./value-shapes-layer.js";
import { envelopeLayerType } from "./envelope-layer.js";
import { intersectionLayerType } from "./intersection-layer.js";
import type { FormType } from "./shared.js";

function textResult(text: string): McpToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(text: string): McpToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function generateLayerId(): string {
  return `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function fullCanvasTransform(ctx: McpToolContext): LayerTransform {
  return {
    x: 0, y: 0,
    width: ctx.canvasWidth, height: ctx.canvasHeight,
    rotation: 0, scaleX: 1, scaleY: 1, anchorX: 0, anchorY: 0,
  };
}

function addLayer(context: McpToolContext, layer: DesignLayer): void {
  context.layers.add(layer);
  context.emitChange("layer-added");
}

const VALID_FORMS: FormType[] = ["box", "cylinder", "sphere", "cone", "wedge", "egg"];

// ---------------------------------------------------------------------------
// add_construction_form
// ---------------------------------------------------------------------------

const addConstructionFormTool: McpToolDefinition = {
  name: "add_construction_form",
  description: "Add a 3D construction form guide layer. Form types: box, cylinder, sphere, cone, wedge, egg.",
  inputSchema: {
    type: "object",
    properties: {
      formType: {
        type: "string",
        enum: VALID_FORMS,
        description: "The form primitive type.",
      },
      position: {
        type: "object",
        properties: { x: { type: "number" }, y: { type: "number" } },
        description: "Normalized position (0-1). Default: {x:0.5, y:0.5}.",
      },
      size: { type: "number", description: "Overall form size (0.05-0.6). Default: 0.25." },
      sizeX: { type: "number", description: "Width scale (0.2-3.0). Default: 1.0." },
      sizeY: { type: "number", description: "Height scale (0.2-3.0). Default: 1.0." },
      sizeZ: { type: "number", description: "Depth scale (0.2-3.0). Default: 1.0." },
      rotationX: { type: "number", description: "X rotation (-90 to 90). Default: 15." },
      rotationY: { type: "number", description: "Y rotation (-180 to 180). Default: 30." },
      rotationZ: { type: "number", description: "Z rotation (-180 to 180). Default: 0." },
      crossContours: { type: "boolean", description: "Show cross-contour lines. Default: true." },
      projection: {
        type: "string",
        enum: ["orthographic", "weak-perspective"],
        description: "Projection type. Default: orthographic.",
      },
    },
    required: ["formType"],
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const formType = input.formType as string;
    if (!VALID_FORMS.includes(formType as FormType)) {
      return errorResult(`Invalid form type '${formType}'. Use: ${VALID_FORMS.join(", ")}`);
    }

    const defaults = formLayerType.createDefault();
    const properties: LayerProperties = { ...defaults, formType };

    if (input.position) properties.position = input.position as { x: number; y: number };
    if (input.size !== undefined) properties.formSize = input.size as number;
    if (input.sizeX !== undefined) properties.sizeX = input.sizeX as number;
    if (input.sizeY !== undefined) properties.sizeY = input.sizeY as number;
    if (input.sizeZ !== undefined) properties.sizeZ = input.sizeZ as number;
    if (input.rotationX !== undefined) properties.rotationX = input.rotationX as number;
    if (input.rotationY !== undefined) properties.rotationY = input.rotationY as number;
    if (input.rotationZ !== undefined) properties.rotationZ = input.rotationZ as number;
    if (input.crossContours !== undefined) properties.showCrossContours = input.crossContours as boolean;
    if (input.projection !== undefined) properties.projection = input.projection as string;

    const id = generateLayerId();
    addLayer(context, {
      id, type: "construction:form", name: `Construction Form (${formType})`,
      visible: true, locked: true, opacity: 1, blendMode: "normal",
      transform: fullCanvasTransform(context), properties,
    });
    return textResult(`Added ${formType} construction form '${id}'.`);
  },
};

// ---------------------------------------------------------------------------
// add_construction_scene
// ---------------------------------------------------------------------------

const addConstructionSceneTool: McpToolDefinition = {
  name: "add_construction_scene",
  description: "Add multiple 3D construction forms arranged as a scene.",
  inputSchema: {
    type: "object",
    properties: {
      forms: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: VALID_FORMS },
            position: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
            size: { type: "number" },
            rotation: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } } },
          },
          required: ["type"],
        },
        description: "Array of form definitions.",
      },
      showAxes: { type: "boolean", description: "Show axes on all forms. Default: true." },
    },
    required: ["forms"],
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const formsInput = input.forms as Array<Record<string, unknown>>;
    if (!Array.isArray(formsInput) || formsInput.length === 0) {
      return errorResult("'forms' must be a non-empty array.");
    }

    const showAxes = (input.showAxes as boolean) ?? true;
    const ids: string[] = [];

    for (const f of formsInput) {
      const formType = f.type as string;
      if (!VALID_FORMS.includes(formType as FormType)) continue;

      const defaults = formLayerType.createDefault();
      const properties: LayerProperties = { ...defaults, formType, showAxes };

      const pos = f.position as { x: number; y: number } | undefined;
      if (pos) properties.position = pos;
      if (f.size !== undefined) properties.formSize = f.size as number;
      const rot = f.rotation as { x: number; y: number; z: number } | undefined;
      if (rot) {
        properties.rotationX = rot.x ?? 15;
        properties.rotationY = rot.y ?? 30;
        properties.rotationZ = rot.z ?? 0;
      }

      const id = generateLayerId();
      ids.push(id);
      addLayer(context, {
        id, type: "construction:form", name: `Construction Form (${formType})`,
        visible: true, locked: true, opacity: 1, blendMode: "normal",
        transform: fullCanvasTransform(context), properties,
      });
    }

    return textResult(`Added ${ids.length} construction form(s): ${ids.join(", ")}.`);
  },
};

// ---------------------------------------------------------------------------
// add_cross_contours
// ---------------------------------------------------------------------------

const addCrossContoursTool: McpToolDefinition = {
  name: "add_cross_contours",
  description: "Add cross-contour lines over an outline + axis path, revealing surface direction on any organic shape.",
  inputSchema: {
    type: "object",
    properties: {
      outline: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } }, description: "Outline points (normalized 0-1)." },
      axis: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } }, description: "Central axis path (normalized 0-1)." },
      curvature: { type: "number", description: "Curvature 0-1 (0=flat, 0.5=cylindrical, 1=spherical). Default: 0.5." },
      count: { type: "number", description: "Number of contour lines (2-20). Default: 8." },
      style: { type: "string", enum: ["elliptical", "angular", "organic"], description: "Contour style. Default: elliptical." },
      curvatureVariation: { type: "array", items: { type: "number" }, description: "Per-contour curvature overrides." },
    },
    required: ["outline", "axis"],
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const outline = input.outline as Array<{ x: number; y: number }>;
    const axis = input.axis as Array<{ x: number; y: number }>;
    if (!Array.isArray(outline) || !Array.isArray(axis) || axis.length < 2) {
      return errorResult("'outline' and 'axis' (min 2 points) are required.");
    }

    const defaults = crossContourLayerType.createDefault();
    const properties: LayerProperties = {
      ...defaults,
      outline: JSON.stringify(outline),
      axis: JSON.stringify(axis),
    };

    if (input.curvature !== undefined) properties.curvature = input.curvature as number;
    if (input.count !== undefined) properties.contourCount = input.count as number;
    if (input.style !== undefined) properties.contourStyle = input.style as string;
    if (input.curvatureVariation !== undefined) {
      properties.curvatureVariation = JSON.stringify(input.curvatureVariation);
    }

    const id = generateLayerId();
    addLayer(context, {
      id, type: "construction:cross-contour", name: "Cross-Contour Lines",
      visible: true, locked: true, opacity: 1, blendMode: "normal",
      transform: fullCanvasTransform(context), properties,
    });
    return textResult(`Added cross-contour layer '${id}'.`);
  },
};

// ---------------------------------------------------------------------------
// add_value_study
// ---------------------------------------------------------------------------

const addValueStudyTool: McpToolDefinition = {
  name: "add_value_study",
  description: "Add a light/shadow value study overlay with terminator, cast shadow, and value zones.",
  inputSchema: {
    type: "object",
    properties: {
      lightAzimuth: { type: "number", description: "Light azimuth 0-360 (0=right, 90=bottom). Default: 315." },
      lightElevation: { type: "number", description: "Light elevation 10-80 degrees. Default: 45." },
      forms: { type: "array", description: "Optional array of FormDefinition objects." },
      valueGrouping: { type: "string", enum: ["two-value", "three-value", "five-value"], description: "Value grouping. Default: three-value." },
      showTerminator: { type: "boolean", description: "Show terminator line. Default: true." },
    },
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const defaults = valueShapesLayerType.createDefault();
    const properties: LayerProperties = { ...defaults };

    if (input.lightAzimuth !== undefined) properties.lightAzimuth = input.lightAzimuth as number;
    if (input.lightElevation !== undefined) properties.lightElevation = input.lightElevation as number;
    if (input.forms !== undefined) properties.formData = JSON.stringify(input.forms);
    if (input.valueGrouping !== undefined) properties.valueGrouping = input.valueGrouping as string;
    if (input.showTerminator !== undefined) properties.showTerminator = input.showTerminator as boolean;

    const id = generateLayerId();
    addLayer(context, {
      id, type: "construction:value-shapes", name: "Value Study",
      visible: true, locked: true, opacity: 1, blendMode: "normal",
      transform: fullCanvasTransform(context), properties,
    });
    return textResult(`Added value study layer '${id}'.`);
  },
};

// ---------------------------------------------------------------------------
// add_envelope
// ---------------------------------------------------------------------------

const addEnvelopeTool: McpToolDefinition = {
  name: "add_envelope",
  description: "Add a straight-line envelope block-in with angle and measurement annotations.",
  inputSchema: {
    type: "object",
    properties: {
      points: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } }, description: "Envelope vertex points (normalized 0-1)." },
      style: { type: "string", enum: ["tight", "loose", "fitted"], description: "Envelope style. Default: tight." },
      showAngles: { type: "boolean", description: "Show angle annotations. Default: true." },
      showPlumbLine: { type: "boolean", description: "Show vertical plumb line. Default: true." },
      showMeasurements: { type: "boolean", description: "Show comparative measurements. Default: false." },
    },
    required: ["points"],
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const points = input.points as Array<{ x: number; y: number }>;
    if (!Array.isArray(points) || points.length < 3) {
      return errorResult("'points' must have at least 3 vertices.");
    }

    const defaults = envelopeLayerType.createDefault();
    const properties: LayerProperties = { ...defaults, envelopePath: JSON.stringify(points) };

    if (input.style !== undefined) properties.envelopeStyle = input.style as string;
    if (input.showAngles !== undefined) properties.showAngles = input.showAngles as boolean;
    if (input.showPlumbLine !== undefined) properties.showPlumbLine = input.showPlumbLine as boolean;
    if (input.showMeasurements !== undefined) properties.showMeasurements = input.showMeasurements as boolean;

    const id = generateLayerId();
    addLayer(context, {
      id, type: "construction:envelope", name: "Envelope Block-In",
      visible: true, locked: true, opacity: 1, blendMode: "normal",
      transform: fullCanvasTransform(context), properties,
    });
    return textResult(`Added envelope layer '${id}'.`);
  },
};

// ---------------------------------------------------------------------------
// add_form_intersection
// ---------------------------------------------------------------------------

const addFormIntersectionTool: McpToolDefinition = {
  name: "add_form_intersection",
  description: "Add intersection lines between two or more overlapping 3D forms.",
  inputSchema: {
    type: "object",
    properties: {
      forms: {
        type: "array", minItems: 2,
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: VALID_FORMS },
            position: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } } },
            size: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } } },
            rotation: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } } },
          },
          required: ["type"],
        },
        description: "Array of form definitions (at least 2).",
      },
      transitionType: { type: "string", enum: ["hard", "soft", "mixed"], description: "Intersection transition type. Default: hard." },
      showForms: { type: "boolean", description: "Render the forms alongside intersection lines. Default: true." },
    },
    required: ["forms"],
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const forms = input.forms as Array<Record<string, unknown>>;
    if (!Array.isArray(forms) || forms.length < 2) {
      return errorResult("'forms' must have at least 2 entries.");
    }

    // Normalize form definitions with defaults
    const normalizedForms = forms.map((f) => ({
      type: (f.type as string) || "box",
      position: (f.position as { x: number; y: number; z: number }) ?? { x: 0, y: 0, z: 0 },
      size: (f.size as { x: number; y: number; z: number }) ?? { x: 1, y: 1, z: 1 },
      rotation: (f.rotation as { x: number; y: number; z: number }) ?? { x: 0, y: 0, z: 0 },
    }));

    const defaults = intersectionLayerType.createDefault();
    const properties: LayerProperties = { ...defaults, forms: JSON.stringify(normalizedForms) };

    if (input.transitionType !== undefined) properties.transitionType = input.transitionType as string;
    if (input.showForms !== undefined) properties.showForms = input.showForms as boolean;

    const id = generateLayerId();
    addLayer(context, {
      id, type: "construction:intersection", name: "Form Intersection",
      visible: true, locked: true, opacity: 1, blendMode: "normal",
      transform: fullCanvasTransform(context), properties,
    });
    return textResult(`Added form intersection layer '${id}'.`);
  },
};

// ---------------------------------------------------------------------------
// generate_construction_exercise
// ---------------------------------------------------------------------------

const generateExerciseTool: McpToolDefinition = {
  name: "generate_construction_exercise",
  description: "Generate a random construction exercise with forms at varying difficulty.",
  inputSchema: {
    type: "object",
    properties: {
      difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"], description: "Exercise difficulty. Default: beginner." },
      formCount: { type: "number", description: "Number of forms (overrides difficulty default)." },
      seed: { type: "number", description: "Random seed for reproducibility." },
      includeValues: { type: "boolean", description: "Include a value study overlay. Default: false." },
      includeIntersections: { type: "boolean", description: "Include intersection lines. Default: false." },
    },
  } satisfies JsonSchema,

  async handler(input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const difficulty = (input.difficulty as string) ?? "beginner";
    const seed = (input.seed as number) ?? Date.now();
    const includeValues = (input.includeValues as boolean) ?? false;
    const includeIntersections = (input.includeIntersections as boolean) ?? false;

    // Simple seeded random
    let s = seed;
    const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

    const defaultCounts: Record<string, number> = { beginner: 1, intermediate: 3, advanced: 5 };
    const formCount = (input.formCount as number) ?? defaultCounts[difficulty] ?? 1;
    const ids: string[] = [];

    const maxRotation: Record<string, number> = { beginner: 30, intermediate: 60, advanced: 90 };
    const rotLimit = maxRotation[difficulty] ?? 30;

    for (let i = 0; i < formCount; i++) {
      const typeIdx = Math.floor(rand() * VALID_FORMS.length);
      const formType = VALID_FORMS[typeIdx]!;

      const posSpread = difficulty === "beginner" ? 0 : 0.3;
      const defaults = formLayerType.createDefault();
      const properties: LayerProperties = {
        ...defaults,
        formType,
        position: { x: 0.5 + (rand() - 0.5) * posSpread, y: 0.5 + (rand() - 0.5) * posSpread },
        formSize: 0.15 + rand() * 0.15,
        rotationX: Math.round((rand() - 0.5) * 2 * rotLimit / 5) * 5,
        rotationY: Math.round((rand() - 0.5) * 2 * 180 / 5) * 5,
        rotationZ: difficulty === "advanced" ? Math.round((rand() - 0.5) * 2 * 45 / 5) * 5 : 0,
        showCrossContours: true,
        showAxes: true,
      };

      const id = generateLayerId();
      ids.push(id);
      addLayer(context, {
        id, type: "construction:form", name: `Exercise Form ${i + 1} (${formType})`,
        visible: true, locked: true, opacity: 1, blendMode: "normal",
        transform: fullCanvasTransform(context), properties,
      });
    }

    // Optional value study
    if (includeValues) {
      const valDefaults = valueShapesLayerType.createDefault();
      const valId = generateLayerId();
      ids.push(valId);
      addLayer(context, {
        id: valId, type: "construction:value-shapes", name: "Exercise Value Study",
        visible: true, locked: true, opacity: 1, blendMode: "normal",
        transform: fullCanvasTransform(context),
        properties: { ...valDefaults, lightAzimuth: Math.round(rand() * 360 / 15) * 15 },
      });
    }

    return textResult(`Generated ${difficulty} exercise with ${formCount} form(s): ${ids.join(", ")}.`);
  },
};

// ---------------------------------------------------------------------------
// clear_construction_guides
// ---------------------------------------------------------------------------

const clearConstructionGuidesTool: McpToolDefinition = {
  name: "clear_construction_guides",
  description: "Remove all construction:* layers from the layer stack.",
  inputSchema: { type: "object", properties: {} } satisfies JsonSchema,

  async handler(_input: Record<string, unknown>, context: McpToolContext): Promise<McpToolResult> {
    const layers = context.layers.getAll();
    const ids = layers.filter((l) => l.type.startsWith("construction:")).map((l) => l.id);

    if (ids.length === 0) return textResult("No construction layers to remove.");

    for (const id of ids) context.layers.remove(id);
    context.emitChange("layer-removed");
    return textResult(`Removed ${ids.length} construction layer(s).`);
  },
};

// ---------------------------------------------------------------------------
// Export all tools
// ---------------------------------------------------------------------------

export const constructionMcpTools: McpToolDefinition[] = [
  addConstructionFormTool,
  addConstructionSceneTool,
  addCrossContoursTool,
  addValueStudyTool,
  addEnvelopeTool,
  addFormIntersectionTool,
  generateExerciseTool,
  clearConstructionGuidesTool,
];
