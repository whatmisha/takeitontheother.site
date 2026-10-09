import { effectDefaults, effectRanges, effectColors } from './effects.js';

const labels = { backgroundAngle: 'Direction', shadowOpacity: 'Opacity', shadowBlur: 'Blur', shadowDistance: 'Distance', shadowAngle: 'Direction', outlineWidth: 'Width',
    backgroundStart: 'Start', backgroundMidLow: 'Stop 2', backgroundMidHigh: 'Stop 3', backgroundEnd: 'End', shadowColor: 'Color', outlineColor: 'Color' };
const colorNames = { backgroundStart: 'Background start', backgroundMidLow: 'Gradient stop 2', backgroundMidHigh: 'Gradient stop 3', backgroundEnd: 'Background end', shadowColor: 'Shadow', outlineColor: 'Outline' };

export const effectSwatches = effectColors.map(setting => ({ type: setting, setting,
    itemId: setting + 'ColorItem', dotId: setting + 'ColorPreview', hexId: setting + 'ColorHex', hsbSlotId: setting + 'ColorHsbSlot' }));
export const effectSliders = Object.entries(effectRanges).map(([setting, [min, max]]) => ({ id: setting + 'Slider', valueId: setting + 'Value', setting, min, max, decimals: 0, baseStep: 1 }));

function range(key) {
    const unit = key.endsWith('Angle') ? '&deg;' : key === 'shadowOpacity' ? '%' : 'px';
    return `<div class="control-group"><label for="${key}Slider"><span>${labels[key]} <span class="unit">${unit}</span></span><input id="${key}Value" class="value-display" value="${effectDefaults[key]}" inputmode="decimal" aria-label="${key.startsWith('background') ? 'Background' : key.startsWith('shadow') ? 'Shadow' : 'Outline'} ${labels[key].toLowerCase()}"></label><input id="${key}Slider" type="range" min="${effectRanges[key][0]}" max="${effectRanges[key][1]}" step="1" value="${effectDefaults[key]}"></div>`;
}

function color(key) {
    return `<div class="color-swatch-row" id="${key}Row"><div class="color-swatch-compact" id="${key}ColorItem"><button class="color-dot color-dot--expandable" id="${key}ColorPreview" type="button" aria-label="Open ${colorNames[key].toLowerCase()} color"></button><span class="color-label">${labels[key]}</span><input class="color-swatch-hex" id="${key}ColorHex" aria-label="${colorNames[key]} color hex" spellcheck="false" maxlength="7"></div><div class="color-hsb-slot" id="${key}ColorHsbSlot">${key === 'backgroundStart' ? '<div id="effectsColorPicker"></div>' : ''}</div></div>`;
}

function toggle(key, label) {
    return `<label class="toggle-label"><span class="toggle-switch"><input id="${key}Toggle" type="checkbox"><span class="toggle-slider"></span></span><span>${label}</span></label>`;
}

export function mountEffects() {
    document.getElementById('effectsControls').innerHTML = `
        <details class="ui-disclosure effect-details" id="backgroundDetails"><summary>Background<span class="ui-disclosure__chevron" data-icon="chevron"></span></summary>
            <div class="effect-content"><div class="segmented-control" role="radiogroup" aria-label="Background mode">
                <input id="backgroundGradient" type="radio" name="backgroundMode" value="gradient" checked><label for="backgroundGradient">Gradient</label>
                <input id="backgroundSolid" type="radio" name="backgroundMode" value="solid"><label for="backgroundSolid">Solid</label></div>
            <div class="color-swatches-compact">${effectColors.slice(0, 4).map(color).join('')}</div>
            <div id="backgroundDirection">${range('backgroundAngle')}</div></div>
        </details>
        <details class="ui-disclosure effect-details" id="shadowDetails"><summary>Shadow<span class="ui-disclosure__chevron" data-icon="chevron"></span></summary>
            <div class="effect-content">${toggle('shadowEnabled', 'Drop shadow')}<div id="shadowOptions" hidden>
            <div class="color-swatches-compact">${color('shadowColor')}</div>${['shadowOpacity', 'shadowBlur', 'shadowDistance', 'shadowAngle'].map(range).join('')}</div></div>
        </details>
        <details class="ui-disclosure effect-details" id="outlineDetails"><summary>Outline<span class="ui-disclosure__chevron" data-icon="chevron"></span></summary>
            <div class="effect-content">${toggle('outlineEnabled', 'Sticker outline')}<div id="outlineOptions" hidden>
            <div class="color-swatches-compact">${color('outlineColor')}</div>${range('outlineWidth')}</div></div>
        </details>
        <div class="effect-reset"><button id="resetEffectsBtn" type="button" class="ui-icon-button" aria-label="Reset effects and background" data-tooltip="Reset effects and background" data-icon="refresh"></button></div>`;
}

export function syncEffects(tool) {
    const s = tool.settings;
    for (const radio of document.querySelectorAll('input[name="backgroundMode"]')) radio.checked = radio.value === s.backgroundMode;
    for (const key of ['backgroundMidLow', 'backgroundMidHigh', 'backgroundEnd']) document.getElementById(key + 'Row').hidden = s.backgroundMode === 'solid';
    document.getElementById('backgroundDirection').hidden = s.backgroundMode === 'solid';
    for (const name of ['shadow', 'outline']) {
        document.getElementById(name + 'EnabledToggle').checked = s[name + 'Enabled'];
        document.getElementById(name + 'Options').hidden = !s[name + 'Enabled'];
    }
    for (const key of Object.keys(effectRanges)) if (document.activeElement !== document.getElementById(key + 'Value')) tool.sliders?.setDisplayValue(key + 'Slider', s[key]);
}
