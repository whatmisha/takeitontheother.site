import { BackgroundColorPicker } from "./BackgroundColorPicker.js";
import { DoodleFlorGenerator } from "../generators/DoodleFlorGenerator.js";
import { NuevoGenerator } from "../generators/NuevoGenerator.js";
import { PhotoGenerator } from "../generators/PhotoGenerator.js";
import { PlantGenerator } from "../generators/PlantGenerator.js";
import { createSvgLineStrokes } from "../importers/SvgLineImporter.js";

export class Toolbar {
  constructor(controller) {
    this.controller = controller;
    this.activeMode = "pinta";
    this.previousPintaTool = "dotted";
    this.activeBrushTool = "dotted";
    this.modeButtons = document.querySelectorAll("[data-mode-tab]");
    this.toolsPanel = document.getElementById("toolsPanel");
    this.linePanel = document.getElementById("linePanel");
    this.effectsPanel = document.getElementById("effectsPanel");
    this.backgroundPanel = document.getElementById("backgroundPanel");
    this.fotoPanel = document.getElementById("fotoPanel");
    this.nuevoPanel = document.getElementById("nuevoPanel");
    this.florPanel = document.getElementById("florPanel");
    this.doodleFlorPanel = document.getElementById("doodleFlorPanel");
    this.sizeInput = document.getElementById("sizeInput");
    this.sizeOutput = document.getElementById("sizeOutput");
    this.sizeVariationInput = document.getElementById("sizeVariationInput");
    this.sizeVariationOutput = document.getElementById("sizeVariationOutput");
    this.densityInput = document.getElementById("densityInput");
    this.densityOutput = document.getElementById("densityOutput");
    this.densityProfileSelect = document.getElementById("densityProfileSelect");
    this.svgLineInput = document.getElementById("svgLineInput");
    this.svgLineUploadButton = document.getElementById("svgLineUploadButton");
    this.svgLineReapplyButton = document.getElementById("svgLineReapplyButton");
    this.svgLineMeta = document.getElementById("svgLineMeta");
    this.canvasPresetToggle = document.getElementById("canvasPresetToggle");
    this.canvasPresetText = document.getElementById("canvasPresetText");
    this.canvasPresetMenu = document.getElementById("canvasPresetMenu");
    this.canvasPresetItems = document.querySelectorAll("[data-canvas-preset]");
    this.undoButton = document.getElementById("undoButton");
    this.redoButton = document.getElementById("redoButton");
    this.clearButton = document.getElementById("clearButton");
    this.exportButton = document.getElementById("exportButton");
    this.jsonExportButton = document.getElementById("jsonExportButton");
    this.transparencyToggle = document.getElementById("transparencyToggle");
    this.gifToggle = document.getElementById("gifToggle");
    this.backgroundInput = document.getElementById("backgroundInput");
    this.backgroundButton = document.getElementById("backgroundButton");
    this.swapColorsButton = document.getElementById("swapColorsButton");
    this.clearBackgroundButton = document.getElementById("clearBackgroundButton");
    this.backgroundFitInputs = document.querySelectorAll("[data-background-fit]");
    this.backgroundMeta = document.getElementById("backgroundMeta");
    this.deselectButton = document.getElementById("deselectButton");
    this.selectionMeta = document.getElementById("selectionMeta");
    this.mobileSizeInput = document.getElementById("mobileSizeInput");
    this.mobileContrastButton = document.getElementById("mobileContrastButton");
    this.mobileBrushButton = document.getElementById("mobileBrushButton");
    this.mobileBrushPopover = document.getElementById("mobileBrushPopover");
    this.mobilePhotoButton = document.getElementById("mobilePhotoButton");
    this.mobilePlayButton = document.getElementById("mobilePlayButton");
    this.mobileExportButton = document.getElementById("mobileExportButton");
    this.mobileExportSheet = document.getElementById("mobileExportSheet");
    this.mobileUndoButton = document.getElementById("mobileUndoButton");
    this.mobileRedoButton = document.getElementById("mobileRedoButton");
    this.mobilePhotoExportToggle = document.getElementById("mobilePhotoExportToggle");
    this.mobileTransparencyToggle = document.getElementById("mobileTransparencyToggle");
    this.mobileExportActionButton = document.getElementById("mobileExportActionButton");
    this.mobileGifToggle = document.getElementById("mobileGifToggle");
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
    this.doodleFlorRegenerateButton = document.getElementById("doodleFlorRegenerateButton");
    this.doodleFlorSeedInput = document.getElementById("doodleFlorSeedInput");
    this.doodleFlorShapeSelect = document.getElementById("doodleFlorShapeSelect");
    this.windEnabledCheckbox = document.getElementById("windEnabledCheckbox");
    this.windSectionContent = document.getElementById("windSectionContent");
    this.windDirectionInput = document.getElementById("windDirectionInput");
    this.windStrengthInput = document.getElementById("windStrengthInput");
    this.windTrailInput = document.getElementById("windTrailInput");
    this.windDestructionInput = document.getElementById("windDestructionInput");
    this.windUniformityInput = document.getElementById("windUniformityInput");
    this.boilEnabledCheckbox = document.getElementById("boilEnabledCheckbox");
    this.boilSectionContent = document.getElementById("boilSectionContent");
    this.boilAmountInput = document.getElementById("boilAmountInput");
    this.boilFramesInput = document.getElementById("boilFramesInput");
    this.boilFpsInput = document.getElementById("boilFpsInput");
    this.boilPreviewButton = document.getElementById("boilPreviewButton");
    this.lastDetail = null;
    this.nuevoGenerator = new NuevoGenerator();
    this.photoGenerator = new PhotoGenerator();
    this.plantGenerator = new PlantGenerator();
    this.doodleFlorGenerator = new DoodleFlorGenerator();
    this.photoImage = null;
    this.photoObjectUrl = null;
    this.generatedGroupIds = {
      foto: null,
      nuevo: null,
      flor: null,
      doodleFlor: null
    };
    this.svgLineSource = null;
    this.svgLineName = "";
    this.svgLineGroupId = null;
    this.generatorRefreshTimer = null;
    this.svgLineRefreshTimer = null;
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
    this.applyParameterTooltips();
    this.backgroundColorPicker.init();
    this.brushColorPicker.init();
    if (document.documentElement.classList.contains("is-etica-mobile") && this.mobileSizeInput) {
      this.applySize(this.mobileSizeInput.value);
    }
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
      baseStep: 1,
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
      baseStep: 1,
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
      this.queueSvgLineRefresh();
    });

    this.svgLineUploadButton?.addEventListener("click", () => this.svgLineInput?.click());
    this.svgLineInput?.addEventListener("change", () => {
      this.loadSvgLineFile(this.svgLineInput.files?.[0]);
      this.svgLineInput.value = "";
    });
    this.svgLineReapplyButton?.addEventListener("click", () => {
      this.regenerateSvgLines({ commitHistory: true });
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
      this.exportCurrentFormat();
    });

    this.jsonExportButton?.addEventListener("click", () => {
      this.controller.exportJson();
    });

    this.gifToggle?.addEventListener("change", () => {
      if (this.mobileGifToggle) this.mobileGifToggle.checked = this.gifToggle.checked;
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
    this.bindEffectControls();

    window.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const code = event.code;
      if ((event.metaKey || event.ctrlKey) && code === "KeyE") {
        event.preventDefault();
        if (event.shiftKey) {
          this.exportTransparentGif();
        } else {
          this.exportCurrentFormat();
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && code === "KeyZ") {
        event.preventDefault();
        if (event.shiftKey) {
          this.controller.redo();
        } else {
          this.controller.undo();
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (code === "KeyJ") {
        event.preventDefault();
        this.toggleJsonExportButton();
        return;
      }

      if (code === "Space") {
        event.preventDefault();
        this.toggleBoilPreview();
        return;
      }

      if (code === "Delete" || code === "Backspace") {
        event.preventDefault();
        this.controller.deleteSelectedStroke();
        return;
      }

      if (code === "BracketLeft" || code === "BracketRight") {
        event.preventDefault();
        const direction = code === "BracketRight" ? 1 : -1;
        const current = Number(this.sizeInput.value);
        const next = event.shiftKey ? snapByStep(current, direction, 10) : current + direction;
        this.applySize(next);
        return;
      }

      const toolByCode = {
        KeyV: "select",
        KeyB: "dotted",
        KeyI: "ink",
        KeyE: "eraser"
      };

      if (toolByCode[code]) {
        event.preventDefault();
        this.setActiveTool(toolByCode[code]);
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
    if (tool === "dotted" || tool === "ink") this.activeBrushTool = tool;
    this.controller.setTool(tool);
    this.queueSvgLineRefresh();
  }

  applyParameterTooltips() {
    const tooltips = {
      toolDotted: "Draws with separate dots.",
      toolInk: "Draws denser ink-like marks.",
      toolEraser: "Removes existing strokes.",
      toolSelect: "Select and move strokes.",
      sizeInput: "Base dot or brush size.",
      densityInput: "Dot density along a stroke.",
      sizeVariationInput: "Maximum random dot size difference.",
      densityProfileSelect: "How density changes along a stroke.",
      fotoRecognitionInput: "How closely the result follows the photo.",
      fotoAbstractionInput: "Simplifies the photo and removes details.",
      fotoDetailInput: "Amount of small photo detail.",
      fotoMassInput: "How strongly dark masses are filled.",
      fotoContourInput: "How strongly contours are detected.",
      fotoDensityInput: "Overall amount of generated dots.",
      fotoDotSizeInput: "Base dot size.",
      fotoSizeVariationInput: "Maximum random dot size difference.",
      fotoJitterInput: "Random dot offset from source positions.",
      fotoMaxPointsInput: "Hard maximum number of generated dots.",
      fotoSeedInput: "Locks the random generation variant.",
      nuevoLineStrengthInput: "Strength of contrast and color line detection.",
      nuevoMassOutlineInput: "Outlines the borders of large masses.",
      nuevoInteriorDetailInput: "Amount of inner lines and texture.",
      nuevoFillInput: "Sparse fill inside dark masses.",
      nuevoSimplifyInput: "Simplifies the photo before line detection.",
      nuevoSpacingInput: "Distance between dots on detected lines.",
      nuevoDotSizeInput: "Base dot size.",
      nuevoSizeVariationInput: "Maximum random dot size difference.",
      nuevoJitterInput: "Organic offset from the detected line.",
      nuevoMaxPointsInput: "Hard maximum number of generated dots.",
      nuevoSeedInput: "Locks the random generation variant.",
      florTypeSelect: "Type of plant structure.",
      florScaleInput: "Overall plant size.",
      florComplexityInput: "Amount of branches, leaves, and detail.",
      florBendInput: "Stem curvature.",
      florOpennessInput: "Width and openness of the shape.",
      florRecognitionInput: "How recognizable the plant remains.",
      florAbstractionInput: "Simplifies the plant and removes detail.",
      florDensityInput: "Overall amount of generated dots.",
      florMassInput: "How often dots gather into dense masses.",
      florDotSizeInput: "Base dot size.",
      florSizeVariationInput: "Maximum random dot size difference.",
      florJitterInput: "Random dot offset from the plant form.",
      florMaxPointsInput: "Hard maximum number of generated dots.",
      florSeedInput: "Locks the random generation variant.",
      doodleFlorShapeSelect: "Simple doodle flower silhouette.",
      doodleFlorScaleInput: "Overall single flower size.",
      doodleFlorPetalsInput: "Number of looped petals or lobes.",
      doodleFlorOpennessInput: "How far the petals open from the center.",
      doodleFlorWobbleInput: "Hand-drawn asymmetry in the outline.",
      doodleFlorScribbleInput: "Extra center fill and interior doodle lines.",
      doodleFlorStemInput: "Length and presence of the stem.",
      doodleFlorLeavesInput: "Amount of simple leaf loops.",
      doodleFlorDensityInput: "How tightly dots form each line.",
      doodleFlorDotSizeInput: "Base dot size.",
      doodleFlorSizeVariationInput: "Maximum random dot size difference.",
      doodleFlorJitterInput: "Organic offset from the doodle line.",
      doodleFlorMaxStrokesInput: "Hard maximum number of generated line strokes.",
      doodleFlorSeedInput: "Locks the random generation variant.",
      windDirectionInput: "Direction the dots are blown, in degrees.",
      windStrengthInput: "Overall force of the wind displacement.",
      windTrailInput: "Maximum length of the blown dot trail.",
      windDestructionInput: "How much of the original shape breaks apart.",
      windUniformityInput: "Flag-like falloff at low values, sand-like spread at high values.",
      boilAmountInput: "How much the dots jitter between GIF frames.",
      boilFramesInput: "Number of frames in the transparent GIF loop.",
      boilFpsInput: "Playback speed for the GIF loop."
    };

    for (const [controlId, tooltip] of Object.entries(tooltips)) {
      const label = document.querySelector(`label[for="${controlId}"]`);
      if (!label) continue;
      const textNode = label.querySelector("span:first-child") || label;
      textNode.title = tooltip;
    }

    const fitTooltips = [
      ["fotoFitMode", "Fit the entire photo inside the canvas."],
      ["fotoFillMode", "Fill the canvas and crop the photo."],
      ["nuevoFitMode", "Fit the entire photo inside the canvas."],
      ["nuevoFillMode", "Fill the canvas and crop the photo."]
    ];
    for (const [controlId, tooltip] of fitTooltips) {
      const label = document.querySelector(`label[for="${controlId}"]`);
      if (label) label.title = tooltip;
    }
  }

  bindModeTabs() {
    this.modeButtons.forEach((button) => {
      button.addEventListener("click", () => this.setMode(button.dataset.modeTab));
    });
  }

  setMode(mode) {
    if (!["pinta", "foto", "nuevo", "flor", "doodleFlor"].includes(mode)) return;
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
    if (this.effectsPanel) this.effectsPanel.hidden = mode !== "pinta";
    if (this.fotoPanel) this.fotoPanel.hidden = mode !== "foto";
    if (this.nuevoPanel) this.nuevoPanel.hidden = mode !== "nuevo";
    if (this.florPanel) this.florPanel.hidden = mode !== "flor";
    if (this.doodleFlorPanel) this.doodleFlorPanel.hidden = mode !== "doodleFlor";
    if (this.backgroundPanel) this.backgroundPanel.hidden = false;
    this.controller.setEffectsEnabled(mode === "pinta");

    if (mode === "pinta" && previousMode !== "pinta") {
      this.setActiveTool(this.previousPintaTool || "dotted");
    } else if (mode !== "pinta" && this.controller.tool !== "select") {
      this.setActiveTool("select");
    }

    if (mode === "doodleFlor" && !this.hasGeneratedGroup("doodleFlor")) {
      this.regenerateDoodleFlor({ commitHistory: true });
    }
  }

  swapColors() {
    this.controller.swapBackgroundAndBrushColors();
    this.backgroundColorPicker.syncColor(this.controller.backgroundColor);
    this.brushColorPicker.syncColor(this.controller.brushColor);
    this.queueActiveGeneratorRefresh();
  }

  applyMobileContrastColors() {
    this.controller.setBackgroundColor("#111111");
    this.controller.setBrushColor("#ffffff");
    this.backgroundColorPicker.syncColor(this.controller.backgroundColor);
    this.brushColorPicker.syncColor(this.controller.brushColor);
    this.queueActiveGeneratorRefresh();
  }

  applySize(value) {
    const next = clampNumber(value, 3, 160);
    this.sizeInput.value = next;
    this.sizeOutput.value = String(Math.round(next));
    if (this.mobileSizeInput) this.mobileSizeInput.value = next;
    this.controller.setSize(next);
    this.queueSvgLineRefresh();
  }

  applyDensity(value) {
    const next = clampNumber(value, 20, 320);
    this.densityInput.value = next;
    this.densityOutput.value = `${Math.round(next)}%`;
    this.controller.setDensity(next);
    this.queueSvgLineRefresh();
  }

  applySizeVariation(value) {
    const next = clampNumber(value, 0, 100);
    this.sizeVariationInput.value = next;
    this.sizeVariationOutput.value = `${Math.round(next)}%`;
    this.controller.setSizeVariation(next);
    this.queueSvgLineRefresh();
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
      if (options.editSession !== false) this.controller.beginEditSession();
      textInput.value = String(parseNumber(textInput.value, sliderInput.value));
      textInput.select();
    });

    textInput.addEventListener("blur", () => {
      applyValue(textInput.value);
      if (options.editSession !== false) this.controller.endEditSession();
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
        if (options.editSession !== false) this.controller.endEditSession();
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
      if (options.editSession !== false) this.controller.beginEditSession();
      const current = parseNumber(sliderInput.value, options.min);
      const next = event.shiftKey
        ? snapByStep(current, direction, options.shiftStep)
        : current + (direction * options.baseStep);
      options.onApply(clampNumber(next, options.min, options.max));
      if (options.editSession !== false) this.controller.endEditSession();
    });
  }

  bindMobileControls() {
    this.mobileUndoButton?.addEventListener("click", () => this.controller.undo());
    this.mobileRedoButton?.addEventListener("click", () => this.controller.redo());
    this.mobilePhotoButton?.addEventListener("click", () => this.backgroundInput.click());
    this.mobilePlayButton?.addEventListener("click", () => this.toggleBoilPreview());
    this.mobileContrastButton?.addEventListener("click", () => {
      this.closeMobileExportSheet();
      if (this.mobileBrushPopover) this.mobileBrushPopover.hidden = true;
      this.applyMobileContrastColors();
    });

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

    this.mobilePhotoExportToggle?.addEventListener("change", () => {
      if (this.mobilePhotoExportToggle.checked && this.mobileTransparencyToggle) {
        this.mobileTransparencyToggle.checked = false;
      }
    });

    this.mobileTransparencyToggle?.addEventListener("change", () => {
      if (this.mobileTransparencyToggle.checked && this.mobilePhotoExportToggle) {
        this.mobilePhotoExportToggle.checked = false;
      }
    });

    this.mobileGifToggle?.addEventListener("change", () => {
      if (this.gifToggle) this.gifToggle.checked = this.mobileGifToggle.checked;
    });

    this.mobileExportActionButton?.addEventListener("click", () => {
      this.closeMobileExportSheet();
      if (this.mobileGifToggle?.checked) {
        this.exportTransparentGif();
        return;
      }
      const includePhoto = this.mobilePhotoExportToggle?.checked ?? false;
      const transparent = includePhoto ? false : (this.mobileTransparencyToggle?.checked ?? true);
      this.controller.export({ transparent });
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
    this.hydrateGeneratorValueInputs();
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
        const valueInput = document.getElementById(`${input.id.replace(/Input$/, "")}Value`);
        this.bindRangeKeyboard(input, {
          min: Number(input.min) || 0,
          max: Number(input.max) || 100,
          baseStep: step,
          shiftStep: step * 10,
          onApply: (value) => this.applyGeneratorRange(input, value)
        });
        if (valueInput instanceof HTMLInputElement) {
          this.bindValueInput(valueInput, input, {
            min: Number(input.min) || 0,
            max: Number(input.max) || 100,
            baseStep: step,
            shiftStep: step * 10,
            shiftSnap: true,
            formatter: (value) => formatGeneratorValue(input, value),
            onApply: (value) => this.applyGeneratorRange(input, value)
          });
        }
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
    this.doodleFlorSeedInput?.addEventListener("change", () => {
      this.doodleFlorSeedInput.value = String(sanitizeSeed(this.doodleFlorSeedInput.value, 2207));
      this.regenerateDoodleFlor({ commitHistory: true });
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

    this.doodleFlorRegenerateButton?.addEventListener("click", () => {
      this.doodleFlorSeedInput.value = String(randomUiSeed());
      this.regenerateDoodleFlor({ commitHistory: true });
    });
  }

  bindEffectControls() {
    this.bindEffectSection(this.windEnabledCheckbox, this.windSectionContent, () => this.applyWindEffect());
    this.bindEffectSection(this.boilEnabledCheckbox, this.boilSectionContent, () => this.applyBoilSettings());
    this.boilPreviewButton?.addEventListener("click", () => this.toggleBoilPreview());
    this.controller.addEventListener("boilpreviewchange", (event) => {
      this.boilPreviewButton?.classList.toggle("active", Boolean(event.detail.active));
      this.boilPreviewButton?.setAttribute("aria-pressed", String(Boolean(event.detail.active)));
      this.mobilePlayButton?.classList.toggle("active", Boolean(event.detail.active));
      this.mobilePlayButton?.setAttribute("aria-pressed", String(Boolean(event.detail.active)));
    });

    document.querySelectorAll("[data-effect-input]").forEach((input) => {
      this.updateEffectValue(input);
      input.addEventListener("input", () => this.applyEffectRange(input, input.value));
      input.addEventListener("change", () => this.applyEffectRange(input, input.value));

      if (input.type === "range") {
        const step = Math.max(1, Number(input.step) || 1);
        const valueInput = document.getElementById(`${input.id.replace(/Input$/, "")}Value`);
        this.bindRangeKeyboard(input, {
          min: Number(input.min) || 0,
          max: Number(input.max) || 100,
          baseStep: step,
          shiftStep: step * 10,
          editSession: false,
          onApply: (value) => this.applyEffectRange(input, value)
        });
        if (valueInput instanceof HTMLInputElement) {
          this.bindValueInput(valueInput, input, {
            min: Number(input.min) || 0,
            max: Number(input.max) || 100,
            baseStep: step,
            shiftStep: step * 10,
            shiftSnap: true,
            editSession: false,
            formatter: (value) => formatEffectValue(input, value),
            onApply: (value) => this.applyEffectRange(input, value)
          });
        }
      }
    });

    this.applyWindEffect();
    this.applyBoilSettings();
  }

  bindEffectSection(toggle, content, onToggle) {
    if (!toggle || !content) return;
    const sync = () => {
      content.classList.toggle("controls-disabled", !toggle.checked);
      if (onToggle) onToggle();
    };
    toggle.addEventListener("change", sync);
    sync();
  }

  updateEffectValue(input) {
    if (!input || input.type !== "range") return;
    const value = document.getElementById(`${input.id.replace(/Input$/, "")}Value`);
    if (value instanceof HTMLInputElement) {
      value.value = formatEffectValue(input, input.value);
    } else if (value) {
      value.textContent = formatEffectValue(input, input.value);
    }
  }

  applyEffectRange(input, value) {
    const next = clampNumber(value, Number(input.min) || 0, Number(input.max) || 100);
    input.value = next;
    this.updateEffectValue(input);
    if (input.dataset.effectInput === "wind") this.applyWindEffect();
    if (input.dataset.effectInput === "boil") this.applyBoilSettings();
  }

  applyWindEffect() {
    this.controller.setWindEffect({
      enabled: this.windEnabledCheckbox?.checked ?? false,
      direction: valueOf("windDirectionInput", 0),
      strength: valueOf("windStrengthInput", 45),
      trailLength: valueOf("windTrailInput", 120),
      destruction: valueOf("windDestructionInput", 40),
      uniformity: valueOf("windUniformityInput", 35)
    });
  }

  applyBoilSettings() {
    const enabled = this.boilEnabledCheckbox?.checked ?? true;
    this.controller.setAnimationSettings({
      boilAmount: enabled ? valueOf("boilAmountInput", 42) : 0,
      frames: valueOf("boilFramesInput", 4),
      fps: valueOf("boilFpsInput", 8)
    });
  }

  exportTransparentGif() {
    this.controller.exportTransparentGif({
      boilAmount: 42,
      frames: 4,
      fps: 8
    });
  }

  exportCurrentFormat() {
    if (this.gifToggle?.checked) {
      this.exportTransparentGif();
      return;
    }
    this.controller.export({ transparent: this.transparencyToggle.checked });
  }

  toggleBoilPreview() {
    this.applyBoilSettings();
    this.controller.toggleBoilPreview({
      boilAmount: this.boilEnabledCheckbox?.checked ? valueOf("boilAmountInput", 42) : 0,
      frames: valueOf("boilFramesInput", 4),
      fps: valueOf("boilFpsInput", 8)
    });
  }

  bindGeneratorValueMirrors() {
    document.querySelectorAll("[data-generator-input]").forEach((input) => this.updateGeneratorValue(input));
  }

  hydrateGeneratorValueInputs() {
    document.querySelectorAll(".generator-value").forEach((value) => {
      if (value instanceof HTMLInputElement) return;
      const input = document.createElement("input");
      input.type = "text";
      input.className = "value-display generator-value generator-value-input";
      input.id = value.id;
      input.value = value.textContent || "";
      input.inputMode = "numeric";
      input.setAttribute("aria-label", `${value.id.replace(/Value$/, "")} value`);
      value.replaceWith(input);
    });
  }

  updateGeneratorValue(input) {
    if (!input || input.type !== "range") return;
    const value = document.getElementById(`${input.id.replace(/Input$/, "")}Value`);
    if (value instanceof HTMLInputElement) {
      value.value = formatGeneratorValue(input, input.value);
    } else if (value) {
      value.textContent = formatGeneratorValue(input, input.value);
    }
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

  async loadSvgLineFile(file) {
    if (!file) return;
    if (this.svgLineMeta) this.svgLineMeta.textContent = "Importing…";

    try {
      this.svgLineSource = await file.text();
      this.svgLineName = file.name || "Imported SVG";
      this.regenerateSvgLines({ commitHistory: true });
    } catch (error) {
      console.error(error);
      this.svgLineSource = null;
      this.svgLineName = "";
      if (this.svgLineMeta) this.svgLineMeta.textContent = "Failed";
      if (this.svgLineReapplyButton) this.svgLineReapplyButton.disabled = true;
    }
  }

  regenerateSvgLines({ commitHistory = false } = {}) {
    if (!this.svgLineSource) return;

    try {
      const strokes = createSvgLineStrokes(this.svgLineSource, {
        width: this.controller.canvas.width,
        height: this.controller.canvas.height,
        color: this.controller.brushColor,
        brush: this.activeBrushTool,
        size: this.controller.size,
        sizeVariation: this.controller.sizeVariation,
        density: this.controller.density,
        densityProfile: this.controller.densityProfile,
        pressureEnabled: this.controller.pressureEnabled,
        sourceName: this.svgLineName
      });

      if (!strokes.length) {
        if (this.svgLineMeta) this.svgLineMeta.textContent = "No lines found";
        if (this.svgLineReapplyButton) this.svgLineReapplyButton.disabled = true;
        return;
      }

      const hasExistingGroup = this.hasSvgLineGroup();
      this.svgLineGroupId = this.controller.replaceGeneratedGroup(this.svgLineGroupId, strokes, {
        selectGroup: false,
        commitHistory: commitHistory || !hasExistingGroup
      });
      if (this.svgLineMeta) this.svgLineMeta.textContent = `${this.svgLineName} · ${strokes.length}`;
      if (this.svgLineReapplyButton) this.svgLineReapplyButton.disabled = false;
    } catch (error) {
      console.error(error);
      if (this.svgLineMeta) this.svgLineMeta.textContent = "Failed";
      if (this.svgLineReapplyButton) this.svgLineReapplyButton.disabled = true;
    }
  }

  queueActiveGeneratorRefresh() {
    if (this.activeMode === "pinta") {
      this.queueSvgLineRefresh();
      return;
    }
    if (this.activeMode === "foto" || this.activeMode === "nuevo" || this.activeMode === "flor" || this.activeMode === "doodleFlor") {
      this.queueGeneratorRefresh(this.activeMode);
    }
  }

  queueSvgLineRefresh() {
    if (this.activeMode !== "pinta" || !this.svgLineSource || !this.hasSvgLineGroup()) return;
    if (this.controller.getSelectedStroke()) return;
    window.clearTimeout(this.svgLineRefreshTimer);
    this.svgLineRefreshTimer = window.setTimeout(() => {
      this.regenerateSvgLines({ commitHistory: false });
    }, 120);
  }

  queueGeneratorRefresh(mode) {
    if (mode !== "foto" && mode !== "nuevo" && mode !== "flor" && mode !== "doodleFlor") return;
    if ((mode === "foto" || mode === "nuevo") && !this.photoImage) return;
    window.clearTimeout(this.generatorRefreshTimer);
    this.generatorRefreshTimer = window.setTimeout(() => {
      if (mode === "foto") this.regenerateFoto({ commitHistory: false });
      if (mode === "nuevo") this.regenerateNuevo({ commitHistory: false });
      if (mode === "flor") this.regenerateFlor({ commitHistory: false });
      if (mode === "doodleFlor") this.regenerateDoodleFlor({ commitHistory: false });
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

  regenerateDoodleFlor({ commitHistory = false } = {}) {
    const strokes = this.doodleFlorGenerator.generate({
      width: this.controller.canvas.width,
      height: this.controller.canvas.height,
      color: this.controller.brushColor,
      settings: this.getDoodleFlorSettings()
    });
    this.commitGeneratedStrokes("doodleFlor", strokes, { commitHistory });
  }

  commitGeneratedStrokes(mode, strokes, { commitHistory = false } = {}) {
    if (!strokes.length) return;
    const hasExistingGroup = Boolean(this.generatedGroupIds[mode]);
    this.generatedGroupIds[mode] = this.controller.replaceGeneratedGroup(this.generatedGroupIds[mode], strokes, {
      selectGroup: false,
      commitHistory: commitHistory || !hasExistingGroup
    });
  }

  hasGeneratedGroup(mode) {
    const groupId = this.generatedGroupIds[mode];
    return Boolean(groupId && this.controller.strokes.some((stroke) => stroke.meta?.generated && stroke.meta.groupId === groupId));
  }

  hasSvgLineGroup() {
    return Boolean(this.svgLineGroupId && this.controller.strokes.some((stroke) => stroke.meta?.generated && stroke.meta.groupId === this.svgLineGroupId));
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
      lineStrength: valueOf("nuevoLineStrengthInput", 68),
      massOutline: valueOf("nuevoMassOutlineInput", 50),
      interiorDetail: valueOf("nuevoInteriorDetailInput", 62),
      fill: valueOf("nuevoFillInput", 18),
      simplify: valueOf("nuevoSimplifyInput", 34),
      spacing: valueOf("nuevoSpacingInput", 11),
      dotSize: valueOf("nuevoDotSizeInput", 22),
      sizeVariation: valueOf("nuevoSizeVariationInput", 0),
      jitter: valueOf("nuevoJitterInput", 10),
      maxPoints: valueOf("nuevoMaxPointsInput", 1200),
      seed: sanitizeSeed(this.nuevoSeedInput?.value, 851663)
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

  getDoodleFlorSettings() {
    return {
      shape: this.doodleFlorShapeSelect?.value || "mixed",
      scale: valueOf("doodleFlorScaleInput", 64),
      petals: valueOf("doodleFlorPetalsInput", 6),
      openness: valueOf("doodleFlorOpennessInput", 72),
      wobble: valueOf("doodleFlorWobbleInput", 46),
      scribble: valueOf("doodleFlorScribbleInput", 28),
      stem: valueOf("doodleFlorStemInput", 84),
      leaves: valueOf("doodleFlorLeavesInput", 42),
      density: valueOf("doodleFlorDensityInput", 78),
      dotSize: valueOf("doodleFlorDotSizeInput", 20),
      sizeVariation: valueOf("doodleFlorSizeVariationInput", 0),
      jitter: valueOf("doodleFlorJitterInput", 16),
      maxStrokes: valueOf("doodleFlorMaxStrokesInput", 60),
      seed: sanitizeSeed(this.doodleFlorSeedInput?.value, 2207)
    };
  }

  closeMobileExportSheet() {
    if (this.mobileExportSheet) this.mobileExportSheet.hidden = true;
  }

  toggleJsonExportButton() {
    if (!this.jsonExportButton) return;
    this.jsonExportButton.hidden = !this.jsonExportButton.hidden;
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
    this.queueSvgLineRefresh();
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

function formatGeneratorValue(input, value) {
  const numeric = Math.round(Number(value));
  const formatted = Number.isFinite(numeric) ? String(numeric) : String(value);
  return input.dataset.generatorUnit === "%" ? `${formatted}%` : formatted;
}

function formatEffectValue(input, value) {
  const numeric = Math.round(Number(value));
  const formatted = Number.isFinite(numeric) ? String(numeric) : String(value);
  return input.dataset.effectUnit === "°" ? `${formatted}°` : formatted;
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
