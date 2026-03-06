import type { Vec2, Vec3, Mat3 } from "../math/rotation.js";
import { rotate3D, transformedNormalZ } from "../math/rotation.js";
import { project } from "../math/rotation.js";
import { drawLine, applyHiddenEdgeStyle, resetEdgeStyle, type HiddenEdgeStyle } from "../shared.js";

/** A 3D box edge: two vertex indices + the two face normals it borders. */
interface BoxEdge {
  a: number;
  b: number;
  faces: [number, number]; // Indices into FACE_NORMALS
}

// Box has 8 vertices at ±0.5 on each axis
const BOX_VERTICES: Vec3[] = [
  { x: -0.5, y: -0.5, z: -0.5 }, // 0: left-bottom-back
  { x:  0.5, y: -0.5, z: -0.5 }, // 1: right-bottom-back
  { x:  0.5, y:  0.5, z: -0.5 }, // 2: right-top-back
  { x: -0.5, y:  0.5, z: -0.5 }, // 3: left-top-back
  { x: -0.5, y: -0.5, z:  0.5 }, // 4: left-bottom-front
  { x:  0.5, y: -0.5, z:  0.5 }, // 5: right-bottom-front
  { x:  0.5, y:  0.5, z:  0.5 }, // 6: right-top-front
  { x: -0.5, y:  0.5, z:  0.5 }, // 7: left-top-front
];

// 6 face outward normals
const FACE_NORMALS: Vec3[] = [
  { x:  0, y:  0, z:  1 }, // 0: front
  { x:  0, y:  0, z: -1 }, // 1: back
  { x:  1, y:  0, z:  0 }, // 2: right
  { x: -1, y:  0, z:  0 }, // 3: left
  { x:  0, y:  1, z:  0 }, // 4: top
  { x:  0, y: -1, z:  0 }, // 5: bottom
];

// 12 edges with their two bordering faces
const BOX_EDGES: BoxEdge[] = [
  // Front face edges
  { a: 4, b: 5, faces: [0, 5] }, // front-bottom
  { a: 5, b: 6, faces: [0, 2] }, // front-right
  { a: 6, b: 7, faces: [0, 4] }, // front-top
  { a: 7, b: 4, faces: [0, 3] }, // front-left
  // Back face edges
  { a: 0, b: 1, faces: [1, 5] }, // back-bottom
  { a: 1, b: 2, faces: [1, 2] }, // back-right
  { a: 2, b: 3, faces: [1, 4] }, // back-top
  { a: 3, b: 0, faces: [1, 3] }, // back-left
  // Connecting edges (front-to-back)
  { a: 4, b: 0, faces: [3, 5] }, // left-bottom
  { a: 5, b: 1, faces: [2, 5] }, // right-bottom
  { a: 6, b: 2, faces: [2, 4] }, // right-top
  { a: 7, b: 3, faces: [3, 4] }, // left-top
];

export interface BoxRenderOptions {
  center: Vec2;
  scale: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  matrix: Mat3;
  projection: "orthographic" | "weak-perspective";
  focalLength: number;
  showHidden: boolean;
  hiddenStyle: HiddenEdgeStyle;
  hiddenAlpha: number;
  edgeColor: string;
}

/** Classify an edge as front-facing if at least one of its bordering faces is front-facing. */
function isEdgeFrontFacing(edge: BoxEdge, faceVisibility: boolean[]): boolean {
  return faceVisibility[edge.faces[0]]! || faceVisibility[edge.faces[1]]!;
}

export function renderBox(ctx: CanvasRenderingContext2D, opts: BoxRenderOptions): Vec2[] {
  const { center, scale, sizeX, sizeY, sizeZ, matrix, projection, focalLength, showHidden, hiddenStyle, hiddenAlpha, edgeColor } = opts;

  // Transform vertices
  const projected: Vec2[] = BOX_VERTICES.map((v) => {
    const scaled: Vec3 = { x: v.x * sizeX, y: v.y * sizeY, z: v.z * sizeZ };
    const rotated = rotate3D(scaled, matrix);
    const p = project(rotated, projection, focalLength);
    return { x: center.x + p.x * scale, y: center.y - p.y * scale }; // flip Y for screen
  });

  // Compute face visibility (face is visible if its transformed normal points toward viewer, i.e. Z > 0)
  const faceVisibility = FACE_NORMALS.map((n) => transformedNormalZ(n, matrix) > 0);

  ctx.strokeStyle = edgeColor;
  const savedAlpha = ctx.globalAlpha;

  // Draw back edges first (if showing hidden)
  if (showHidden) {
    applyHiddenEdgeStyle(ctx, hiddenStyle, hiddenAlpha);
    for (const edge of BOX_EDGES) {
      if (!isEdgeFrontFacing(edge, faceVisibility)) {
        const pa = projected[edge.a]!;
        const pb = projected[edge.b]!;
        drawLine(ctx, pa.x, pa.y, pb.x, pb.y);
      }
    }
    resetEdgeStyle(ctx, savedAlpha);
  }

  // Draw front edges
  ctx.setLineDash([]);
  ctx.globalAlpha = savedAlpha;
  for (const edge of BOX_EDGES) {
    if (isEdgeFrontFacing(edge, faceVisibility)) {
      const pa = projected[edge.a]!;
      const pb = projected[edge.b]!;
      drawLine(ctx, pa.x, pa.y, pb.x, pb.y);
    }
  }

  return projected;
}

/** Get cross-contour lines for visible box faces (parallel lines on each visible face). */
export function boxCrossContours(
  opts: BoxRenderOptions,
  count: number,
): { front: Vec2[][]; hidden: Vec2[][] } {
  const { center, scale, sizeX, sizeY, sizeZ, matrix, projection, focalLength } = opts;
  const faceVisibility = FACE_NORMALS.map((n) => transformedNormalZ(n, matrix) > 0);

  const front: Vec2[][] = [];
  const hidden: Vec2[][] = [];

  // Cross-contours on each face: lines perpendicular to the face's primary axis
  const faceContours: { faceIdx: number; generate: () => Vec3[][] }[] = [
    // Front/back faces: horizontal lines
    { faceIdx: 0, generate: () => generateFaceContours(sizeX, sizeY, 0.5 * sizeZ, "xy", count) },
    { faceIdx: 1, generate: () => generateFaceContours(sizeX, sizeY, -0.5 * sizeZ, "xy", count) },
    // Right/left faces: horizontal lines
    { faceIdx: 2, generate: () => generateFaceContours(sizeZ, sizeY, 0.5 * sizeX, "zy-right", count) },
    { faceIdx: 3, generate: () => generateFaceContours(sizeZ, sizeY, -0.5 * sizeX, "zy-left", count) },
    // Top/bottom faces: depth lines
    { faceIdx: 4, generate: () => generateFaceContours(sizeX, sizeZ, 0.5 * sizeY, "xz-top", count) },
    { faceIdx: 5, generate: () => generateFaceContours(sizeX, sizeZ, -0.5 * sizeY, "xz-bottom", count) },
  ];

  for (const fc of faceContours) {
    const lines3D = fc.generate();
    const lines2D = lines3D.map((line) =>
      line.map((p) => {
        const rotated = rotate3D(p, matrix);
        const proj = project(rotated, projection, focalLength);
        return { x: center.x + proj.x * scale, y: center.y - proj.y * scale };
      }),
    );

    if (faceVisibility[fc.faceIdx]) {
      front.push(...lines2D);
    } else {
      hidden.push(...lines2D);
    }
  }

  return { front, hidden };
}

function generateFaceContours(
  width: number,
  height: number,
  fixedCoord: number,
  plane: string,
  count: number,
): Vec3[][] {
  const lines: Vec3[][] = [];
  for (let i = 1; i < count; i++) {
    const t = i / count - 0.5;
    const line: Vec3[] = [];
    switch (plane) {
      case "xy":
        line.push({ x: -width / 2, y: t * height, z: fixedCoord });
        line.push({ x: width / 2, y: t * height, z: fixedCoord });
        break;
      case "zy-right":
        line.push({ x: fixedCoord, y: t * height, z: -width / 2 });
        line.push({ x: fixedCoord, y: t * height, z: width / 2 });
        break;
      case "zy-left":
        line.push({ x: fixedCoord, y: t * height, z: -width / 2 });
        line.push({ x: fixedCoord, y: t * height, z: width / 2 });
        break;
      case "xz-top":
        line.push({ x: -width / 2, y: fixedCoord, z: t * height });
        line.push({ x: width / 2, y: fixedCoord, z: t * height });
        break;
      case "xz-bottom":
        line.push({ x: -width / 2, y: fixedCoord, z: t * height });
        line.push({ x: width / 2, y: fixedCoord, z: t * height });
        break;
    }
    lines.push(line);
  }
  return lines;
}
