export class PanelManager {
  constructor() {
    this.panels = new Map();
    this.highestZIndex = 1000;
    this.dragState = {
      isDragging: false,
      panelId: null,
      startX: 0,
      startY: 0,
      initialX: 0,
      initialY: 0
    };

    document.addEventListener("pointermove", (event) => this.onDrag(event));
    document.addEventListener("pointerup", () => this.stopDrag());
  }

  registerPanel(panelId, config = {}) {
    const panel = document.getElementById(panelId);
    const header = document.getElementById(config.headerId);
    if (!panel) return;

    this.panels.set(panelId, {
      element: panel,
      header,
      draggable: config.draggable !== false
    });

    if (header && config.draggable !== false) {
      header.style.cursor = "grab";
      header.addEventListener("pointerdown", (event) => this.startDrag(panelId, event));
    }

    panel.addEventListener("pointerdown", () => this.bringToFront(panelId));
  }

  startDrag(panelId, event) {
    if (event.target.closest(".collapse-toggle, .collapse-icon, .modal-close, button, input, select, textarea")) {
      return;
    }

    const panelData = this.panels.get(panelId);
    if (!panelData?.draggable) return;

    event.preventDefault();
    panelData.header?.setPointerCapture?.(event.pointerId);

    const rect = panelData.element.getBoundingClientRect();
    this.dragState = {
      isDragging: true,
      panelId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: rect.left,
      initialY: rect.top
    };

    if (panelData.header) panelData.header.style.cursor = "grabbing";
    panelData.element.style.transition = "none";
    this.bringToFront(panelId);
  }

  onDrag(event) {
    if (!this.dragState.isDragging) return;

    const panelData = this.panels.get(this.dragState.panelId);
    if (!panelData) return;

    const rect = panelData.element.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - rect.width);
    const maxY = Math.max(0, window.innerHeight - rect.height);
    const x = clamp(this.dragState.initialX + event.clientX - this.dragState.startX, 0, maxX);
    const y = clamp(this.dragState.initialY + event.clientY - this.dragState.startY, 0, maxY);

    panelData.element.style.left = `${x}px`;
    panelData.element.style.top = `${y}px`;
    panelData.element.style.right = "auto";
    panelData.element.style.bottom = "auto";
  }

  stopDrag() {
    if (!this.dragState.isDragging) return;

    const panelData = this.panels.get(this.dragState.panelId);
    if (panelData?.header) panelData.header.style.cursor = "grab";
    if (panelData?.element) panelData.element.style.transition = "";

    this.dragState = {
      isDragging: false,
      panelId: null,
      startX: 0,
      startY: 0,
      initialX: 0,
      initialY: 0
    };
  }

  bringToFront(panelId) {
    const panelData = this.panels.get(panelId);
    if (!panelData) return;

    this.highestZIndex += 1;
    panelData.element.style.zIndex = this.highestZIndex;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
