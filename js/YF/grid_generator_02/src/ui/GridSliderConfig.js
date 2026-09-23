import { getSlidersByGroup } from '../config/SliderConfig.js';

const GRID_SLIDER_IDS = new Set([
    'frontWidthSlider',
    'frontHeightSlider',
    'thicknessSlider',
    'gridModuleSlider',
    'marginsSlider',
    'columnCountSlider',
    'rowCountSlider',
    'rowHeightSlider'
]);

export function createGridSliderConfigs(actions) {
    const definitions = {
        ...getSlidersByGroup('dimensions'),
        ...getSlidersByGroup('grid')
    };
    return {
        ...definitions,
        frontWidthSlider: {
            ...definitions.frontWidthSlider,
            onUpdate: () => actions.handleWidthChange()
        },
        frontHeightSlider: {
            ...definitions.frontHeightSlider,
            onUpdate: () => actions.handleVerticalGeometryChange(true)
        },
        thicknessSlider: {
            ...definitions.thicknessSlider,
            onUpdate: () => actions.handleThicknessChange()
        },
        gridModuleSlider: {
            ...definitions.gridModuleSlider,
            onUpdate: () => actions.handleModuleChange()
        },
        marginsSlider: {
            ...definitions.marginsSlider,
            onUpdate: value => actions.handleMarginsChange(value)
        },
        columnCountSlider: {
            ...definitions.columnCountSlider,
            onUpdate: () => actions.handleColumnCountChange()
        },
        rowCountSlider: {
            ...definitions.rowCountSlider,
            onUpdate: () => actions.handleRowCountChange()
        },
        rowHeightSlider: {
            ...definitions.rowHeightSlider,
            onUpdate: () => actions.handleRowHeightChange()
        }
    };
}

export function isGridSlider(sliderId) {
    return GRID_SLIDER_IDS.has(sliderId);
}
