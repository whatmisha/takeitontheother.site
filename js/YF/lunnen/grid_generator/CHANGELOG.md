# Changelog

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

