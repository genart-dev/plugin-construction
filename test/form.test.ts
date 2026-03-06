import { describe, it, expect } from "vitest";
import { renderBox, boxCrossContours } from "../src/forms/box.js";
import { identityMatrix, rotationMatrix } from "../src/math/rotation.js";

describe("renderBox", () => {
  it("returns 8 projected vertices", () => {
    // Create a mock context that just tracks calls
    const calls: string[] = [];
    const ctx = {
      beginPath: () => calls.push("beginPath"),
      moveTo: () => calls.push("moveTo"),
      lineTo: () => calls.push("lineTo"),
      stroke: () => calls.push("stroke"),
      setLineDash: () => {},
      getLineDash: () => [],
      globalAlpha: 1,
      strokeStyle: "",
    } as unknown as CanvasRenderingContext2D;

    const vertices = renderBox(ctx, {
      center: { x: 200, y: 200 },
      scale: 100,
      sizeX: 1, sizeY: 1, sizeZ: 1,
      matrix: rotationMatrix(15, 30, 0),
      projection: "orthographic",
      focalLength: 5,
      showHidden: true,
      hiddenStyle: "dashed",
      hiddenAlpha: 0.3,
      edgeColor: "cyan",
    });

    expect(vertices).toHaveLength(8);
    // All vertices should be finite numbers
    for (const v of vertices) {
      expect(isFinite(v.x)).toBe(true);
      expect(isFinite(v.y)).toBe(true);
    }
    // Drawing should have happened
    expect(calls.includes("stroke")).toBe(true);
  });
});

describe("boxCrossContours", () => {
  it("generates contours for visible and hidden faces", () => {
    const opts = {
      center: { x: 200, y: 200 },
      scale: 100,
      sizeX: 1, sizeY: 1, sizeZ: 1,
      matrix: rotationMatrix(15, 30, 0),
      projection: "orthographic" as const,
      focalLength: 5,
      showHidden: true,
      hiddenStyle: "dashed" as const,
      hiddenAlpha: 0.3,
      edgeColor: "cyan",
    };

    const { front, hidden } = boxCrossContours(opts, 4);
    // Should have some contours
    expect(front.length + hidden.length).toBeGreaterThan(0);
    // Each contour should be a pair of points
    for (const line of [...front, ...hidden]) {
      expect(line.length).toBe(2);
    }
  });
});
