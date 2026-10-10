import { UnifiedColorPicker } from '../infra/framework/src/index.js';
import { addGradientStop, removeGradientStop } from './effects.js';

const swatches = ['backgroundStart', ...Array.from({ length: 8 }, (_, i) => 'gradient' + i)].map((setting, i) => ({ type: setting, setting, index: i - 1,
    itemId: setting + 'ColorItem', dotId: setting + 'ColorPreview', hexId: setting + 'ColorHex', hsbSlotId: setting + 'ColorHsbSlot' }));

function color(swatch) {
    const { setting: key, index } = swatch, name = index < 0 ? 'Background color' : `Gradient color ${index + 1}`;
    const compact = `<div class="color-swatch-compact" id="${key}ColorItem"><button class="color-dot color-dot--expandable" id="${key}ColorPreview" type="button" aria-label="Open ${name.toLowerCase()}"></button><span class="color-label">${index < 0 ? 'Color' : index + 1}</span><input class="color-swatch-hex" id="${key}ColorHex" aria-label="${name} hex" spellcheck="false" maxlength="7"></div>`;
    return `<div class="color-swatch-row" id="${key}Row">${index < 0 ? compact : `<div class="gradient-stop-main">${compact}<button type="button" class="ui-icon-button" data-remove-stop="${index}" aria-label="Remove gradient color ${index + 1}" data-tooltip="Remove color" data-icon="minus"></button></div>`}<div class="color-hsb-slot" id="${key}ColorHsbSlot">${index < 0 ? '<div id="effectsColorPicker"></div>' : ''}</div></div>`;
}

export function mountEffects() {
    document.getElementById('backgroundControls').innerHTML = `
            <div class="segmented-control" role="radiogroup" aria-label="Background mode">
                <input id="backgroundGradient" type="radio" name="backgroundMode" value="gradient" checked><label for="backgroundGradient">Gradient</label>
                <input id="backgroundSolid" type="radio" name="backgroundMode" value="solid"><label for="backgroundSolid">Solid</label></div>
            <div class="color-swatches-compact">${swatches.map(color).join('')}</div>
            <div class="gradient-actions" id="gradientActions"><button id="addGradientColorBtn" class="ui-icon-button" type="button" aria-label="Add gradient color" data-tooltip="Add color" data-icon="plus"></button></div>`;
    document.getElementById('effectsControls').innerHTML = `
        <div class="control-group pill-toggle-row"><label class="pill-toggle" for="shadowEnabledToggle"><input id="shadowEnabledToggle" class="sr-only" type="checkbox" checked><span>Drop shadow</span></label></div>`;
}

export function bindEffects(tool, change, signal) {
    const bySetting = new Map(swatches.map(swatch => [swatch.setting, swatch]));
    const settings = {
        get: key => key === 'backgroundStart' ? tool.settings.backgroundStart : tool.settings.backgroundStops[bySetting.get(key).index]?.color || '#000000',
        set: (key, color) => {
            if (key === 'backgroundStart') tool.settingsStore.set(key, color);
            else {
                const index = bySetting.get(key).index;
                if (index >= tool.settings.backgroundStops.length) return;
                tool.settingsStore.set('backgroundStops', tool.settings.backgroundStops.map((stop, i) => i === index ? { ...stop, color } : stop));
            }
        }
    };
    const picker = new UnifiedColorPicker({ settings, containerId: 'effectsColorPicker', swatches });
    picker.init();
    let signature = '';
    const close = () => { picker.picker.close(); document.querySelectorAll('#backgroundControls .active').forEach(node => node.classList.remove('active')); };
    document.getElementById('addGradientColorBtn').addEventListener('click', () => {
        change({ ...tool.getSnapshot(), backgroundStops: addGradientStop(tool.settings.backgroundStops) }, 'Add gradient color');
    }, { signal });
    for (const button of document.querySelectorAll('[data-remove-stop]')) button.addEventListener('click', () => {
        const index = Number(button.dataset.removeStop);
        change({ ...tool.getSnapshot(), backgroundStops: removeGradientStop(tool.settings.backgroundStops, index) }, 'Remove gradient color');
        const nextIndex = Math.min(index, tool.settings.backgroundStops.length - 1);
        document.getElementById(`gradient${nextIndex}ColorPreview`).focus();
    }, { signal });
    return { sync() {
        const next = tool.settings.backgroundMode + ':' + tool.settings.backgroundStops.length;
        if (signature !== next) { close(); signature = next; }
        picker.sync();
    }, destroy: close };
}

export function syncEffects(tool, controller) {
    const s = tool.settings;
    for (const radio of document.querySelectorAll('input[name="backgroundMode"]')) radio.checked = radio.value === s.backgroundMode;
    document.getElementById('backgroundStartRow').hidden = s.backgroundMode !== 'solid';
    for (let i = 0; i < 8; i++) document.getElementById(`gradient${i}Row`).hidden = s.backgroundMode === 'solid' || i >= s.backgroundStops.length;
    document.getElementById('gradientActions').hidden = s.backgroundMode === 'solid';
    document.getElementById('addGradientColorBtn').disabled = s.backgroundStops.length >= 8;
    for (const button of document.querySelectorAll('[data-remove-stop]')) button.disabled = s.backgroundStops.length <= 2;
    document.getElementById('shadowEnabledToggle').checked = s.shadowEnabled;
    controller?.sync();
}
