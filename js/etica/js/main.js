import { CanvasController } from "./canvas/CanvasController.js";
import { PointerTracker } from "./input/PointerTracker.js";
import { Toolbar } from "./ui/Toolbar.js";
import { PanelManager } from "../yf-ui-framework/v2/src/ui/PanelManager.js";

const canvas = document.getElementById("drawingCanvas");
const controller = new CanvasController(canvas);
const panels = new PanelManager();
const isTouchMode = navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;

if (isTouchMode) {
  document.documentElement.classList.add("is-etica-mobile");
  controller.setCanvasSize(1080, 1920);
  controller.setBackgroundFit("fill");
  controller.setTool("dotted");
}

new PointerTracker(canvas, controller);
new Toolbar(controller);

[
  ["toolsPanel", "toolsPanelHeader"],
  ["linePanel", "linePanelHeader"],
  ["canvasPanel", "canvasPanelHeader"],
  ["backgroundPanel", "backgroundPanelHeader"]
].forEach(([panelId, headerId]) => {
  panels.registerPanel(panelId, {
    headerId,
    draggable: true,
    persistent: true
  });
});

document.querySelectorAll(".collapse-icon").forEach((icon) => {
  const togglePanel = () => {
    const panel = icon.closest(".controls-panel");
    if (!panel) return;
    panel.classList.toggle("panel-collapsed");
    icon.classList.toggle("collapsed");
  };

  icon.addEventListener("mousedown", (event) => event.stopPropagation());
  icon.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePanel();
  });
  icon.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    togglePanel();
  });
});

controller.renderNow();
