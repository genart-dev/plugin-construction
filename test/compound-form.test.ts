import { describe, it, expect, vi } from "vitest";
import { compoundFormLayerType, COMPOUND_PRESETS } from "../src/compound-form-layer.js";
import type { LayerBounds, RenderResources } from "@genart-dev/core";

const BOUNDS: LayerBounds = { x: 0, y: 0, width: 400, height: 400, rotation: 0, scaleX: 1, scaleY: 1 };
const RESOURCES: RenderResources = {} as RenderResources;

function createMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe("construction:compound-form", () => {
  it("has correct metadata", () => {
    expect(compoundFormLayerType.typeId).toBe("construction:compound-form");
    expect(compoundFormLayerType.category).toBe("guide");
  });

  it("creates defaults", () => {
    const d = compoundFormLayerType.createDefault();
    expect(d.preset).toBe("snowman");
    expect(d.formSize).toBe(0.25);
  });

  it("renders each preset without error", () => {
    for (const preset of Object.keys(COMPOUND_PRESETS)) {
      const ctx = createMockCtx();
      expect(() => compoundFormLayerType.render(
        { ...compoundFormLayerType.createDefault(), preset },
        ctx, BOUNDS, RESOURCES,
      )).not.toThrow();
      expect(ctx.ellipse).toHaveBeenCalled();
    }
  });

  it("renders correct number of components per preset", () => {
    for (const [name, components] of Object.entries(COMPOUND_PRESETS)) {
      const ctx = createMockCtx();
      compoundFormLayerType.render(
        { ...compoundFormLayerType.createDefault(), preset: name },
        ctx, BOUNDS, RESOURCES,
      );
      // Each component renders one ellipse + one arc (center dot)
      expect((ctx.ellipse as any).mock.calls.length).toBe(components.length);
    }
  });

  it("renders custom components from JSON", () => {
    const ctx = createMockCtx();
    const customComponents = [
      { type: "sphere", offsetX: 0, offsetY: 0, offsetZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
      { type: "cylinder", offsetX: 0, offsetY: -0.3, offsetZ: 0, scaleX: 0.5, scaleY: 0.5, scaleZ: 0.5 },
    ];
    compoundFormLayerType.render(
      { ...compoundFormLayerType.createDefault(), components: JSON.stringify(customComponents) },
      ctx, BOUNDS, RESOURCES,
    );
    expect((ctx.ellipse as any).mock.calls.length).toBe(2);
  });

  it("has 5 presets", () => {
    expect(Object.keys(COMPOUND_PRESETS).length).toBe(5);
    expect(COMPOUND_PRESETS["snowman"]).toBeDefined();
    expect(COMPOUND_PRESETS["bottle"]).toBeDefined();
    expect(COMPOUND_PRESETS["mushroom"]).toBeDefined();
    expect(COMPOUND_PRESETS["lamp"]).toBeDefined();
    expect(COMPOUND_PRESETS["tree"]).toBeDefined();
  });

  it("validate accepts valid components JSON", () => {
    expect(compoundFormLayerType.validate({ components: '[{"type":"sphere","offsetX":0,"offsetY":0,"offsetZ":0,"scaleX":1,"scaleY":1,"scaleZ":1}]' })).toBeNull();
  });

  it("validate rejects invalid JSON", () => {
    const errors = compoundFormLayerType.validate({ components: "not json" });
    expect(errors).not.toBeNull();
  });

  it("validate rejects non-array JSON", () => {
    const errors = compoundFormLayerType.validate({ components: '{"type":"sphere"}' });
    expect(errors).not.toBeNull();
  });
});
