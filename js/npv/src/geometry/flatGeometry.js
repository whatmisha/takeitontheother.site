export const FLAT_ARTBOARD_WIDTH = 960;
export const FLAT_ARTBOARD_HEIGHT = 540;
export const FLAT_ARTBOARD_CENTER_X = FLAT_ARTBOARD_WIDTH / 2;
export const FLAT_ARTBOARD_CENTER_Y = FLAT_ARTBOARD_HEIGHT / 2;
export const FLAT_ARTBOARD_MIN_SIZE = 80;
export const FLAT_ARTBOARD_MAX_SIZE = 1920;

const EPSILON = 1e-7;
const PERSON_HEAD_ROW_PARITY = 0;
const PERSON_REFERENCE_BASE_RADIUS = 4.19383;
const PERSON_HEAD_RADIUS_RATIO = 8.88839 / PERSON_REFERENCE_BASE_RADIUS;
const PERSON_SHOULDER_RX_RATIO = 14.8358 / PERSON_REFERENCE_BASE_RADIUS;
const PERSON_SHOULDER_RY_RATIO = 8.47758 / PERSON_REFERENCE_BASE_RADIUS;
const PERSON_PAIR_DISTANCE_RATIO = (246.523 - 228.386) / (PERSON_REFERENCE_BASE_RADIUS * 2);
const PERSON_PAIR_CENTER_SHIFT_RATIO = (
    (228.386 + 246.523) / 2 - (227.885 + 250.952) / 2
) / (PERSON_REFERENCE_BASE_RADIUS * 2);
const PERSON_ICON_CLEARANCE = 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function defaultFlatSettings() {
    return {
        width: FLAT_ARTBOARD_WIDTH,
        height: FLAT_ARTBOARD_HEIGHT,
        mode: 'basic',
        distribution: 'grid',
        ellipseWidth: 8.4,
        ellipseHeight: 8.4,
        spacingX: 23.1,
        spacingY: 23.1,
        stagger: 50,
        basicScale: 215,
        personIconScale: 100,
        personMinimumScale: 48,
        fieldRadius: 78,
        falloffCurve: 0,
        fieldX: 0,
        fieldY: 0,
        coordinateSpace: 'center',
        fieldFollow: true,
        showField: false,
        staticFields: [],
        ellipseColor: '#d9d9d9',
        backgroundColor: '#000000'
    };
}

export function normalizeFlatSettings(source = {}) {
    const defaults = defaultFlatSettings();
    const settings = { ...defaults, ...source };
    settings.width = Math.round(clamp(
        finiteOr(settings.width, defaults.width),
        FLAT_ARTBOARD_MIN_SIZE,
        FLAT_ARTBOARD_MAX_SIZE
    ));
    settings.height = Math.round(clamp(
        finiteOr(settings.height, defaults.height),
        FLAT_ARTBOARD_MIN_SIZE,
        FLAT_ARTBOARD_MAX_SIZE
    ));
    settings.mode = settings.mode === 'basic' ? 'basic' : 'person';
    settings.distribution = settings.distribution === 'paired' ? 'paired' : 'grid';
    delete settings.columns;
    delete settings.rows;
    settings.ellipseWidth = clamp(finiteOr(settings.ellipseWidth, defaults.ellipseWidth), 1, 120);
    settings.ellipseHeight = clamp(finiteOr(settings.ellipseHeight, defaults.ellipseHeight), 1, 120);
    const migratedSpacingX = source.spacingX == null && source.gapX != null
        ? finiteOr(source.gapX, 14.7) + settings.ellipseWidth
        : settings.spacingX;
    const migratedSpacingY = source.spacingY == null && source.gapY != null
        ? finiteOr(source.gapY, 14.7) + settings.ellipseHeight
        : settings.spacingY;
    settings.spacingX = clamp(finiteOr(migratedSpacingX, defaults.spacingX), 1, 160);
    settings.spacingY = clamp(finiteOr(migratedSpacingY, defaults.spacingY), 1, 160);
    settings.stagger = clamp(finiteOr(settings.stagger, defaults.stagger), 0, 100);
    settings.basicScale = clamp(finiteOr(settings.basicScale, defaults.basicScale), 25, 600);
    settings.personIconScale = clamp(
        finiteOr(settings.personIconScale, defaults.personIconScale),
        100,
        400
    );
    settings.personMinimumScale = clamp(
        finiteOr(settings.personMinimumScale, defaults.personMinimumScale),
        10,
        100
    );
    delete settings.personScale;
    settings.fieldRadius = clamp(finiteOr(settings.fieldRadius, defaults.fieldRadius), 5, 240);
    settings.falloffCurve = clamp(finiteOr(settings.falloffCurve, defaults.falloffCurve), -100, 100);
    const legacyCoordinates = source.coordinateSpace !== 'center';
    const coordinateLimit = FLAT_ARTBOARD_MAX_SIZE / 2;
    const legacyOffsetX = legacyCoordinates && source.fieldX != null ? settings.width / 2 : 0;
    const legacyOffsetY = legacyCoordinates && source.fieldY != null ? settings.height / 2 : 0;
    settings.fieldX = clamp(
        finiteOr(source.fieldX, defaults.fieldX) - legacyOffsetX,
        -coordinateLimit,
        coordinateLimit
    );
    settings.fieldY = clamp(
        finiteOr(source.fieldY, defaults.fieldY) - legacyOffsetY,
        -coordinateLimit,
        coordinateLimit
    );
    settings.coordinateSpace = 'center';
    settings.fieldFollow = Boolean(settings.fieldFollow);
    settings.showField = Boolean(settings.showField);
    settings.staticFields = Array.isArray(settings.staticFields)
        ? settings.staticFields.slice(0, 100).map((field, index) => ({
            id: String(field?.id || `point-${index + 1}`),
            x: clamp(
                finiteOr(field?.x, defaults.fieldX) - (legacyCoordinates ? settings.width / 2 : 0),
                -coordinateLimit,
                coordinateLimit
            ),
            y: clamp(
                finiteOr(field?.y, defaults.fieldY) - (legacyCoordinates ? settings.height / 2 : 0),
                -coordinateLimit,
                coordinateLimit
            ),
            enabled: field?.enabled !== false,
            mode: field?.mode === 'person' ? 'person' : field?.mode === 'basic' ? 'basic' : settings.mode,
            radius: clamp(finiteOr(field?.radius, settings.fieldRadius), 5, 240),
            falloffCurve: clamp(finiteOr(field?.falloffCurve, settings.falloffCurve), -100, 100),
            basicScale: clamp(finiteOr(field?.basicScale, settings.basicScale), 25, 600),
            personIconScale: clamp(
                finiteOr(field?.personIconScale, settings.personIconScale),
                100,
                400
            ),
            personMinimumScale: clamp(
                finiteOr(field?.personMinimumScale, settings.personMinimumScale),
                10,
                100
            )
        }))
        : [];
    settings.ellipseColor = /^#[0-9a-f]{6}$/i.test(settings.ellipseColor)
        ? settings.ellipseColor.toLowerCase()
        : defaults.ellipseColor;
    settings.backgroundColor = /^#[0-9a-f]{6}$/i.test(settings.backgroundColor)
        ? settings.backgroundColor.toLowerCase()
        : defaults.backgroundColor;
    return settings;
}

function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
}

function pairedBandForRow(row) {
    return Math.floor((row - PERSON_HEAD_ROW_PARITY) / 2);
}

function centeredIndexRange(size, pitch) {
    const halfCellCount = size / (2 * pitch);
    return {
        min: Math.ceil(-halfCellCount - 0.5 + EPSILON),
        max: Math.floor(halfCellCount + 0.5 - EPSILON)
    };
}

export function buildFlatLayout(rawSettings = {}) {
    const settings = normalizeFlatSettings(rawSettings);
    const pitchX = settings.spacingX;
    const pitchY = settings.spacingY;
    const columns = centeredIndexRange(settings.width, pitchX);
    const rows = centeredIndexRange(settings.height, pitchY);
    const columnIndices = Array.from(
        { length: columns.max - columns.min + 1 },
        (_, index) => columns.min + index
    );
    const rowIndices = Array.from(
        { length: rows.max - rows.min + 1 },
        (_, index) => rows.min + index
    );
    const columnCount = columnIndices.length;
    const rowCount = rowIndices.length;
    const staggerDistance = pitchX * settings.stagger / 100;
    const elements = [];

    rowIndices.forEach((row) => {
        const band = pairedBandForRow(row);
        const rowShift = settings.distribution === 'paired'
            ? (band % 2 ? 0.5 : -0.5) * staggerDistance
            : 0;
        columnIndices.forEach((column) => {
            const worldX = column * pitchX + rowShift;
            const worldY = row * pitchY;
            elements.push({
                id: `${row}:${column}`,
                row,
                column,
                band,
                worldX,
                worldY,
                cx: settings.width / 2 + worldX,
                cy: settings.height / 2 + worldY,
                rx: settings.ellipseWidth / 2,
                ry: settings.ellipseHeight / 2
            });
        });
    });

    const elementById = new Map(elements.map((element) => [element.id, element]));
    return {
        settings,
        pitchX,
        pitchY,
        columnCount,
        rowCount,
        columnIndices,
        rowIndices,
        elementById,
        elements
    };
}

export function flatFalloff(distance, radius, curve = 0) {
    const linear = clamp(1 - distance / Math.max(EPSILON, radius), 0, 1);
    const amount = clamp(Number(curve) || 0, -100, 100) / 100;
    if (amount >= 0) return linear ** (1 + amount * 3);
    return 1 - (1 - linear) ** (1 + -amount * 3);
}

function closestPersonPair(layout, target) {
    let closest = null;
    layout.rowIndices.forEach((headRow) => {
        if (positiveModulo(headRow, 2) !== PERSON_HEAD_ROW_PARITY) return;
        const shoulderRow = headRow + 1;
        if (!layout.rowIndices.includes(shoulderRow)) return;
        layout.columnIndices.forEach((column) => {
            const head = layout.elementById.get(`${headRow}:${column}`);
            const shoulders = layout.elementById.get(`${shoulderRow}:${column}`);
            if (!head || !shoulders) return;
            const x = (head.cx + shoulders.cx) / 2;
            const y = head.cy;
            const distance = Math.hypot(target.x - x, target.y - y);
            if (!closest || distance < closest.distance) {
                closest = { head, shoulders, x, y, distance };
            }
        });
    });
    return closest;
}

function strongestInfluence(values) {
    return values.reduce((strongest, value) => Math.max(strongest, clamp(value, 0, 1)), 0);
}

function strongestDelta(values) {
    return values.reduce(
        (strongest, value) => Math.abs(value) > Math.abs(strongest) ? value : strongest,
        0
    );
}

function activeFields(settings, transientField) {
    const coordinateLimit = FLAT_ARTBOARD_MAX_SIZE / 2;
    const project = (field) => {
        const coordinateX = clamp(finiteOr(field.x, settings.fieldX), -coordinateLimit, coordinateLimit);
        const coordinateY = clamp(finiteOr(field.y, settings.fieldY), -coordinateLimit, coordinateLimit);
        return {
            ...field,
            coordinateX,
            coordinateY,
            x: settings.width / 2 + coordinateX,
            y: settings.height / 2 + coordinateY
        };
    };
    const primary = {
        id: 'cursor',
        kind: settings.fieldFollow ? 'cursor' : 'manual',
        x: finiteOr(transientField?.x, settings.fieldX),
        y: finiteOr(transientField?.y, settings.fieldY),
        mode: settings.mode,
        radius: settings.fieldRadius,
        falloffCurve: settings.falloffCurve,
        basicScale: settings.basicScale,
        personIconScale: settings.personIconScale,
        personMinimumScale: settings.personMinimumScale
    };
    const pinned = settings.staticFields
        .filter((field) => field.enabled)
        .map((field) => project({ ...field, kind: 'static' }));
    return [project(primary), ...pinned];
}

function buildBasicElements(layout, fields) {
    return layout.elements.map((source) => {
        const delta = strongestDelta(fields.map((field) => (
            (field.basicScale / 100 - 1) * flatFalloff(
                Math.hypot(source.cx - field.x, source.cy - field.y),
                field.radius,
                field.falloffCurve
            )
        )));
        const influence = strongestInfluence(fields.map((field) => flatFalloff(
            Math.hypot(source.cx - field.x, source.cy - field.y),
            field.radius,
            field.falloffCurve
        )));
        const scale = 1 + delta;
        return { ...source, rx: source.rx * scale, ry: source.ry * scale, influence, role: 'dot' };
    });
}

function referencePersonShapes(pair, baseDiameter, iconScale) {
    const baseRadius = baseDiameter / 2;
    const pairCenterY = pair.y + baseDiameter * PERSON_PAIR_CENTER_SHIFT_RATIO * iconScale;
    const pairDistance = baseDiameter * PERSON_PAIR_DISTANCE_RATIO * iconScale;
    return {
        head: {
            ...pair.head,
            cy: pairCenterY - pairDistance / 2,
            rx: baseRadius * PERSON_HEAD_RADIUS_RATIO * iconScale,
            ry: baseRadius * PERSON_HEAD_RADIUS_RATIO * iconScale
        },
        shoulders: {
            ...pair.shoulders,
            cy: pairCenterY + pairDistance / 2,
            rx: baseRadius * PERSON_SHOULDER_RX_RATIO * iconScale,
            ry: baseRadius * PERSON_SHOULDER_RY_RATIO * iconScale
        }
    };
}

function ellipseSupportInDirection(ellipse, dx, dy) {
    const distance = Math.hypot(dx, dy);
    if (distance < EPSILON || ellipse.rx < EPSILON || ellipse.ry < EPSILON) return 0;
    const nx = dx / distance;
    const ny = dy / distance;
    return Math.hypot(ellipse.rx * nx, ellipse.ry * ny);
}

function nonContactScale(source, shape) {
    const dx = source.cx - shape.cx;
    const dy = source.cy - shape.cy;
    const distance = Math.hypot(dx, dy);
    if (distance < EPSILON) return 0;
    const shapeRadius = ellipseSupportInDirection(shape, dx, dy);
    const sourceRadius = ellipseSupportInDirection(source, dx, dy);
    if (sourceRadius < EPSILON) return 0;
    return clamp((distance - shapeRadius - PERSON_ICON_CLEARANCE) / sourceRadius, 0, 1);
}

function buildPersonElements(layout, fields) {
    const { settings } = layout;
    const baseDiameter = Math.sqrt(settings.ellipseWidth * settings.ellipseHeight);
    const pairedFields = fields.map((field) => {
        const pair = closestPersonPair(layout, field);
        if (!pair) return null;
        const shapes = referencePersonShapes(pair, baseDiameter, field.personIconScale / 100);
        return {
            ...field,
            x: pair.x,
            y: pair.y,
            requestedX: field.x,
            requestedY: field.y,
            pair,
            head: shapes.head,
            shoulders: shapes.shoulders
        };
    }).filter(Boolean);
    if (!pairedFields.length) return { elements: layout.elements, fields: [] };

    const uniquePairs = [...new Map(pairedFields.map((field) => [field.pair.head.id, field])).values()];
    const headTargets = new Map(uniquePairs.map((field) => [field.head.id, field.head]));
    const shoulderTargets = new Map(uniquePairs.map((field) => [field.shoulders.id, field.shoulders]));

    const elements = layout.elements.map((source) => {
        if (headTargets.has(source.id)) {
            return { ...headTargets.get(source.id), influence: 1, role: 'head' };
        }
        if (shoulderTargets.has(source.id)) {
            return { ...shoulderTargets.get(source.id), influence: 1, role: 'shoulders' };
        }

        const candidates = pairedFields.map((field) => {
            const influence = flatFalloff(
                Math.hypot(source.cx - field.x, source.cy - field.y),
                field.radius,
                field.falloffCurve
            );
            const minimumScale = field.personMinimumScale / 100;
            const exclusionScale = Math.min(
                nonContactScale(source, field.head),
                nonContactScale(source, field.shoulders)
            );
            return {
                scale: Math.min(1 - (1 - minimumScale) * influence, exclusionScale),
                influence: Math.max(influence, 1 - exclusionScale)
            };
        });
        const strongest = candidates.reduce(
            (current, candidate) => candidate.scale < current.scale ? candidate : current,
            { scale: 1, influence: 0 }
        );
        return {
            ...source,
            rx: source.rx * strongest.scale,
            ry: source.ry * strongest.scale,
            influence: strongest.influence,
            role: 'neighbor'
        };
    });

    return { elements, fields: pairedFields };
}

export function buildFlatScene(rawSettings = {}, options = {}) {
    const layout = buildFlatLayout(rawSettings);
    const settings = layout.settings;
    const fields = activeFields(settings, options.transientField);
    const basicFields = fields.filter((field) => field.mode === 'basic');
    const personFields = fields.filter((field) => field.mode === 'person');
    const basicElements = buildBasicElements(layout, basicFields);
    const person = buildPersonElements({ ...layout, elements: basicElements }, personFields);
    const basicGuides = basicFields.map((field) => ({
        ...field,
        requestedX: field.x,
        requestedY: field.y
    }));
    const guideById = new Map([...basicGuides, ...person.fields].map((field) => [field.id, field]));
    const guideFields = fields.map((field) => guideById.get(field.id)).filter(Boolean);
    return {
        width: settings.width,
        height: settings.height,
        settings,
        pitchX: layout.pitchX,
        pitchY: layout.pitchY,
        elements: person.elements,
        field: guideFields[0],
        fields: guideFields
    };
}
