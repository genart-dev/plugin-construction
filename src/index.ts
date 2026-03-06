import type { DesignPlugin, PluginContext } from "@genart-dev/core";
import { formLayerType } from "./form-layer.js";
import { crossContourLayerType } from "./cross-contour-layer.js";
import { valueShapesLayerType } from "./value-shapes-layer.js";
import { envelopeLayerType } from "./envelope-layer.js";
import { intersectionLayerType } from "./intersection-layer.js";
import { constructionMcpTools } from "./construction-tools.js";

const constructionPlugin: DesignPlugin = {
  id: "construction",
  name: "Construction Guides",
  version: "0.1.0",
  tier: "free",
  description:
    "Drawing construction guides: 3D form primitives, cross-contour lines, value/shadow studies, envelope block-ins, and form intersections.",

  layerTypes: [
    formLayerType,
    crossContourLayerType,
    valueShapesLayerType,
    envelopeLayerType,
    intersectionLayerType,
  ],
  tools: [],
  exportHandlers: [],
  mcpTools: constructionMcpTools,

  async initialize(_context: PluginContext): Promise<void> {
    // No async setup needed
  },

  dispose(): void {
    // No resources to release
  },
};

export default constructionPlugin;
export { formLayerType } from "./form-layer.js";
export { crossContourLayerType } from "./cross-contour-layer.js";
export { valueShapesLayerType } from "./value-shapes-layer.js";
export { envelopeLayerType } from "./envelope-layer.js";
export { intersectionLayerType } from "./intersection-layer.js";
export { constructionMcpTools } from "./construction-tools.js";
export {
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
} from "./math/rotation.js";
export {
  projectedEllipse,
  drawEllipse,
  drawEllipseWithHidden,
  ellipsePoints,
} from "./math/ellipse.js";
export {
  lightDirection,
  lightDirection2D,
  sphereTerminator,
  castShadow,
  sphereValueZones,
} from "./math/shadow.js";
export {
  computeEnvelope,
  envelopeAngles,
  plumbLine,
  levelLine,
  comparativeMeasure,
} from "./math/envelope.js";
export { approximateIntersection } from "./math/intersection.js";
