import { MathUtils } from '../utils/MathUtils.js';

const MANUAL_SLIDER_SETTINGS = Object.freeze({
    headlineSizeSlider: 'headlineSize',
    lineHeightSlider: 'lineHeight',
    textSizeSlider: 'textSize',
    textLineHeightSlider: 'textLineHeight',
    captionSizeSlider: 'captionSize',
    captionLineHeightSlider: 'captionLineHeight',
    lunnenDisplaySizeSlider: 'lunnenDisplaySize',
    lunnenDisplayLineHeightSlider: 'lunnenDisplayLineHeight'
});

const SIZE_STYLES = Object.freeze({
    headlineSize: 'headline',
    textSize: 'text',
    captionSize: 'caption',
    lunnenDisplaySize: 'lunnenDisplay'
});

const EYE_TOGGLE_KEYS = Object.freeze([
    'showColumns',
    'showRows',
    'showBaseline',
    'showSidePanels',
    'surfaceVisibleToggle',
    'showObjects'
]);

/** Keeps application-wide controls in sync with the settings source of truth. */
export class ApplicationUiSynchronizer {
    constructor(host, windowRef = window) {
        this.host = host;
        this.window = windowRef;
    }

    sync() {
        const host = this.host;
        const settings = host.settingsModule.getAll();
        host.gridSettingsController.sync(settings);

        Object.entries(host.sliderConfig).forEach(([sliderId, config]) => {
            if (host.gridSettingsController.isGridSlider(sliderId)) return;
            if (config.setting && settings[config.setting] !== undefined) {
                host.sliderController.setValue(sliderId, settings[config.setting], false);
                return;
            }
            const settingKey = MANUAL_SLIDER_SETTINGS[sliderId];
            if (!settingKey || settings[settingKey] === undefined) return;
            host.sliderController.setValue(
                sliderId,
                this.getDisplayValue(settingKey, settings),
                false
            );
        });

        if (host.dom.useXHeight) host.dom.useXHeight.checked = settings.useXHeight !== false;
        if (host.dom.useXHeight2) host.dom.useXHeight2.checked = settings.useXHeight2 === true;
        if (host.dom.useXHeightCaption) {
            host.dom.useXHeightCaption.checked = settings.useXHeightCaption === true;
        }
        host.typographyUnitController.syncButtons(settings);
        host.panelUiController.syncFontWeights(settings);
        host.colorPanelController.sync(settings.boxColor);
        host.gridSettingsController.generateRowPresets();
        host.surfacePanelController?.sync();
    }

    getDisplayValue(settingKey, settings) {
        const isSize = settingKey.endsWith('Size');
        const unit = isSize
            ? (settings.fontSizeUnit || 'mod')
            : (settings.lineHeightUnit || 'mod');
        let value = settings[settingKey];
        if (unit === 'pt') {
            const millimeters = isSize
                ? this.host.textStyleResolver.calculateFontSize(SIZE_STYLES[settingKey])
                : value * settings.gridModule;
            value = MathUtils.mmToPt(millimeters);
        }
        return Number.parseFloat(value.toFixed(2));
    }

    updateViewportSize() {
        this.host.DISPLAY_SIZE = this.window.innerHeight - 40;
    }

    updateEyeIcon(checkbox) {
        const label = checkbox?.closest('label');
        if (!label) return;
        if (!label.classList.contains('toggle-chip')) {
            label.classList.remove('toggle-chip-checked');
            return;
        }
        label.classList.toggle('toggle-chip-checked', checkbox.checked);
    }

    initializeEyeIcons() {
        EYE_TOGGLE_KEYS.forEach(key => this.updateEyeIcon(this.host.dom[key]));
    }
}
