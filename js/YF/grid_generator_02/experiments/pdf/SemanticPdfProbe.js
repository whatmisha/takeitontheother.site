const PT_PER_MM = 72 / 25.4;
export const mm = value => value * PT_PER_MM;
export const paragraphsOf = text => text.replace(/\r\n?/gu, '\n').split('\n');

// Research writer, deliberately separate from production SVG/PDF export.
// Tagged PDF classes describe layout; they are NOT Illustrator style definitions.
export async function generateProbe({ PDFDocument, toBytes, fonts, model, tagged = true }) {
    const pdf = new PDFDocument({
        autoFirstPage: false, font: null, margin: 0, pdfVersion: '1.7', tagged,
        lang: 'ru-RU', compress: false,
        info: { Title: model.title, Creator: 'Pizza Boxer 02 / browser PDF probe',
            CreationDate: new Date('2026-09-28T00:00:00Z') }
    });
    for (const [id, font] of Object.entries(fonts)) pdf.registerFont(id, font);
    const root = tagged ? pdf.struct('Document') : null;
    if (root) {
        pdf.addStructure(root);
        // PDFKit has no public ClassMap helper. This PDF dictionary is isolated
        // here and checked by the structural inspector against the pinned version.
        pdf.getStructTreeRoot().data.ClassMap = Object.fromEntries(
            Object.entries(model.styles).map(([id, style]) => [id,
                { O: 'Layout', LineHeight: style.leading, SpaceBefore: 0, SpaceAfter: 0 }])
        );
    }
    const output = toBytes(pdf);
    // Attach a handler immediately, including when synchronous layout fails.
    output.catch(() => {});
    const report = [];
    for (const [pageIndex, page] of model.pages.entries()) {
        pdf.addPage({ size: [mm(page.width), mm(page.height)], margin: 0 });
        const section = tagged ? pdf.struct('Sect', { title: `Page ${pageIndex + 1}` }) : null;
        if (root) root.add(section);
        for (const frame of page.frames) {
            const style = model.styles[frame.style];
            if (!style || !fonts[style.font]) throw new Error(`Unknown style/font in ${frame.id}`);
            pdf.font(style.font).fontSize(style.size).fillColor('#111111');
            const options = { width: mm(frame.width), align: frame.align || 'left',
                characterSpacing: (style.tracking || 0) * style.size,
                lineGap: style.leading - pdf.currentLineHeight(true),
                features: { ...(style.features || { liga: false }) }, paragraphGap: 0 };
            const paragraphs = paragraphsOf(frame.text);
            const layout = [];
            let usedHeight = 0;
            for (const paragraph of paragraphs) {
                // U+2028 is a forced line break, not a new semantic paragraph.
                const printable = paragraph.replace(/\u2028/gu, '\n');
                const height = printable ? pdf.heightOfString(printable, options) : style.leading;
                layout.push({ paragraph, printable, height, y: usedHeight });
                usedHeight += height;
            }
            if (usedHeight > mm(frame.height) + 0.1) {
                throw new Error(`Text overflows ${frame.id}: ${usedHeight.toFixed(2)} pt / ${mm(frame.height).toFixed(2)} pt`);
            }
            pdf.save().translate(mm(frame.x), mm(frame.y)).rotate(frame.rotation || 0);
            if (frame.border) {
                if (tagged) pdf.markContent('Artifact');
                pdf.lineWidth(0.4).strokeColor('#999999').rect(0, 0, mm(frame.width), mm(frame.height)).stroke();
                if (tagged) pdf.endMarkedContent();
            }
            const angle = (frame.rotation || 0) * Math.PI / 180;
            const corners = [[0, 0], [frame.width, 0], [0, frame.height], [frame.width, frame.height]]
                .map(([x, y]) => [frame.x + x * Math.cos(angle) - y * Math.sin(angle),
                    frame.y + x * Math.sin(angle) + y * Math.cos(angle)]);
            const bbox = [Math.min(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1])),
                Math.max(...corners.map(p => p[0])), Math.max(...corners.map(p => p[1]))].map(mm);
            const group = tagged ? pdf.struct('Div', { title: `${frame.id} / ${style.name}`, bbox }) : null;
            if (section) section.add(group);
            for (const item of layout) {
                let element;
                if (tagged) {
                    element = pdf.struct('P', { title: style.name, actual: item.paragraph });
                    element.dictionary.data.C = frame.style;
                    group.add(element);
                    element.add(pdf.markStructureContent('P', { actual: item.paragraph }));
                }
                // Empty paragraphs have a structure node and reserve one full line.
                if (item.printable) pdf.text(item.printable, 0, item.y, options);
                if (tagged) { pdf.endMarkedContent(); element.end(); }
            }
            if (group) group.end();
            pdf.restore();
            report.push({ page: pageIndex + 1, id: frame.id, style: style.name,
                paragraphs: paragraphs.length, emptyParagraphs: paragraphs.filter(p => !p).length,
                usedHeightPt: usedHeight, rotation: frame.rotation || 0 });
        }
        if (page.ruler) {
            if (tagged) pdf.markContent('Artifact');
            pdf.save().strokeColor('#111111').lineWidth(0.5)
                .moveTo(mm(18), mm(237)).lineTo(mm(118), mm(237))
                .moveTo(mm(18), mm(235)).lineTo(mm(18), mm(239))
                .moveTo(mm(118), mm(235)).lineTo(mm(118), mm(239)).stroke()
                .rect(mm(160), mm(228), mm(20), mm(15)).stroke().restore();
            if (tagged) pdf.endMarkedContent();
        }
        if (section) section.end();
    }
    if (root) root.end();
    pdf.end();
    return { bytes: await output, report };
}
