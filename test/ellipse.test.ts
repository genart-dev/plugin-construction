import { describe, it, expect } from "vitest";
import { projectedEllipse, ellipsePoints } from "../src/math/ellipse.js";

describe("projectedEllipse", () => {
  it("returns a circle when normalTilt is 0 (face-on)", () => {
    const e = projectedEllipse({ x: 100, y: 100 }, 50, 0, 0);
    expect(e.rx).toBeCloseTo(50);
    expect(e.ry).toBeCloseTo(50);
  });

  it("returns a line when normalTilt is 90 (edge-on)", () => {
    const e = projectedEllipse({ x: 100, y: 100 }, 50, 90, 0);
    expect(e.rx).toBeCloseTo(50);
    expect(e.ry).toBeCloseTo(0, 1);
  });

  it("minor axis shrinks with tilt", () => {
    const e45 = projectedEllipse({ x: 0, y: 0 }, 50, 45, 0);
    expect(e45.ry).toBeCloseTo(50 * Math.cos(45 * Math.PI / 180), 3);
    expect(e45.rx).toBeCloseTo(50);
  });

  it("preserves center position", () => {
    const e = projectedEllipse({ x: 200, y: 300 }, 50, 30, 0);
    expect(e.cx).toBe(200);
    expect(e.cy).toBe(300);
  });

  it("rotation is converted to radians", () => {
    const e = projectedEllipse({ x: 0, y: 0 }, 50, 0, 90);
    expect(e.rotation).toBeCloseTo(Math.PI / 2);
  });
});

describe("ellipsePoints", () => {
  it("generates the correct number of points", () => {
    const params = { cx: 0, cy: 0, rx: 50, ry: 30, rotation: 0 };
    const pts = ellipsePoints(params, 10);
    expect(pts).toHaveLength(11); // segments + 1
  });

  it("first and last point are close for full ellipse", () => {
    const params = { cx: 100, cy: 100, rx: 50, ry: 30, rotation: 0 };
    const pts = ellipsePoints(params, 36);
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    expect(first.x).toBeCloseTo(last.x, 3);
    expect(first.y).toBeCloseTo(last.y, 3);
  });

  it("points lie on the ellipse", () => {
    const params = { cx: 0, cy: 0, rx: 50, ry: 30, rotation: 0 };
    const pts = ellipsePoints(params, 36);
    for (const p of pts) {
      // (x/rx)^2 + (y/ry)^2 should be close to 1
      const val = (p.x / 50) ** 2 + (p.y / 30) ** 2;
      expect(val).toBeCloseTo(1, 2);
    }
  });
});
