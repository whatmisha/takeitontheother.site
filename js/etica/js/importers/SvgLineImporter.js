import { DENSITY_PROFILE_DEFAULT } from "../brushes/DensityProfiles.js";
import { randomSeed } from "../brushes/random.js";
import { LINE_DENSITY_MAX, LINE_DENSITY_MIN } from "../utils/LineSettings.js?v=roughness-1";

const SVG_NS = "http://www.w3.org/2000/svg";
const GEOMETRY_SELECTOR = "path,line,polyline,polygon,rect,circle,ellipse";
const GEOMETRY_TAGS = new Set(GEOMETRY_SELECTOR.split(","));
const CONTAINER_TAGS = new Set(["svg", "g", "a"]);
const ROOT_ATTRIBUTES = ["viewBox", "preserveAspectRatio"];
const GEOMETRY_ATTRIBUTES = [
  "d",
  "points",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "transform"
];
const CONTAINER_ATTRIBUTES = ["x", "y", "width", "height", "viewBox", "transform"];
const DENSITY_PROFILES = new Set(["flat", "fade-in", "fade-out", "in-out", "soft-peak", "hard-peak", "soft-dip", "hard-dip"]);

export function createSvgLineStrokes(svgText, options = {}) {
  const { svg, host, sourceBox } = mountSanitizedSvg(svgText);

  try {
    const sampledLines = Array.from(svg.querySelectorAll(GEOMETRY_SELECTOR))
      .map((element) => sampleSvgElement(element))
      .map((points) => dedupePoints(points, 0.05))
      .filter((points) => points.length >= 2);

    if (!sampledLines.length) return [];

    const viewportBox = sourceBox || getPointsBounds(sampledLines);
    if (!viewportBox || viewportBox.width <= 0 || viewportBox.height <= 0) return [];

    const placement = fitIntoCanvas(viewportBox, {
      ...options,
      preserveViewport: Boolean(sourceBox)
    });
    const groupId = `svg-${Date.now()}-${randomSeed()}`;

    return sampledLines
      .map((points, index) => createStroke(points, index, groupId, viewportBox, placement, options))
      .filter((stroke) => stroke.points.length >= 2);
  } finally {
    host.remove();
  }
}

function mountSanitizedSvg(svgText) {
  const parser = new DOMParser();
  const documentSvg = parser.parseFromString(svgText, "image/svg+xml");
  const parserError = documentSvg.querySelector("parsererror");
  if (parserError) throw new Error("Invalid SVG file.");

  const sourceSvg = documentSvg.documentElement;
  if (!sourceSvg || sourceSvg.localName.toLowerCase() !== "svg") {
    throw new Error("File does not contain an SVG root.");
  }

  const sourceBox = getSvgSourceBox(sourceSvg);
  const cleanSvg = document.createElementNS(SVG_NS, "svg");
  copyAttributes(sourceSvg, cleanSvg, ROOT_ATTRIBUTES);

  if (sourceBox) {
    const viewBox = sourceSvg.getAttribute("viewBox");
    cleanSvg.setAttribute("width", String(sourceBox.width));
    cleanSvg.setAttribute("height", String(sourceBox.height));
    cleanSvg.setAttribute("viewBox", viewBox || `${sourceBox.x} ${sourceBox.y} ${sourceBox.width} ${sourceBox.height}`);
  } else {
    cleanSvg.setAttribute("width", "1000");
    cleanSvg.setAttribute("height", "1000");
  }

  copySupportedChildren(sourceSvg, cleanSvg);

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "absolute";
  host.style.left = "-10000px";
  host.style.top = "-10000px";
  host.style.width = "0";
  host.style.height = "0";
  host.style.overflow = "hidden";
  host.style.opacity = "0";
  host.style.pointerEvents = "none";
  host.append(cleanSvg);
  document.body.append(host);

  return {
    svg: cleanSvg,
    host,
    sourceBox: sourceBox ? { x: 0, y: 0, width: sourceBox.width, height: sourceBox.height } : null
  };
}

function copySupportedChildren(sourceNode, targetNode) {
  for (const child of Array.from(sourceNode.children)) {
    const tagName = child.localName.toLowerCase();

    if (GEOMETRY_TAGS.has(tagName)) {
      const clone = document.createElementNS(SVG_NS, tagName);
      copyAttributes(child, clone, GEOMETRY_ATTRIBUTES);
      targetNode.append(clone);
      continue;
    }

    if (CONTAINER_TAGS.has(tagName)) {
      const clone = document.createElementNS(SVG_NS, tagName === "svg" ? "svg" : "g");
      copyAttributes(child, clone, CONTAINER_ATTRIBUTES);
      copySupportedChildren(child, clone);
      if (clone.children.length) targetNode.append(clone);
    }
  }
}

function copyAttributes(source, target, attributes) {
  for (const attribute of attributes) {
    const value = source.getAttribute(attribute);
    if (value !== null && value !== "") target.setAttribute(attribute, value);
  }
}

function getSvgSourceBox(svg) {
  const viewBox = parseViewBox(svg.getAttribute("viewBox"));
  if (viewBox) return viewBox;

  const width = parseSvgLength(svg.getAttribute("width"));
  const height = parseSvgLength(svg.getAttribute("height"));
  if (width > 0 && height > 0) return { x: 0, y: 0, width, height };

  return null;
}

function parseViewBox(value) {
  const numbers = parseNumbers(value);
  if (numbers.length !== 4 || numbers.some((number) => !Number.isFinite(number))) return null;
  const [x, y, width, height] = numbers;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function parseSvgLength(value) {
  if (!value || /%/.test(value)) return null;
  const match = String(value).trim().match(/^[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/i);
  if (!match) return null;
  const number = Number.parseFloat(match[0]);
  return Number.isFinite(number) ? number : null;
}

function sampleSvgElement(element) {
  const geometryPoints = sampleGeometryElement(element);
  if (geometryPoints.length >= 2) return geometryPoints;
  return sampleManualElement(element);
}

function sampleGeometryElement(element) {
  if (typeof element.getTotalLength !== "function" || typeof element.getPointAtLength !== "function") return [];

  let length = 0;
  try {
    length = element.getTotalLength();
  } catch {
    return [];
  }

  if (!Number.isFinite(length) || length <= 0) return [];

  const matrix = element.getCTM();
  const step = Math.max(3, Math.min(14, length / 180));
  const sampleCount = Math.max(2, Math.min(1600, Math.ceil(length / step)));
  const points = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    const distance = length * (index / sampleCount);
    try {
      points.push(applyMatrix(element.getPointAtLength(distance), matrix));
    } catch {
      return [];
    }
  }

  return points;
}

function sampleManualElement(element) {
  const tagName = element.localName.toLowerCase();
  const matrix = element.getCTM();

  if (tagName === "line") {
    return [
      applyMatrix({ x: numberAttribute(element, "x1"), y: numberAttribute(element, "y1") }, matrix),
      applyMatrix({ x: numberAttribute(element, "x2"), y: numberAttribute(element, "y2") }, matrix)
    ];
  }

  if (tagName === "polyline" || tagName === "polygon") {
    const points = parsePointList(element.getAttribute("points")).map((point) => applyMatrix(point, matrix));
    if (tagName === "polygon" && points.length > 2) points.push({ ...points[0] });
    return points;
  }

  if (tagName === "rect") {
    const x = numberAttribute(element, "x");
    const y = numberAttribute(element, "y");
    const width = numberAttribute(element, "width");
    const height = numberAttribute(element, "height");
    if (width <= 0 || height <= 0) return [];
    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
      { x, y }
    ].map((point) => applyMatrix(point, matrix));
  }

  if (tagName === "circle" || tagName === "ellipse") {
    const cx = numberAttribute(element, "cx");
    const cy = numberAttribute(element, "cy");
    const rx = tagName === "circle" ? numberAttribute(element, "r") : numberAttribute(element, "rx");
    const ry = tagName === "circle" ? numberAttribute(element, "r") : numberAttribute(element, "ry");
    if (rx <= 0 || ry <= 0) return [];
    return sampleEllipse(cx, cy, rx, ry).map((point) => applyMatrix(point, matrix));
  }

  return [];
}

function sampleEllipse(cx, cy, rx, ry) {
  const points = [];
  const sampleCount = 96;
  for (let index = 0; index <= sampleCount; index += 1) {
    const angle = Math.PI * 2 * (index / sampleCount);
    points.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry
    });
  }
  return points;
}

function parsePointList(value) {
  const numbers = parseNumbers(value);
  const points = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    points.push({ x: numbers[index], y: numbers[index + 1] });
  }
  return points;
}

function parseNumbers(value) {
  return (String(value || "").match(/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi) || [])
    .map((number) => Number.parseFloat(number))
    .filter((number) => Number.isFinite(number));
}

function numberAttribute(element, name, fallback = 0) {
  const value = parseSvgLength(element.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

function applyMatrix(point, matrix) {
  if (!matrix) return { x: point.x, y: point.y };
  return {
    x: (matrix.a * point.x) + (matrix.c * point.y) + matrix.e,
    y: (matrix.b * point.x) + (matrix.d * point.y) + matrix.f
  };
}

function getPointsBounds(lines) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const line of lines) {
    for (const point of line) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

function fitIntoCanvas(sourceBox, options) {
  const canvasWidth = Math.max(1, Number(options.width) || 1080);
  const canvasHeight = Math.max(1, Number(options.height) || 1080);
  const padding = options.preserveViewport ? 0 : Math.min(canvasWidth, canvasHeight) * 0.04;
  const targetWidth = Math.max(1, canvasWidth - (padding * 2));
  const targetHeight = Math.max(1, canvasHeight - (padding * 2));
  const scale = Math.min(targetWidth / sourceBox.width, targetHeight / sourceBox.height);

  return {
    x: (canvasWidth - (sourceBox.width * scale)) / 2,
    y: (canvasHeight - (sourceBox.height * scale)) / 2,
    scale
  };
}

function createStroke(points, index, groupId, sourceBox, placement, options) {
  const seed = randomSeed();
  const canvasPoints = points
    .map((point, pointIndex) => ({
      x: placement.x + ((point.x - sourceBox.x) * placement.scale),
      y: placement.y + ((point.y - sourceBox.y) * placement.scale),
      pressure: 0.72,
      pointerType: "svg",
      time: pointIndex
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  return {
    id: `${groupId}-${index}-${seed}`,
    seed,
    tool: "brush",
    brush: options.brush === "ink" ? "ink" : "dotted",
    settings: {
      size: sanitizeNumber(options.size, 60, 3, 160),
      sizeVariation: sanitizeNumber(options.sizeVariation, 0, 0, 1),
      roughness: sanitizeNumber(options.roughness, 1, 0, 1),
      density: sanitizeNumber(options.density, 1, LINE_DENSITY_MIN, LINE_DENSITY_MAX),
      densityProfile: sanitizeDensityProfile(options.densityProfile),
      pressureEnabled: Boolean(options.pressureEnabled ?? true),
      color: sanitizeColor(options.color)
    },
    sizeScale: 1,
    densityScale: 1,
    meta: {
      generated: true,
      generator: "svg",
      groupId,
      role: "svg-line",
      sourceName: options.sourceName || null
    },
    points: dedupePoints(canvasPoints, 0.5)
  };
}

function dedupePoints(points, minDistance) {
  const clean = [];
  const minDistanceSq = minDistance * minDistance;

  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const previous = clean[clean.length - 1];
    if (previous) {
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      if ((dx * dx) + (dy * dy) < minDistanceSq) continue;
    }
    clean.push(point);
  }

  return clean;
}

function sanitizeNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function sanitizeDensityProfile(profile) {
  return DENSITY_PROFILES.has(profile) ? profile : DENSITY_PROFILE_DEFAULT;
}

function sanitizeColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color.toLowerCase() : "#000000";
}
