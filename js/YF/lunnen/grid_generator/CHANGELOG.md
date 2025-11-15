# Changelog

## [Iteration 11] - 2025-11-14 (Updated)

### 🔍 Added - Zoom & Pan Functionality

#### New Features
- **Figma-like Zoom** - Cmd/Ctrl + Scroll to zoom in/out, with zoom point following cursor position
  - Comfortable speed: 5% per scroll step (2x slower than initial)
  - Range: 100% to 1000% (cannot zoom below 100%)
  - Auto-centers when reaching 100%
- **Zoom Indicator** - Displays current zoom percentage next to preset dropdown
  - Hover effect: Shows "Fit" text on hover as a hint
  - Click to reset to 100% with smooth centering
- **Smart Centering** - Canvas auto-centers when zooming out to 100%
- **Smooth Panning** - Regular scroll (without modifier) for navigating the canvas at any zoom level
  - Vertical scrollbar hidden for cleaner UI (functionality preserved)
  - Horizontal scrollbar visible when needed
- **Apple Magic Mouse Support** - Native smooth scrolling support for seamless panning

#### Technical Implementation
- **New ZoomController Module** - `src/ui/ZoomController.js`
  - Manages zoom state (100% to 1000%, step 5%)
  - Handles wheel events with modifier detection
  - Calculates zoom origin relative to cursor position
  - Smooth scroll positioning with requestAnimationFrame
  - Auto-centering method when zoom reaches 100%
- **Canvas Structure Update** - Added `canvas-container-inner` wrapper for transform isolation
- **Enhanced Scrollbars** - Custom styled scrollbars matching app theme
  - Vertical scrollbar hidden (width: 0)
  - Horizontal scrollbar visible and styled
  - Scrollbar functionality preserved for both axes

#### Files Added
- `src/ui/ZoomController.js` - Zoom and pan controller module
- `backup/48 перед добавлением зума/` - Backup before zoom implementation

#### Files Modified
- `index.html` - Added zoom indicator button and canvas-inner wrapper
- `style.css` - Added zoom indicator styles, improved canvas container scrolling
- `script.js` - Integrated ZoomController into initialization flow

#### User Benefits
- 🎯 Precise zoom to cursor position (just like Figma)
- 🖱️ Natural scrolling for navigation
- 📊 Always see current zoom level
- ⚡ Fast reset to default view
- 🎨 Work comfortably at any scale

#### Bug Fix (same iteration)
- **Fixed:** Layout cut off at bottom on page load
- **Solution:** Dynamic overflow switching
  - At 100%: `overflow: visible` (no scrollbars, flexbox centering)
  - At zoom > 100%: `overflow: auto` (scrollbars for panning)
- **Result:** Layout always fits perfectly at 100% without scrolling

---

## [Iteration 10] - 2025-11-14

### 🎨 Added - Preset Configurations Feature

#### New Features
- **Preset Selector Dropdown** - Added at the top of the page for quick access to pre-configured layouts
- **Four Default Presets:**
  - Default Square (382×387mm) - Standard square packaging
  - Wide Format (500×300mm) - Horizontal packaging
  - Tall Format (250×400mm) - Vertical packaging  
  - Compact (200×200mm) - Small packaging

#### Technical Improvements
- **Dynamic Preset Loading** - Fetch presets from `/presets/` folder on-demand
- **UI Synchronization** - New `syncUIWithSettings()` method ensures all controls reflect loaded preset
- **Format Compatibility** - Works with both organized and flat JSON formats
- **Error Handling** - Graceful error messages if preset fails to load

#### Files Added
- `presets/default-square.json` - Default square preset
- `presets/wide-format.json` - Wide format preset
- `presets/tall-format.json` - Tall format preset
- `presets/compact.json` - Compact format preset
- `presets/README.md` - User guide for presets
- `docs/PRESETS_FEATURE.md` - Technical documentation
- `backup/45 перед добавлением пресетов/` - Backup before changes

#### Files Modified
- `index.html` - Added preset selector dropdown
- `style.css` - Added styles for preset selector
- `script.js` - Added preset management system
  - New `availablePresets` array
  - New `initializePresets()` method
  - New `loadPreset()` method
  - New `syncUIWithSettings()` method
  - Updated DOM elements with `presetDropdown`

#### User Benefits
- ⚡ Quick switching between common layouts
- 📐 Standardized configurations for consistency
- 🎓 Example presets for learning
- 🔄 Easy to create and share custom presets
- 💾 Compatible with existing Export/Import Settings

---

## Previous Iterations

### [Iteration 9] - Typography and Text Styles
- Added text style panels (Headline, Text)
- Paragraph settings with custom positioning
- Font weight selection (Regular/Medium)
- X-height alignment mode

### [Iteration 8] - Elements Management
- Elements Navigator panel
- Add/Edit/Delete text and graphics
- Object positioning system

### [Iteration 7] - SVG Export System
- Export SVG functionality
- Export/Import Settings (JSON)
- Clean SVG output for Adobe Illustrator

### [Iteration 6] - Graphics Support
- SVG graphics upload
- Graphics positioning and scaling
- Built-in icons and claim blocks

### [Iteration 5] - UI Controllers
- Slider controller system
- Color picker (HSB)
- Panel manager for draggable panels

### [Iteration 4] - Grid Renderer
- Grid rendering system
- Baseline grid
- Column and row visualization

### [Iteration 3] - Grid Calculator
- Module-based calculations
- Link modes (Off, Rows×Height, Module)
- Row presets

### [Iteration 2] - Settings Module
- Centralized settings management
- Settings persistence

### [Iteration 1] - Foundation
- Basic project structure
- Utility modules (ColorUtils, MathUtils, DOMUtils)
- Initial grid generation

---

**Project:** Pizza Boxer — Packaging Layout Tool  
**Version:** 1.10  
**Status:** Active Development

