import type { Vec2, Vec3, Mat3 } from "./rotation.js";
import { rotate3D, project, rotationMatrix, normalize3 } from "./rotation.js";
import type { FormDefinition } from "../shared.js";

/**
 * Approximate form intersection by sampling both surfaces and finding
 * points where they are equidistant from the camera (same Z depth).
 *
 * Returns a projected 2D polyline approximating the intersection curve.
 */
export function approximateIntersection(
  form1: FormDefinition,
  form2: FormDefinition,
  samples = 24,
): Vec2[] {
  const m1 = rotationMatrix(form1.rotation.x, form1.rotation.y, form1.rotation.z);
  const m2 = rotationMatrix(form2.rotation.x, form2.rotation.y, form2.rotation.z);

  // Sample surface points of both forms
  const surf1 = sampleFormSurface(form1, m1, samples);
  const surf2 = sampleFormSurface(form2, m2, samples);

  // Find pairs of points that are close to each other in 3D space
  const intersectionPoints: Vec3[] = [];
  const threshold = Math.max(
    form1.size.x, form1.size.y, form1.size.z,
    form2.size.x, form2.size.y, form2.size.z,
  ) * 0.15;

  for (const p1 of surf1) {
    for (const p2 of surf2) {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dz = p1.z - p2.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < threshold) {
        // Midpoint between the two surface points
        intersectionPoints.push({
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2,
          z: (p1.z + p2.z) / 2,
        });
      }
    }
  }

  if (intersectionPoints.length < 2) return [];

  // Project to 2D and order the points to form a curve
  const projected = intersectionPoints.map((p) => project(p, "orthographic"));
  return orderPointsIntoCurve(projected);
}

/**
 * Sample the surface of a form in world space.
 */
function sampleFormSurface(form: FormDefinition, matrix: Mat3, samples: number): Vec3[] {
  const points: Vec3[] = [];
  const { x: sx, y: sy, z: sz } = form.size;
  const { x: px, y: py, z: pz } = form.position;

  switch (form.type) {
    case "sphere": {
      for (let i = 0; i < samples; i++) {
        for (let j = 0; j < samples; j++) {
          const theta = (i / samples) * Math.PI;
          const phi = (j / samples) * Math.PI * 2;
          const local: Vec3 = {
            x: sx * 0.5 * Math.sin(theta) * Math.cos(phi),
            y: sy * 0.5 * Math.cos(theta),
            z: sz * 0.5 * Math.sin(theta) * Math.sin(phi),
          };
          const rotated = rotate3D(local, matrix);
          points.push({ x: rotated.x + px, y: rotated.y + py, z: rotated.z + pz });
        }
      }
      break;
    }
    case "box": {
      const half = { x: sx / 2, y: sy / 2, z: sz / 2 };
      // Sample each face
      for (let i = 0; i < samples; i++) {
        for (let j = 0; j < samples; j++) {
          const u = (i / (samples - 1)) * 2 - 1;
          const v = (j / (samples - 1)) * 2 - 1;
          // 6 faces
          const faces: Vec3[] = [
            { x: u * half.x, y: v * half.y, z: half.z },
            { x: u * half.x, y: v * half.y, z: -half.z },
            { x: half.x, y: u * half.y, z: v * half.z },
            { x: -half.x, y: u * half.y, z: v * half.z },
            { x: u * half.x, y: half.y, z: v * half.z },
            { x: u * half.x, y: -half.y, z: v * half.z },
          ];
          for (const local of faces) {
            const rotated = rotate3D(local, matrix);
            points.push({ x: rotated.x + px, y: rotated.y + py, z: rotated.z + pz });
          }
        }
      }
      break;
    }
    case "cylinder": {
      for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * Math.PI * 2;
        for (let j = 0; j < samples; j++) {
          const t = (j / (samples - 1)) * 2 - 1;
          const local: Vec3 = {
            x: sx * 0.5 * Math.cos(angle),
            y: sy * 0.5 * t,
            z: sz * 0.5 * Math.sin(angle),
          };
          const rotated = rotate3D(local, matrix);
          points.push({ x: rotated.x + px, y: rotated.y + py, z: rotated.z + pz });
        }
      }
      break;
    }
    case "cone": {
      for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * Math.PI * 2;
        for (let j = 0; j < samples; j++) {
          const t = j / (samples - 1); // 0=base, 1=apex
          const radius = 1 - t;
          const local: Vec3 = {
            x: sx * 0.5 * radius * Math.cos(angle),
            y: sy * (t - 0.5),
            z: sz * 0.5 * radius * Math.sin(angle),
          };
          const rotated = rotate3D(local, matrix);
          points.push({ x: rotated.x + px, y: rotated.y + py, z: rotated.z + pz });
        }
      }
      break;
    }
    default: {
      // Fallback: sample as sphere
      for (let i = 0; i < samples; i++) {
        const theta = (i / samples) * Math.PI;
        for (let j = 0; j < samples; j++) {
          const phi = (j / samples) * Math.PI * 2;
          const local: Vec3 = {
            x: sx * 0.5 * Math.sin(theta) * Math.cos(phi),
            y: sy * 0.5 * Math.cos(theta),
            z: sz * 0.5 * Math.sin(theta) * Math.sin(phi),
          };
          const rotated = rotate3D(local, matrix);
          points.push({ x: rotated.x + px, y: rotated.y + py, z: rotated.z + pz });
        }
      }
    }
  }

  return points;
}

/**
 * Order scattered 2D points into a curve by nearest-neighbor traversal.
 */
function orderPointsIntoCurve(points: Vec2[]): Vec2[] {
  if (points.length < 2) return points;

  const used = new Set<number>();
  const result: Vec2[] = [];

  // Start from the leftmost point
  let currentIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i]!.x < points[currentIdx]!.x) currentIdx = i;
  }

  result.push(points[currentIdx]!);
  used.add(currentIdx);

  while (used.size < points.length) {
    let bestIdx = -1;
    let bestDist = Infinity;

    for (let i = 0; i < points.length; i++) {
      if (used.has(i)) continue;
      const dx = points[i]!.x - points[currentIdx]!.x;
      const dy = points[i]!.y - points[currentIdx]!.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    result.push(points[bestIdx]!);
    used.add(bestIdx);
    currentIdx = bestIdx;
  }

  return result;
}
