const FP_EPSILON = 1e-9;

/**
 * Calculates the grid values used by the editor controls and GridRenderer.
 *
 * The plane the master grid is measured against is injected rather than read
 * from settings, so the same calculator can serve a plane other than the root.
 */
export class GridCalculator {
    constructor(settings, { getPlaneSize } = {}) {
        this.settings = settings;
        this.getPlaneSize = getPlaneSize || (() => ({
            width: settings.get('frontWidth'),
            height: settings.get('frontHeight')
        }));
    }

    planeWidth() {
        return this.getPlaneSize().width;
    }

    planeHeight() {
        return this.getPlaneSize().height;
    }

    calculateRowCount() {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const rowHeight = this.settings.get('rowHeight');
        const availableHeight = this.planeHeight() - 2 * module * margins;
        const rowWithGutter = module * (rowHeight + 1);
        return Math.max(
            1,
            Math.floor((availableHeight + module) / rowWithGutter + FP_EPSILON)
        );
    }

    calculateRowHeight() {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const rowCount = this.settings.get('rowCount');
        const availableHeight = this.planeHeight() - 2 * module * margins;
        const availableModules = availableHeight / module;
        return Math.max(
            1,
            Math.floor((availableModules - rowCount + 1) / rowCount + FP_EPSILON)
        );
    }

    calculateModule() {
        const planeHeight = this.planeHeight();
        const rowCount = this.settings.get('rowCount');
        const rowHeight = this.settings.get('rowHeight');
        const totalContentModules = rowCount * rowHeight + rowCount - 1;

        if (
            this.settings.get('lockedMargins')
            && this.settings.get('lockedMarginsValue') !== null
            && totalContentModules > 0
        ) {
            return (
                planeHeight - 2 * this.settings.get('lockedMarginsValue')
            ) / totalContentModules;
        }

        const totalModules = 2 * this.settings.get('margins') + totalContentModules;
        return planeHeight / totalModules;
    }

    calculateMargins() {
        const planeHeight = this.planeHeight();
        const module = this.settings.get('gridModule');
        const rowCount = this.settings.get('rowCount');
        const rowHeight = this.settings.get('rowHeight');
        const contentHeight = module * (rowCount * rowHeight + rowCount - 1);
        const marginsInMm = (planeHeight - contentHeight) / 2;
        const marginsInModules = module > 0 ? marginsInMm / module : 0;
        return Math.max(0, parseFloat(marginsInModules.toFixed(4)));
    }

    findPerfectRowCombinations() {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const availableModules = (this.planeHeight() - 2 * module * margins) / module;
        const combinations = [];

        for (let rowHeight = 1; rowHeight <= 20; rowHeight++) {
            const rowCount = Math.floor(
                (availableModules + 1) / (rowHeight + 1) + FP_EPSILON
            );
            if (rowCount < 1) continue;

            const totalUsed = rowCount * rowHeight + rowCount - 1;
            const remaining = availableModules - totalUsed;
            if (remaining >= -FP_EPSILON && remaining < 1) {
                combinations.push({
                    rowCount,
                    rowHeight,
                    remaining: Math.max(0, remaining)
                });
            }
        }

        combinations.sort((a, b) => b.rowCount - a.rowCount);
        return combinations;
    }

    calculateColumnWidth() {
        const module = this.settings.get('gridModule');
        const margins = this.settings.get('margins');
        const columnCount = this.settings.get('columnCount');
        return (
            this.planeWidth()
            - module * margins * 2
            - module * (columnCount - 1)
        ) / columnCount;
    }
}
