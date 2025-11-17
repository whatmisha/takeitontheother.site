# Presets Folder

This folder contains preset configurations for the Pizza Boxer packaging layout tool.

## What are Presets?

Presets are pre-configured settings files that allow you to quickly switch between different packaging layouts. Each preset is a JSON file exported using the "Export Settings" button that contains ALL settings, including:

- Canvas dimensions (width, height, thickness)
- Grid configuration (module size, columns, rows, margins)
- Typography settings (headline and text styles)
- Colors
- Display options
- Text blocks with content and positioning
- Graphics blocks with SVG content and positioning
- Icons and claim blocks (if present)

## How to Use Presets

1. Open the Pizza Boxer tool in your browser
2. At the top of the page, you'll see a preset dropdown (gray rounded button)
3. The first preset loads automatically
4. Select any other preset from the dropdown to switch configurations
5. All settings, text, and graphics will load automatically

## Available Presets

Available presets are defined in `manifest.json`. Check that file to see the current list.

## How to Add New Presets

**IMPORTANT:** Presets must be in the exact same format as files exported via "Export Settings" button. This ensures all data is preserved.

### Step-by-Step Instructions:

1. **Create your layout** in the Pizza Boxer tool
   - Set all dimensions, grid settings, colors
   - Add text blocks with content
   - Add graphics if needed
   - Position everything as desired

2. **Export the configuration**
   - Click the "Export Settings" button
   - A JSON file will be downloaded (e.g., `grid-settings_2025-11-14.json`)

3. **Rename the file** (optional)
   - Give it a descriptive name (e.g., `My Product Box.json`)
   - Keep the `.json` extension

4. **Add to presets folder**
   - Place the file in this `presets/` folder

5. **Update manifest.json**
   - Open `manifest.json` in this folder
   - Add your preset to the `presets` array:
   ```json
   {
     "presets": [
       {
         "name": "My Product Box",
         "file": "My Product Box.json"
       }
     ]
   }
   ```

6. **Refresh the page**
   - The new preset will appear in the dropdown
   - It will load automatically if it's the only/first preset

### Example manifest.json:

```json
{
  "presets": [
    {
      "name": "Preset 1 Name",
      "file": "preset1.json"
    },
    {
      "name": "Preset 2 Name",
      "file": "preset2.json"
    },
    {
      "name": "My Product Box",
      "file": "My Product Box.json"
    }
  ]
}
```

**Note:** The order in manifest.json determines the order in the dropdown. The first preset loads automatically.

## JSON Structure Reference

### Root Level
- `presetName` (string): Display name for the preset
- `version` (string): Format version (currently "1.0")
- `timestamp` (string): ISO date when preset was created
- `dimensions` (object): Canvas dimensions
- `texts` (array): Text blocks (optional)
- `grid` (object): Grid configuration
- `colors` (object): Color settings
- `typography` (object): Typography settings
- `display` (object): Display options
- `graphics` (object): Graphics blocks (optional)

### Dimensions Object
- `width` (number): Canvas width in mm
- `height` (number): Canvas height in mm
- `thickness` (number): Box thickness in mm
- `unit` (string): Always "mm"

### Grid Object
- `module` (number): Base module size in mm
- `margins` (number): Margin size
- `marginsUnit` (string): "mod" or "mm"
- `columns` (number): Number of columns
- `rows` (number): Number of rows
- `rowHeight` (number): Height of each row in modules
- `linkMode` (string): "off", "rows-height", or "module"
- `visibility` (object): Grid visibility settings
  - `columns` (boolean): Show columns
  - `rows` (boolean): Show rows
  - `baseline` (boolean): Show baseline grid

### Colors Object
- `background` (string): Background color in hex format (e.g., "#dadde6")

### Typography Object
Contains two sub-objects: `headline` and `text`, each with:
- `size` (number): Font size in modules
- `lineHeight` (number): Line height in modules
- `tracking` (number): Letter spacing in em units
- `useXHeight` (boolean): Use x-height for alignment
- `fontWeight` (string): "400" or "500"

### Display Object
- `dimensions` (boolean): Show dimension lines
- `labels` (boolean): Show labels
- `sidePanels` (boolean): Show side panels
- `objects` (boolean): Show objects by default

### Texts Array
Array of text block objects (optional):
```json
{
  "id": "text_1",
  "content": "Your text here",
  "style": "headline",
  "position": {
    "column": 1,
    "row": 0,
    "baseline": 0
  },
  "width": 6
}
```

### Graphics Object
Contains arrays of graphic blocks (optional):
- `blocks` (array): Custom graphics
- `icons` (object|null): Icons block
- `claim` (object|null): Claim block

## Important Notes

1. **Always use Export Settings:** Don't manually create preset files - always export them from the tool to ensure correct format
2. **Complete data:** Exported files contain ALL your configuration including text content, graphics SVG, and positioning
3. **File naming:** Use descriptive names for both the JSON file and the display name in manifest
4. **manifest.json is required:** The tool reads this file to discover available presets
5. **First preset loads automatically:** The first preset in manifest.json loads when the page opens
6. **No page reload needed after changes:** Just refresh the browser to see new presets

## Tips

1. **Descriptive Names:** Use clear, descriptive names that indicate the product or use case
2. **Organize by Product:** Create separate presets for different products or box sizes
3. **Version Your Presets:** Include version info in the filename if you iterate on designs
4. **Testing:** Always test new presets in the tool before using in production
5. **Backup:** Keep backups of important presets in version control

## Troubleshooting

### Dropdown shows "Loading presets..." or "No presets available"
- Check that `manifest.json` exists in the `presets` folder
- Verify `manifest.json` is valid JSON
- Make sure at least one preset is listed in manifest
- Check browser console for errors

### Preset doesn't appear in dropdown
- Verify the preset file exists in `presets` folder
- Check that it's added to `manifest.json`
- Ensure the filename in manifest matches the actual file
- Refresh the browser page

### Preset doesn't load correctly
- Ensure the preset file was created using "Export Settings" button
- Don't manually edit preset files unless you know the exact format
- Check browser console for error messages
- Verify the JSON is valid (use a JSON validator)

### Settings don't update after loading preset
- Clear browser cache and reload
- Check that the preset file is complete (not truncated)
- Verify all required fields are present

### Graphics or text missing
- Ensure the preset was exported AFTER adding all elements
- Check that SVG graphics were properly embedded in the export
- Verify text content is in the `texts` array

