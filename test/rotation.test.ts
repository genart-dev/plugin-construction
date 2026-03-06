import { describe, it, expect } from "vitest";
import {
  rotationMatrix,
  rotate3D,
  project,
  transformPoint,
  transformedNormalZ,
  identityMatrix,
  multiplyMat3,
  normalize3,
  dot3,
  cross3,
  clamp,
  type Vec3,
  type Mat3,
} from "../src/math/rotation.js";

const EPSILON = 1e-6;

function expectVec2Close(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
}

function expectVec3Close(actual: Vec3, expected: Vec3) {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
  expect(actual.z).toBeCloseTo(expected.z, 5);
}

function expectMat3Close(actual: Mat3, expected: Mat3) {
  for (let i = 0; i < 9; i++) {
    expect(actual[i]).toBeCloseTo(expected[i]!, 5);
  }
}

describe("clamp", () => {
  it("clamps below min", () => {
    expect(clamp(-100, -90, 90)).toBe(-90);
  });
  it("clamps above max", () => {
    expect(clamp(100, -90, 90)).toBe(90);
  });
  it("passes through in-range values", () => {
    expect(clamp(45, -90, 90)).toBe(45);
  });
});

describe("rotationMatrix", () => {
  it("returns identity when all angles are 0", () => {
    const m = rotationMatrix(0, 0, 0);
    expectMat3Close(m, identityMatrix());
  });

  it("90° Y rotation maps X axis to -Z axis", () => {
    const m = rotationMatrix(0, 90, 0);
    const result = rotate3D({ x: 1, y: 0, z: 0 }, m);
    expectVec3Close(result, { x: 0, y: 0, z: -1 });
  });

  it("90° Z rotation maps X axis to Y axis", () => {
    const m = rotationMatrix(0, 0, 90);
    const result = rotate3D({ x: 1, y: 0, z: 0 }, m);
    expectVec3Close(result, { x: 0, y: 1, z: 0 });
  });

  it("90° X rotation maps Y axis to Z axis", () => {
    const m = rotationMatrix(90, 0, 0);
    const result = rotate3D({ x: 0, y: 1, z: 0 }, m);
    expectVec3Close(result, { x: 0, y: 0, z: 1 });
  });

  it("clamps rotationX beyond ±90", () => {
    const m1 = rotationMatrix(100, 0, 0);
    const m2 = rotationMatrix(90, 0, 0);
    expectMat3Close(m1, m2);

    const m3 = rotationMatrix(-120, 0, 0);
    const m4 = rotationMatrix(-90, 0, 0);
    expectMat3Close(m3, m4);
  });

  it("preserves vector length (orthogonal matrix)", () => {
    const m = rotationMatrix(30, 45, 60);
    const v: Vec3 = { x: 1, y: 2, z: 3 };
    const r = rotate3D(v, m);
    const lenBefore = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
    const lenAfter = Math.sqrt(r.x ** 2 + r.y ** 2 + r.z ** 2);
    expect(lenAfter).toBeCloseTo(lenBefore, 5);
  });

  it("combined rotation applies in ZYX order", () => {
    // R = Rz(30) * Ry(45) * Rx(15)
    const m = rotationMatrix(15, 45, 30);
    const p: Vec3 = { x: 1, y: 0, z: 0 };
    const result = rotate3D(p, m);
    // For x-axis unit vector rotated by Ry(45) then Rz(30):
    // After Ry(45): (cos45, 0, -sin45) = (0.7071, 0, -0.7071)
    // After Rz(30): (cos30*0.7071, sin30*0.7071, -0.7071) ≈ (0.6124, 0.3536, -0.7071)
    // Rx(15) on x-axis doesn't change x, so close to this
    expect(result.x).toBeCloseTo(0.6124, 3);
  });

  it("180° Y rotation maps X to -X, Z to -Z", () => {
    const m = rotationMatrix(0, 180, 0);
    const r = rotate3D({ x: 1, y: 0, z: 1 }, m);
    expectVec3Close(r, { x: -1, y: 0, z: -1 });
  });
});

describe("rotate3D", () => {
  it("identity matrix leaves point unchanged", () => {
    const p: Vec3 = { x: 3, y: -2, z: 7 };
    const result = rotate3D(p, identityMatrix());
    expectVec3Close(result, p);
  });

  it("rotates origin to origin", () => {
    const m = rotationMatrix(45, 45, 45);
    const result = rotate3D({ x: 0, y: 0, z: 0 }, m);
    expectVec3Close(result, { x: 0, y: 0, z: 0 });
  });
});

describe("project", () => {
  it("orthographic drops Z", () => {
    const result = project({ x: 3, y: 4, z: 100 }, "orthographic");
    expectVec2Close(result, { x: 3, y: 4 });
  });

  it("weak-perspective scales by focal length", () => {
    const result = project({ x: 2, y: 3, z: 0 }, "weak-perspective", 5);
    // z=0: scale = 5/(5+0) = 1, no change
    expectVec2Close(result, { x: 2, y: 3 });
  });

  it("weak-perspective shrinks with positive Z", () => {
    const result = project({ x: 2, y: 3, z: 5 }, "weak-perspective", 5);
    // scale = 5/(5+5) = 0.5
    expectVec2Close(result, { x: 1, y: 1.5 });
  });

  it("weak-perspective enlarges with negative Z (closer to camera)", () => {
    const result = project({ x: 2, y: 3, z: -2.5 }, "weak-perspective", 5);
    // scale = 5/(5-2.5) = 2
    expectVec2Close(result, { x: 4, y: 6 });
  });

  it("defaults to orthographic", () => {
    const result = project({ x: 5, y: 6, z: 10 });
    expectVec2Close(result, { x: 5, y: 6 });
  });
});

describe("transformPoint", () => {
  it("identity rotation + orthographic = drop Z", () => {
    const result = transformPoint({ x: 1, y: 2, z: 3 }, 0, 0, 0);
    expectVec2Close(result, { x: 1, y: 2 });
  });

  it("90° Y rotation + orthographic: x=1 -> x≈0", () => {
    const result = transformPoint({ x: 1, y: 0, z: 0 }, 0, 90, 0);
    expectVec2Close(result, { x: 0, y: 0 });
  });

  it("with weak-perspective foreshortening", () => {
    const result = transformPoint({ x: 1, y: 0, z: 0 }, 0, 0, 0, "weak-perspective", 5);
    // No Z after identity rotation of (1,0,0), so scale=1
    expectVec2Close(result, { x: 1, y: 0 });
  });
});

describe("transformedNormalZ", () => {
  it("front-facing normal has positive Z with identity", () => {
    const m = identityMatrix();
    expect(transformedNormalZ({ x: 0, y: 0, z: 1 }, m)).toBeCloseTo(1);
  });

  it("back-facing normal has negative Z with identity", () => {
    const m = identityMatrix();
    expect(transformedNormalZ({ x: 0, y: 0, z: -1 }, m)).toBeCloseTo(-1);
  });

  it("90° Y rotation makes X-normal back-facing", () => {
    const m = rotationMatrix(0, 90, 0);
    // X-normal (1,0,0) after 90° Y -> (0,0,-1) -> Z = -1
    expect(transformedNormalZ({ x: 1, y: 0, z: 0 }, m)).toBeCloseTo(-1);
  });
});

describe("multiplyMat3", () => {
  it("identity * identity = identity", () => {
    const id = identityMatrix();
    expectMat3Close(multiplyMat3(id, id), id);
  });

  it("A * identity = A", () => {
    const m = rotationMatrix(30, 45, 60);
    expectMat3Close(multiplyMat3(m, identityMatrix()), m);
  });
});

describe("normalize3", () => {
  it("normalizes a non-zero vector", () => {
    const n = normalize3({ x: 3, y: 0, z: 4 });
    expect(n.x).toBeCloseTo(0.6, 5);
    expect(n.y).toBeCloseTo(0, 5);
    expect(n.z).toBeCloseTo(0.8, 5);
  });

  it("returns zero for zero vector", () => {
    const n = normalize3({ x: 0, y: 0, z: 0 });
    expectVec3Close(n, { x: 0, y: 0, z: 0 });
  });
});

describe("dot3", () => {
  it("dot of perpendicular vectors is 0", () => {
    expect(dot3({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(0);
  });

  it("dot of parallel vectors is product of lengths", () => {
    expect(dot3({ x: 2, y: 0, z: 0 }, { x: 3, y: 0, z: 0 })).toBeCloseTo(6);
  });
});

describe("cross3", () => {
  it("X cross Y = Z", () => {
    const c = cross3({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    expectVec3Close(c, { x: 0, y: 0, z: 1 });
  });

  it("Y cross X = -Z", () => {
    const c = cross3({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 });
    expectVec3Close(c, { x: 0, y: 0, z: -1 });
  });
});
