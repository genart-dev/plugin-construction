/**
 * Construction Plugin — Visual Render Test
 *
 * Montage layout (4 columns × 4 rows):
 *   Row 0: Forms — Box, Cylinder, Sphere, Cone
 *   Row 1: Forms — Wedge, Egg, Box (rotated), Cylinder (rotated)
 *   Row 2: Cross-Contour (organic), Value Study (3-value), Value Study (5-value), Envelope
 *   Row 3: Intersection (box+sphere), Intersection (cylinder+cone), Form scene, Exercise
 *
 * Output: test-renders/construction-guides.png
 */
const { createCanvas } = require("canvas");
const fs   = require("fs");
const path = require("path");

const {
  formLayerType,
  crossContourLayerType,
  valueShapesLayerType,
  envelopeLayerType,
  intersectionLayerType,
} = require("./dist/index.cjs");

const CW = 380;
const CH = 340;
const PAD = 8;
const LABEL_H = 30;
const COLS = 4;
const ROWS = 4;
const W = COLS * CW + (COLS + 1) * PAD;
const H = ROWS * (CH + LABEL_H) + (ROWS + 1) * PAD;

const outDir = path.join(__dirname, "test-renders");
fs.mkdirSync(outDir, { recursive: true });

const resources = { getFont: () => null, getImage: () => null, theme: "dark", pixelRatio: 1 };

function cellBounds(col, row) {
  const x = PAD + col * (CW + PAD);
  const y = PAD + row * (CH + LABEL_H + PAD) + LABEL_H;
  return { x, y, width: CW, height: CH, rotation: 0, scaleX: 1, scaleY: 1 };
}

function drawLabel(ctx, col, row, title, subtitle) {
  const x = PAD + col * (CW + PAD);
  const y = PAD + row * (CH + LABEL_H + PAD);
  ctx.fillStyle = "#333333";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText(title, x + 6, y + 15);
  ctx.fillStyle = "#888888";
  ctx.font = "10px sans-serif";
  ctx.fillText(subtitle, x + 6, y + 27);
}

function cellBackground(ctx, b) {
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(b.x, b.y, b.width, b.height);
  ctx.strokeStyle = "#333344";
  ctx.lineWidth = 0.5;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.width - 1, b.height - 1);
}

function renderFormCell(ctx, col, row, formType, title, subtitle, overrides) {
  const b = cellBounds(col, row);
  cellBackground(ctx, b);
  drawLabel(ctx, col, row, title, subtitle);
  const props = {
    ...formLayerType.createDefault(),
    formType,
    ...overrides,
  };
  formLayerType.render(props, ctx, b, resources);
}

// Main canvas
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// Dark background
ctx.fillStyle = "#0d0d1a";
ctx.fillRect(0, 0, W, H);

// ─── Row 0: Basic form types ─────────────────────────────────────────────
renderFormCell(ctx, 0, 0, "box", "Box", "rotX: 15, rotY: 30, cross-contours on", {});
renderFormCell(ctx, 1, 0, "cylinder", "Cylinder", "rotX: 20, rotY: 25, 6 contours", {
  rotationX: 20, rotationY: 25, crossContourCount: 6,
});
renderFormCell(ctx, 2, 0, "sphere", "Sphere", "rotX: 10, rotY: 45, lat+lon contours", {
  rotationX: 10, rotationY: 45,
});
renderFormCell(ctx, 3, 0, "cone", "Cone", "rotX: 25, rotY: -30, tapering contours", {
  rotationX: 25, rotationY: -30,
});

// ─── Row 1: More forms + rotated variants ────────────────────────────────
renderFormCell(ctx, 0, 1, "wedge", "Wedge", "rotX: 20, rotY: 40, hidden edges", {
  rotationX: 20, rotationY: 40,
});
renderFormCell(ctx, 1, 1, "egg", "Egg / Ovoid", "rotX: 15, rotY: 20, asymmetric profile", {
  rotationX: 15, rotationY: 20,
});
renderFormCell(ctx, 2, 1, "box", "Box (Rotated)", "rotX: 45, rotY: 60, rotZ: 15", {
  rotationX: 45, rotationY: 60, rotationZ: 15,
});
renderFormCell(ctx, 3, 1, "cylinder", "Cylinder (Foreshortened)", "rotX: -30, weak-perspective", {
  rotationX: -30, rotationY: 0, projection: "weak-perspective",
});

// ─── Row 2: Cross-contour, value studies, envelope ───────────────────────

// Cross-contour on organic shape
{
  const b = cellBounds(0, 2);
  cellBackground(ctx, b);
  drawLabel(ctx, 0, 2, "Cross-Contour Lines", "8 contours, curvature 0.6, elliptical");

  // Define an organic outline (vase-like shape)
  const outline = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const y = t;
    // Vase profile: wider at bottom and top, narrow in middle
    const r = 0.08 + 0.06 * Math.sin(t * Math.PI) + 0.03 * Math.sin(t * Math.PI * 2);
    outline.push({ x: 0.5 - r, y: 0.1 + y * 0.8 });
  }
  for (let i = 40; i >= 0; i--) {
    const t = i / 40;
    const y = t;
    const r = 0.08 + 0.06 * Math.sin(t * Math.PI) + 0.03 * Math.sin(t * Math.PI * 2);
    outline.push({ x: 0.5 + r, y: 0.1 + y * 0.8 });
  }

  // Central axis
  const axis = [];
  for (let i = 0; i <= 10; i++) {
    axis.push({ x: 0.5, y: 0.1 + (i / 10) * 0.8 });
  }

  const props = {
    ...crossContourLayerType.createDefault(),
    outline: JSON.stringify(outline),
    axis: JSON.stringify(axis),
    contourCount: 8,
    curvature: 0.6,
    contourStyle: "elliptical",
  };
  crossContourLayerType.render(props, ctx, b, resources);
}

// Value study — three-value
{
  const b = cellBounds(1, 2);
  cellBackground(ctx, b);
  drawLabel(ctx, 1, 2, "Value Study (3-Value)", "azimuth: 315, elevation: 45");

  const props = {
    ...valueShapesLayerType.createDefault(),
    valueGrouping: "three-value",
    lightAzimuth: 315,
    lightElevation: 45,
    showZoneLabels: true,
  };
  valueShapesLayerType.render(props, ctx, b, resources);
}

// Value study — five-value
{
  const b = cellBounds(2, 2);
  cellBackground(ctx, b);
  drawLabel(ctx, 2, 2, "Value Study (5-Value)", "full anatomy: highlight to reflected light");

  const props = {
    ...valueShapesLayerType.createDefault(),
    valueGrouping: "five-value",
    lightAzimuth: 290,
    lightElevation: 50,
    showZoneLabels: true,
    showCastShadow: true,
    showOcclusionShadow: true,
  };
  valueShapesLayerType.render(props, ctx, b, resources);
}

// Envelope block-in
{
  const b = cellBounds(3, 2);
  cellBackground(ctx, b);
  drawLabel(ctx, 3, 2, "Envelope Block-In", "tight hull, angles, plumb line");

  // Define figure-like envelope points
  const points = [
    { x: 0.45, y: 0.15 },  // head top
    { x: 0.55, y: 0.15 },
    { x: 0.58, y: 0.25 },  // shoulder right
    { x: 0.62, y: 0.35 },
    { x: 0.55, y: 0.50 },  // waist right
    { x: 0.60, y: 0.65 },  // hip right
    { x: 0.55, y: 0.85 },  // foot right
    { x: 0.45, y: 0.85 },  // foot left
    { x: 0.40, y: 0.65 },  // hip left
    { x: 0.42, y: 0.50 },  // waist left
    { x: 0.38, y: 0.35 },
    { x: 0.42, y: 0.25 },  // shoulder left
  ];

  const props = {
    ...envelopeLayerType.createDefault(),
    envelopePath: JSON.stringify(points),
    envelopeStyle: "tight",
    showAngles: true,
    showPlumbLine: true,
    showMeasurements: false,
    showSubdivisions: true,
    subdivisionDepth: 1,
  };
  envelopeLayerType.render(props, ctx, b, resources);
}

// ─── Row 3: Intersections, scene, exercise ───────────────────────────────

// Intersection: box + sphere
{
  const b = cellBounds(0, 3);
  cellBackground(ctx, b);
  drawLabel(ctx, 0, 3, "Intersection (Box + Sphere)", "hard transition, red intersection curve");

  const forms = [
    { type: "box", position: { x: -0.3, y: 0, z: 0 }, size: { x: 1.2, y: 1.2, z: 1.2 }, rotation: { x: 15, y: 30, z: 0 } },
    { type: "sphere", position: { x: 0.3, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, rotation: { x: 0, y: 0, z: 0 } },
  ];
  const props = {
    ...intersectionLayerType.createDefault(),
    forms: JSON.stringify(forms),
    showForms: true,
    showIntersectionLines: true,
    transitionType: "hard",
  };
  intersectionLayerType.render(props, ctx, b, resources);
}

// Intersection: cylinder + cone
{
  const b = cellBounds(1, 3);
  cellBackground(ctx, b);
  drawLabel(ctx, 1, 3, "Intersection (Cylinder + Cone)", "soft transition, overlapping forms");

  const forms = [
    { type: "cylinder", position: { x: -0.2, y: 0, z: 0 }, size: { x: 0.8, y: 1.5, z: 0.8 }, rotation: { x: 0, y: 20, z: 0 } },
    { type: "cone", position: { x: 0.2, y: -0.2, z: 0 }, size: { x: 1, y: 1.2, z: 1 }, rotation: { x: 10, y: -15, z: 0 } },
  ];
  const props = {
    ...intersectionLayerType.createDefault(),
    forms: JSON.stringify(forms),
    showForms: true,
    showIntersectionLines: true,
    transitionType: "soft",
  };
  intersectionLayerType.render(props, ctx, b, resources);
}

// Multi-form scene
{
  const b = cellBounds(2, 3);
  cellBackground(ctx, b);
  drawLabel(ctx, 2, 3, "Multi-Form Scene", "box + sphere + cylinder composed");

  // Render multiple forms in a single cell
  const formConfigs = [
    { formType: "box", position: { x: 0.3, y: 0.55 }, formSize: 0.15, rotationX: 20, rotationY: 35, rotationZ: 0 },
    { formType: "sphere", position: { x: 0.7, y: 0.45 }, formSize: 0.12, rotationX: 10, rotationY: 20, rotationZ: 0 },
    { formType: "cylinder", position: { x: 0.5, y: 0.6 }, formSize: 0.13, rotationX: -15, rotationY: 50, rotationZ: 0 },
  ];

  for (const cfg of formConfigs) {
    const props = {
      ...formLayerType.createDefault(),
      ...cfg,
      showCrossContours: true,
      showAxes: true,
    };
    formLayerType.render(props, ctx, b, resources);
  }
}

// Exercise-style panel
{
  const b = cellBounds(3, 3);
  cellBackground(ctx, b);
  drawLabel(ctx, 3, 3, "Construction Exercise", "varied forms, rotations, with axes");

  const exerciseForms = [
    { formType: "cone", position: { x: 0.35, y: 0.4 }, formSize: 0.18, rotationX: 25, rotationY: -45, rotationZ: 10 },
    { formType: "egg", position: { x: 0.65, y: 0.5 }, formSize: 0.14, rotationX: -20, rotationY: 30, rotationZ: -5 },
    { formType: "wedge", position: { x: 0.5, y: 0.7 }, formSize: 0.12, rotationX: 35, rotationY: 60, rotationZ: 0 },
  ];

  for (const cfg of exerciseForms) {
    const props = {
      ...formLayerType.createDefault(),
      ...cfg,
      showCrossContours: true,
      showAxes: true,
      showHiddenEdges: true,
    };
    formLayerType.render(props, ctx, b, resources);
  }
}

// Write output
const outPath = path.join(outDir, "construction-guides.png");
const buf = canvas.toBuffer("image/png");
fs.writeFileSync(outPath, buf);
console.log(`Wrote ${outPath} (${W}x${H}, ${(buf.length / 1024).toFixed(1)} KB)`);
