import { getStrokeDensity, getStrokeDensityProfile, getStrokeRoughness, getStrokeScatter, getStrokeSize, getStrokeSizeVariation, renderStroke } from "../brushes/BrushEngine.js?v=selection-2";
import { DENSITY_PROFILE_DEFAULT } from "../brushes/DensityProfiles.js?v=selection-2";
import { randomSeed } from "../brushes/random.js";
import { exportGif, exportJson, exportPng } from "./Exporter.js";
import { LINE_DENSITY_MAX_PERCENT, LINE_DENSITY_MIN_PERCENT } from "../utils/LineSettings.js?v=selection-2";

const CANVAS_BACKGROUND = "#bbbbbb";
const BRUSH_COLOR = "#ffffff";
const DEFAULT_EFFECTS = {
  wind: {
    enabled: false,
    direction: 0,
    strength: 45,
    trailLength: 120,
    destruction: 40,
    uniformity: 35
  }
};

export class CanvasController extends EventTarget {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });
    this.strokeCanvas = document.createElement("canvas");
    this.strokeCtx = this.strokeCanvas.getContext("2d", { willReadFrequently: true });
    this.strokes = [];
    this.generatedPreviewStrokes = [];
    this.currentStroke = null;
    this.selectedStrokeId = null;
    this.selectedStrokeIds = new Set();
    this.hoveredStrokeId = null;
    this.tool = "dotted";
    this.size = 100;
    this.sizeVariation = 0;
    this.scatter = 0.3;
    this.roughness = 0.7;
    this.density = 1;
    this.densityProfile = DENSITY_PROFILE_DEFAULT;
    this.pressureEnabled = true;
    this.renderQueued = false;
    this.historyPast = [];
    this.historyFuture = [];
    this.editSessionActive = false;
    this.backgroundColor = CANVAS_BACKGROUND;
    this.brushColor = BRUSH_COLOR;
    this.backgroundImage = null;
    this.backgroundObjectUrl = null;
    this.backgroundName = "";
    this.backgroundFit = "fill";
    this.effects = cloneEffects(DEFAULT_EFFECTS);
    this.animationSettings = {
      frames: 4,
      fps: 8,
      boilAmount: 42
    };
    this.animationPreview = {
      active: false,
      frameIndex: 0,
      lastTime: 0,
      raf: 0,
      settings: { ...this.animationSettings }
    };
    this.effectsEnabled = true;
    this.outlineMode = false;
    this.previewPoint = null;
    this.selectDrag = null;
    this.renderNow();
  }

  setTool(tool) {
    this.stopBoilPreview({ render: false });
    this.tool = tool;
    if (tool !== "select") {
      this.hoveredStrokeId = null;
      this.clearSelectedStrokeIds();
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
    const next = sanitizeNumber(percent, 100, LINE_DENSITY_MIN_PERCENT, LINE_DENSITY_MAX_PERCENT) / 100;
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

  setSizeVariation(percent) {
    const next = sanitizeNumber(percent, 0, 0, 100) / 100;
    const selected = this.getSelectedStroke();
    if (selected) {
      if (!this.editSessionActive) this.commitHistory();
      selected.settings.sizeVariation = next;
      this.queueRender();
      return;
    }
    this.sizeVariation = next;
    this.emitChange();
  }

  setScatter(percent) {
    const next = sanitizeNumber(percent, 100, 0, 100) / 100;
    const selected = this.getSelectedStroke();
    if (selected) {
      if (!this.editSessionActive) this.commitHistory();
      selected.settings.scatter = next;
      this.queueRender();
      return;
    }
    this.scatter = next;
    this.emitChange();
  }

  setRoughness(percent) {
    const next = sanitizeNumber(percent, 100, 0, 100) / 100;
    const selected = this.getSelectedStroke();
    if (selected) {
      if (!this.editSessionActive) this.commitHistory();
      selected.settings.roughness = next;
      this.queueRender();
      return;
    }
    this.roughness = next;
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

  setBrushColor(color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    const next = color.toLowerCase();
    this.brushColor = next;
    const selected = this.getSelectedStroke();
    if (selected && selected.tool !== "eraser") {
      if (!this.editSessionActive) this.commitHistory();
      selected.settings.color = next;
      this.queueRender();
      return;
    }
    this.emitChange();
    this.queueRender();
  }

  swapBackgroundAndBrushColors() {
    const oldBackgroundColor = this.backgroundColor;
    const oldBrushColor = this.brushColor;
    const nextBackgroundColor = oldBrushColor;
    const nextBrushColor = oldBackgroundColor;
    const recoloredStrokes = [];

    for (const stroke of this.strokes) {
      if (stroke.tool === "eraser") continue;
      const color = normalizeHexColor(stroke.settings?.color, oldBrushColor);
      if (color === oldBrushColor || color === oldBackgroundColor) recoloredStrokes.push(stroke);
    }

    if (recoloredStrokes.length) this.commitHistory();

    this.backgroundColor = nextBackgroundColor;
    this.brushColor = nextBrushColor;

    for (const stroke of recoloredStrokes) {
      const color = normalizeHexColor(stroke.settings?.color, oldBrushColor);
      stroke.settings.color = color === oldBrushColor ? nextBrushColor : nextBackgroundColor;
    }

    this.queueRender();
  }

  setBackgroundFit(fit) {
    if (fit !== "fit" && fit !== "fill") return;
    this.backgroundFit = fit;
    this.queueRender();
  }

  setWindEffect(settings = {}) {
    this.effects.wind = {
      ...this.effects.wind,
      enabled: Boolean(settings.enabled),
      direction: sanitizeNumber(settings.direction, 0, 0, 360),
      strength: sanitizeNumber(settings.strength, 45, 0, 100),
      trailLength: sanitizeNumber(settings.trailLength, 120, 0, 420),
      destruction: sanitizeNumber(settings.destruction, 40, 0, 100),
      uniformity: sanitizeNumber(settings.uniformity, 35, 0, 100)
    };
    this.queueRender();
  }

  setEffectsEnabled(enabled) {
    this.effectsEnabled = Boolean(enabled);
    this.queueRender();
  }

  setOutlineMode(enabled) {
    this.outlineMode = Boolean(enabled);
    this.queueRender();
  }

  toggleOutlineMode() {
    this.setOutlineMode(!this.outlineMode);
    return this.outlineMode;
  }

  setAnimationSettings(settings = {}) {
    this.animationSettings = {
      ...this.animationSettings,
      frames: sanitizeNumber(settings.frames, this.animationSettings.frames, 2, 8),
      fps: sanitizeNumber(settings.fps, this.animationSettings.fps, 2, 18),
      boilAmount: sanitizeNumber(settings.boilAmount, this.animationSettings.boilAmount, 0, 100)
    };
    if (this.animationPreview.active) {
      this.animationPreview.settings = { ...this.animationSettings };
      this.animationPreview.frameIndex %= Math.round(this.animationPreview.settings.frames);
    }
    this.emitChange();
  }

  setCanvasSize(width, height) {
    this.canvas.width = sanitizeSize(width);
    this.canvas.height = sanitizeSize(height);
    this.ensureStrokeLayer();
    this.queueRender();
  }

  beginEditSession() {
    if (!this.hasSelection() || this.editSessionActive) return;
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
    this.stopBoilPreview({ render: false });
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
        sizeVariation: this.sizeVariation,
        scatter: this.scatter,
        roughness: this.roughness,
        density: this.density,
        densityProfile: this.densityProfile,
        pressureEnabled: this.pressureEnabled,
        color: this.brushColor
      },
      sizeScale: 1,
      densityScale: 1,
      points: [point]
    };
    this.clearSelectedStrokeIds();
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
    this.stopBoilPreview({ render: false });
    if (this.strokes.length) this.commitHistory();
    this.strokes = [];
    this.generatedPreviewStrokes = [];
    this.currentStroke = null;
    this.clearSelectedStrokeIds();
    this.queueRender();
  }

  addGeneratedStrokes(strokes, { selectGroup = false } = {}) {
    if (!Array.isArray(strokes) || !strokes.length) return;
    this.commitHistory();
    const nextStrokes = cloneStrokes(strokes);
    this.strokes.push(...nextStrokes);
    this.generatedPreviewStrokes = [];
    this.historyFuture = [];
    this.currentStroke = null;
    this.hoveredStrokeId = null;
    if (selectGroup) {
      const selected = nextStrokes.find((stroke) => stroke.tool !== "eraser");
      this.setSelectedStrokeIds(selected ? [selected.id] : []);
    } else {
      this.clearSelectedStrokeIds();
    }
    this.queueRender();
    return getGeneratedGroupId(nextStrokes[0]);
  }

  replaceGeneratedGroup(groupId, strokes, { selectGroup = false, commitHistory = true } = {}) {
    if (!Array.isArray(strokes) || !strokes.length) return null;
    if (commitHistory) this.commitHistory();
    const nextStrokes = cloneStrokes(strokes);
    this.strokes = groupId
      ? this.strokes.filter((stroke) => getGeneratedGroupId(stroke) !== groupId)
      : this.strokes;
    this.strokes.push(...nextStrokes);
    this.generatedPreviewStrokes = [];
    if (commitHistory) this.historyFuture = [];
    this.currentStroke = null;
    this.hoveredStrokeId = null;
    if (selectGroup) {
      const selected = nextStrokes.find((stroke) => stroke.tool !== "eraser");
      this.setSelectedStrokeIds(selected ? [selected.id] : []);
    } else {
      this.clearSelectedStrokeIds();
    }
    this.queueRender();
    return getGeneratedGroupId(nextStrokes[0]);
  }

  previewGeneratedStrokes(strokes) {
    this.generatedPreviewStrokes = Array.isArray(strokes) ? cloneStrokes(strokes) : [];
    this.queueRender();
  }

  clearGeneratedPreview() {
    if (!this.generatedPreviewStrokes.length) return;
    this.generatedPreviewStrokes = [];
    this.queueRender();
  }

  commitGeneratedPreview(options = {}) {
    if (!this.generatedPreviewStrokes.length) return;
    this.addGeneratedStrokes(this.generatedPreviewStrokes, options);
  }

  resize(width, height) {
    const nextWidth = sanitizeSize(width);
    const nextHeight = sanitizeSize(height);
    if (nextWidth === this.canvas.width && nextHeight === this.canvas.height) return;

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
    this.stopBoilPreview({ render: false });
    this.renderNow({ showSelection: false, generatedPreviewAlpha: 1, forceBrushRender: true });
    exportPng(transparent ? this.strokeCanvas : this.canvas, { transparent });
    this.queueRender();
  }

  exportJson() {
    this.stopBoilPreview({ render: false });
    exportJson({
      format: "etica-document",
      version: 1,
      exportedAt: new Date().toISOString(),
      canvas: {
        width: this.canvas.width,
        height: this.canvas.height,
        backgroundColor: this.backgroundColor,
        brushColor: this.brushColor,
        backgroundFit: this.backgroundFit,
        backgroundName: this.backgroundName || null
      },
      defaults: {
        tool: this.tool,
        size: this.size,
        sizeVariation: this.sizeVariation,
        scatter: this.scatter,
        roughness: this.roughness,
        density: this.density,
        densityProfile: this.densityProfile,
        pressureEnabled: this.pressureEnabled
      },
      effects: cloneEffects(this.effects),
      effectsEnabled: this.effectsEnabled,
      animationSettings: { ...this.animationSettings },
      strokes: cloneStrokes(this.strokes)
    });
    this.queueRender();
  }

  async exportTransparentGif(settings = {}) {
    this.stopBoilPreview({ render: false });
    const animation = {
      ...this.animationSettings,
      ...settings
    };
    const frameCount = Math.round(sanitizeNumber(animation.frames, 4, 2, 8));
    const frames = [];

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      frames.push(this.renderTransparentAnimationFrame({
        frameIndex,
        boilAmount: animation.boilAmount
      }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    exportGif(frames, {
      fps: animation.fps,
      alphaThreshold: 96
    });
    this.queueRender();
  }

  startBoilPreview(settings = {}) {
    this.stopBoilPreview({ render: false });
    const previewSettings = {
      ...this.animationSettings,
      ...settings
    };
    previewSettings.frames = Math.round(sanitizeNumber(previewSettings.frames, 4, 2, 8));
    previewSettings.fps = sanitizeNumber(previewSettings.fps, 8, 2, 18);
    previewSettings.boilAmount = sanitizeNumber(previewSettings.boilAmount, 42, 0, 100);

    this.animationPreview = {
      active: true,
      frameIndex: 0,
      lastTime: 0,
      raf: 0,
      settings: previewSettings
    };
    this.emitBoilPreviewChange();

    const tick = (time) => {
      if (!this.animationPreview.active) return;
      const interval = 1000 / this.animationPreview.settings.fps;
      if (!this.animationPreview.lastTime || time - this.animationPreview.lastTime >= interval) {
        this.drawBoilPreviewFrame(this.animationPreview.frameIndex, this.animationPreview.settings.boilAmount);
        this.animationPreview.frameIndex = (this.animationPreview.frameIndex + 1) % this.animationPreview.settings.frames;
        this.animationPreview.lastTime = time;
      }
      this.animationPreview.raf = requestAnimationFrame(tick);
    };

    this.animationPreview.raf = requestAnimationFrame(tick);
  }

  stopBoilPreview({ render = true } = {}) {
    if (!this.animationPreview.active && !this.animationPreview.raf) return;
    cancelAnimationFrame(this.animationPreview.raf);
    this.animationPreview = {
      ...this.animationPreview,
      active: false,
      raf: 0,
      lastTime: 0
    };
    this.emitBoilPreviewChange();
    if (render) this.queueRender();
  }

  toggleBoilPreview(settings = {}) {
    if (this.animationPreview.active) {
      this.stopBoilPreview();
      return false;
    }
    this.startBoilPreview(settings);
    return true;
  }

  async copyTransparent() {
    this.renderNow({ showSelection: false, generatedPreviewAlpha: 1, forceBrushRender: true });
    const blob = await canvasToBlob(this.strokeCanvas);
    if (!blob || !navigator.clipboard || !window.ClipboardItem) {
      exportPng(this.strokeCanvas, { transparent: true });
      this.queueRender();
      return;
    }
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    this.queueRender();
  }

  selectStrokeAt(point, { additive = false } = {}) {
    const hit = this.findStrokeAt(point);
    if (additive) {
      if (hit) this.addStrokeToSelection(hit.id);
    } else {
      this.setSelectedStrokeIds(hit ? [hit.id] : []);
    }
    this.queueRender();
  }

  beginSelectDrag(point, { additive = false } = {}) {
    const hit = this.findStrokeAt(point);
    if (!hit) {
      if (!additive) this.clearSelectedStrokeIds();
      this.selectDrag = null;
      this.queueRender();
      return false;
    }

    if (additive) {
      if (this.selectedStrokeIds.has(hit.id)) {
        this.removeStrokeFromSelection(hit.id);
        this.selectDrag = null;
        this.queueRender();
        return false;
      }
      this.addStrokeToSelection(hit.id);
    } else if (this.selectedStrokeIds.has(hit.id) && this.selectedStrokeIds.size > 1) {
      this.selectedStrokeId = hit.id;
    } else {
      this.setSelectedStrokeIds([hit.id], hit.id);
    }

    this.selectDrag = {
      strokeIds: this.getDragStrokeIds(hit),
      lastPoint: point,
      hasMoved: false
    };
    this.queueRender();
    return true;
  }

  dragSelectedStroke(point) {
    if (!this.selectDrag) return;
    const draggedStrokes = this.strokes.filter((stroke) => this.selectDrag.strokeIds.includes(stroke.id));
    if (!draggedStrokes.length) return;

    const dx = point.x - this.selectDrag.lastPoint.x;
    const dy = point.y - this.selectDrag.lastPoint.y;
    if (dx * dx + dy * dy < 0.01) return;

    if (!this.selectDrag.hasMoved) {
      this.commitHistory();
      this.editSessionActive = true;
      this.selectDrag.hasMoved = true;
    }

    for (const draggedStroke of draggedStrokes) {
      for (const strokePoint of draggedStroke.points) {
        strokePoint.x += dx;
        strokePoint.y += dy;
      }
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
    if (!this.hasSelection()) return;
    this.clearSelectedStrokeIds();
    this.editSessionActive = false;
    this.queueRender();
  }

  deleteSelectedStroke() {
    const selectedIds = this.getSelectedStrokeIds();
    if (!selectedIds.length) return;

    const selectedStrokes = this.strokes.filter((stroke) => selectedIds.includes(stroke.id));
    if (!selectedStrokes.length) {
      this.clearSelectedStrokeIds();
      this.queueRender();
      return;
    }

    this.commitHistory();
    const idsToDelete = new Set(selectedIds);
    if (selectedStrokes.length === 1) {
      const groupId = getGeneratedGroupId(selectedStrokes[0]);
      if (groupId) {
        for (const stroke of this.strokes) {
          if (getGeneratedGroupId(stroke) === groupId) idsToDelete.add(stroke.id);
        }
      }
    }
    this.strokes = this.strokes.filter((stroke) => !idsToDelete.has(stroke.id));
    this.clearSelectedStrokeIds();
    this.hoveredStrokeId = null;
    this.editSessionActive = false;
    this.selectDrag = null;
    this.queueRender();
  }

  getSelectedStroke() {
    if (!this.selectedStrokeId) return null;
    return this.strokes.find((stroke) => stroke.id === this.selectedStrokeId) ?? null;
  }

  getSelectedStrokes() {
    const selectedIds = new Set(this.getSelectedStrokeIds());
    return this.strokes.filter((stroke) => selectedIds.has(stroke.id));
  }

  getSelectedStrokeIds() {
    const validIds = [];
    for (const id of this.selectedStrokeIds) {
      const stroke = this.strokes.find((item) => item.id === id && item.tool !== "eraser");
      if (stroke) validIds.push(id);
    }
    if (validIds.length !== this.selectedStrokeIds.size) {
      this.selectedStrokeIds = new Set(validIds);
      if (!this.selectedStrokeIds.has(this.selectedStrokeId)) {
        this.selectedStrokeId = validIds[0] ?? null;
      }
    }
    return validIds;
  }

  hasSelection() {
    return this.getSelectedStrokeIds().length > 0;
  }

  setSelectedStrokeIds(ids = [], primaryId = null) {
    const nextIds = [];
    for (const id of ids) {
      if (nextIds.includes(id)) continue;
      const stroke = this.strokes.find((item) => item.id === id && item.tool !== "eraser");
      if (stroke) nextIds.push(id);
    }
    this.selectedStrokeIds = new Set(nextIds);
    this.selectedStrokeId = nextIds.includes(primaryId) ? primaryId : (nextIds[0] ?? null);
  }

  addStrokeToSelection(id) {
    this.setSelectedStrokeIds([...this.getSelectedStrokeIds(), id], id);
  }

  removeStrokeFromSelection(id) {
    const nextIds = this.getSelectedStrokeIds().filter((item) => item !== id);
    this.setSelectedStrokeIds(nextIds, this.selectedStrokeId === id ? nextIds[0] : this.selectedStrokeId);
  }

  clearSelectedStrokeIds() {
    this.selectedStrokeIds.clear();
    this.selectedStrokeId = null;
  }

  selectAllStrokes() {
    const ids = this.strokes
      .filter((stroke) => stroke.tool !== "eraser")
      .map((stroke) => stroke.id);
    this.setSelectedStrokeIds(ids, ids[0] ?? null);
    this.queueRender();
  }

  getDragStrokeIds(hit) {
    const selectedIds = this.getSelectedStrokeIds();
    if (selectedIds.length > 1) return selectedIds;

    const groupId = getGeneratedGroupId(hit);
    if (groupId) {
      return this.strokes
        .filter((stroke) => getGeneratedGroupId(stroke) === groupId)
        .map((stroke) => stroke.id);
    }

    return [hit.id];
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

  renderNow({ showSelection = true, showGeneratedPreview = true, generatedPreviewAlpha = 0.68, forceBrushRender = false } = {}) {
    this.ensureStrokeLayer();
    this.paintBackground();
    this.strokeCtx.clearRect(0, 0, this.strokeCanvas.width, this.strokeCanvas.height);

    if (this.outlineMode && !forceBrushRender) {
      this.renderOutlineLayer({ showGeneratedPreview, generatedPreviewAlpha });
      this.ctx.drawImage(this.strokeCanvas, 0, 0);
      if (showSelection) this.drawSelectionOverlay();
      this.emitChange();
      return;
    }

    for (const stroke of this.strokes) {
      const isHovered = showSelection && this.tool === "select" && stroke.id === this.hoveredStrokeId && stroke.tool !== "eraser";
      renderStroke(this.strokeCtx, stroke, this.getStrokeRenderOptions({ alpha: isHovered ? 0.7 : 1 }));
    }

    if (showGeneratedPreview) {
      for (const stroke of this.generatedPreviewStrokes) {
        renderStroke(this.strokeCtx, stroke, this.getStrokeRenderOptions({ alpha: generatedPreviewAlpha }));
      }
    }

    this.ctx.drawImage(this.strokeCanvas, 0, 0);
    if (showSelection) this.drawSelectionOverlay();
    if (showSelection) this.drawBrushPreview();
    this.emitChange();
  }

  renderTransparentAnimationFrame({ frameIndex = 0, boilAmount = 0 } = {}) {
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = this.canvas.width;
    frameCanvas.height = this.canvas.height;
    const frameCtx = frameCanvas.getContext("2d", { willReadFrequently: true });
    frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);

    const options = {
      ...this.getStrokeRenderOptions({
        alpha: 1,
        frameIndex,
        boilAmount
      })
    };

    for (const stroke of this.strokes) {
      renderStroke(frameCtx, stroke, options);
    }

    for (const stroke of this.generatedPreviewStrokes) {
      renderStroke(frameCtx, stroke, options);
    }

    return frameCanvas;
  }

  drawBoilPreviewFrame(frameIndex = 0, boilAmount = 0) {
    this.ensureStrokeLayer();
    this.paintBackground();
    this.strokeCtx.clearRect(0, 0, this.strokeCanvas.width, this.strokeCanvas.height);

    const options = this.getStrokeRenderOptions({
      alpha: 1,
      frameIndex,
      boilAmount
    });

    for (const stroke of this.strokes) {
      renderStroke(this.strokeCtx, stroke, options);
    }

    for (const stroke of this.generatedPreviewStrokes) {
      renderStroke(this.strokeCtx, stroke, options);
    }

    this.ctx.drawImage(this.strokeCanvas, 0, 0);
  }

  renderOutlineLayer({ showGeneratedPreview = true, generatedPreviewAlpha = 0.68 } = {}) {
    for (const stroke of this.strokes) {
      this.drawOutlineStroke(this.strokeCtx, stroke, 1);
    }

    if (showGeneratedPreview) {
      for (const stroke of this.generatedPreviewStrokes) {
        this.drawOutlineStroke(this.strokeCtx, stroke, generatedPreviewAlpha);
      }
    }
  }

  drawOutlineStroke(ctx, stroke, alpha = 1) {
    if (stroke.tool === "eraser" || stroke.points.length < 1) return;

    const color = normalizeHexColor(stroke.settings?.color, this.brushColor);
    const lineWidth = this.getOutlineLineWidth(stroke);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      const radius = Math.max(2.5, Math.min(10, getStrokeSize(stroke) * 0.08));
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let index = 1; index < stroke.points.length; index += 1) {
      ctx.lineTo(stroke.points[index].x, stroke.points[index].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  getStrokeRenderOptions(options = {}) {
    return {
      ...options,
      fallbackColor: this.brushColor,
      effects: this.effectsEnabled ? this.effects : null,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height
    };
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
    this.ctx.strokeStyle = isEraser ? "rgba(255, 92, 92, 0.92)" : hexToRgba(this.brushColor, 0.82);
    this.ctx.fillStyle = isEraser ? "rgba(255, 92, 92, 0.08)" : hexToRgba(this.brushColor, 0.08);
    this.ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
    this.ctx.shadowBlur = 3;
    this.ctx.beginPath();
    this.ctx.arc(this.previewPoint.x, this.previewPoint.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    if (this.tool === "dotted") {
      this.ctx.fillStyle = hexToRgba(this.brushColor, 0.9);
      this.ctx.beginPath();
      this.ctx.arc(this.previewPoint.x, this.previewPoint.y, Math.max(2, radius * 0.16), 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawSelectionOverlay() {
    const selectedStrokes = this.getSelectedStrokes();
    if (!selectedStrokes.length || this.editSessionActive) return;

    this.ctx.save();

    for (const stroke of selectedStrokes) {
      if (stroke.points.length < 1) continue;
      const firstPoint = stroke.points[0];
      const lastPoint = stroke.points[stroke.points.length - 1];
      const radius = Math.max(5.5, Math.min(13, getStrokeSize(stroke) * 0.23));
      const pathWidth = this.outlineMode ? this.getOutlineLineWidth(stroke) : 1;
      this.drawSelectedPath(stroke, pathWidth);
      this.ctx.shadowColor = "rgba(68, 255, 98, 0.42)";
      this.ctx.shadowBlur = radius * 0.7;
      this.ctx.fillStyle = "#43ff5f";
      this.ctx.strokeStyle = "rgba(0, 0, 0, 0.86)";
      this.ctx.lineWidth = Math.max(2, radius * 0.18);
      this.drawEndpointDot(firstPoint, radius, "S");
      if (lastPoint !== firstPoint) this.drawEndpointDot(lastPoint, radius, "F");
    }
    this.ctx.restore();
  }

  drawSelectedPath(stroke, lineWidth) {
    if (stroke.points.length < 2) return;

    this.ctx.save();
    this.ctx.shadowColor = "transparent";
    this.ctx.shadowBlur = 0;
    this.ctx.globalAlpha = 1;
    this.ctx.strokeStyle = "#43ff5f";
    this.ctx.lineWidth = lineWidth;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let index = 1; index < stroke.points.length; index += 1) {
      this.ctx.lineTo(stroke.points[index].x, stroke.points[index].y);
    }
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawEndpointDot(point, radius, label = "") {
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    if (!label) return;

    this.ctx.save();
    this.ctx.shadowColor = "transparent";
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = "#000000";
    this.ctx.font = `700 ${Math.max(8, radius * 1.05)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(label, point.x, point.y + (radius * 0.03));
    this.ctx.restore();
  }

  getOutlineLineWidth(stroke) {
    return Math.max(2, Math.min(8, getStrokeSize(stroke) * 0.035));
  }

  findStrokeAt(point) {
    let best = null;
    let bestDistance = Infinity;

    for (let index = this.strokes.length - 1; index >= 0; index -= 1) {
      const stroke = this.strokes[index];
      if (stroke.tool === "eraser" || stroke.points.length < 1) continue;

      const threshold = Math.max(18, getStrokeSize(stroke) * 1.75);
      const distance = stroke.points.length === 1
        ? Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y)
        : distanceToStroke(point, stroke);
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
      selectedStrokeIds: this.getSelectedStrokeIds(),
      strokes: cloneStrokes(this.strokes)
    };
  }

  restoreState(state) {
    this.canvas.width = state.width;
    this.canvas.height = state.height;
    this.ensureStrokeLayer();
    this.strokes = cloneStrokes(state.strokes);
    this.setSelectedStrokeIds(state.selectedStrokeIds || (state.selectedStrokeId ? [state.selectedStrokeId] : []), state.selectedStrokeId);
    this.hoveredStrokeId = null;
    this.currentStroke = null;
    this.editSessionActive = false;
    this.selectDrag = null;
    this.generatedPreviewStrokes = [];
    this.queueRender();
  }

  emitChange() {
    const selected = this.getSelectedStroke();
    const selectedCount = this.getSelectedStrokeIds().length;
    const selectableStrokes = this.strokes.filter((stroke) => stroke.tool !== "eraser");
    const selectedIndex = selected ? selectableStrokes.findIndex((stroke) => stroke.id === selected.id) + 1 : 0;
    this.dispatchEvent(new CustomEvent("change", {
      detail: {
        width: this.canvas.width,
        height: this.canvas.height,
        strokes: this.strokes.length,
        tool: this.tool,
        size: this.size,
        density: this.density,
        scatter: this.scatter,
        roughness: this.roughness,
        outlineMode: this.outlineMode,
        activeSize: selected ? getStrokeSize(selected) : this.size,
        activeSizeVariation: selected ? getStrokeSizeVariation(selected) : this.sizeVariation,
        activeScatter: selected ? getStrokeScatter(selected) : this.scatter,
        activeRoughness: selected ? getStrokeRoughness(selected) : this.roughness,
        activeDensity: selected ? getStrokeDensity(selected) : this.density,
        activeDensityProfile: selected ? getStrokeDensityProfile(selected) : this.densityProfile,
        activeBrushColor: selected?.settings?.color ?? this.brushColor,
        backgroundColor: this.backgroundColor,
        brushColor: this.brushColor,
        effects: cloneEffects(this.effects),
        animationSettings: { ...this.animationSettings },
        selectedStrokeId: selected?.id ?? null,
        selectedStrokeIds: this.getSelectedStrokeIds(),
        selectedStrokeCount: selectedCount,
        selectedStrokeIndex: selectedIndex,
        selectedStrokeTotal: selectableStrokes.length,
        canUndo: this.historyPast.length > 0,
        canRedo: this.historyFuture.length > 0,
        backgroundName: this.backgroundName,
        boilPreviewActive: this.animationPreview.active
      }
    }));
  }

  emitBoilPreviewChange() {
    this.dispatchEvent(new CustomEvent("boilpreviewchange", {
      detail: { active: this.animationPreview.active }
    }));
  }
}

function cloneStrokes(strokes) {
  return strokes.map((stroke) => ({
    ...stroke,
    settings: { ...stroke.settings },
    meta: stroke.meta ? { ...stroke.meta } : undefined,
    points: stroke.points.map((point) => ({ ...point }))
  }));
}

function cloneEffects(effects) {
  return {
    wind: { ...effects.wind }
  };
}

function getGeneratedGroupId(stroke) {
  return stroke?.meta?.generated ? stroke.meta.groupId : null;
}

function hexToRgba(hex, alpha) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return `rgba(0, 0, 0, ${alpha})`;
  const red = Number.parseInt(match[1], 16);
  const green = Number.parseInt(match[2], 16);
  const blue = Number.parseInt(match[3], 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function normalizeHexColor(color, fallback = "#000000") {
  return /^#[0-9a-f]{6}$/i.test(color || "") ? color.toLowerCase() : fallback;
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
  return ["flat", "fade-in", "fade-out", "in-out", "soft-peak", "hard-peak", "soft-dip", "hard-dip"].includes(profile)
    ? profile
    : DENSITY_PROFILE_DEFAULT;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
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
