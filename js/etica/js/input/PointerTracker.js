export class PointerTracker {
  constructor(canvas, controller) {
    this.canvas = canvas;
    this.controller = controller;
    this.activePointerId = null;
    this.bind();
  }

  bind() {
    this.canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const point = this.controller.getPointFromEvent(event);
      if (this.controller.tool === "select") {
        if (this.controller.beginSelectDrag(point, { additive: event.shiftKey })) {
          this.activePointerId = event.pointerId;
          this.canvas.setPointerCapture(event.pointerId);
        }
        return;
      }
      this.controller.clearPreviewPoint();
      this.activePointerId = event.pointerId;
      this.canvas.setPointerCapture(event.pointerId);
      this.controller.beginStroke(point);
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (this.activePointerId === null && this.controller.tool === "select") {
        this.controller.hoverStrokeAt(this.controller.getPointFromEvent(event));
        return;
      }
      if (this.activePointerId === null) {
        this.controller.setPreviewPoint(this.controller.getPointFromEvent(event));
        return;
      }
      if (event.pointerId !== this.activePointerId) return;
      event.preventDefault();
      if (this.controller.tool === "select") {
        this.controller.dragSelectedStroke(this.controller.getPointFromEvent(event));
        return;
      }
      this.controller.addPoint(this.controller.getPointFromEvent(event));
    });

    this.canvas.addEventListener("pointerup", (event) => this.finish(event));
    this.canvas.addEventListener("pointercancel", (event) => this.finish(event));
    this.canvas.addEventListener("lostpointercapture", () => {
      this.controller.endSelectDrag();
      this.activePointerId = null;
    });

    this.canvas.addEventListener("pointerleave", () => {
      this.controller.clearHover();
      this.controller.clearPreviewPoint();
    });
  }

  finish(event) {
    if (event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    if (this.controller.tool === "select") {
      this.controller.endSelectDrag();
      this.activePointerId = null;
      return;
    }
    this.controller.endStroke(this.controller.getPointFromEvent(event));
    this.activePointerId = null;
    this.controller.setPreviewPoint(this.controller.getPointFromEvent(event));
  }
}
