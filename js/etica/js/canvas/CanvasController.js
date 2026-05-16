import { getStrokeDensity, getStrokeDensityProfile, getStrokeSize, renderStroke } from "../brushes/BrushEngine.js";
import { DENSITY_PROFILE_DEFAULT } from "../brushes/DensityProfiles.js";
import { randomSeed } from "../brushes/random.js";
import { exportPng } from "./Exporter.js";

const CANVAS_BACKGROUND = "#050505";

export class CanvasController extends EventTarget {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });
    this.strokeCanvas = document.createElement("canvas");
    this.strokeCtx = this.strokeCanvas.getContext("2d", { willReadFrequently: true });
    this.strokes = [];
    this.currentStroke = null;
    this.selectedStrokeId = null;
    this.hoveredStrokeId = null;
    this.tool = "dotted";
    this.size = 18;
    this.density = 1;
    this.densityProfile = DENSITY_PROFILE_DEFAULT;
    this.pressureEnabled = true;
    this.renderQueued = false;
    this.historyPast = [];
    this.historyFuture = [];
    this.editSessionActive = false;
    this.backgroundColor = CANVAS_BACKGROUND;
    this.backgroundImage = null;
    this.backgroundObjectUrl = null;
    this.backgroundName = "";
    this.backgroundFit = "fit";
    this.previewPoint = null;
    this.selectDrag = null;
    this.renderNow();
  }

  setTool(tool) {
    this.tool = tool;
    if (tool !== "select") {
      this.hoveredStrokeId = null;
      this.selectedStrokeId = null;
      this.editSessionActive = false;
      this.selectDrag = null;
    }
    if (tool === "select") this.previewPoint = null;
    this.queueRender();
  }

  setSize(size) {
    const next = sanitizeNumber(size, 18, 3, 160);
    const selected = this.getSelectedStroke();
    if (selected) {
      if (!this.editSessionActive) this.commitHistory();
      selected.settings.size = next;
      this.queueRender();
      return;
    }
    this.size = next;
    this.emitChange();
  }

  setDensity(percent) {
    const next = sanitizeNumber(percent, 100, 20, 320) / 100;
    const selected = this.getSelectedStroke();
    if (selected) {
      if (!this.editSessionActive) this.commitHistory();
      selected.settings.density = next;
      this.queueRender();
      return;
    }
    this.density = next;
    this.emitChange();
  }

  setDensityProfile(profile) {
    const next = sanitizeDensityProfile(profile);
    const selected = this.getSelectedStroke();
    if (selected) {
      if (!this.editSessionActive) this.commitHistory();
      selected.settings.densityProfile = next;
      this.queueRender();
      return;
    }
    this.densityProfile = next;
    this.emitChange();
  }

  setBackgroundColor(color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    this.backgroundColor = color.toLowerCase();
    this.queueRender();
  }

  setBackgroundFit(fit) {
    if (fit !== "fit" && fit !== "fill") return;
    this.backgroundFit = fit;
    this.queueRender();
  }

  beginEditSession() {
    if (!this.getSelectedStroke() || this.editSessionActive) return;
    this.commitHistory();
    this.editSessionActive = true;
    this.queueRender();
  }

  endEditSession() {
    if (!this.editSessionActive) return;
    this.editSessionActive = false;
    this.queueRender();
  }

  beginStroke(point) {
    if (this.tool === "select") {
      this.selectStrokeAt(point);
      return;
    }

    this.commitHistory();
    this.currentStroke = {
      id: `${Date.now()}-${this.strokes.length}-${randomSeed()}`,
      seed: randomSeed(),
      tool: this.tool === "eraser" ? "eraser" : "brush",
      brush: this.tool === "ink" ? "ink" : "dotted",
      settings: {
        size: this.size,
        density: this.density,
        densityProfile: this.densityProfile,
        pressureEnabled: this.pressureEnabled
      },
      sizeScale: 1,
      densityScale: 1,
      points: [point]
    };
    this.selectedStrokeId = null;
    this.strokes.push(this.currentStroke);
    this.queueRender();
  }

  addPoint(point) {
    if (!this.currentStroke) return;
    const last = this.currentStroke.points[this.currentStroke.points.length - 1];
    const dx = point.x - last.x;
    const dy = point.y - last.y;
    if (dx * dx + dy * dy < 0.36) return;
    this.currentStroke.points.push(point);
    this.queueRender();
  }

  endStroke(point) {
    if (!this.currentStroke) return;
    this.addPoint(point);
    this.currentStroke = null;
    this.queueRender();
  }

  undo() {
    if (!this.historyPast.length) return;
    this.historyFuture.push(this.captureState());
    this.restoreState(this.historyPast.pop());
  }

  redo() {
    if (!this.historyFuture.length) return;
    this.historyPast.push(this.captureState());
    this.restoreState(this.historyFuture.pop());
  }

  clear() {
    if (this.strokes.length) this.commitHistory();
    this.strokes = [];
    this.currentStroke = null;
    this.selectedStrokeId = null;
    this.queueRender();
  }

  resize(width, height) {
    const nextWidth = sanitizeSize(width);
    const nextHeight = sanitizeSize(height);
    const dx = (nextWidth - this.canvas.width) / 2;
    const dy = (nextHeight - this.canvas.height) / 2;

    this.commitHistory();

    for (const stroke of this.strokes) {
      for (const point of stroke.points) {
        point.x += dx;
        point.y += dy;
      }
    }

    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;
    this.ensureStrokeLayer();
    this.queueRender();
  }

  loadBackgroundFile(file) {
    if (!file) return;

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      if (this.backgroundObjectUrl) URL.revokeObjectURL(this.backgroundObjectUrl);
      this.backgroundObjectUrl = objectUrl;
      this.backgroundImage = image;
      this.backgroundName = file.name;
      this.queueRender();
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  }

  clearBackground() {
    if (this.backgroundObjectUrl) URL.revokeObjectURL(this.backgroundObjectUrl);
    this.backgroundObjectUrl = null;
    this.backgroundImage = null;
    this.backgroundName = "";
    this.queueRender();
  }

  export({ transparent = false } = {}) {
    this.renderNow({ showSelection: false });
    exportPng(transparent ? this.strokeCanvas : this.canvas, { transparent });
    this.queueRender();
  }

  selectStrokeAt(point) {
    const hit = this.findStrokeAt(point);
    this.selectedStrokeId = hit?.id ?? null;
    this.queueRender();
  }

  beginSelectDrag(point) {
    const hit = this.findStrokeAt(point);
    this.selectedStrokeId = hit?.id ?? null;
    this.selectDrag = hit ? {
      strokeId: hit.id,
      lastPoint: point,
      hasMoved: false
    } : null;
    this.queueRender();
    return Boolean(hit);
  }

  dragSelectedStroke(point) {
    if (!this.selectDrag) return;
    const stroke = this.strokes.find((item) => item.id === this.selectDrag.strokeId);
    if (!stroke) return;

    const dx = point.x - this.selectDrag.lastPoint.x;
    const dy = point.y - this.selectDrag.lastPoint.y;
    if (dx * dx + dy * dy < 0.01) return;

    if (!this.selectDrag.hasMoved) {
      this.commitHistory();
      this.editSessionActive = true;
      this.selectDrag.hasMoved = true;
    }

    for (const strokePoint of stroke.points) {
      strokePoint.x += dx;
      strokePoint.y += dy;
    }

    this.selectDrag.lastPoint = point;
    this.queueRender();
  }

  endSelectDrag() {
    if (!this.selectDrag) return;
    this.selectDrag = null;
    this.editSessionActive = false;
    this.queueRender();
  }

  hoverStrokeAt(point) {
    const hit = this.tool === "select" ? this.findStrokeAt(point) : null;
    const nextId = hit?.id ?? null;
    if (nextId === this.hoveredStrokeId) return;
    this.hoveredStrokeId = nextId;
    this.queueRender();
  }

  clearHover() {
    if (!this.hoveredStrokeId) return;
    this.hoveredStrokeId = null;
    this.queueRender();
  }

  setPreviewPoint(point) {
    if (this.currentStroke || this.tool === "select") return;
    this.previewPoint = point;
    this.queueRender();
  }

  clearPreviewPoint() {
    if (!this.previewPoint) return;
    this.previewPoint = null;
    this.queueRender();
  }

  clearSelection() {
    if (!this.selectedStrokeId) return;
    this.selectedStrokeId = null;
    this.editSessionActive = false;
    this.queueRender();
  }

  deleteSelectedStroke() {
    if (!this.selectedStrokeId) return;
    const strokeIndex = this.strokes.findIndex((stroke) => stroke.id === this.selectedStrokeId);
    if (strokeIndex === -1) {
      this.selectedStrokeId = null;
      this.queueRender();
      return;
    }

    this.commitHistory();
    this.strokes.splice(strokeIndex, 1);
    this.selectedStrokeId = null;
    this.hoveredStrokeId = null;
    this.editSessionActive = false;
    this.selectDrag = null;
    this.queueRender();
  }

  getSelectedStroke() {
    if (!this.selectedStrokeId) return null;
    return this.strokes.find((stroke) => stroke.id === this.selectedStrokeId) ?? null;
  }

  getPointFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (event.clientY - rect.top) * (this.canvas.height / rect.height),
      pressure: normalizePressure(event),
      pointerType: event.pointerType || "mouse",
      time: performance.now()
    };
  }

  queueRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.renderNow();
    });
  }

  renderNow({ showSelection = true } = {}) {
    this.ensureStrokeLayer();
    this.paintBackground();
    this.strokeCtx.clearRect(0, 0, this.strokeCanvas.width, this.strokeCanvas.height);

    for (const stroke of this.strokes) {
      const isHovered = showSelection && this.tool === "select" && stroke.id === this.hoveredStrokeId && stroke.tool !== "eraser";
      renderStroke(this.strokeCtx, stroke, { alpha: isHovered ? 0.7 : 1 });
    }

    this.ctx.drawImage(this.strokeCanvas, 0, 0);
    if (showSelection) this.drawSelectionOverlay();
    if (showSelection) this.drawBrushPreview();
    this.emitChange();
  }

  paintBackground() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.fillStyle = this.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.backgroundImage) {
      const placement = containRect(
        this.backgroundImage.naturalWidth || this.backgroundImage.width,
        this.backgroundImage.naturalHeight || this.backgroundImage.height,
        this.canvas.width,
        this.canvas.height,
        this.backgroundFit
      );
      this.ctx.drawImage(
        this.backgroundImage,
        placement.x,
        placement.y,
        placement.width,
        placement.height
      );
    }

    this.ctx.restore();
  }

  drawBrushPreview() {
    if (!this.previewPoint || this.tool === "select") return;

    const radius = Math.max(1.5, this.size * 0.5);
    const isEraser = this.tool === "eraser";
    this.ctx.save();
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeStyle = isEraser ? "rgba(255, 92, 92, 0.92)" : "rgba(244, 244, 240, 0.82)";
    this.ctx.fillStyle = isEraser ? "rgba(255, 92, 92, 0.08)" : "rgba(244, 244, 240, 0.08)";
    this.ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    this.ctx.shadowBlur = 3;
    this.ctx.beginPath();
    this.ctx.arc(this.previewPoint.x, this.previewPoint.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    if (this.tool === "dotted") {
      this.ctx.fillStyle = "rgba(244, 244, 240, 0.9)";
      this.ctx.beginPath();
      this.ctx.arc(this.previewPoint.x, this.previewPoint.y, Math.max(2, radius * 0.16), 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawSelectionOverlay() {
    const stroke = this.getSelectedStroke();
    if (!stroke || stroke.points.length < 1 || this.editSessionActive) return;

    const firstPoint = stroke.points[0];
    const lastPoint = stroke.points[stroke.points.length - 1];
    const radius = Math.max(11, Math.min(26, getStrokeSize(stroke) * 0.46));

    this.ctx.save();
    this.ctx.shadowColor = "rgba(68, 255, 98, 0.42)";
    this.ctx.shadowBlur = radius * 0.7;
    this.ctx.fillStyle = "#43ff5f";
    this.ctx.strokeStyle = "rgba(0, 0, 0, 0.86)";
    this.ctx.lineWidth = Math.max(2, radius * 0.18);
    this.drawEndpointDot(firstPoint, radius);
    if (lastPoint !== firstPoint) this.drawEndpointDot(lastPoint, radius);
    this.ctx.restore();
  }

  drawEndpointDot(point, radius) {
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }

  findStrokeAt(point) {
    let best = null;
    let bestDistance = Infinity;

    for (let index = this.strokes.length - 1; index >= 0; index -= 1) {
      const stroke = this.strokes[index];
      if (stroke.tool === "eraser" || stroke.points.length < 2) continue;

      const threshold = Math.max(18, getStrokeSize(stroke) * 1.75);
      const distance = distanceToStroke(point, stroke);
      if (distance <= threshold && distance < bestDistance) {
        best = stroke;
        bestDistance = distance;
      }
    }

    return best;
  }

  ensureStrokeLayer() {
    if (this.strokeCanvas.width === this.canvas.width && this.strokeCanvas.height === this.canvas.height) return;
    this.strokeCanvas.width = this.canvas.width;
    this.strokeCanvas.height = this.canvas.height;
  }

  commitHistory() {
    if (this.editSessionActive) return;
    this.historyPast.push(this.captureState());
    if (this.historyPast.length > 80) this.historyPast.shift();
    this.historyFuture = [];
    this.hoveredStrokeId = null;
  }

  captureState() {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
      selectedStrokeId: this.selectedStrokeId,
      strokes: cloneStrokes(this.strokes)
    };
  }

  restoreState(state) {
    this.canvas.width = state.width;
    this.canvas.height = state.height;
    this.ensureStrokeLayer();
    this.strokes = cloneStrokes(state.strokes);
    this.selectedStrokeId = state.selectedStrokeId;
    this.hoveredStrokeId = null;
    this.currentStroke = null;
    this.editSessionActive = false;
    this.selectDrag = null;
    this.queueRender();
  }

  emitChange() {
    const selected = this.getSelectedStroke();
    const selectedIndex = selected ? this.strokes.findIndex((stroke) => stroke.id === selected.id) + 1 : 0;
    this.dispatchEvent(new CustomEvent("change", {
      detail: {
        width: this.canvas.width,
        height: this.canvas.height,
        strokes: this.strokes.length,
        tool: this.tool,
        size: this.size,
        density: this.density,
        activeSize: selected ? getStrokeSize(selected) : this.size,
        activeDensity: selected ? getStrokeDensity(selected) : this.density,
        activeDensityProfile: selected ? getStrokeDensityProfile(selected) : this.densityProfile,
        selectedStrokeId: selected?.id ?? null,
        selectedStrokeIndex: selectedIndex,
        canUndo: this.historyPast.length > 0,
        canRedo: this.historyFuture.length > 0,
        backgroundName: this.backgroundName
      }
    }));
  }
}

function cloneStrokes(strokes) {
  return strokes.map((stroke) => ({
    ...stroke,
    settings: { ...stroke.settings },
    points: stroke.points.map((point) => ({ ...point }))
  }));
}

function normalizePressure(event) {
  if (event.pointerType === "mouse") return 0.72;
  if (typeof event.pressure === "number" && event.pressure > 0) {
    return Math.min(1, Math.max(0.05, event.pressure));
  }
  return 0.72;
}

function sanitizeSize(value) {
  return Math.round(sanitizeNumber(value, 1080, 64, 6000));
}

function sanitizeNumber(value, fallback, min, max) {
  const numeric = Number.parseFloat(String(value).replace(",", ".").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function sanitizeDensityProfile(profile) {
  return ["flat", "fade-in", "fade-out", "in-out", "soft-peak"].includes(profile)
    ? profile
    : DENSITY_PROFILE_DEFAULT;
}

function containRect(sourceWidth, sourceHeight, targetWidth, targetHeight, mode = "fit") {
  const scale = mode === "fill"
    ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
    : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height
  };
}

function distanceToStroke(point, stroke) {
  let best = Infinity;
  for (let index = 1; index < stroke.points.length; index += 1) {
    const distance = distanceToSegment(point, stroke.points[index - 1], stroke.points[index]);
    if (distance < best) best = distance;
  }
  return best;
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(point.x - a.x, point.y - a.y);

  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  const x = a.x + dx * t;
  const y = a.y + dy * t;
  return Math.hypot(point.x - x, point.y - y);
}
