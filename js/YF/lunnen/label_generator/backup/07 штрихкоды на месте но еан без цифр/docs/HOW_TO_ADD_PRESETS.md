# How to Add Presets — Quick Guide

## Automatic Method (Recommended) 🚀

### 1️⃣ Create Your Layout
Open Pizza Boxer and set up everything:
- Dimensions, grid, colors
- Add text blocks with content
- Add graphics if needed
- Position everything

### 2️⃣ Export Settings
Click **"Export Settings"** button → JSON file downloads

### 3️⃣ Rename File
Give it a meaningful name:
- Example: `grid-settings_2025-11-14.json` → `Outer 16" Back.json`
- The filename will be the preset name in dropdown

### 4️⃣ Move to Presets Folder
Place your JSON file in: `presets/`

### 5️⃣ Run Auto-Generator Script
```bash
python3 generate-presets-manifest.py
```

Or if you have Node.js:
```bash
npm run presets
```

### 6️⃣ Refresh Browser
Reload the page → Your preset appears in the dropdown!

---

## Manual Method (If needed)

If you can't run the script, manually edit `presets/manifest.json`:

```json
{
  "presets": [
    {
      "name": "Outer 16\" Back",
      "file": "Outer 16\" Back.json"
    },
    {
      "name": "Your New Preset",
      "file": "Your New Preset.json"
    }
  ]
}
```

---

## Important Rules

✅ **DO:**
- Always use "Export Settings" to create presets
- Add each preset to `manifest.json`
- Use descriptive names
- Test before sharing

❌ **DON'T:**
- Manually create preset files
- Edit exported JSON (unless you know the format)
- Forget to update `manifest.json`

---

## Example manifest.json

```json
{
  "presets": [
    {
      "name": "Product A - Front",
      "file": "product-a-front.json"
    },
    {
      "name": "Product A - Back", 
      "file": "product-a-back.json"
    },
    {
      "name": "Product B - Square",
      "file": "product-b-square.json"
    }
  ]
}
```

---

## Need More Help?

See full documentation: `presets/README.md`

