import { defineTool } from './framework/src/core/defineTool.js?v=20260823-2';
import { PresetStore } from './framework/src/preset/PresetStore.js';
import {
    DEFAULT_GEOMETRY,
    buildCharacterGeometry
} from './src/geometry/characterGeometry.js?v=20260823-5';
import { buildEyeGeometry, buildEyeLidGeometry } from './src/geometry/eyeGeometry.js?v=20260823-2';
import { createSparkyExportBaseName } from './src/export/exportNaming.js';
import {
    advanceEyeMotion,
    createEyeMotionState,
    retargetEyeMotion,
    snapEyeMotion
} from './src/animation/eyeMotion.js';
import {
    advanceBlink,
    createBlinkState,
    resetBlink,
    triggerBlink
} from './src/animation/blink.js?v=20260822-6';
import { clamp } from './src/geometry/vector.js';
import {
    constrainFocusPoint,
    focusPointFromPolar,
    focusPointToPolar
} from './src/geometry/focusBounds.js?v=20260823-6';
import {
    COORDINATE_SPACE_VERSION,
    migrateCoordinateSpace
} from './src/geometry/coordinateSpace.js?v=20260823-2';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GUIDE_CLIP_ID = 'sparky-artboard-clip';
const HEAD_CLIP_ID = 'sparky-head-clip';
const MOBILE_SHOWCASE_QUERY = '(max-width: 768px), (hover: none) and (pointer: coarse)';
const DESKTOP_FIT_PADDING = 58;
const MOBILE_FIT_PADDING = 24;
const MOBILE_GRAPHIC_OFFSET_PX = 24;
const MOBILE_FOCUS_TAP_RESPONSE_MS = 135;
const MOBILE_FOCUS_SWIPE_RESPONSE_MS = 45;
const ARTBOARD_CROP_X = 0;
const ARTBOARD_CROP_Y = DEFAULT_GEOMETRY.boundaryCenterY - DEFAULT_GEOMETRY.boundaryRadius;
let mobileShowcaseFocus = null;
let desktopFollowFocus = null;

const settings = {
    coordinateSpaceVersion: COORDINATE_SPACE_VERSION,
    width: DEFAULT_GEOMETRY.artboardWidth,
    height: DEFAULT_GEOMETRY.artboardHeight,
    boundaryType: DEFAULT_GEOMETRY.boundaryType,
    boundaryCenterX: DEFAULT_GEOMETRY.boundaryCenterX,
    boundaryCenterY: DEFAULT_GEOMETRY.boundaryCenterY,
    boundaryRadius: DEFAULT_GEOMETRY.boundaryRadius,
    boundaryRadiusX: DEFAULT_GEOMETRY.boundaryRadiusX,
    boundaryRadiusY: DEFAULT_GEOMETRY.boundaryRadiusY,
    boundaryRotation: DEFAULT_GEOMETRY.boundaryRotation,
    focusX: DEFAULT_GEOMETRY.focusX,
    focusY: DEFAULT_GEOMETRY.focusY,
    focusAngle: 0,
    focusDistance: 0,
    rayCount: DEFAULT_GEOMETRY.rayCount,
    centerAngle: DEFAULT_GEOMETRY.centerAngle,
    angleStep: DEFAULT_GEOMETRY.angleStep,
    angleSpan: DEFAULT_GEOMETRY.angleSpan,
    rayLength: DEFAULT_GEOMETRY.rayLength,
    rayWidth: DEFAULT_GEOMETRY.rayWidth,
    roundness: DEFAULT_GEOMETRY.roundness,
    cornerSmoothing: 0,
    rayOverrides: [{}, {}, {}, {}, {}],
    headColor: '#ffffff',
    eyeColor: '#000000',
    backgroundColor: '#000000',
    showSphere: false,
    showRayGuides: false,
    showBisectors: false,
    showPoint: false,
    followCursor: true,
    eyePerspective: 50,
    eyeSize: 0,
    eyeDistance: -20,
    cute: 50,
    angry: 0
};

const STATE_KEYS = Object.freeze(Object.keys(settings));
const PERSISTED_STATE_KEYS = Object.freeze(
    STATE_KEYS.filter((key) => key !== 'focusX' && key !== 'focusY')
);

function extractState(source) {
    return Object.fromEntries(PERSISTED_STATE_KEYS.map((key) => [key, source[key]]));
}

function extractInternalState(source) {
    return Object.fromEntries(STATE_KEYS.map((key) => [key, source[key]]));
}

function normalizeIncomingState(source = {}) {
    const migrated = migrateCoordinateSpace(source);
    const normalized = { ...settings, ...migrated };
    if (migrated.showGuides != null) {
        if (migrated.showSphere == null) normalized.showSphere = Boolean(migrated.showGuides);
        if (migrated.showRayGuides == null) normalized.showRayGuides = Boolean(migrated.showGuides);
        if (migrated.showBisectors == null) normalized.showBisectors = Boolean(migrated.showGuides);
    }
    if (source.roundness == null && Number.isFinite(source.cornerRadius)) {
        normalized.roundness = clamp(source.cornerRadius * 6, 0, 100);
    }
    const hasPolarFocus = migrated.focusAngle != null
        && migrated.focusDistance != null
        && Number.isFinite(Number(migrated.focusAngle))
        && Number.isFinite(Number(migrated.focusDistance));
    if (hasPolarFocus) {
        const polar = normalizedPolar({
            angle: migrated.focusAngle,
            distance: migrated.focusDistance
        });
        const focus = normalizedFocus(focusPointFromPolar(polar, normalized), normalized);
        normalized.focusAngle = polar.angle;
        normalized.focusDistance = polar.distance;
        normalized.focusX = focus.x;
        normalized.focusY = focus.y;
    } else {
        const focus = normalizedFocus({ x: normalized.focusX, y: normalized.focusY }, normalized);
        const polar = normalizedPolar(focusPointToPolar(focus, normalized, normalized.focusAngle));
        normalized.focusAngle = polar.angle;
        normalized.focusDistance = polar.distance;
        normalized.focusX = focus.x;
        normalized.focusY = focus.y;
    }
    return extractInternalState(normalized);
}

function isMobileShowcase() {
    return window.matchMedia?.(MOBILE_SHOWCASE_QUERY).matches
        ?? window.innerWidth <= 768;
}

function activeRenderSettings(current) {
    if (isMobileShowcase()) {
        const focus = mobileShowcaseFocus || { x: settings.focusX, y: settings.focusY };
        return { ...settings, focusX: focus.x, focusY: focus.y };
    }
    const focus = current.followCursor ? desktopFollowFocus : null;
    if (!focus) return current;
    return { ...current, focusX: focus.x, focusY: focus.y };
}

function fitShowcaseToViewport(app, mobile = isMobileShowcase()) {
    const zoomPan = app.target?.zoomPan;
    if (!zoomPan) return;
    const padding = mobile ? MOBILE_FIT_PADDING : DESKTOP_FIT_PADDING;
    zoomPan.fitPadding = { top: padding, right: padding, bottom: padding, left: padding };
    app.target.fitToScreen();
    if (mobile) {
        zoomPan.panY += MOBILE_GRAPHIC_OFFSET_PX / zoomPan.zoom;
        zoomPan.updateTransform();
    }
}

function bindMobileShowcase(app) {
    const media = window.matchMedia?.(MOBILE_SHOWCASE_QUERY);
    let fitFrame = null;
    let wasMobile = false;
    const scheduleFit = (mobile) => {
        if (fitFrame != null) cancelAnimationFrame(fitFrame);
        fitFrame = requestAnimationFrame(() => {
            fitFrame = null;
            fitShowcaseToViewport(app, mobile);
        });
    };
    const syncMode = () => {
        const mobile = media?.matches ?? window.innerWidth <= 768;
        document.documentElement.classList.toggle('sparky-mobile-showcase', mobile);
        if (mobile && !wasMobile) {
            resetMobileFocusMotion({ x: settings.focusX, y: settings.focusY });
            stopBlink(app);
        } else if (!mobile && wasMobile) {
            cancelMobileFocusMotion();
            desktopFollowFocus = app.settings.followCursor
                ? { x: app.settings.focusX, y: app.settings.focusY }
                : null;
        }
        wasMobile = mobile;
        app.renderNow();
        snapDisplayedEyes(app);
        scheduleFit(mobile);
    };
    const refitMobile = () => {
        if (isMobileShowcase()) scheduleFit(true);
    };

    media?.addEventListener?.('change', syncMode);
    window.addEventListener('resize', refitMobile);
    window.visualViewport?.addEventListener('resize', refitMobile);
    syncMode();
}

function exportSettingsJSON(tool, filename) {
    const name = filename || `${createSparkyExportBaseName()}.json`;
    const snapshot = extractState(tool.settingsStore.toObject());
    return tool.exporter?.exportJSON(snapshot, name);
}

function setAttributes(element, attributes) {
    Object.entries(attributes).forEach(([name, value]) => {
        if (value != null) element.setAttribute(name, String(value));
    });
    return element;
}

function makeSvgElement(tag, attributes = {}) {
    return setAttributes(document.createElementNS(SVG_NS, tag), attributes);
}

function append(parent, ...children) {
    children.forEach((child) => parent.appendChild(child));
    return parent;
}

const eyeMotion = createEyeMotionState();
let eyeMotionFrame = null;
const mobileFocusMotion = createEyeMotionState(MOBILE_FOCUS_TAP_RESPONSE_MS);
let mobileFocusFrame = null;
let mobileFocusInMotion = false;
const blink = createBlinkState();
let blinkFrame = null;

function cancelMobileFocusMotion() {
    if (mobileFocusFrame != null) cancelAnimationFrame(mobileFocusFrame);
    mobileFocusFrame = null;
    mobileFocusMotion.lastTime = null;
    mobileFocusInMotion = false;
}

function resetMobileFocusMotion(focus) {
    cancelMobileFocusMotion();
    mobileShowcaseFocus = { ...focus };
    mobileFocusMotion.displayedCenter = { ...focus };
    mobileFocusMotion.targetCenter = { ...focus };
}

function settleMobileFocusMotion() {
    const target = mobileFocusMotion.targetCenter;
    cancelMobileFocusMotion();
    if (!target) return;
    mobileShowcaseFocus = { ...target };
    mobileFocusMotion.displayedCenter = { ...target };
    mobileFocusMotion.targetCenter = { ...target };
}

function scheduleMobileFocusMotion(app) {
    if (mobileFocusFrame != null) return;
    mobileFocusFrame = requestAnimationFrame((timestamp) => {
        mobileFocusFrame = null;
        if (!isMobileShowcase()) return;
        const result = advanceEyeMotion(mobileFocusMotion, timestamp);
        mobileShowcaseFocus = { ...mobileFocusMotion.displayedCenter };
        mobileFocusInMotion = !result.settled;
        app.renderNow();
        // While moving, the whole face already follows Focus. Once it settles,
        // keep the eye transform alive for the short fast-to-exact correction.
        if (!result.settled) snapDisplayedEyes(app);
        if (!result.settled) scheduleMobileFocusMotion(app);
    });
}

function retargetMobileFocus(app, target, responseMs = MOBILE_FOCUS_SWIPE_RESPONSE_MS) {
    if (!mobileFocusMotion.displayedCenter) resetMobileFocusMotion(target);
    mobileFocusMotion.timeConstant = responseMs;
    const result = retargetEyeMotion(mobileFocusMotion, target, performance.now());
    mobileShowcaseFocus = { ...mobileFocusMotion.displayedCenter };
    if (result.settled) {
        mobileFocusInMotion = false;
        mobileShowcaseFocus = { ...target };
        mobileFocusMotion.displayedCenter = { ...target };
        app.renderNow();
        return;
    }
    mobileFocusInMotion = true;
    scheduleMobileFocusMotion(app);
}

function applyEyeMotionTransform(app) {
    const svg = app.target?.element;
    if (!svg || !eyeMotion.displayedCenter || !eyeMotion.targetCenter) return;
    const dx = eyeMotion.displayedCenter.x - eyeMotion.targetCenter.x;
    const dy = eyeMotion.displayedCenter.y - eyeMotion.targetCenter.y;
    const settled = Math.hypot(dx, dy) <= 0.02;
    const cachedElements = (app.eyeMotionElements || []).filter((element) => element.isConnected);
    const elements = cachedElements.length
        ? cachedElements
        : [...svg.querySelectorAll('[data-eye-motion="true"]')];
    app.eyeMotionElements = elements;
    elements.forEach((element) => {
        if (settled) element.removeAttribute('transform');
        else element.setAttribute('transform', `translate(${dx} ${dy})`);
    });
    app.displayedEyeCenter = { ...eyeMotion.displayedCenter };
}

function scheduleEyeMotion(app) {
    if (eyeMotionFrame != null) return;
    eyeMotionFrame = requestAnimationFrame((timestamp) => {
        eyeMotionFrame = null;
        const result = advanceEyeMotion(eyeMotion, timestamp);
        applyEyeMotionTransform(app);
        if (!result.settled) scheduleEyeMotion(app);
    });
}

function retargetDisplayedEyes(app, target) {
    const result = retargetEyeMotion(eyeMotion, target, performance.now());
    if (!result.settled) scheduleEyeMotion(app);
}

function snapDisplayedEyes(app) {
    if (eyeMotionFrame != null) cancelAnimationFrame(eyeMotionFrame);
    eyeMotionFrame = null;
    snapEyeMotion(eyeMotion);
    applyEyeMotionTransform(app);
}

function applyBlink(app) {
    const svg = app.target?.element;
    const eyeGeometry = app.eyeGeometry;
    if (!svg || !eyeGeometry) return;
    const amount = blink.amount;
    const expression = activeRenderSettings(app.settings);
    const lids = amount <= 0
        ? eyeGeometry
        : buildEyeLidGeometry({
            cute: expression.cute + (100 - expression.cute) * amount,
            angry: expression.angry + (100 - expression.angry) * amount,
            lidClosure: amount
        }, eyeGeometry);
    ['left', 'right'].forEach((side) => {
        ['top', 'bottom'].forEach((lid) => {
            const cached = app.eyeLidElements?.[side]?.[lid];
            const element = cached?.isConnected
                ? cached
                : svg.querySelector(`#${side}_eye_${lid}`);
            element?.setAttribute('d', lids[side][lid].path);
        });
    });
    app.blinkAmount = amount;
}

function scheduleBlink(app) {
    if (blinkFrame != null) return;
    blinkFrame = requestAnimationFrame(() => {
        blinkFrame = null;
        const result = advanceBlink(blink, performance.now());
        applyBlink(app);
        if (result.active) scheduleBlink(app);
    });
}

function startBlink(app) {
    if (blinkFrame != null) cancelAnimationFrame(blinkFrame);
    blinkFrame = null;
    triggerBlink(blink, performance.now());
    scheduleBlink(app);
}

function stopBlink(app) {
    if (blinkFrame != null) cancelAnimationFrame(blinkFrame);
    blinkFrame = null;
    resetBlink(blink);
    applyBlink(app);
}

function bindBlink(app) {
    const excluded = [
        '.controls-panel',
        'button',
        'input',
        'textarea',
        'select',
        'label',
        'a',
        '[role="button"]',
        '[role="option"]',
        '[role="listbox"]',
        '.dialog-overlay'
    ].join(',');
    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest(excluded)) return;
        startBlink(app);
    }, { capture: true });
}

function createDefinitions(width, height, headPath) {
    const defs = makeSvgElement('defs');
    const guideClip = makeSvgElement('clipPath', { id: GUIDE_CLIP_ID });
    guideClip.appendChild(makeSvgElement('rect', {
        x: ARTBOARD_CROP_X,
        y: ARTBOARD_CROP_Y,
        width,
        height
    }));
    const headClip = makeSvgElement('clipPath', { id: HEAD_CLIP_ID });
    headClip.appendChild(makeSvgElement('path', { d: headPath }));
    append(defs, guideClip, headClip);
    return defs;
}

function drawEyes(ctx, eyeGeometry, definitions) {
    const { create, width, height, settings: state } = ctx;
    const eyes = create('g', {
        fill: state.eyeColor,
        'clip-path': `url(#${HEAD_CLIP_ID})`,
        'data-layer': 'eyes'
    });
    const motionElements = [];
    const lidElements = {};

    ['left', 'right'].forEach((side) => {
        const eye = eyeGeometry[side];
        const maskId = `sparky-${side}-eye-mask`;
        const mask = create('mask', {
            id: maskId,
            x: ARTBOARD_CROP_X,
            y: ARTBOARD_CROP_Y,
            width,
            height,
            maskUnits: 'userSpaceOnUse',
            maskContentUnits: 'userSpaceOnUse'
        });
        const maskContent = create('g', { 'data-eye-motion': 'true' });
        const topLid = create('path', {
                id: `${side}_eye_top`,
                d: eye.top.path,
                fill: '#000000',
                'data-object': `${side}_eye_top`
            });
        const bottomLid = create('path', {
                id: `${side}_eye_bottom`,
                d: eye.bottom.path,
                fill: '#000000',
                'data-object': `${side}_eye_bottom`
            });
        append(maskContent,
            create('path', { d: eye.eye1.path, fill: '#ffffff' }),
            topLid,
            bottomLid
        );
        mask.appendChild(maskContent);
        definitions.appendChild(mask);

        const eyeGroup = create('g', {
            id: `${side}_eye`,
            'data-eye': side,
            'data-eye-motion': 'true'
        });
        eyeGroup.appendChild(create('path', {
            id: `${side}_eye1`,
            d: eye.eye1.path,
            mask: `url(#${maskId})`,
            'data-object': `${side}_eye1`
        }));
        eyes.appendChild(eyeGroup);
        motionElements.push(maskContent, eyeGroup);
        lidElements[side] = { top: topLid, bottom: bottomLid };
    });

    ctx.app.eyeMotionElements = motionElements;
    ctx.app.eyeLidElements = lidElements;

    return eyes;
}

function drawCharacter(ctx, geometry, eyeGeometry) {
    const { svg, create, width, height, settings: state } = ctx;
    const definitions = createDefinitions(width, height, geometry.rounded.path);
    svg.appendChild(definitions);
    svg.appendChild(create('rect', {
        x: ARTBOARD_CROP_X,
        y: ARTBOARD_CROP_Y,
        width,
        height,
        fill: state.backgroundColor,
        'data-layer': 'background'
    }));

    svg.appendChild(create('path', {
        d: geometry.rounded.path,
        fill: state.headColor,
        'fill-rule': 'nonzero',
        'data-layer': 'head'
    }));

    svg.appendChild(drawEyes(ctx, eyeGeometry, definitions));

    if (state.showSphere || state.showRayGuides || state.showBisectors || state.showPoint) {
        drawGuides(ctx, geometry);
    }
}

function drawGuides(ctx, geometry) {
    const { svg, create, width, height } = ctx;
    const state = geometry.values;
    const commonStroke = {
        fill: 'none',
        'stroke-width': 0.75,
        'vector-effect': 'non-scaling-stroke'
    };
    const guides = create('g', {
        'clip-path': `url(#${GUIDE_CLIP_ID})`,
        'aria-hidden': 'true'
    });

    if (state.showSphere) {
        append(guides,
            create('line', {
                x1: state.boundaryCenterX,
                y1: ARTBOARD_CROP_Y,
                x2: state.boundaryCenterX,
                y2: ARTBOARD_CROP_Y + height,
                stroke: '#315bff',
                opacity: 0.55,
                ...commonStroke
            }),
            create('line', {
                x1: ARTBOARD_CROP_X,
                y1: state.boundaryCenterY,
                x2: ARTBOARD_CROP_X + width,
                y2: state.boundaryCenterY,
                stroke: '#315bff',
                opacity: 0.55,
                ...commonStroke
            })
        );

        if (geometry.boundary.type === 'circle') {
            guides.appendChild(create('circle', {
                cx: geometry.boundary.center.x,
                cy: geometry.boundary.center.y,
                r: geometry.boundary.radius,
                stroke: '#315bff',
                opacity: 0.8,
                ...commonStroke
            }));
        } else if (geometry.boundary.type === 'ellipse') {
            guides.appendChild(create('ellipse', {
                cx: geometry.boundary.center.x,
                cy: geometry.boundary.center.y,
                rx: geometry.boundary.radiusX,
                ry: geometry.boundary.radiusY,
                transform: `rotate(${geometry.boundary.rotationDeg} ${geometry.boundary.center.x} ${geometry.boundary.center.y})`,
                stroke: '#315bff',
                opacity: 0.8,
                ...commonStroke
            }));
        }

        const center = geometry.boundary.center;
        const focusOffsetX = geometry.focus.x - center.x;
        const focusOffsetY = geometry.focus.y - center.y;
        const focusOffsetLength = Math.hypot(focusOffsetX, focusOffsetY);
        const fallbackAngle = ((Number(state.focusAngle) || 0) - 90) * Math.PI / 180;
        const radiusDirection = focusOffsetLength > 1e-9
            ? { x: focusOffsetX / focusOffsetLength, y: focusOffsetY / focusOffsetLength }
            : { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) };
        const radiusEnd = geometry.boundary.intersectRay(center, radiusDirection);
        if (radiusEnd) {
            guides.appendChild(create('line', {
                x1: center.x,
                y1: center.y,
                x2: radiusEnd.x,
                y2: radiusEnd.y,
                stroke: '#315bff',
                opacity: 0.8,
                ...commonStroke
            }));
        }
    }

    if (state.showRayGuides) {
        geometry.rays.forEach((ray) => {
            guides.appendChild(create('path', {
                d: `M ${ray.guideMinusEnd.x} ${ray.guideMinusEnd.y} L ${ray.tip.x} ${ray.tip.y} L ${ray.guidePlusEnd.x} ${ray.guidePlusEnd.y}`,
                stroke: '#ff4c48',
                opacity: 0.72,
                ...commonStroke
            }));
        });
    }

    if (state.showBisectors) {
        geometry.rays.forEach((ray) => {
            guides.appendChild(create('line', {
                x1: ray.guideAxisEnd.x,
                y1: ray.guideAxisEnd.y,
                x2: ray.tip.x,
                y2: ray.tip.y,
                stroke: '#38e972',
                opacity: 0.68,
                ...commonStroke
            }));
        });
    }

    if (state.showPoint) {
        append(guides,
            create('path', {
                d: `M ${geometry.focus.x - 9} ${geometry.focus.y} H ${geometry.focus.x + 9} M ${geometry.focus.x} ${geometry.focus.y - 9} V ${geometry.focus.y + 9}`,
                fill: 'none',
                stroke: '#0000FF',
                'stroke-width': 0.75,
                'stroke-linecap': 'square',
                'vector-effect': 'non-scaling-stroke',
                'pointer-events': 'none'
            }),
            create('rect', {
                x: geometry.focus.x - 12,
                y: geometry.focus.y - 12,
                width: 24,
                height: 24,
                fill: 'transparent',
                class: 'sparky-focus-hit-area',
                'data-focus-handle': 'true',
                'data-interactive': 'true',
                'data-export-exclude': 'true'
            })
        );
    }

    svg.appendChild(guides);
}

function renderFailure(ctx, error) {
    const { svg, create, width, height, settings: state } = ctx;
    svg.appendChild(create('rect', {
        x: ARTBOARD_CROP_X,
        y: ARTBOARD_CROP_Y,
        width,
        height,
        fill: state.backgroundColor
    }));
    const message = create('text', {
        x: width / 2,
        y: height / 2,
        fill: '#ff765f',
        'text-anchor': 'middle',
        class: 'sparky-error-message',
        'data-interactive': 'true'
    });
    message.textContent = 'This combination cannot form a closed character.';
    svg.appendChild(message);
    console.warn('Sparky geometry:', error.message);
}

function constrainFocus(raw, state) {
    return constrainFocusPoint(raw, state);
}

let focusControlsSyncing = false;

function normalizedFocus(raw, state) {
    const constrained = constrainFocus(raw, state);
    const rounded = {
        x: Number(constrained.x.toFixed(3)),
        y: Number(constrained.y.toFixed(3))
    };
    const final = constrainFocus(rounded, state);
    return {
        x: Number(final.x.toFixed(6)),
        y: Number(final.y.toFixed(6))
    };
}

function normalizedPolar(raw = {}) {
    return {
        angle: clamp(Number(raw.angle) || 0, 0, 360),
        distance: clamp(Number(raw.distance) || 0, 0, 100)
    };
}

function syncFocusControls(app) {
    if (!app.sliders) return;
    const storedPolar = normalizedPolar({
        angle: app.settings.focusAngle,
        distance: app.settings.focusDistance
    });
    const focus = normalizedFocus(focusPointFromPolar(storedPolar, app.settings), app.settings);
    const controlPolar = !isMobileShowcase() && app.settings.followCursor && desktopFollowFocus
        ? normalizedPolar(focusPointToPolar(desktopFollowFocus, app.settings, storedPolar.angle))
        : storedPolar;
    const wasSyncing = focusControlsSyncing;
    focusControlsSyncing = true;
    try {
        app.settingsStore.setMultiple({
            focusAngle: storedPolar.angle,
            focusDistance: storedPolar.distance,
            focusX: focus.x,
            focusY: focus.y
        }, true);
        setFocusControls(app, controlPolar, {
            displayOnly: !isMobileShowcase() && app.settings.followCursor && !!desktopFollowFocus
        });
    } finally {
        focusControlsSyncing = wasSyncing;
    }
}

function applyState(app, source) {
    const normalized = normalizeIncomingState(source);
    app.settingsStore.setMultiple(normalized, true);
    desktopFollowFocus = normalized.followCursor
        ? { x: normalized.focusX, y: normalized.focusY }
        : null;
}

function pointFromPointer(svg, event) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
}

function bindFocusDragging(app) {
    const svg = document.getElementById('mainSvg');
    if (!svg) return;
    let pointerId = null;
    let followFrame = null;
    let pendingFollowPoint = null;

    const update = (raw, responseMs = MOBILE_FOCUS_SWIPE_RESPONSE_MS) => {
        const mobile = isMobileShowcase();
        const renderSettings = activeRenderSettings(app.settings);
        const focus = normalizedFocus(raw, renderSettings);
        const { x, y } = focus;
        if (mobile) {
            retargetMobileFocus(app, { x, y }, responseMs);
            return;
        }
        if (app.settings.followCursor) setTransientFollowFocus(app, x, y);
        else setFocus(app, x, y);
    };

    const updateFromEvent = (event, responseMs) => {
        const raw = pointFromPointer(svg, event);
        if (raw) update(raw, responseMs);
    };

    const scheduleFollow = (event) => {
        pendingFollowPoint = pointFromPointer(svg, event);
        if (!pendingFollowPoint || followFrame != null) return;
        followFrame = requestAnimationFrame(() => {
            followFrame = null;
            if ((!isMobileShowcase() && !app.settings.followCursor) || !pendingFollowPoint) return;
            update(pendingFollowPoint);
            pendingFollowPoint = null;
        });
    };

    svg.addEventListener('pointerdown', (event) => {
        if (isMobileShowcase()) {
            pointerId = event.pointerId;
            svg.setPointerCapture(pointerId);
            updateFromEvent(event, MOBILE_FOCUS_TAP_RESPONSE_MS);
            return;
        }
        const handle = event.target.closest?.('[data-focus-handle="true"]');
        if (!handle) return;
        event.preventDefault();
        event.stopPropagation();
        disableFollowCursor(app);
        pointerId = event.pointerId;
        svg.setPointerCapture(pointerId);
        app.history?.beginTransaction('focus-drag');
        updateFromEvent(event);
    });

    svg.addEventListener('pointermove', (event) => {
        if (event.pointerId === pointerId) {
            event.preventDefault();
            updateFromEvent(event, MOBILE_FOCUS_SWIPE_RESPONSE_MS);
            return;
        }
        if (isMobileShowcase() || app.settings.followCursor) scheduleFollow(event);
    });

    const finish = (event) => {
        if (event.pointerId !== pointerId) return;
        if (svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
        pointerId = null;
        if (!isMobileShowcase()) app.history?.endTransaction();
    };
    svg.addEventListener('pointerup', finish);
    svg.addEventListener('pointercancel', finish);
}

function setFocusControls(app, polar, { displayOnly = false } = {}) {
    const method = displayOnly ? 'setDisplayValue' : 'setValue';
    app.sliders?.[method]?.('focusAngleSlider', polar.angle, false);
    app.sliders?.[method]?.('focusDistanceSlider', polar.distance, false);
}

function commitTransientFollowFocus(app, { syncControls = true } = {}) {
    if (!desktopFollowFocus || isMobileShowcase()) return;
    const focus = normalizedFocus(desktopFollowFocus, app.settings);
    const polar = normalizedPolar(focusPointToPolar(focus, app.settings, app.settings.focusAngle));
    const wasSyncing = focusControlsSyncing;
    focusControlsSyncing = true;
    try {
        app.settingsStore.setMultiple({
            focusAngle: polar.angle,
            focusDistance: polar.distance,
            focusX: focus.x,
            focusY: focus.y
        }, true);
        if (syncControls) setFocusControls(app, polar);
    } finally {
        focusControlsSyncing = wasSyncing;
    }
    desktopFollowFocus = null;
}

function disableFollowCursor(app, { syncControls = true } = {}) {
    if (!app.settings.followCursor) return;
    commitTransientFollowFocus(app, { syncControls });
    app.settingsStore.set('followCursor', false);
}

function bindManualFocusControls(app) {
    [
        'focusAngleSlider',
        'focusDistanceSlider',
        'focusAngleValue',
        'focusDistanceValue'
    ].forEach((id) => {
        document.getElementById(id)?.addEventListener(
            'input',
            () => disableFollowCursor(app, { syncControls: false }),
            { capture: true }
        );
    });

    const reconcile = () => {
        if (focusControlsSyncing) return;
        const polar = normalizedPolar({
            angle: app.settings.focusAngle,
            distance: app.settings.focusDistance
        });
        const focus = normalizedFocus(focusPointFromPolar(polar, app.settings), app.settings);
        const wasSyncing = focusControlsSyncing;
        focusControlsSyncing = true;
        try {
            app.settingsStore.setMultiple({
                focusAngle: polar.angle,
                focusDistance: polar.distance,
                focusX: focus.x,
                focusY: focus.y
            }, true);
        } finally {
            focusControlsSyncing = wasSyncing;
        }
    };

    app.settingsStore.subscribe('focusAngle', reconcile);
    app.settingsStore.subscribe('focusDistance', reconcile);
    app.settingsStore.subscribe('followCursor', (enabled) => {
        if (isMobileShowcase()) return;
        if (!enabled) {
            commitTransientFollowFocus(app);
            return;
        }
        desktopFollowFocus = { x: app.settings.focusX, y: app.settings.focusY };
        app.renderNow();
        syncFocusControls(app);
    });
}

function setTransientFollowFocus(app, x, y) {
    const focus = normalizedFocus({ x, y }, app.settings);
    const polar = normalizedPolar(focusPointToPolar(focus, app.settings, app.settings.focusAngle));
    setFocusControls(app, polar, { displayOnly: true });
    desktopFollowFocus = { ...focus };
    app.renderNow();
}

function setFocus(app, x, y) {
    const focus = normalizedFocus({ x, y }, app.settings);
    const polar = normalizedPolar(focusPointToPolar(focus, app.settings, app.settings.focusAngle));
    const wasSyncing = focusControlsSyncing;
    focusControlsSyncing = true;
    try {
        app.settingsStore.setMultiple({
            focusAngle: polar.angle,
            focusDistance: polar.distance,
            focusX: focus.x,
            focusY: focus.y
        });
        setFocusControls(app, polar);
    } finally {
        focusControlsSyncing = wasSyncing;
    }
}

function setPolarFocus(app, angle, distance) {
    const polar = normalizedPolar({ angle, distance });
    const focus = normalizedFocus(focusPointFromPolar(polar, app.settings), app.settings);
    const wasSyncing = focusControlsSyncing;
    focusControlsSyncing = true;
    try {
        app.settingsStore.setMultiple({
            focusAngle: polar.angle,
            focusDistance: polar.distance,
            focusX: focus.x,
            focusY: focus.y
        });
        setFocusControls(app, polar);
    } finally {
        focusControlsSyncing = wasSyncing;
    }
}

const app = defineTool({
    renderer: 'svg',
    autoStart: true,
    dom: {
        canvas: 'canvasContainer',
        surface: 'mainSvg'
    },
    settings,
    controls: {
        sliders: [
            { id: 'rayCountSlider', valueId: 'rayCountValue', setting: 'rayCount', min: 3, max: 13, decimals: 0, baseStep: 1, shiftStep: 2 },
            { id: 'rayLengthSlider', valueId: 'rayLengthValue', setting: 'rayLength', min: 220, max: 360, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'rayWidthSlider', valueId: 'rayWidthValue', setting: 'rayWidth', min: 20, max: 160, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'roundnessSlider', valueId: 'roundnessValue', setting: 'roundness', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'cornerSmoothingSlider', valueId: 'cornerSmoothingValue', setting: 'cornerSmoothing', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'focusAngleSlider', valueId: 'focusAngleValue', setting: 'focusAngle', min: 0, max: 360, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'focusDistanceSlider', valueId: 'focusDistanceValue', setting: 'focusDistance', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'eyePerspectiveSlider', valueId: 'eyePerspectiveValue', setting: 'eyePerspective', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'eyeSizeSlider', valueId: 'eyeSizeValue', setting: 'eyeSize', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'eyeDistanceSlider', valueId: 'eyeDistanceValue', setting: 'eyeDistance', min: -90, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'cuteSlider', valueId: 'cuteValue', setting: 'cute', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'angrySlider', valueId: 'angryValue', setting: 'angry', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 }
        ],
        toggles: true
    },
    panels: [
        { id: 'shapePanel', headerId: 'shapePanelHeader', persistent: true },
        { id: 'focusPanel', headerId: 'focusPanelHeader', persistent: true },
        { id: 'eyesPanel', headerId: 'eyesPanelHeader', persistent: true },
        { id: 'colorsPanel', headerId: 'colorsPanelHeader', persistent: true }
    ],
    colorPickers: {
        containerId: 'unifiedColorPickerContainer',
        swatches: [
            { type: 'head', setting: 'headColor', label: 'Head', itemId: 'headColorItem', dotId: 'headColorPreview', hexId: 'headColorHex', hsbSlotId: 'headColorHsbSlot' },
            { type: 'eyes', setting: 'eyeColor', label: 'Eyes', itemId: 'eyeColorItem', dotId: 'eyeColorPreview', hexId: 'eyeColorHex', hsbSlotId: 'eyeColorHsbSlot' },
            { type: 'background', setting: 'backgroundColor', label: 'Background', itemId: 'backgroundColorItem', dotId: 'backgroundColorPreview', hexId: 'backgroundColorHex', hsbSlotId: 'backgroundColorHsbSlot' }
        ]
    },
    presets: {
        storageKey: 'lunnenSparkyGeneratorV2',
        basePath: 'presets',
        defaultName: 'Basic',
        forceSeed: true,
        migrate: (store) => {
            const storedPresets = store.loadAll();
            let removedObsoleteSeed = false;
            ['Needle Crown', 'Wide Crown'].forEach((name) => {
                if (storedPresets[name]?.seeded !== true) return;
                delete storedPresets[name];
                removedObsoleteSeed = true;
            });
            if (removedObsoleteSeed) store.saveAll(storedPresets);

            if (store.getNames().length) return;
            const legacyStore = new PresetStore({ storageKey: 'lunnenSparkyGeneratorV1' });
            const builtInNames = new Set(['Basic']);
            Object.entries(legacyStore.loadAll()).forEach(([name, preset]) => {
                if (!preset || preset.seeded === true) return;
                const {
                    seeded: _seeded,
                    createdAt: _createdAt,
                    updatedAt: _updatedAt,
                    ...blob
                } = preset;
                const migrated = migrateCoordinateSpace(blob);
                if (builtInNames.has(name)) {
                    delete migrated.focusX;
                    delete migrated.focusY;
                    migrated.focusAngle = 0;
                    migrated.focusDistance = 0;
                }
                store.create(name, migrated);
            });
        },
        pinnedPrefix: '+',
        colorDots: (blob) => [
            { kind: 'solid', value: blob.headColor || '#ffffff' },
            { kind: 'solid', value: blob.backgroundColor || '#000000' }
        ]
    },
    share: {
        stripKeys: ['width', 'height', 'focusX', 'focusY'],
        quantizableFloatKeys: [
            'focusAngle', 'focusDistance', 'rayLength', 'rayWidth', 'roundness', 'cornerSmoothing',
            'rayCount', 'angleSpan', 'boundaryCenterX', 'boundaryCenterY', 'boundaryRadius',
            'eyePerspective', 'eyeSize', 'eyeDistance', 'cute', 'angry'
        ],
        decimals: 2
    },
    history: { maxSize: 80, debounceMs: 180 },
    snapshot: (tool) => extractState(tool.settingsStore.toObject()),
    restore: (tool, snapshot) => applyState(tool, snapshot),
    collectPreset: (tool) => extractState(tool.settingsStore.toObject()),
    applyPreset: (tool, preset) => applyState(tool, preset),
    syncControls: (tool) => syncFocusControls(tool),
    export: { filename: 'sparky.svg' },
    zoom: {
        interactive: false,
        fitPadding: { top: 58, right: 58, bottom: 58, left: 58 }
    },
    shortcuts: {
        g: (tool) => {
            const enabled = !(tool.settings.showSphere
                && tool.settings.showRayGuides
                && tool.settings.showBisectors);
            tool.settingsStore.setMultiple({
                showSphere: enabled,
                showRayGuides: enabled,
                showBisectors: enabled
            });
        }
    },
    onInit(tool) {
        tool.shortcuts?.register(
            'mod+j',
            () => exportSettingsJSON(tool),
            { allowInInput: true }
        );
    },
    render(ctx) {
        try {
            const renderSettings = activeRenderSettings(ctx.settings);
            const renderContext = renderSettings === ctx.settings
                ? ctx
                : { ...ctx, settings: renderSettings };
            const geometry = buildCharacterGeometry(renderSettings);
            const eyeGeometry = buildEyeGeometry(renderSettings, geometry, {
                placementMode: isMobileShowcase() && mobileFocusInMotion ? 'fast' : 'exact',
                previousEyeGeometry: ctx.app.eyeGeometry
            });
            retargetDisplayedEyes(ctx.app, eyeGeometry.pairCenter);
            ctx.app.characterGeometry = geometry;
            ctx.app.eyeGeometry = eyeGeometry;
            ctx.app.geometryError = null;
            drawCharacter(renderContext, geometry, eyeGeometry);
            applyEyeMotionTransform(ctx.app);
            applyBlink(ctx.app);
        } catch (error) {
            ctx.app.geometryError = error;
            renderFailure(ctx, error);
        }
    },
    onReady(tool) {
        const frameworkExportSVG = tool.exportSVG.bind(tool);
        const frameworkExportPNG = tool.exportPNG.bind(tool);
        tool.exportSVG = async (filename) => {
            stopBlink(tool);
            settleMobileFocusMotion();
            tool.renderNow();
            snapDisplayedEyes(tool);
            const name = filename || `${createSparkyExportBaseName()}.svg`;
            return frameworkExportSVG(name);
        };
        tool.exportPNG = (filename, scaleFactor) => {
            stopBlink(tool);
            settleMobileFocusMotion();
            tool.renderNow();
            snapDisplayedEyes(tool);
            const name = filename || `${createSparkyExportBaseName()}.png`;
            return frameworkExportPNG(name, scaleFactor);
        };
        desktopFollowFocus = tool.settings.followCursor
            ? { x: tool.settings.focusX, y: tool.settings.focusY }
            : null;
        bindFocusDragging(tool);
        bindManualFocusControls(tool);
        syncFocusControls(tool);
        bindBlink(tool);
        bindMobileShowcase(tool);
        document.getElementById('resetFocusBtn')?.addEventListener('click', () => {
            disableFollowCursor(tool);
            setPolarFocus(tool, 0, 0);
        });
        document.getElementById('exportSvgBtn')?.addEventListener('click', () => tool.exportSVG());
        document.getElementById('exportPngBtn')?.addEventListener('click', () => tool.exportPNG());
        document.getElementById('introHelpBtn')?.addEventListener('click', () => {
            tool.dialog?.alert({
                title: 'Lunnen Sparky',
                text: 'A mathematically precise parametric character. Change ray geometry, drag or follow the focus, shape the expression, save or share presets, and export SVG or PNG. Enabled guides and focus are included in exports.'
            });
        });
    }
});

export default app;
