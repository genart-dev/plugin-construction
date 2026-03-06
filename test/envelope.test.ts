import { describe, it, expect } from "vitest";
import {
  computeEnvelope,
  envelopeAngles,
  plumbLine,
  levelLine,
  comparativeMeasure,
  convexHull,
} from "../src/math/envelope.js";

describe("convexHull", () => {
  it("returns all points for a triangle", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }];
    const hull = convexHull(pts);
    expect(hull).toHaveLength(3);
  });

  it("excludes interior points", () => {
    const pts = [
      { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 },
      { x: 1, y: 1 }, // interior
    ];
    const hull = convexHull(pts);
    expect(hull).toHaveLength(4);
  });
});

describe("computeEnvelope", () => {
  it("tight returns convex hull", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }, { x: 0.5, y: 0.3 }];
    const env = computeEnvelope(pts, "tight");
    expect(env).toHaveLength(3); // interior point excluded
  });

  it("fitted returns all points", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }, { x: 0.5, y: 0.3 }];
    const env = computeEnvelope(pts, "fitted");
    expect(env).toHaveLength(4);
  });

  it("loose expands outward from center", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }];
    const tight = computeEnvelope(pts, "tight");
    const loose = computeEnvelope(pts, "loose");
    // Loose should be larger
    const tightArea = shoelaceArea(tight);
    const looseArea = shoelaceArea(loose);
    expect(looseArea).toBeGreaterThan(tightArea);
  });
});

describe("envelopeAngles", () => {
  it("equilateral triangle has ~60° angles", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: Math.sqrt(3) / 2 }];
    const angles = envelopeAngles(pts);
    expect(angles).toHaveLength(3);
    for (const a of angles) {
      expect(a.angle).toBeCloseTo(60, 0);
    }
  });

  it("right angle is 90°", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    const angles = envelopeAngles(pts);
    const rightAngle = angles.find((a) => a.vertex.x === 0 && a.vertex.y === 0);
    expect(rightAngle!.angle).toBeCloseTo(90, 0);
  });
});

describe("plumbLine", () => {
  it("returns vertical line through reference", () => {
    const [a, b] = plumbLine({ x: 50, y: 50 }, { x: 0, y: 0, width: 100, height: 100 });
    expect(a.x).toBe(50);
    expect(b.x).toBe(50);
    expect(a.y).toBe(0);
    expect(b.y).toBe(100);
  });
});

describe("levelLine", () => {
  it("returns horizontal line through reference", () => {
    const [a, b] = levelLine({ x: 50, y: 30 }, { x: 0, y: 0, width: 100, height: 100 });
    expect(a.y).toBe(30);
    expect(b.y).toBe(30);
    expect(a.x).toBe(0);
    expect(b.x).toBe(100);
  });
});

describe("comparativeMeasure", () => {
  it("equal segments have ratio 1", () => {
    const result = comparativeMeasure(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    );
    expect(result.ratio).toBeCloseTo(1);
  });

  it("double length has ratio 2", () => {
    const result = comparativeMeasure(
      [{ x: 0, y: 0 }, { x: 20, y: 0 }],
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    );
    expect(result.ratio).toBeCloseTo(2);
  });
});

function shoelaceArea(pts: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i]!.x * pts[j]!.y - pts[j]!.x * pts[i]!.y;
  }
  return Math.abs(area) / 2;
}
