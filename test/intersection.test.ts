import { describe, it, expect } from "vitest";
import { approximateIntersection } from "../src/math/intersection.js";
import type { FormDefinition } from "../src/shared.js";

describe("approximateIntersection", () => {
  it("returns points for overlapping spheres", () => {
    const sphere1: FormDefinition = {
      type: "sphere",
      position: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 },
    };
    const sphere2: FormDefinition = {
      type: "sphere",
      position: { x: 0.5, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 },
    };

    const curve = approximateIntersection(sphere1, sphere2, 12);
    expect(curve.length).toBeGreaterThan(0);
  });

  it("returns empty for non-overlapping forms", () => {
    const box1: FormDefinition = {
      type: "box",
      position: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 },
    };
    const box2: FormDefinition = {
      type: "box",
      position: { x: 10, y: 10, z: 10 },
      size: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 },
    };

    const curve = approximateIntersection(box1, box2, 8);
    expect(curve).toHaveLength(0);
  });

  it("returns ordered 2D points", () => {
    const cyl: FormDefinition = {
      type: "cylinder",
      position: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 2, z: 1 },
      rotation: { x: 0, y: 0, z: 0 },
    };
    const box: FormDefinition = {
      type: "box",
      position: { x: 0.3, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 },
    };

    const curve = approximateIntersection(cyl, box, 10);
    for (const p of curve) {
      expect(typeof p.x).toBe("number");
      expect(typeof p.y).toBe("number");
      expect(isNaN(p.x)).toBe(false);
      expect(isNaN(p.y)).toBe(false);
    }
  });
});
