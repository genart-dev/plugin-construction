import { describe, it, expect } from "vitest";
import {
  lightDirection,
  lightDirection2D,
  sphereTerminator,
  castShadow,
  sphereValueZones,
} from "../src/math/shadow.js";
import { identityMatrix } from "../src/math/rotation.js";

describe("lightDirection", () => {
  it("returns a unit vector", () => {
    const ld = lightDirection({ azimuth: 315, elevation: 45, intensity: 1 });
    const len = Math.sqrt(ld.x ** 2 + ld.y ** 2 + ld.z ** 2);
    expect(len).toBeCloseTo(1, 4);
  });

  it("elevation 90 points straight down", () => {
    const ld = lightDirection({ azimuth: 0, elevation: 89, intensity: 1 });
    // Should be mostly downward (negative y)
    expect(ld.y).toBeLessThan(-0.9);
  });
});

describe("lightDirection2D", () => {
  it("azimuth 0 points right", () => {
    const ld = lightDirection2D({ azimuth: 0, elevation: 45, intensity: 1 });
    expect(ld.x).toBeCloseTo(1);
    expect(ld.y).toBeCloseTo(0);
  });

  it("azimuth 90 points down", () => {
    const ld = lightDirection2D({ azimuth: 90, elevation: 45, intensity: 1 });
    expect(ld.x).toBeCloseTo(0, 4);
    expect(ld.y).toBeCloseTo(1);
  });
});

describe("sphereTerminator", () => {
  it("returns a valid terminator ellipse", () => {
    const result = sphereTerminator(
      { x: 100, y: 100 }, 50,
      { azimuth: 315, elevation: 45, intensity: 1 },
      identityMatrix(),
    );
    expect(result.terminatorEllipse.cx).toBe(100);
    expect(result.terminatorEllipse.cy).toBe(100);
    expect(result.terminatorEllipse.rx).toBe(50);
    expect(result.terminatorEllipse.ry).toBeLessThanOrEqual(50);
  });
});

describe("castShadow", () => {
  it("returns a polygon of points", () => {
    const shadow = castShadow(
      { x: 200, y: 200 }, 50,
      { azimuth: 315, elevation: 45, intensity: 1 },
      300,
    );
    expect(shadow.length).toBeGreaterThan(3);
  });
});

describe("sphereValueZones", () => {
  it("two-value returns 2 zones", () => {
    const zones = sphereValueZones(
      { x: 100, y: 100 }, 50,
      { azimuth: 315, elevation: 45, intensity: 1 },
      identityMatrix(),
      "two-value",
    );
    expect(zones).toHaveLength(2);
    expect(zones[0]!.type).toBe("light");
  });

  it("three-value returns 3 zones", () => {
    const zones = sphereValueZones(
      { x: 100, y: 100 }, 50,
      { azimuth: 315, elevation: 45, intensity: 1 },
      identityMatrix(),
      "three-value",
    );
    expect(zones).toHaveLength(3);
  });

  it("five-value returns 5 zones", () => {
    const zones = sphereValueZones(
      { x: 100, y: 100 }, 50,
      { azimuth: 315, elevation: 45, intensity: 1 },
      identityMatrix(),
      "five-value",
    );
    expect(zones).toHaveLength(5);
    expect(zones.some((z) => z.type === "highlight")).toBe(true);
    expect(zones.some((z) => z.type === "reflected-light")).toBe(true);
  });

  it("each zone has a non-empty path", () => {
    const zones = sphereValueZones(
      { x: 100, y: 100 }, 50,
      { azimuth: 315, elevation: 45, intensity: 1 },
      identityMatrix(),
      "five-value",
    );
    for (const zone of zones) {
      expect(zone.path.length).toBeGreaterThan(2);
      expect(zone.label).toBeTruthy();
    }
  });
});
