/** 3D vector. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 2D vector. */
export interface Vec2 {
  x: number;
  y: number;
}

/** 3x3 matrix stored as row-major flat array. */
export type Mat3 = [
  number, number, number,
  number, number, number,
  number, number, number,
];

const DEG2RAD = Math.PI / 180;

/** Clamp a value to [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Build a ZYX Euler rotation matrix from angles in degrees.
 * rotationX is clamped to [-90, 90] to avoid gimbal lock.
 *
 * R = Rz * Ry * Rx
 */
export function rotationMatrix(rxDeg: number, ryDeg: number, rzDeg: number): Mat3 {
  const rx = clamp(rxDeg, -90, 90) * DEG2RAD;
  const ry = ryDeg * DEG2RAD;
  const rz = rzDeg * DEG2RAD;

  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);

  // Rz * Ry * Rx (row-major)
  return [
    cz * cy,                        cz * sy * sx - sz * cx,          cz * sy * cx + sz * sx,
    sz * cy,                        sz * sy * sx + cz * cx,          sz * sy * cx - cz * sx,
    -sy,                            cy * sx,                         cy * cx,
  ];
}

/** Multiply a Mat3 by a Vec3, returning a new Vec3. */
export function rotate3D(point: Vec3, m: Mat3): Vec3 {
  return {
    x: m[0] * point.x + m[1] * point.y + m[2] * point.z,
    y: m[3] * point.x + m[4] * point.y + m[5] * point.z,
    z: m[6] * point.x + m[7] * point.y + m[8] * point.z,
  };
}

/**
 * Project a 3D point to 2D.
 *
 * - "orthographic": drops Z (screen.x = point.x, screen.y = point.y)
 * - "weak-perspective": mild foreshortening based on Z depth
 *   scale = focalLength / (focalLength + point.z)
 */
export function project(
  point: Vec3,
  projection: "orthographic" | "weak-perspective" = "orthographic",
  focalLength = 5,
): Vec2 {
  if (projection === "weak-perspective") {
    const scale = focalLength / (focalLength + point.z);
    return { x: point.x * scale, y: point.y * scale };
  }
  return { x: point.x, y: point.y };
}

/**
 * Convenience: rotate a 3D point then project to 2D.
 * rotationX is clamped to [-90, 90].
 */
export function transformPoint(
  point: Vec3,
  rxDeg: number,
  ryDeg: number,
  rzDeg: number,
  projection: "orthographic" | "weak-perspective" = "orthographic",
  focalLength = 5,
): Vec2 {
  const m = rotationMatrix(rxDeg, ryDeg, rzDeg);
  const rotated = rotate3D(point, m);
  return project(rotated, projection, focalLength);
}

/** Transform a 3D normal vector and return the Z component (for face visibility). */
export function transformedNormalZ(normal: Vec3, m: Mat3): number {
  return m[6] * normal.x + m[7] * normal.y + m[8] * normal.z;
}

/** Compute the identity matrix. */
export function identityMatrix(): Mat3 {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

/** Multiply two Mat3 matrices: result = a * b. */
export function multiplyMat3(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0]*b[0] + a[1]*b[3] + a[2]*b[6],  a[0]*b[1] + a[1]*b[4] + a[2]*b[7],  a[0]*b[2] + a[1]*b[5] + a[2]*b[8],
    a[3]*b[0] + a[4]*b[3] + a[5]*b[6],  a[3]*b[1] + a[4]*b[4] + a[5]*b[7],  a[3]*b[2] + a[4]*b[5] + a[5]*b[8],
    a[6]*b[0] + a[7]*b[3] + a[8]*b[6],  a[6]*b[1] + a[7]*b[4] + a[8]*b[7],  a[6]*b[2] + a[7]*b[5] + a[8]*b[8],
  ];
}

/** Normalize a Vec3 to unit length. Returns zero vector if length is ~0. */
export function normalize3(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len < 1e-10) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** Dot product of two Vec3. */
export function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Cross product of two Vec3. */
export function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/** Distance between two Vec2 points. */
export function dist2(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Lerp between two Vec2 points. */
export function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Lerp between two Vec3 points. */
export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}
