import type { Vec2, Vec3, Mat3 } from "./rotation.js";
import { normalize3, dot3, rotate3D, project } from "./rotation.js";
import type { EllipseParams } from "./ellipse.js";
import type { FormType } from "../shared.js";

const DEG2RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Light source
// ---------------------------------------------------------------------------

export interface LightSource {
  azimuth: number;    // 0-360 degrees (0=right, 90=bottom, 180=left, 270=top)
  elevation: number;  // 10-80 degrees above horizon
  intensity: number;  // 0-1
}

/**
 * Compute a 3D light direction vector from azimuth and elevation.
 * Returns a unit vector pointing FROM the light TOWARD the scene.
 */
export function lightDirection(light: LightSource): Vec3 {
  const az = light.azimuth * DEG2RAD;
  const el = light.elevation * DEG2RAD;
  const cosEl = Math.cos(el);
  return normalize3({
    x: -Math.cos(az) * cosEl,
    y: -Math.sin(el),
    z: -Math.sin(az) * cosEl,
  });
}

/**
 * Compute the light direction as a 2D vector for rendering indicators.
 * Points from center toward where light is coming from.
 */
export function lightDirection2D(light: LightSource): Vec2 {
  const az = light.azimuth * DEG2RAD;
  return { x: Math.cos(az), y: Math.sin(az) };
}

// ---------------------------------------------------------------------------
// Sphere terminator
// ---------------------------------------------------------------------------

/**
 * Compute the terminator ellipse on a sphere.
 * The terminator is a great circle perpendicular to the light direction.
 */
export function sphereTerminator(
  center: Vec2,
  radius: number,
  light: LightSource,
  matrix: Mat3,
): { terminatorEllipse: EllipseParams; lightSide: Vec2 } {
  const ld = lightDirection(light);

  // The terminator plane normal is the light direction
  // In screen space, project the light direction
  const rotatedLD = rotate3D(ld, matrix);
  const ldScreen = { x: rotatedLD.x, y: -rotatedLD.y }; // flip Y for screen

  // The terminator ellipse has its major axis perpendicular to the projected light direction
  const perpAngle = Math.atan2(ldScreen.y, ldScreen.x) + Math.PI / 2;

  // Minor axis = radius * |sin(angle between light and view direction)|
  // Since we view along Z, the angle is acos(|rotatedLD.z|)
  const viewAngle = Math.acos(Math.min(1, Math.abs(rotatedLD.z)));
  const minorRadius = radius * Math.sin(viewAngle);

  return {
    terminatorEllipse: {
      cx: center.x,
      cy: center.y,
      rx: radius,
      ry: minorRadius,
      rotation: perpAngle,
    },
    lightSide: { x: -ldScreen.x, y: -ldScreen.y },
  };
}

// ---------------------------------------------------------------------------
// Cast shadow
// ---------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute a simple cast shadow polygon on the ground plane.
 * Projects the form's bottom silhouette along the light direction.
 */
export function castShadow(
  center: Vec2,
  radius: number,
  light: LightSource,
  groundY: number,
): Vec2[] {
  const ld = lightDirection(light);
  const ld2d = lightDirection2D(light);

  // Shadow extends from the base of the form along the ground
  const shadowLength = radius * (1 / Math.tan(light.elevation * DEG2RAD));
  const shadowDirX = -ld2d.x;
  const shadowDirY = 0; // shadow lies on ground

  // Approximate as an ellipse stretched along shadow direction
  const points: Vec2[] = [];
  const segments = 24;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const bx = Math.cos(angle) * radius;
    const by = Math.sin(angle) * radius * 0.3; // flatten

    // Offset along shadow direction
    const sx = center.x + bx + shadowDirX * shadowLength * 0.5;
    const sy = groundY + by;
    points.push({ x: sx, y: sy });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Value zones
// ---------------------------------------------------------------------------

export type ValueGrouping = "two-value" | "three-value" | "five-value";

export interface ValueZone {
  type: "highlight" | "light" | "halftone" | "core-shadow" | "reflected-light" | "cast-shadow" | "occlusion-shadow";
  path: Vec2[];
  value: number; // 0 (darkest) to 1 (lightest)
  label: string;
}

/**
 * Compute value zones for a sphere at a given position.
 * Returns an array of zones with polygon paths and values.
 */
export function sphereValueZones(
  center: Vec2,
  radius: number,
  light: LightSource,
  matrix: Mat3,
  grouping: ValueGrouping,
): ValueZone[] {
  const zones: ValueZone[] = [];
  const ld = lightDirection(light);
  const rotatedLD = rotate3D(ld, matrix);
  const ldScreen = { x: -rotatedLD.x, y: rotatedLD.y }; // direction light comes FROM

  // Generate semicircular paths for light/shadow division
  const terminatorAngle = Math.atan2(ldScreen.y, ldScreen.x);
  const segments = 32;

  if (grouping === "two-value") {
    // Light side
    zones.push({
      type: "light",
      path: generateArcPath(center, radius, terminatorAngle - Math.PI / 2, terminatorAngle + Math.PI / 2, segments),
      value: 0.8,
      label: "Light",
    });
    // Shadow side
    zones.push({
      type: "core-shadow",
      path: generateArcPath(center, radius, terminatorAngle + Math.PI / 2, terminatorAngle + Math.PI * 1.5, segments),
      value: 0.2,
      label: "Shadow",
    });
  } else if (grouping === "three-value") {
    // Light
    zones.push({
      type: "light",
      path: generateArcPath(center, radius, terminatorAngle - Math.PI / 2, terminatorAngle, segments),
      value: 0.85,
      label: "Light",
    });
    // Halftone
    zones.push({
      type: "halftone",
      path: generateArcPath(center, radius, terminatorAngle, terminatorAngle + Math.PI / 3, segments),
      value: 0.5,
      label: "Halftone",
    });
    // Shadow
    zones.push({
      type: "core-shadow",
      path: generateArcPath(center, radius, terminatorAngle + Math.PI / 3, terminatorAngle + Math.PI * 1.5, segments),
      value: 0.15,
      label: "Shadow",
    });
  } else {
    // Five-value
    const lightEnd = terminatorAngle - Math.PI / 6;
    const highlightEnd = terminatorAngle - Math.PI / 3;

    zones.push({
      type: "highlight",
      path: generateArcPath(center, radius, terminatorAngle - Math.PI / 2, highlightEnd, segments),
      value: 0.95,
      label: "Highlight",
    });
    zones.push({
      type: "light",
      path: generateArcPath(center, radius, highlightEnd, lightEnd, segments),
      value: 0.8,
      label: "Light",
    });
    zones.push({
      type: "halftone",
      path: generateArcPath(center, radius, lightEnd, terminatorAngle + Math.PI / 6, segments),
      value: 0.5,
      label: "Halftone",
    });
    zones.push({
      type: "core-shadow",
      path: generateArcPath(center, radius, terminatorAngle + Math.PI / 6, terminatorAngle + Math.PI * 0.6, segments),
      value: 0.1,
      label: "Core Shadow",
    });
    zones.push({
      type: "reflected-light",
      path: generateArcPath(center, radius, terminatorAngle + Math.PI * 0.6, terminatorAngle + Math.PI * 1.5, segments),
      value: 0.3,
      label: "Reflected Light",
    });
  }

  return zones;
}

function generateArcPath(
  center: Vec2,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number,
): Vec2[] {
  const points: Vec2[] = [{ x: center.x, y: center.y }];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + (endAngle - startAngle) * t;
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }
  return points;
}
