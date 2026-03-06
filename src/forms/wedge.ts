import type { Vec2, Vec3, Mat3 } from "../math/rotation.js";
import { rotate3D, project, transformedNormalZ } from "../math/rotation.js";
import { drawLine, applyHiddenEdgeStyle, resetEdgeStyle, type HiddenEdgeStyle } from "../shared.js";

export interface WedgeRenderOptions {
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

// Wedge: triangular cross-section in XY, extruded along Z
// Front triangle: 3 vertices, back triangle: 3 vertices = 6 total
//
//       2(top)          5(top-back)
//      / \              / \
//     /   \            /   \
//    0-----1          3-----4
// front-left-right    back-left-right

const WEDGE_VERTICES: Vec3[] = [
  { x: -0.5, y: -0.5, z:  0.5 }, // 0: front-left-bottom
  { x:  0.5, y: -0.5, z:  0.5 }, // 1: front-right-bottom
  { x:  0,   y:  0.5, z:  0.5 }, // 2: front-top
  { x: -0.5, y: -0.5, z: -0.5 }, // 3: back-left-bottom
  { x:  0.5, y: -0.5, z: -0.5 }, // 4: back-right-bottom
  { x:  0,   y:  0.5, z: -0.5 }, // 5: back-top
];

// 5 faces with normals
const FACE_NORMALS: Vec3[] = [
  { x:  0, y:  0, z:  1 },                      // 0: front (triangle 0,1,2)
  { x:  0, y:  0, z: -1 },                      // 1: back (triangle 3,4,5)
  { x:  0, y: -1, z:  0 },                      // 2: bottom (quad 0,1,4,3)
  { x: -0.894, y: 0.447, z: 0 },                // 3: left slope (quad 0,2,5,3) normalized(-1, 0.5, 0)
  { x:  0.894, y: 0.447, z: 0 },                // 4: right slope (quad 1,2,5,4) normalized(1, 0.5, 0)
];

interface WedgeEdge {
  a: number;
  b: number;
  faces: [number, number];
}

const WEDGE_EDGES: WedgeEdge[] = [
  // Front triangle
  { a: 0, b: 1, faces: [0, 2] },
  { a: 1, b: 2, faces: [0, 4] },
  { a: 2, b: 0, faces: [0, 3] },
  // Back triangle
  { a: 3, b: 4, faces: [1, 2] },
  { a: 4, b: 5, faces: [1, 4] },
  { a: 5, b: 3, faces: [1, 3] },
  // Connecting edges
  { a: 0, b: 3, faces: [2, 3] },
  { a: 1, b: 4, faces: [2, 4] },
  { a: 2, b: 5, faces: [3, 4] },
];

function projectVertex(v: Vec3, opts: WedgeRenderOptions): Vec2 {
  const scaled: Vec3 = { x: v.x * opts.sizeX, y: v.y * opts.sizeY, z: v.z * opts.sizeZ };
  const rotated = rotate3D(scaled, opts.matrix);
  const p = project(rotated, opts.projection, opts.focalLength);
  return { x: opts.center.x + p.x * opts.scale, y: opts.center.y - p.y * opts.scale };
}

export function renderWedge(ctx: CanvasRenderingContext2D, opts: WedgeRenderOptions): void {
  const { showHidden, hiddenStyle, hiddenAlpha, edgeColor, matrix } = opts;

  const projected = WEDGE_VERTICES.map((v) => projectVertex(v, opts));
  const faceVisibility = FACE_NORMALS.map((n) => transformedNormalZ(n, matrix) > 0);

  ctx.strokeStyle = edgeColor;
  const savedAlpha = ctx.globalAlpha;

  // Draw hidden edges first
  if (showHidden) {
    applyHiddenEdgeStyle(ctx, hiddenStyle, hiddenAlpha);
    for (const edge of WEDGE_EDGES) {
      if (!(faceVisibility[edge.faces[0]]! || faceVisibility[edge.faces[1]]!)) {
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
  for (const edge of WEDGE_EDGES) {
    if (faceVisibility[edge.faces[0]]! || faceVisibility[edge.faces[1]]!) {
      const pa = projected[edge.a]!;
      const pb = projected[edge.b]!;
      drawLine(ctx, pa.x, pa.y, pb.x, pb.y);
    }
  }
}
