import { BackgroundColorPicker } from "./BackgroundColorPicker.js";

export class Toolbar {
  constructor(controller) {
    this.controller = controller;
    this.sizeInput = document.getElementById("sizeInput");
    this.sizeOutput = document.getElementById("sizeOutput");
    this.densityInput = document.getElementById("densityInput");
    this.densityOutput = document.getElementById("densityOutput");
    this.densityProfileSelect = document.getElementById("densityProfileSelect");
    this.canvasPresetSelect = document.getElementById("canvasPresetSelect");
    this.undoButton = document.getElementById("undoButton");
    this.redoButton = document.getElementById("redoButton");
    this.clearButton = document.getElementById("clearButton");
    this.exportButton = document.getElementById("exportButton");
    this.transparencyToggle = document.getElementById("transparencyToggle");
    this.backgroundInput = document.getElementById("backgroundInput");
    this.backgroundButton = document.getElementById("backgroundButton");
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
    this.lastDetail = null;
    this.backgroundColorPicker = new BackgroundColorPicker(controller);
    this.bind();
    this.backgroundColorPicker.init();
  }

  bind() {
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

    this.densityProfileSelect.addEventListener("change", () => {
      this.controller.setDensityProfile(this.densityProfileSelect.value);
    });

    this.canvasPresetSelect.addEventListener("change", () => {
      const [width, height] = this.canvasPresetSelect.value.split("x").map(Number);
      this.controller.resize(width, height);
    });

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

  closeMobileExportSheet() {
    if (this.mobileExportSheet) this.mobileExportSheet.hidden = true;
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
      : "None";
    this.backgroundMeta.textContent = detail.backgroundName || "None";

    const presetValue = `${detail.width}x${detail.height}`;
    if (document.activeElement !== this.canvasPresetSelect && hasSelectOption(this.canvasPresetSelect, presetValue)) {
      this.canvasPresetSelect.value = presetValue;
    }

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

    if (document.activeElement !== this.densityProfileSelect) {
      this.densityProfileSelect.value = detail.activeDensityProfile || "flat";
    }
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

function hasSelectOption(select, value) {
  if (!select) return false;
  return Array.from(select.options).some((option) => option.value === value);
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}
