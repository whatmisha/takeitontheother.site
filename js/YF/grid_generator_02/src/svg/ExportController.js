/** Coordinates SVG, PDF and JSON export actions and their shared filenames. */
export class ExportController {
    constructor(host, { now = () => new Date() } = {}) {
        this.host = host;
        this.now = now;
    }

    static formatTimestamp(date) {
        const year = String(date.getFullYear()).slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}${month}${day}_${hours}${minutes}`;
    }

    static buildFilename({ settings, presetName = 'Custom', extension, date }) {
        const parts = [];
        if (
            !/^\+\s*New/i.test(presetName) &&
            presetName !== 'Custom' &&
            !/^Custom\s+—\s*/i.test(presetName)
        ) {
            parts.push(presetName.replace(/\s+/g, '_'));
        }

        parts.push(settings.showSidePanels
            ? `${settings.frontWidth}×${settings.frontHeight}×${settings.thickness}`
            : `${settings.frontWidth}×${settings.frontHeight}`
        );
        const marginsInMm = settings.margins * settings.gridModule;
        parts.push(
            `${settings.columnCount}col_${settings.rowCount}rows_` +
            `module_${settings.gridModule.toFixed(2)}mm_` +
            `margins_${marginsInMm.toFixed(2)}mm`
        );
        parts.push(ExportController.formatTimestamp(date));
        return `${parts.join('_')}.${extension}`;
    }

    filename(extension, date = this.now()) {
        return ExportController.buildFilename({
            settings: this.host.settingsModule.getAll(),
            presetName: this.host.currentPresetName || 'Custom',
            extension,
            date
        });
    }

    async exportSvg() {
        const svg = await this.host.exportDocumentBuilder.build();
        const convertTextToOutlines = Boolean(
            this.host.dom.convertToOutlinesCheckbox?.checked
        );
        await this.host.svgExporter.exportToFile(svg, this.filename('svg'), {
            removeInteractive: true,
            optimizeSize: true,
            convertTextToOutlines
        });
    }

    async exportPdf() {
        const svg = await this.host.exportDocumentBuilder.build(false);
        try {
            await this.host.svgExporter.exportToPDF(svg, this.filename('pdf'), {
                removeInteractive: true,
                convertTextToOutlines: true,
                unit: 'mm'
            });
        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.host.errorPresenter?.show(error, { title: 'PDF export failed' });
            return false;
        }
        return true;
    }

    exportSettings() {
        const host = this.host;
        const data = {
            version: '1.2',
            timestamp: this.now().toISOString(),
            settings: host.settingsModule.getAll(),
            textBlocks: host.objectDocument.textBlocks,
            graphicsBlocks: host.objectDocument.graphicsBlocks,
            currentPresetName: host.currentPresetName || 'Custom'
        };
        host.svgExporter.exportSettings(data, this.filename('json'));
        host.onSettingsExported?.(data);
        return data;
    }
}
