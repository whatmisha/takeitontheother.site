/**
 * PatternRenderer — SVG visualisation of a weave.
 *
 * IMPORTANT: this module contains NO weave formulas. It only knows how to draw a
 * ThreadModel (which exposes `warpOnTop(x, y)`). All structure lives in the
 * generators. The renderer is also surface-agnostic: it receives a `create(tag,
 * attrs)` factory and a `root` node to append into, so it never imports the DOM
 * directly and stays trivially swappable.
 *
 * Two view modes:
 *   'grid'    — schematic draft: one flat coloured square per crossing.
 *   'threads' — woven look: warp/weft bands with correct over/under occlusion.
 *
 * Seamless repeat: the model is tiled `tileX \u00d7 tileY` times; because every tile
 * is the same rapport and indices wrap, floats join continuously across borders.
 */

const DEFAULTS = {
    viewMode: 'threads',
    tileX: 3,
    tileY: 3,
    width: 600,
    height: 600,
    warpColor: '#d8c9a3',
    weftColor: '#6f4e37',
    bg: '#0a0a0a',
    gridColor: '#3a3a3a',
    threadFrac: 0.82, // fraction of a cell occupied by a thread (rest is spacing)
    showGrid: false,
    label: '',
    labelColor: '#d2d2d2',
    fontFamily: "'TT Commons Classic', sans-serif"
};

/**
 * @param {Object} params
 * @param {import('./ThreadModel.js').ThreadModel} params.model
 * @param {(tag:string, attrs?:Object) => Element} params.create
 * @param {Element} params.root  node to append generated elements into
 * @param {Object} [params.options]
 */
export function renderWeave({ model, create, root, options = {} }) {
    const o = { ...DEFAULTS, ...options };
    const totalCols = Math.max(1, model.cols * o.tileX);
    const totalRows = Math.max(1, model.rows * o.tileY);
    const cw = o.width / totalCols;
    const ch = o.height / totalRows;

    root.appendChild(create('rect', { x: 0, y: 0, width: o.width, height: o.height, fill: o.bg }));

    if (o.viewMode === 'grid') {
        drawSchematic(model, create, root, o, totalCols, totalRows, cw, ch);
    } else {
        drawThreads(model, create, root, o, totalCols, totalRows, cw, ch);
    }

    if (o.showGrid) drawGridLines(create, root, o, totalCols, totalRows, cw, ch);
    if (o.label) drawLabel(create, root, o);
}

/* ----------------------------- view: schematic ----------------------------- */

function drawSchematic(model, create, root, o, totalCols, totalRows, cw, ch) {
    for (let gy = 0; gy < totalRows; gy++) {
        for (let gx = 0; gx < totalCols; gx++) {
            const warp = model.warpOnTop(gx, gy);
            root.appendChild(create('rect', {
                x: gx * cw,
                y: gy * ch,
                width: cw + 0.5, // hairline overlap kills sub-pixel seams
                height: ch + 0.5,
                fill: warp ? o.warpColor : o.weftColor
            }));
        }
    }
}

/* ------------------------------ view: threads ------------------------------ */

function drawThreads(model, create, root, o, totalCols, totalRows, cw, ch) {
    const warpW = cw * o.threadFrac;
    const weftH = ch * o.threadFrac;
    const warpX = (gx) => gx * cw + (cw - warpW) / 2;
    const weftY = (gy) => gy * ch + (ch - weftH) / 2;
    const rx = Math.min(warpW, weftH) * 0.18;
    // Bleed makes consecutive same-direction crossings merge into one float.
    const bleedV = ch * (1 - o.threadFrac) / 2 + 0.5;
    const bleedH = cw * (1 - o.threadFrac) / 2 + 0.5;

    for (let gy = 0; gy < totalRows; gy++) {
        for (let gx = 0; gx < totalCols; gx++) {
            const warpTop = model.warpOnTop(gx, gy);

            const weft = () => create('rect', {
                x: gx * cw - bleedH, y: weftY(gy),
                width: cw + bleedH * 2, height: weftH,
                rx, ry: rx, fill: o.weftColor
            });
            const warp = () => create('rect', {
                x: warpX(gx), y: gy * ch - bleedV,
                width: warpW, height: ch + bleedV * 2,
                rx, ry: rx, fill: o.warpColor
            });

            // Bottom thread first, face thread last (painter's occlusion).
            if (warpTop) {
                root.appendChild(weft());
                root.appendChild(warp());
            } else {
                root.appendChild(warp());
                root.appendChild(weft());
            }
        }
    }
}

/* ------------------------------- decorations ------------------------------- */

function drawGridLines(create, root, o, totalCols, totalRows, cw, ch) {
    for (let c = 0; c <= totalCols; c++) {
        root.appendChild(create('line', {
            x1: c * cw, y1: 0, x2: c * cw, y2: o.height,
            stroke: o.gridColor, 'stroke-width': 1, opacity: 0.5
        }));
    }
    for (let r = 0; r <= totalRows; r++) {
        root.appendChild(create('line', {
            x1: 0, y1: r * ch, x2: o.width, y2: r * ch,
            stroke: o.gridColor, 'stroke-width': 1, opacity: 0.5
        }));
    }
}

function drawLabel(create, root, o) {
    const pad = Math.max(10, o.width * 0.025);
    const fontSize = Math.max(12, Math.min(o.width, o.height) * 0.04);
    const text = create('text', {
        x: pad,
        y: o.height - pad,
        fill: o.labelColor,
        'font-family': o.fontFamily,
        'font-size': fontSize,
        'font-weight': 500,
        'letter-spacing': '0.04em'
    });
    text.textContent = o.label;
    root.appendChild(text);
}
