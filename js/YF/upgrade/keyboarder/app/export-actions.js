/** UI feedback only; keyboard geometry, clean-export guards and file formats stay private. */
export function bindKeyboarderExportActions({ app, ExportFeedbackController, exportJSON, ownerDocument = document }) {
    const bindings = [];
    const actions = [
        ['exportSvgBtn', 'SVG', () => app.exportSVG()],
        ['exportPngBtn', 'PNG', () => app.exportPNG()],
        ['exportPdfBtn', 'PDF', () => app.exportPDF()],
        ['exportJsonBtn', 'JSON', () => exportJSON(app)]
    ];
    for (const [id, format, operation] of actions) {
        const button = ownerDocument.getElementById(id);
        if (!button) continue;
        const feedback = new ExportFeedbackController({
            button, status: ownerDocument.getElementById(`${id}Status`)
        });
        const listener = () => feedback.run(async () => {
            let reported = false;
            try {
                if (format !== 'JSON' && (!app.exporter || !app.target)) {
                    throw new Error('The exporter is not ready yet.');
                }
                const result = await operation();
                if (result?.ok === false) {
                    reported = result.reported === true;
                    throw new Error(result.error || `Could not export ${format}.`);
                }
                // PDF has an explicit result contract. SVG/PNG finish after download initiation.
                if (format === 'PDF' && result?.ok !== true) {
                    throw new Error('No PDF was produced.');
                }
                return result;
            } catch (error) {
                if (!reported) app.dialog?.alert({
                    title: `${format} export failed`, text: error.message || String(error), okText: 'Close'
                });
                throw error;
            }
        });
        button.addEventListener('click', listener);
        bindings.push({ button, feedback, listener });
    }
    return {
        destroy() {
            for (const { button, feedback, listener } of bindings) {
                button.removeEventListener('click', listener);
                feedback.destroy();
            }
        }
    };
}
