import { MathUtils } from '../utils/MathUtils.js';

const CONTROL_CONFIG = Object.freeze({
    headline: Object.freeze({
        size: Object.freeze({
            setting: 'headlineSize',
            slider: 'headlineSizeSlider',
            modButton: 'headlineSizeUnitMod',
            ptButton: 'headlineSizeUnitPt'
        }),
        lineHeight: Object.freeze({
            setting: 'lineHeight',
            slider: 'lineHeightSlider',
            modButton: 'headlineLineHeightUnitMod',
            ptButton: 'headlineLineHeightUnitPt'
        }),
        display: 'headlineFontSize'
    }),
    text: Object.freeze({
        size: Object.freeze({
            setting: 'textSize',
            slider: 'textSizeSlider',
            modButton: 'textSizeUnitMod',
            ptButton: 'textSizeUnitPt'
        }),
        lineHeight: Object.freeze({
            setting: 'textLineHeight',
            slider: 'textLineHeightSlider',
            modButton: 'textLineHeightUnitMod',
            ptButton: 'textLineHeightUnitPt'
        }),
        display: 'textFontSize'
    }),
    caption: Object.freeze({
        size: Object.freeze({
            setting: 'captionSize',
            slider: 'captionSizeSlider',
            modButton: 'captionSizeUnitMod',
            ptButton: 'captionSizeUnitPt'
        }),
        lineHeight: Object.freeze({
            setting: 'captionLineHeight',
            slider: 'captionLineHeightSlider',
            modButton: 'captionLineHeightUnitMod',
            ptButton: 'captionLineHeightUnitPt'
        }),
        display: 'captionFontSize'
    }),
    lunnenDisplay: Object.freeze({
        size: Object.freeze({
            setting: 'lunnenDisplaySize',
            slider: 'lunnenDisplaySizeSlider',
            modButton: 'lunnenDisplaySizeUnitMod',
            ptButton: 'lunnenDisplaySizeUnitPt'
        }),
        lineHeight: Object.freeze({
            setting: 'lunnenDisplayLineHeight',
            slider: 'lunnenDisplayLineHeightSlider',
            modButton: 'lunnenDisplayLineHeightUnitMod',
            ptButton: 'lunnenDisplayLineHeightUnitPt'
        }),
        display: 'lunnenDisplayFontSize'
    })
});

export class TypographyUnitController {
    constructor({
        settings,
        dom,
        sliderController,
        styleResolver,
        beginAction = () => {},
        commitAction = () => {},
        markChanged = () => {}
    }) {
        this.settings = settings;
        this.dom = dom;
        this.sliderController = sliderController;
        this.styleResolver = styleResolver;
        this.beginAction = beginAction;
        this.commitAction = commitAction;
        this.markChanged = markChanged;
        this.buttonsBound = false;
    }

    bindButtons() {
        if (this.buttonsBound) return;
        this.buttonsBound = true;

        for (const [style, config] of Object.entries(CONTROL_CONFIG)) {
            for (const property of ['size', 'lineHeight']) {
                const control = config[property];
                for (const unit of ['mod', 'pt']) {
                    const button = this.dom[unit === 'mod' ? control.modButton : control.ptButton];
                    button?.addEventListener('click', event => {
                        event.preventDefault();
                        const setting = property === 'size' ? 'fontSizeUnit' : 'lineHeightUnit';
                        if ((this.settings.get(setting) || 'mod') !== unit) {
                            this.switchUnit(style, property, unit);
                        }
                    });
                }
            }
        }
    }

    switchUnit(style, property, unit) {
        const control = CONTROL_CONFIG[style]?.[property];
        if (!control || !['mod', 'pt'].includes(unit)) return false;

        this.beginAction(`switch ${style} ${property} unit`);
        this.markChanged();
        this.settings.set(property === 'size' ? 'fontSizeUnit' : 'lineHeightUnit', unit);
        this.syncButtons();
        this.syncSliders(property);
        this.commitAction();
        return true;
    }

    sync() {
        this.syncButtons();
        this.syncSliders();
    }

    syncButtons(source = null) {
        const sizeUnit = source?.fontSizeUnit || this.settings.get('fontSizeUnit') || 'mod';
        const lineHeightUnit = source?.lineHeightUnit || this.settings.get('lineHeightUnit') || 'mod';

        for (const config of Object.values(CONTROL_CONFIG)) {
            this.setButtonPair(config.size, sizeUnit);
            this.setButtonPair(config.lineHeight, lineHeightUnit);
        }
    }

    setButtonPair(control, unit) {
        const modButton = this.dom[control.modButton];
        const ptButton = this.dom[control.ptButton];
        modButton?.classList.toggle('active', unit === 'mod');
        ptButton?.classList.toggle('active', unit === 'pt');
    }

    syncSliders(propertyFilter = null) {
        if (!this.sliderController) return;

        for (const [style, config] of Object.entries(CONTROL_CONFIG)) {
            for (const property of ['size', 'lineHeight']) {
                if (propertyFilter && property !== propertyFilter) continue;
                const control = config[property];
                const valueInModules = this.settings.get(control.setting);
                const unit = this.settings.get(
                    property === 'size' ? 'fontSizeUnit' : 'lineHeightUnit'
                ) || 'mod';

                if (unit === 'pt') {
                    const valueInPt = MathUtils.mmToPt(this.getValueInMm(style, property));
                    this.sliderController.updateLimits(control.slider, 0, 500);
                    this.sliderController.setValue(
                        control.slider,
                        parseFloat(valueInPt.toFixed(2)),
                        false
                    );
                } else {
                    this.sliderController.resetLimits(control.slider);
                    this.sliderController.setValue(
                        control.slider,
                        parseFloat(valueInModules.toFixed(2)),
                        false
                    );
                }
            }
        }
    }

    getValueInMm(style, property) {
        if (property === 'size') return this.styleResolver.calculateFontSize(style);
        const control = CONTROL_CONFIG[style].lineHeight;
        return this.settings.get(control.setting) * this.settings.get('gridModule');
    }

    updateDisplays() {
        for (const [style, config] of Object.entries(CONTROL_CONFIG)) {
            const element = this.dom[config.display];
            if (!element) continue;
            const fontSize = this.roundPt(this.styleResolver.calculateFontSize(style));
            const lineHeight = this.roundPt(this.getValueInMm(style, 'lineHeight'));
            element.textContent = `${fontSize}/${lineHeight} pt`;
        }
    }

    roundPt(valueInMm) {
        return Math.round(MathUtils.mmToPt(valueInMm) * 10) / 10;
    }
}
