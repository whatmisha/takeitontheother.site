import { BackgroundColorPicker } from "./BackgroundColorPicker.js";
import { NuevoGenerator } from "../generators/NuevoGenerator.js";
import { PhotoGenerator } from "../generators/PhotoGenerator.js";
import { PlantGenerator } from "../generators/PlantGenerator.js";

export class Toolbar {
  constructor(controller) {
    this.controller = controller;
    this.activeMode = "pinta";
    this.previousPintaTool = "dotted";
    this.modeButtons = document.querySelectorAll("[data-mode-tab]");
    this.toolsPanel = document.getElementById("toolsPanel");
    this.linePanel = document.getElementById("linePanel");
    this.backgroundPanel = document.getElementById("backgroundPanel");
    this.fotoPanel = document.getElementById("fotoPanel");
    this.nuevoPanel = document.getElementById("nuevoPanel");
    this.florPanel = document.getElementById("florPanel");
    this.sizeInput = document.getElementById("sizeInput");
    this.sizeOutput = document.getElementById("sizeOutput");
    this.sizeVariationInput = document.getElementById("sizeVariationInput");
    this.sizeVariationOutput = document.getElementById("sizeVariationOutput");
    this.densityInput = document.getElementById("densityInput");
    this.densityOutput = document.getElementById("densityOutput");
    this.densityProfileSelect = document.getElementById("densityProfileSelect");
    this.canvasPresetToggle = document.getElementById("canvasPresetToggle");
    this.canvasPresetText = document.getElementById("canvasPresetText");
    this.canvasPresetMenu = document.getElementById("canvasPresetMenu");
    this.canvasPresetItems = document.querySelectorAll("[data-canvas-preset]");
    this.undoButton = document.getElementById("undoButton");
    this.redoButton = document.getElementById("redoButton");
    this.clearButton = document.getElementById("clearButton");
    this.exportButton = document.getElementById("exportButton");
    this.transparencyToggle = document.getElementById("transparencyToggle");
    this.backgroundInput = document.getElementById("backgroundInput");
    this.backgroundButton = document.getElementById("backgroundButton");
    this.swapColorsButton = document.getElementById("swapColorsButton");
    this.clearBackgroundButton = document.getElementById("clearBackgroundButton");
    this.backgroundFitInputs = document.querySelectorAll("[data-background-fit]");
    this.backgroundMeta = document.getElementById("backgroundMeta");
    this.deselectButton = document.getElementById("deselectButton");
    this.selectionMeta = document.getElementById("selectionMeta");
    this.mobileSizeInput = document.getElementById("mobileSizeInput");
    this.mobileBrushButton = document.getElementById("mobileBrushButton");
    this.mobileBrushPopover = document.getElementById("mobileBrushPopover");
    this.mobilePhotoButton = document.getElementById("mobilePhotoButton");
    this.mobileExportButton = document.getElementById("mobileExportButton");
    this.mobileExportSheet = document.getElementById("mobileExportSheet");
    this.mobileUndoButton = document.getElementById("mobileUndoButton");
    this.mobileRedoButton = document.getElementById("mobileRedoButton");
    this.mobileExportCanvasButton = document.getElementById("mobileExportCanvasButton");
    this.mobileExportTransparentButton = document.getElementById("mobileExportTransparentButton");
    this.mobileCopyTransparentButton = document.getElementById("mobileCopyTransparentButton");
    this.fotoInput = document.getElementById("fotoInput");
    this.fotoUploadButton = document.getElementById("fotoUploadButton");
    this.fotoMeta = document.getElementById("fotoMeta");
    this.fotoFitInputs = document.querySelectorAll("[data-foto-fit]");
    this.fotoRegenerateButton = document.getElementById("fotoRegenerateButton");
    this.fotoSeedInput = document.getElementById("fotoSeedInput");
    this.nuevoInput = document.getElementById("nuevoInput");
    this.nuevoUploadButton = document.getElementById("nuevoUploadButton");
    this.nuevoMeta = document.getElementById("nuevoMeta");
    this.nuevoFitInputs = document.querySelectorAll("[data-nuevo-fit]");
    this.nuevoRegenerateButton = document.getElementById("nuevoRegenerateButton");
    this.nuevoSeedInput = document.getElementById("nuevoSeedInput");
    this.florRegenerateButton = document.getElementById("florRegenerateButton");
    this.florSeedInput = document.getElementById("florSeedInput");
    this.florTypeSelect = document.getElementById("florTypeSelect");
    this.lastDetail = null;
    this.nuevoGenerator = new NuevoGenerator();
    this.photoGenerator = new PhotoGenerator();
    this.plantGenerator = new PlantGenerator();
    this.photoImage = null;
    this.photoObjectUrl = null;
    this.generatedGroupIds = {
      foto: null,
      nuevo: null,
      flor: null
    };
    this.generatorRefreshTimer = null;
    this.backgroundColorPicker = new BackgroundColorPicker(controller, {
      prefix: "background",
      initialColor: "#bbbbbb",
      onChange: (color) => controller.setBackgroundColor(color)
    });
    this.brushColorPicker = new BackgroundColorPicker(controller, {
      prefix: "brush",
      initialColor: "#000000",
      onChange: (color) => {
        controller.setBrushColor(color);
        this.queueActiveGeneratorRefresh();
      }
    });
    this.bind();
    this.backgroundColorPicker.init();
    this.brushColorPicker.init();
    this.setMode("pinta");
  }

  bind() {
    this.bindModeTabs();

    document.querySelectorAll("[data-tool]").forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) this.setActiveTool(input.dataset.tool);
      });
    });

    this.sizeInput.addEventListener("pointerdown", () => this.controller.beginEditSession());
    this.sizeInput.addEventListener("input", () => this.applySize(this.sizeInput.value));
    this.sizeInput.addEventListener("change", () => this.controller.endEditSession());
    this.bindRangeKeyboard(this.sizeInput, {
      min: 3,
      max: 160,
      baseStep: 1,
      shiftStep: 10,
      onApply: (value) => this.applySize(value)
    });

    this.densityInput.addEventListener("pointerdown", () => this.controller.beginEditSession());
    this.densityInput.addEventListener("input", () => this.applyDensity(this.densityInput.value));
    this.densityInput.addEventListener("change", () => this.controller.endEditSession());
    this.bindRangeKeyboard(this.densityInput, {
      min: 20,
      max: 320,
      baseStep: 5,
      shiftStep: 10,
      onApply: (value) => this.applyDensity(value)
    });

    this.sizeVariationInput.addEventListener("pointerdown", () => this.controller.beginEditSession());
    this.sizeVariationInput.addEventListener("input", () => this.applySizeVariation(this.sizeVariationInput.value));
    this.sizeVariationInput.addEventListener("change", () => this.controller.endEditSession());
    this.bindRangeKeyboard(this.sizeVariationInput, {
      min: 0,
      max: 100,
      baseStep: 1,
      shiftStep: 10,
      onApply: (value) => this.applySizeVariation(value)
    });

    this.bindValueInput(this.sizeOutput, this.sizeInput, {
      min: 3,
      max: 160,
      baseStep: 1,
      shiftStep: 10,
      shiftSnap: true,
      formatter: (value) => String(Math.round(value)),
      onApply: (value) => this.applySize(value)
    });

    this.bindValueInput(this.densityOutput, this.densityInput, {
      min: 20,
      max: 320,
      baseStep: 5,
      shiftStep: 10,
      shiftSnap: true,
      formatter: (value) => `${Math.round(value)}%`,
      onApply: (value) => this.applyDensity(value)
    });

    this.bindValueInput(this.sizeVariationOutput, this.sizeVariationInput, {
      min: 0,
      max: 100,
      baseStep: 1,
      shiftStep: 10,
      shiftSnap: true,
      formatter: (value) => `${Math.round(value)}%`,
      onApply: (value) => this.applySizeVariation(value)
    });

    this.densityProfileSelect.addEventListener("change", () => {
      this.controller.setDensityProfile(this.densityProfileSelect.value);
    });

    this.bindCanvasPresetDropdown();

    this.undoButton.addEventListener("click", () => {
      this.controller.undo();
    });

    this.redoButton.addEventListener("click", () => {
      this.controller.redo();
    });

    this.clearButton.addEventListener("click", () => {
      if (!this.controller.strokes.length || window.confirm("Clear all strokes?")) {
        this.controller.clear();
      }
    });

    this.exportButton.addEventListener("click", () => {
      this.controller.export({ transparent: this.transparencyToggle.checked });
    });

    this.backgroundButton.addEventListener("click", () => {
      this.backgroundInput.click();
    });

    this.backgroundInput.addEventListener("change", () => {
      this.controller.loadBackgroundFile(this.backgroundInput.files?.[0]);
      this.backgroundInput.value = "";
    });

    this.swapColorsButton?.addEventListener("click", () => this.swapColors());

    this.clearBackgroundButton.addEventListener("click", () => {
      this.controller.clearBackground();
    });

    this.backgroundFitInputs.forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) this.controller.setBackgroundFit(input.dataset.backgroundFit);
      });
    });

    this.deselectButton.addEventListener("click", () => {
      this.controller.clearSelection();
    });

    this.bindMobileControls();
    this.bindGeneratorControls();

    window.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "e") {
        event.preventDefault();
        this.controller.export({ transparent: this.transparencyToggle.checked });
        return;
      }

      if ((event.metaKey || event.ctrlKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          this.controller.redo();
        } else {
          this.controller.undo();
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        this.controller.deleteSelectedStroke();
        return;
      }

      if (event.key === "[" || event.key === "]") {
        event.preventDefault();
        const direction = event.key === "]" ? 1 : -1;
        const current = Number(this.sizeInput.value);
        const next = event.shiftKey ? snapByStep(current, direction, 10) : current + direction;
        this.applySize(next);
        return;
      }

      const toolByKey = {
        v: "select",
        b: "dotted",
        i: "ink",
        e: "eraser"
      };

      if (toolByKey[key]) {
        event.preventDefault();
        this.setActiveTool(toolByKey[key]);
      }
    });

    this.controller.addEventListener("change", (event) => {
      this.sync(event.detail);
    });
  }

  setActiveTool(tool) {
    document.querySelectorAll("[data-tool]").forEach((input) => {
      input.checked = input.dataset.tool === tool;
    });
    this.controller.setTool(tool);
  }

  bindModeTabs() {
    this.modeButtons.forEach((button) => {
      button.addEventListener("click", () => this.setMode(button.dataset.modeTab));
    });
  }

  setMode(mode) {
    if (!["pinta", "foto", "nuevo", "flor"].includes(mode)) return;
    const previousMode = this.activeMode;
    if (previousMode === "pinta" && mode !== "pinta" && this.controller.tool !== "select") {
      this.previousPintaTool = this.controller.tool;
    }
    this.activeMode = mode;
    this.modeButtons.forEach((button) => {
      const active = button.dataset.modeTab === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    if (this.toolsPanel) this.toolsPanel.hidden = mode !== "pinta";
    if (this.linePanel) this.linePanel.hidden = mode !== "pinta";
    if (this.fotoPanel) this.fotoPanel.hidden = mode !== "foto";
    if (this.nuevoPanel) this.nuevoPanel.hidden = mode !== "nuevo";
    if (this.florPanel) this.florPanel.hidden = mode !== "flor";
    if (this.backgroundPanel) this.backgroundPanel.hidden = false;

    if (mode === "pinta" && previousMode !== "pinta") {
      this.setActiveTool(this.previousPintaTool || "dotted");
    } else if (mode !== "pinta" && this.controller.tool !== "select") {
      this.setActiveTool("select");
    }
  }

  swapColors() {
    const backgroundColor = this.controller.backgroundColor;
    const brushColor = this.controller.brushColor;
    const selectedStrokeId = this.controller.selectedStrokeId;
    this.controller.selectedStrokeId = null;
    this.backgroundColorPicker.setColor(brushColor);
    this.brushColorPicker.setColor(backgroundColor);
    this.controller.selectedStrokeId = selectedStrokeId;
    this.controller.queueRender();
    this.queueActiveGeneratorRefresh();
  }

  applySize(value) {
    const next = clampNumber(value, 3, 160);
    this.sizeInput.value = next;
    this.sizeOutput.value = String(Math.round(next));
    if (this.mobileSizeInput) this.mobileSizeInput.value = next;
    this.controller.setSize(next);
  }

  applyDensity(value) {
    const next = clampNumber(value, 20, 320);
    this.densityInput.value = next;
    this.densityOutput.value = `${Math.round(next)}%`;
    this.controller.setDensity(next);
  }

  applySizeVariation(value) {
    const next = clampNumber(value, 0, 100);
    this.sizeVariationInput.value = next;
    this.sizeVariationOutput.value = `${Math.round(next)}%`;
    this.controller.setSizeVariation(next);
  }

  bindValueInput(textInput, sliderInput, options) {
    const applyValue = (rawValue) => {
      const next = clampNumber(rawValue, options.min, options.max);
      sliderInput.value = next;
      textInput.value = options.formatter(next);
      options.onApply(next);
      return next;
    };

    textInput.addEventListener("focus", () => {
      this.controller.beginEditSession();
      textInput.value = String(parseNumber(textInput.value, sliderInput.value));
      textInput.select();
    });

    textInput.addEventListener("blur", () => {
      applyValue(textInput.value);
      this.controller.endEditSession();
    });

    textInput.addEventListener("keydown", (event) => {
      const isArrow = event.key === "ArrowUp" || event.key === "ArrowDown";
      if (isArrow) {
        event.preventDefault();
        const direction = event.key === "ArrowUp" ? 1 : -1;
        const current = parseNumber(textInput.value, sliderInput.value);
        const next = event.shiftKey && options.shiftSnap
          ? snapByStep(current, direction, options.shiftStep)
          : current + (direction * (event.shiftKey ? options.shiftStep : options.baseStep));
        applyValue(next);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        textInput.blur();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        textInput.value = options.formatter(Number(sliderInput.value));
        this.controller.endEditSession();
        textInput.blur();
      }
    });
  }

  bindRangeKeyboard(sliderInput, options) {
    sliderInput.addEventListener("keydown", (event) => {
      const directionByKey = {
        ArrowUp: 1,
        ArrowRight: 1,
        ArrowDown: -1,
        ArrowLeft: -1
      };

      const direction = directionByKey[event.key];
      if (!direction) return;

      event.preventDefault();
      this.controller.beginEditSession();
      const current = parseNumber(sliderInput.value, options.min);
      const next = event.shiftKey
        ? snapByStep(current, direction, options.shiftStep)
        : current + (direction * options.baseStep);
      options.onApply(clampNumber(next, options.min, options.max));
      this.controller.endEditSession();
    });
  }

  bindMobileControls() {
    this.mobileUndoButton?.addEventListener("click", () => this.controller.undo());
    this.mobileRedoButton?.addEventListener("click", () => this.controller.redo());
    this.mobilePhotoButton?.addEventListener("click", () => this.backgroundInput.click());

    this.mobileBrushButton?.addEventListener("click", () => {
      this.closeMobileExportSheet();
      this.mobileBrushPopover.hidden = !this.mobileBrushPopover.hidden;
    });

    this.mobileSizeInput?.addEventListener("input", () => {
      this.applySize(this.mobileSizeInput.value);
    });

    this.mobileExportButton?.addEventListener("click", () => {
      this.mobileBrushPopover.hidden = true;
      this.mobileExportSheet.hidden = !this.mobileExportSheet.hidden;
    });

    this.mobileExportCanvasButton?.addEventListener("click", () => {
      this.closeMobileExportSheet();
      this.controller.export({ transparent: false });
    });

    this.mobileExportTransparentButton?.addEventListener("click", () => {
      this.closeMobileExportSheet();
      this.controller.export({ transparent: true });
    });

    this.mobileCopyTransparentButton?.addEventListener("click", async () => {
      this.closeMobileExportSheet();
      try {
        await this.controller.copyTransparent();
      } catch {
        this.controller.export({ transparent: true });
      }
    });

    document.addEventListener("pointerdown", (event) => {
      if (!document.documentElement.classList.contains("is-etica-mobile")) return;
      const target = event.target;
      if (this.mobileBrushPopover && !this.mobileBrushPopover.hidden) {
        const insideBrush = this.mobileBrushPopover.contains(target) || this.mobileBrushButton?.contains(target);
        if (!insideBrush) this.mobileBrushPopover.hidden = true;
      }
      if (this.mobileExportSheet && !this.mobileExportSheet.hidden) {
        const insideExport = this.mobileExportSheet.contains(target) || this.mobileExportButton?.contains(target);
        if (!insideExport) this.mobileExportSheet.hidden = true;
      }
    });
  }

  bindGeneratorControls() {
    this.bindGeneratorValueMirrors();

    document.querySelectorAll("[data-generator-input]").forEach((input) => {
      input.addEventListener("input", () => {
        this.updateGeneratorValue(input);
        this.queueGeneratorRefresh(input.dataset.generatorInput);
      });
      input.addEventListener("change", () => {
        this.updateGeneratorValue(input);
        this.queueGeneratorRefresh(input.dataset.generatorInput);
      });

      if (input.type === "range") {
        const step = Math.max(1, Number(input.step) || 1);
        this.bindRangeKeyboard(input, {
          min: Number(input.min) || 0,
          max: Number(input.max) || 100,
          baseStep: step,
          shiftStep: step * 10,
          onApply: (value) => this.applyGeneratorRange(input, value)
        });
      }
    });

    this.fotoFitInputs.forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) this.queueGeneratorRefresh("foto");
      });
    });

    this.nuevoFitInputs.forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) this.queueGeneratorRefresh("nuevo");
      });
    });

    this.fotoUploadButton?.addEventListener("click", () => this.fotoInput?.click());
    this.fotoInput?.addEventListener("change", () => {
      this.loadPhotoFile(this.fotoInput.files?.[0], "foto");
      this.fotoInput.value = "";
    });
    this.nuevoUploadButton?.addEventListener("click", () => this.nuevoInput?.click());
    this.nuevoInput?.addEventListener("change", () => {
      this.loadPhotoFile(this.nuevoInput.files?.[0], "nuevo");
      this.nuevoInput.value = "";
    });
    this.fotoSeedInput?.addEventListener("change", () => {
      this.fotoSeedInput.value = String(sanitizeSeed(this.fotoSeedInput.value, 2401));
      this.regenerateFoto({ commitHistory: true });
    });
    this.nuevoSeedInput?.addEventListener("change", () => {
      this.nuevoSeedInput.value = String(sanitizeSeed(this.nuevoSeedInput.value, 3101));
      this.regenerateNuevo({ commitHistory: true });
    });
    this.florSeedInput?.addEventListener("change", () => {
      this.florSeedInput.value = String(sanitizeSeed(this.florSeedInput.value, 1207));
      this.regenerateFlor({ commitHistory: true });
    });

    this.fotoRegenerateButton?.addEventListener("click", () => {
      this.fotoSeedInput.value = String(randomUiSeed());
      this.regenerateFoto({ commitHistory: true });
    });

    this.nuevoRegenerateButton?.addEventListener("click", () => {
      this.nuevoSeedInput.value = String(randomUiSeed());
      this.regenerateNuevo({ commitHistory: true });
    });

    this.florRegenerateButton?.addEventListener("click", () => {
      this.florSeedInput.value = String(randomUiSeed());
      this.regenerateFlor({ commitHistory: true });
    });
  }

  bindGeneratorValueMirrors() {
    document.querySelectorAll("[data-generator-input]").forEach((input) => this.updateGeneratorValue(input));
  }

  updateGeneratorValue(input) {
    if (!input || input.type !== "range") return;
    const value = document.getElementById(`${input.id.replace(/Input$/, "")}Value`);
    if (value) value.textContent = input.dataset.generatorUnit === "%" ? `${input.value}%` : input.value;
  }

  applyGeneratorRange(input, value) {
    const next = clampNumber(value, Number(input.min) || 0, Number(input.max) || 100);
    input.value = next;
    this.updateGeneratorValue(input);
    this.queueGeneratorRefresh(input.dataset.generatorInput);
  }

  loadPhotoFile(file, targetMode = "foto") {
    if (!file) return;
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      if (this.photoObjectUrl) URL.revokeObjectURL(this.photoObjectUrl);
      this.photoObjectUrl = objectUrl;
      this.photoImage = image;
      if (this.fotoMeta) this.fotoMeta.textContent = file.name;
      if (this.nuevoMeta) this.nuevoMeta.textContent = file.name;
      if (this.fotoRegenerateButton) this.fotoRegenerateButton.disabled = false;
      if (this.nuevoRegenerateButton) this.nuevoRegenerateButton.disabled = false;
      if (targetMode === "nuevo") {
        this.regenerateNuevo({ commitHistory: true });
      } else {
        this.regenerateFoto({ commitHistory: true });
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      if (this.fotoMeta) this.fotoMeta.textContent = "Failed";
      if (this.nuevoMeta) this.nuevoMeta.textContent = "Failed";
    };
    image.src = objectUrl;
  }

  queueActiveGeneratorRefresh() {
    if (this.activeMode === "foto" || this.activeMode === "nuevo" || this.activeMode === "flor") {
      this.queueGeneratorRefresh(this.activeMode);
    }
  }

  queueGeneratorRefresh(mode) {
    if (mode !== "foto" && mode !== "nuevo" && mode !== "flor") return;
    if ((mode === "foto" || mode === "nuevo") && !this.photoImage) return;
    window.clearTimeout(this.generatorRefreshTimer);
    this.generatorRefreshTimer = window.setTimeout(() => {
      if (mode === "foto") this.regenerateFoto({ commitHistory: false });
      if (mode === "nuevo") this.regenerateNuevo({ commitHistory: false });
      if (mode === "flor") this.regenerateFlor({ commitHistory: false });
    }, 120);
  }

  regenerateFoto({ commitHistory = false } = {}) {
    if (!this.photoImage) return;
    const strokes = this.photoGenerator.generate({
      image: this.photoImage,
      width: this.controller.canvas.width,
      height: this.controller.canvas.height,
      color: this.controller.brushColor,
      settings: this.getFotoSettings()
    });
    this.commitGeneratedStrokes("foto", strokes, { commitHistory });
  }

  regenerateNuevo({ commitHistory = false } = {}) {
    if (!this.photoImage) return;
    const strokes = this.nuevoGenerator.generate({
      image: this.photoImage,
      width: this.controller.canvas.width,
      height: this.controller.canvas.height,
      color: this.controller.brushColor,
      settings: this.getNuevoSettings()
    });
    this.commitGeneratedStrokes("nuevo", strokes, { commitHistory });
  }

  regenerateFlor({ commitHistory = false } = {}) {
    const strokes = this.plantGenerator.generate({
      width: this.controller.canvas.width,
      height: this.controller.canvas.height,
      color: this.controller.brushColor,
      settings: this.getFlorSettings()
    });
    this.commitGeneratedStrokes("flor", strokes, { commitHistory });
  }

  commitGeneratedStrokes(mode, strokes, { commitHistory = false } = {}) {
    if (!strokes.length) return;
    const hasExistingGroup = Boolean(this.generatedGroupIds[mode]);
    this.generatedGroupIds[mode] = this.controller.replaceGeneratedGroup(this.generatedGroupIds[mode], strokes, {
      selectGroup: false,
      commitHistory: commitHistory || !hasExistingGroup
    });
  }

  getFotoSettings() {
    return {
      fit: document.querySelector("[data-foto-fit]:checked")?.dataset.fotoFit || "fill",
      recognition: valueOf("fotoRecognitionInput", 70),
      abstraction: valueOf("fotoAbstractionInput", 34),
      detail: valueOf("fotoDetailInput", 52),
      mass: valueOf("fotoMassInput", 56),
      contour: valueOf("fotoContourInput", 48),
      density: valueOf("fotoDensityInput", 56),
      dotSize: valueOf("fotoDotSizeInput", 14),
      sizeVariation: valueOf("fotoSizeVariationInput", 0),
      jitter: valueOf("fotoJitterInput", 44),
      maxPoints: valueOf("fotoMaxPointsInput", 2500),
      seed: sanitizeSeed(this.fotoSeedInput?.value, 2401)
    };
  }

  getNuevoSettings() {
    return {
      fit: document.querySelector("[data-nuevo-fit]:checked")?.dataset.nuevoFit || "fill",
      lineStrength: valueOf("nuevoLineStrengthInput", 74),
      massOutline: valueOf("nuevoMassOutlineInput", 68),
      interiorDetail: valueOf("nuevoInteriorDetailInput", 42),
      fill: valueOf("nuevoFillInput", 24),
      simplify: valueOf("nuevoSimplifyInput", 34),
      spacing: valueOf("nuevoSpacingInput", 16),
      dotSize: valueOf("nuevoDotSizeInput", 18),
      sizeVariation: valueOf("nuevoSizeVariationInput", 0),
      jitter: valueOf("nuevoJitterInput", 18),
      maxPoints: valueOf("nuevoMaxPointsInput", 1400),
      seed: sanitizeSeed(this.nuevoSeedInput?.value, 3101)
    };
  }

  getFlorSettings() {
    return {
      type: this.florTypeSelect?.value || "single",
      scale: valueOf("florScaleInput", 70),
      complexity: valueOf("florComplexityInput", 65),
      bend: valueOf("florBendInput", 50),
      openness: valueOf("florOpennessInput", 64),
      recognition: valueOf("florRecognitionInput", 72),
      abstraction: valueOf("florAbstractionInput", 28),
      density: valueOf("florDensityInput", 70),
      mass: valueOf("florMassInput", 50),
      dotSize: valueOf("florDotSizeInput", 22),
      sizeVariation: valueOf("florSizeVariationInput", 0),
      jitter: valueOf("florJitterInput", 46),
      maxPoints: valueOf("florMaxPointsInput", 1200),
      seed: sanitizeSeed(this.florSeedInput?.value, 1207)
    };
  }

  closeMobileExportSheet() {
    if (this.mobileExportSheet) this.mobileExportSheet.hidden = true;
  }

  bindCanvasPresetDropdown() {
    this.canvasPresetToggle?.addEventListener("click", () => {
      const isOpen = this.canvasPresetMenu.classList.toggle("active");
      this.canvasPresetToggle.setAttribute("aria-expanded", String(isOpen));
    });

    this.canvasPresetItems.forEach((item) => {
      item.addEventListener("click", () => {
        this.applyCanvasPreset(item.dataset.canvasPreset);
        this.closeCanvasPresetDropdown();
      });
    });

    document.addEventListener("pointerdown", (event) => {
      const dropdown = document.getElementById("canvasPresetDropdown");
      if (!dropdown || dropdown.contains(event.target)) return;
      this.closeCanvasPresetDropdown();
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.closeCanvasPresetDropdown();
    });
  }

  applyCanvasPreset(value) {
    if (!value) return;
    const [width, height] = value.split("x").map(Number);
    this.setCanvasPresetLabel(value);
    this.controller.resize(width, height);
  }

  closeCanvasPresetDropdown() {
    this.canvasPresetMenu?.classList.remove("active");
    this.canvasPresetToggle?.setAttribute("aria-expanded", "false");
  }

  sync(detail) {
    this.lastDetail = detail;
    this.undoButton.disabled = !detail.canUndo;
    this.redoButton.disabled = !detail.canRedo;
    if (this.mobileUndoButton) this.mobileUndoButton.disabled = !detail.canUndo;
    if (this.mobileRedoButton) this.mobileRedoButton.disabled = !detail.canRedo;
    this.deselectButton.disabled = !detail.selectedStrokeId;
    this.clearBackgroundButton.disabled = !detail.backgroundName;
    this.selectionMeta.textContent = detail.selectedStrokeId
      ? `${detail.selectedStrokeIndex}/${detail.selectedStrokeTotal}`
      : `0/${detail.selectedStrokeTotal}`;
    this.backgroundMeta.textContent = detail.backgroundName || "None";

    this.setCanvasPresetLabel(`${detail.width}x${detail.height}`);

    if (!isActivelyEditing(this.sizeInput, this.sizeOutput)) {
      this.sizeInput.value = Math.round(detail.activeSize);
      this.sizeOutput.value = String(Math.round(detail.activeSize));
      if (this.mobileSizeInput) this.mobileSizeInput.value = Math.round(detail.activeSize);
    }

    if (!isActivelyEditing(this.densityInput, this.densityOutput)) {
      const densityPercent = Math.round(detail.activeDensity * 100);
      this.densityInput.value = densityPercent;
      this.densityOutput.value = `${densityPercent}%`;
    }

    if (!isActivelyEditing(this.sizeVariationInput, this.sizeVariationOutput)) {
      const variationPercent = Math.round(detail.activeSizeVariation * 100);
      this.sizeVariationInput.value = variationPercent;
      this.sizeVariationOutput.value = `${variationPercent}%`;
    }

    if (document.activeElement !== this.densityProfileSelect) {
      this.densityProfileSelect.value = detail.activeDensityProfile || "flat";
    }
  }

  setCanvasPresetLabel(value) {
    const selectedItem = Array.from(this.canvasPresetItems).find((item) => item.dataset.canvasPreset === value);
    if (!selectedItem) return;

    this.canvasPresetItems.forEach((item) => {
      const isSelected = item === selectedItem;
      item.classList.toggle("selected", isSelected);
      item.setAttribute("aria-selected", String(isSelected));
    });
    if (this.canvasPresetText) this.canvasPresetText.textContent = selectedItem.textContent;
  }
}

function isActivelyEditing(slider, textInput) {
  return document.activeElement === slider || document.activeElement === textInput;
}

function parseNumber(value, fallback) {
  const numeric = Number.parseFloat(String(value).replace(",", ".").replace(/[^\d.-]/g, ""));
  if (Number.isFinite(numeric)) return numeric;
  return Number(fallback);
}

function clampNumber(value, min, max) {
  const numeric = parseNumber(value, min);
  return Math.min(max, Math.max(min, numeric));
}

function snapByStep(value, direction, step) {
  return direction > 0
    ? Math.ceil((value + 1) / step) * step
    : Math.floor((value - 1) / step) * step;
}

function valueOf(id, fallback) {
  const element = document.getElementById(id);
  if (!element) return fallback;
  const numeric = Number.parseFloat(String(element.value).replace(",", "."));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sanitizeSeed(value, fallback) {
  const numeric = Math.round(Number.parseFloat(String(value).replace(",", ".").replace(/[^\d.-]/g, "")));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(999999, Math.max(1, numeric));
}

function randomUiSeed() {
  return Math.floor(1 + Math.random() * 999999);
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}
