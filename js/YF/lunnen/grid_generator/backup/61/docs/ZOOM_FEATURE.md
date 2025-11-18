# Zoom & Pan Feature

## Overview

Figma-like zoom and pan functionality for the Pizza Boxer canvas, allowing precise control over the viewport at any scale.

## User Interface

### Zoom Indicator
- **Location:** Top bar, right of preset dropdown
- **Display:** Shows current zoom percentage (e.g., "100%", "150%", "200%")
- **Hover Effect:** Text changes from percentage to "Fit" on hover
- **Interaction:** Click to reset zoom to 100% with smooth centering
- **Auto-center:** Automatically centers canvas when reaching 100% via scroll

## Controls

### Zooming
- **Keyboard:** Hold `Cmd` (Mac) or `Ctrl` (Windows/Linux) + Scroll
- **Direction:** 
  - Scroll up = Zoom in
  - Scroll down = Zoom out (min 100%)
- **Behavior:** Zoom centers on cursor position (just like Figma)
- **Range:** 100% to 1000%
- **Step:** 5% per scroll increment (comfortable speed)
- **Minimum:** Cannot zoom below 100% - layout always fits in window

### Panning
- **Keyboard:** Regular scroll (no modifiers)
- **Direction:**
  - Vertical scroll = Pan up/down
  - Horizontal scroll = Pan left/right (if supported by device)
- **Support:** Optimized for Apple Magic Mouse with smooth momentum scrolling

### Reset Zoom
- **Action:** Click on zoom percentage indicator
- **Behavior:** Returns to 100% zoom with smooth animation and auto-centering

## Technical Details

### Implementation
- **Module:** `src/ui/ZoomController.js`
- **Integration:** Initialized in `GridGenerator` constructor via `initZoomController()`
- **Dependencies:** None (standalone module)

### Architecture

```javascript
class ZoomController {
  // State
  zoom: number (0.1 to 10.0)
  panX, panY: scroll position
  
  // Methods
  handleWheel(e) - Zoom or pan based on modifier key
  updateTransform() - Apply CSS transform
  resetZoom() - Return to 100% with centering
}
```

### CSS Transform
- **Container:** `.canvas-container` - Scrollable viewport
- **Inner:** `.canvas-container-inner` - Transform target
- **Transform:** `scale(zoom)` with `transform-origin: 0 0`

### Canvas Structure
```html
<div class="canvas-container" id="canvasContainer">
  <div class="canvas-container-inner" id="canvasInner">
    <svg id="gridSvg">...</svg>
  </div>
</div>
```

## Performance Considerations

1. **RequestAnimationFrame** - Scroll updates use RAF for smooth 60fps
2. **No Transitions** - Transform applied instantly for responsive feel
3. **Native Scroll** - Leverages browser's optimized scrolling for panning
4. **Minimal DOM Updates** - Only transform and text content changes

## Future Enhancements

Possible improvements:
- [ ] Keyboard shortcuts (e.g., `Cmd+0` to reset, `Cmd+=/-` to zoom)
- [ ] Touch gestures for pinch-to-zoom on trackpad
- [ ] Zoom presets (25%, 50%, 100%, 200%)
- [ ] Fit to screen button
- [ ] Space + drag for panning (alternative to scroll)

## Browser Compatibility

- ✅ Chrome/Edge (latest)
- ✅ Safari (latest)
- ✅ Firefox (latest)
- ⚠️ Requires ES6 module support
- ⚠️ Smooth scrolling requires modern browser

## Known Issues

None reported.

## Related Files

- `src/ui/ZoomController.js` - Main implementation
- `script.js` - Integration point
- `style.css` - Canvas and scrollbar styles
- `index.html` - DOM structure

