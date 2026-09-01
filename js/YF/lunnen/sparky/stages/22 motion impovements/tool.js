import { defineTool } from './framework/src/core/defineTool.js?v=20260823-2';
import { PresetStore } from './framework/src/preset/PresetStore.js';
import {
    DEFAULT_GEOMETRY,
    buildCharacterGeometry
} from './src/geometry/characterGeometry.js?v=20260823-5';
import { buildEyeGeometry, buildEyeLidGeometry } from './src/geometry/eyeGeometry.js?v=20260824-7';
import { createSparkyExportBaseName } from './src/export/exportNaming.js';
import { createStaticSparkySvg } from './src/export/staticSvgExporter.js?v=20260825-2';
import { AnimationExporter } from './src/export/animationExporter.js?v=20260826-2';
import {
    advanceEyeMotion,
    createEyeMotionState,
    retargetEyeMotion,
    snapEyeMotion
} from './src/animation/eyeMotion.js?v=20260825-1';
import {
    advanceBlink,
    createBlinkState,
    resetBlink,
    triggerBlink
} from './src/animation/blink.js?v=20260822-6';
import {
    generateFocusPathForSettings,
    normalizeMotionComplexity,
    normalizeMotionSmoothness,
    normalizeMotionSeed,
    serializeFocusPath
} from './src/animation/focusPath.js?v=20260825-8';
import {
    focusPathEditorHandlePoints,
    moveFocusPathAnchor,
    moveFocusPathHandle
} from './src/animation/focusPathEditor.js?v=20260825-6';
import {
    confirmPathRegeneration
} from './src/animation/pathRegenerateConfirmation.js?v=20260825-1';
import {
    createFocusTimeline,
    normalizeSpeedVariation,
    resolveFocusStops,
    sampleFocusTimeline
} from './src/animation/focusTimeline.js?v=20260826-1';
import {
    createEyeAnimationTimeline,
    sampleEyeAnimationTimeline
} from './src/animation/eyeTimeline.js?v=20260826-1';
import {
    normalizeMotionBlur,
    resolvePreviewMotionBlurGhosts,
    wrapMotionBlurTime
} from './src/animation/motionBlur.js?v=20260826-2';
import { clamp } from './src/geometry/vector.js';
import {
    focusPointFromPolar,
    focusPointToPolar
} from './src/geometry/focusBounds.js?v=20260823-6';
import {
    centeredFocus,
    normalizedFocus,
    normalizedPolar,
    resolveEffectivePersistenceState,
    resolveManualFocusMode
} from './src/state/focusState.js?v=20260825-2';
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
const FOCUS_PREVIEW_INTERVAL_MS = 1000 / 30;
const ARTBOARD_CROP_X = 0;
const ARTBOARD_CROP_Y = DEFAULT_GEOMETRY.boundaryCenterY - DEFAULT_GEOMETRY.boundaryRadius;
let mobileShowcaseFocus = null;
let desktopFollowFocus = null;
let eyePlacementMode = 'global';
let previewBlurReducedUntil = 0;
let previewBlurRestoreTimer = null;

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
    focusX: DEFAULT_GEOMETRY.boundaryCenterX,
    focusY: DEFAULT_GEOMETRY.boundaryCenterY,
    focusAngle: 0,
    focusDistance: 0,
    rayCount: DEFAULT_GEOMETRY.rayCount,
    centerAngle: DEFAULT_GEOMETRY.centerAngle,
    angleStep: DEFAULT_GEOMETRY.angleStep,
    angleSpan: DEFAULT_GEOMETRY.angleSpan,
    rayLength: DEFAULT_GEOMETRY.rayLength,
    rayWidth: DEFAULT_GEOMETRY.rayWidth,
    roundness: DEFAULT_GEOMETRY.roundness,
    cornerSmoothing: 100,
    rayOverrides: [{}, {}, {}, {}, {}],
    headColor: '#ffffff',
    eyeColor: '#000000',
    backgroundColor: '#000000',
    showSphere: false,
    showRayGuides: false,
    showBisectors: false,
    showPoint: false,
    followCursor: true,
    focusMode: 'manual',
    motionDuration: 5,
    motionPointCount: 6,
    motionComplexity: 0,
    motionSmoothness: 50,
    motionStopCount: 3,
    motionSpeedVariation: 0,
    motionBlinkCount: 2,
    motionEmotionVariation: 0,
    motionBlur: 0,
    motionSeed: 24062026,
    showMotionPath: true,
    eyePerspective: 100,
    eyeSize: 50,
    eyeDistance: 0,
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
    normalized.focusMode = normalized.focusMode === 'animate' ? 'animate' : 'manual';
    normalized.motionDuration = clamp(Number(normalized.motionDuration) || 5, 1, 10);
    normalized.motionPointCount = Math.round(clamp(Number(normalized.motionPointCount) || 6, 2, 16));
    normalized.motionComplexity = normalizeMotionComplexity(normalized.motionComplexity);
    normalized.motionSmoothness = normalizeMotionSmoothness(normalized.motionSmoothness);
    const legacyStopPercentage = Number(source.motionStops);
    const requestedStopCount = Number(source.motionStopCount);
    normalized.motionStopCount = Number.isFinite(requestedStopCount)
        ? Math.round(clamp(requestedStopCount, 1, normalized.motionPointCount))
        : Number.isFinite(legacyStopPercentage)
            ? 1 + Math.round(
                (normalized.motionPointCount - 1) * clamp(legacyStopPercentage, 0, 100) / 100
            )
            : Math.round(clamp(normalized.motionStopCount, 1, normalized.motionPointCount));
    normalized.motionSpeedVariation = normalizeSpeedVariation(normalized.motionSpeedVariation);
    normalized.motionBlinkCount = Math.round(clamp(
        Number.isFinite(Number(normalized.motionBlinkCount))
            ? Number(normalized.motionBlinkCount)
            : 2,
        0,
        12
    ));
    normalized.motionEmotionVariation = clamp(
        Number(normalized.motionEmotionVariation) || 0,
        0,
        100
    );
    normalized.motionBlur = normalizeMotionBlur(normalized.motionBlur);
    normalized.motionSeed = normalizeMotionSeed(normalized.motionSeed);
    normalized.showMotionPath = Boolean(normalized.showMotionPath);
    Object.assign(normalized, resolveManualFocusMode(normalized));
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
        // Product contract: mobile is a deliberately reduced Basic-only
        // showcase. Stored/shared presets remain available for desktop, but do
        // not replace the mobile character profile.
        const focus = mobileShowcaseFocus || centeredFocus(settings);
        return { ...settings, focusX: focus.x, focusY: focus.y };
    }
    if (current.focusMode === 'animate' && focusAnimation.currentFocus) {
        return {
            ...current,
            focusX: focusAnimation.currentFocus.x,
            focusY: focusAnimation.currentFocus.y
        };
    }
    const focus = current.followCursor ? desktopFollowFocus : null;
    if (!focus) return current;
    return { ...current, focusX: focus.x, focusY: focus.y };
}

function effectivePersistenceState(app) {
    const current = app.settingsStore.toObject();
    return resolveEffectivePersistenceState(current, desktopFollowFocus, {
        mobileShowcase: isMobileShowcase()
    });
}

function extractEffectiveState(app) {
    return extractState(effectivePersistenceState(app));
}

function setEyePlacementMode(app, mode) {
    eyePlacementMode = mode;
    if (app) app.eyePlacementMode = mode;
    if (typeof document !== 'undefined') {
        document.documentElement.dataset.eyePlacementMode = mode;
    }
}

function beginInteractivePlacement(app) {
    setEyePlacementMode(app, 'interactive');
}

function finishInteractivePlacement(app) {
    // Settling is diagnostic only. The last local solution remains the visible
    // geometry, so pointer stop cannot switch to another placement law.
    setEyePlacementMode(app, 'settled');
}

function forceGlobalPlacement(app) {
    setEyePlacementMode(app, 'global');
}

function syncPageBackground(color) {
    const value = color || '#000000';
    const root = document.documentElement;
    if (root.style.getPropertyValue('--sparky-page-background') !== value) {
        root.style.setProperty('--sparky-page-background', value);
    }
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
    const syncMode = ({ fitImmediately = false } = {}) => {
        const mobile = media?.matches ?? window.innerWidth <= 768;
        forceGlobalPlacement(app);
        document.documentElement.classList.toggle('sparky-mobile-showcase', mobile);
        if (mobile && !wasMobile) {
            resetMobileFocusMotion(centeredFocus(settings));
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
        if (fitImmediately) fitShowcaseToViewport(app, mobile);
        else scheduleFit(mobile);
    };
    const refitMobile = () => {
        if (isMobileShowcase()) scheduleFit(true);
    };
    const preventMobileSelection = (event) => {
        if (isMobileShowcase()) event.preventDefault();
    };

    media?.addEventListener?.('change', syncMode);
    window.addEventListener('resize', refitMobile);
    window.visualViewport?.addEventListener('resize', refitMobile);
    document.addEventListener('selectstart', preventMobileSelection, { capture: true });
    document.addEventListener('dragstart', preventMobileSelection, { capture: true });
    syncMode({ fitImmediately: true });
}

function exportSettingsJSON(tool, filename) {
    const name = filename || `${createSparkyExportBaseName()}.json`;
    const snapshot = extractEffectiveState(tool);
    return tool.exporter?.exportJSON(snapshot, name);
}

function exportFocusAnimation(tool, format) {
    const exporter = tool.animationExporter;
    if (!exporter) return Promise.reject(new Error('Animation exporter is not ready.'));
    return exporter.export({
        format,
        settings: extractInternalState(tool.settings),
        startFocus: currentStoredFocus(tool.settings),
        motionPath: focusAnimation.editedPath && focusAnimation.path
            ? serializeFocusPath(focusAnimation.path)
            : null,
        baseName: createSparkyExportBaseName()
    });
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
const blink = createBlinkState();
let blinkFrame = null;
const focusAnimation = {
    path: null,
    timeline: null,
    eyeTimeline: null,
    currentFocus: null,
    frame: null,
    startedAt: null,
    lastPreviewAt: null,
    elapsedMs: 0,
    paused: false,
    editing: false,
    manuallyEdited: false,
    editedPath: null,
    selectedEditorControl: null
};
let focusAnimationReady = false;
let motionSmoothnessConfirmation = null;
let revertingMotionSmoothness = false;

function cancelFocusAnimationFrame() {
    if (focusAnimation.frame != null) cancelAnimationFrame(focusAnimation.frame);
    focusAnimation.frame = null;
}

function currentStoredFocus(state) {
    const polar = normalizedPolar({
        angle: state.focusAngle,
        distance: state.focusDistance
    });
    return normalizedFocus(focusPointFromPolar(polar, state), state);
}

function updateFocusAnimationButtons() {
    const playPause = document.getElementById('motionPlayPauseBtn');
    if (playPause) playPause.textContent = focusAnimation.paused ? 'Play' : 'Pause';
    const editPath = document.getElementById('motionEditPathBtn');
    if (editPath) {
        editPath.textContent = focusAnimation.editing ? 'Done editing' : 'Edit path';
        editPath.setAttribute('aria-pressed', String(focusAnimation.editing));
    }
    document.getElementById('motionEditorHint')
        ?.toggleAttribute('hidden', !focusAnimation.editing);
}

function scheduleFocusAnimation(app) {
    if (focusAnimation.frame != null
        || focusAnimation.paused
        || app.settings.focusMode !== 'animate'
        || isMobileShowcase()) return;
    focusAnimation.frame = requestAnimationFrame((timestamp) => {
        focusAnimation.frame = null;
        if (focusAnimation.paused
            || app.settings.focusMode !== 'animate'
            || isMobileShowcase()
            || !focusAnimation.timeline) return;
        if (focusAnimation.lastPreviewAt != null
            && timestamp - focusAnimation.lastPreviewAt < FOCUS_PREVIEW_INTERVAL_MS) {
            scheduleFocusAnimation(app);
            return;
        }
        focusAnimation.lastPreviewAt = timestamp;
        if (focusAnimation.startedAt == null) {
            focusAnimation.startedAt = timestamp - focusAnimation.elapsedMs;
        }
        focusAnimation.elapsedMs = (
            timestamp - focusAnimation.startedAt
        ) % focusAnimation.timeline.durationMs;
        focusAnimation.currentFocus = sampleFocusTimeline(
            focusAnimation.timeline,
            focusAnimation.elapsedMs
        ).point;
        app.renderNow();
        scheduleFocusAnimation(app);
    });
}

function rebuildFocusAnimation(app, {
    restart = true,
    schedule = true,
    regenerate = false,
    preservePlayback = false
} = {}) {
    cancelFocusAnimationFrame();
    const start = currentStoredFocus(app.settings);
    const wasPaused = focusAnimation.paused;
    if (regenerate) {
        focusAnimation.editedPath = null;
        focusAnimation.manuallyEdited = false;
        focusAnimation.editing = false;
        focusAnimation.selectedEditorControl = null;
    }
    focusAnimation.path = focusAnimation.editedPath
        || generateFocusPathForSettings(app.settings, start);
    const stops = resolveFocusStops(
        app.settings.motionStopCount,
        focusAnimation.path.anchors.length
    );
    focusAnimation.timeline = createFocusTimeline(focusAnimation.path, {
        duration: app.settings.motionDuration,
        ...stops,
        speedVariation: app.settings.motionSpeedVariation,
        easing: 'ease-in-out',
        seed: app.settings.motionSeed
    });
    focusAnimation.eyeTimeline = createEyeAnimationTimeline(focusAnimation.timeline, {
        blinkCount: app.settings.motionBlinkCount,
        blinkAtStops: true,
        emotionVariation: app.settings.motionEmotionVariation,
        easing: 'ease-in-out'
    });
    if (restart) {
        focusAnimation.elapsedMs = 0;
        focusAnimation.startedAt = null;
        focusAnimation.lastPreviewAt = null;
        focusAnimation.currentFocus = { ...focusAnimation.path.anchors[0] };
    } else if (focusAnimation.timeline) {
        focusAnimation.elapsedMs %= focusAnimation.timeline.durationMs;
        focusAnimation.currentFocus = sampleFocusTimeline(
            focusAnimation.timeline,
            focusAnimation.elapsedMs
        ).point;
        focusAnimation.startedAt = performance.now() - focusAnimation.elapsedMs;
    }
    if (app.settings.focusMode === 'animate') {
        focusAnimation.paused = preservePlayback ? wasPaused : false;
        stopBlink(app);
        // Preview uses the exact local containment solver and reuses the prior
        // frame as its seed. Export recomputes every frame with the global
        // solver in a worker, keeping the UI responsive without lowering the
        // quality of the saved result.
        beginInteractivePlacement(app);
    }
    updateFocusAnimationButtons();
    app.renderNow();
    if (schedule) scheduleFocusAnimation(app);
}

function rebuildEyeAnimation(app) {
    if (!focusAnimation.timeline) return;
    focusAnimation.eyeTimeline = createEyeAnimationTimeline(focusAnimation.timeline, {
        blinkCount: app.settings.motionBlinkCount,
        blinkAtStops: true,
        emotionVariation: app.settings.motionEmotionVariation,
        easing: 'ease-in-out'
    });
    app.renderNow();
}

function pauseFocusAnimation(app) {
    if (focusAnimation.paused || app.settings.focusMode !== 'animate') return;
    if (focusAnimation.startedAt != null && focusAnimation.timeline) {
        focusAnimation.elapsedMs = (
            performance.now() - focusAnimation.startedAt
        ) % focusAnimation.timeline.durationMs;
        focusAnimation.currentFocus = sampleFocusTimeline(
            focusAnimation.timeline,
            focusAnimation.elapsedMs
        ).point;
    }
    focusAnimation.paused = true;
    cancelFocusAnimationFrame();
    updateFocusAnimationButtons();
    app.renderNow();
}

function setFocusPathEditing(app, editing) {
    const next = Boolean(editing) && app.settings.focusMode === 'animate';
    if (next) {
        pauseFocusAnimation(app);
    }
    focusAnimation.editing = next;
    focusAnimation.selectedEditorControl = null;
    updateFocusAnimationButtons();
    app.renderNow();
}

function playFocusAnimation(app) {
    if (!focusAnimation.paused || app.settings.focusMode !== 'animate') return;
    focusAnimation.editing = false;
    focusAnimation.selectedEditorControl = null;
    focusAnimation.paused = false;
    focusAnimation.startedAt = performance.now() - focusAnimation.elapsedMs;
    focusAnimation.lastPreviewAt = null;
    updateFocusAnimationButtons();
    scheduleFocusAnimation(app);
}

function toggleFocusFreeze(app) {
    if (app.settings.focusMode === 'animate') {
        if (focusAnimation.paused) playFocusAnimation(app);
        else pauseFocusAnimation(app);
        return;
    }
    if (app.settings.focusMode !== 'manual') return;
    if (app.settings.followCursor) {
        disableFollowCursor(app);
        return;
    }
    app.settingsStore.setMultiple({
        showPoint: false,
        followCursor: true
    });
    syncManualFocusModeControls(app);
    app.renderNow();
}

function restartFocusAnimation(app) {
    if (!focusAnimation.timeline) rebuildFocusAnimation(app);
    focusAnimation.editing = false;
    focusAnimation.selectedEditorControl = null;
    focusAnimation.elapsedMs = 0;
    focusAnimation.startedAt = null;
    focusAnimation.lastPreviewAt = null;
    focusAnimation.currentFocus = { ...focusAnimation.path.anchors[0] };
    focusAnimation.paused = false;
    updateFocusAnimationButtons();
    app.renderNow();
    scheduleFocusAnimation(app);
}

function stopFocusAnimation(app) {
    cancelFocusAnimationFrame();
    focusAnimation.path = null;
    focusAnimation.timeline = null;
    focusAnimation.eyeTimeline = null;
    focusAnimation.currentFocus = null;
    focusAnimation.startedAt = null;
    focusAnimation.lastPreviewAt = null;
    focusAnimation.elapsedMs = 0;
    focusAnimation.paused = false;
    focusAnimation.editing = false;
    focusAnimation.selectedEditorControl = null;
    updateFocusAnimationButtons();
    app?.renderNow();
}

function syncRadioGroup(name, value) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
        input.checked = String(input.value) === String(value);
    });
}

function syncFocusModeUI(app) {
    const animate = app.settings.focusMode === 'animate';
    syncRadioGroup('focusMode', animate ? 'animate' : 'manual');
    document.getElementById('focusManualControls')?.toggleAttribute('hidden', animate);
    document.getElementById('focusAnimationControls')?.toggleAttribute('hidden', !animate);
    document.getElementById('showMotionPathToggle')?.toggleAttribute('hidden', !animate);
    const pngButton = document.getElementById('exportPngBtn');
    const primaryButton = document.getElementById('exportSvgBtn');
    if (pngButton) pngButton.textContent = animate ? 'Export PNG sequence' : 'Export PNG';
    if (primaryButton) primaryButton.textContent = animate ? 'Export MP4' : 'Export ⌘E';
}

function syncFocusAnimationControls(app) {
    syncFocusModeUI(app);
    app.sliders?.updateLimits?.('motionStopCountSlider', 1, app.settings.motionPointCount);
    app.sliders?.setDisplayValue?.('motionStopCountSlider', app.settings.motionStopCount);
    updateFocusAnimationButtons();
}

function applyFocusMode(app) {
    syncFocusModeUI(app);
    if (!focusAnimationReady) return;
    if (app.settings.focusMode === 'animate' && !isMobileShowcase()) {
        stopBlink(app);
        rebuildFocusAnimation(app);
        return;
    }
    forceGlobalPlacement(app);
    stopFocusAnimation(app);
}

function bindFocusAnimation(app) {
    focusAnimationReady = true;
    app.sliders?.updateLimits?.('motionStopCountSlider', 1, app.settings.motionPointCount);
    document.querySelectorAll('input[name="focusMode"]').forEach((input) => {
        input.addEventListener('change', () => {
            if (!input.checked) return;
            if (input.value === 'animate') disableFollowCursor(app);
            app.settingsStore.set('focusMode', input.value);
        });
    });

    document.getElementById('motionPlayPauseBtn')?.addEventListener('click', () => {
        if (focusAnimation.paused) playFocusAnimation(app);
        else pauseFocusAnimation(app);
    });
    document.getElementById('motionRestartBtn')?.addEventListener('click', () => {
        restartFocusAnimation(app);
    });
    document.getElementById('motionEditPathBtn')?.addEventListener('click', () => {
        setFocusPathEditing(app, !focusAnimation.editing);
    });
    document.getElementById('motionRegenerateBtn')?.addEventListener('click', async () => {
        const confirmed = await confirmPathRegeneration({
            manuallyEdited: focusAnimation.manuallyEdited,
            dialog: app.dialog,
            fallbackConfirm: (message) => window.confirm(message)
        });
        if (!confirmed) return;
        const values = new Uint32Array(1);
        crypto.getRandomValues(values);
        focusAnimation.editedPath = null;
        focusAnimation.manuallyEdited = false;
        focusAnimation.editing = false;
        focusAnimation.selectedEditorControl = null;
        app.settingsStore.set('motionSeed', normalizeMotionSeed(values[0]));
    });

    let syncingMotionStopCount = false;
    app.settingsStore.subscribe('motionPointCount', (pointCount) => {
        app.sliders?.updateLimits?.('motionStopCountSlider', 1, pointCount);
        if (app.settings.motionStopCount > pointCount) {
            syncingMotionStopCount = true;
            app.settingsStore.set('motionStopCount', pointCount);
            syncingMotionStopCount = false;
        }
        if (app.settings.focusMode === 'animate') {
            rebuildFocusAnimation(app, { regenerate: true });
        }
    });
    [
        'motionComplexity',
        'motionSeed'
    ].forEach((setting) => {
        app.settingsStore.subscribe(setting, () => {
            if (app.settings.focusMode === 'animate') {
                rebuildFocusAnimation(app, { regenerate: true });
            }
        });
    });
    app.settingsStore.subscribe('motionSmoothness', (value, previousValue) => {
        if (revertingMotionSmoothness || app.settings.focusMode !== 'animate') return;
        if (!focusAnimation.manuallyEdited) {
            rebuildFocusAnimation(app, { regenerate: true });
            return;
        }
        if (motionSmoothnessConfirmation) return;
        const originalValue = previousValue;
        motionSmoothnessConfirmation = (async () => {
            const confirmed = await confirmPathRegeneration({
                manuallyEdited: true,
                dialog: app.dialog,
                fallbackConfirm: (message) => window.confirm(message)
            });
            if (confirmed) {
                if (app.settings.focusMode === 'animate') {
                    rebuildFocusAnimation(app, { regenerate: true });
                } else {
                    focusAnimation.editedPath = null;
                    focusAnimation.manuallyEdited = false;
                    focusAnimation.editing = false;
                    focusAnimation.selectedEditorControl = null;
                }
            } else {
                revertingMotionSmoothness = true;
                app.settingsStore.set('motionSmoothness', originalValue);
                revertingMotionSmoothness = false;
                app.sliders?.setDisplayValue('motionSmoothnessSlider', originalValue);
            }
        })().finally(() => {
            motionSmoothnessConfirmation = null;
        });
    });
    [
        'motionDuration',
        'motionStopCount',
        'motionSpeedVariation'
    ].forEach((setting) => {
        app.settingsStore.subscribe(setting, () => {
            if (setting === 'motionStopCount' && syncingMotionStopCount) return;
            if (app.settings.focusMode === 'animate') {
                rebuildFocusAnimation(app, {
                    restart: false,
                    regenerate: false,
                    preservePlayback: true
                });
            }
        });
    });
    [
        'motionBlinkCount',
        'motionEmotionVariation'
    ].forEach((setting) => {
        app.settingsStore.subscribe(setting, () => {
            if (app.settings.focusMode === 'animate') rebuildEyeAnimation(app);
        });
    });
    app.settingsStore.subscribe('focusMode', () => applyFocusMode(app));
    window.matchMedia?.(MOBILE_SHOWCASE_QUERY)?.addEventListener?.('change', (event) => {
        if (event.matches) {
            cancelFocusAnimationFrame();
            return;
        }
        if (app.settings.focusMode === 'animate') rebuildFocusAnimation(app);
    });

    syncFocusAnimationControls(app);
    applyFocusMode(app);
}

function cancelMobileFocusMotion() {
    if (mobileFocusFrame != null) cancelAnimationFrame(mobileFocusFrame);
    mobileFocusFrame = null;
    mobileFocusMotion.lastTime = null;
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
        if (result.settled) finishInteractivePlacement(app);
        else beginInteractivePlacement(app);
        app.renderNow();
        if (!result.settled) scheduleMobileFocusMotion(app);
    });
}

function retargetMobileFocus(app, target, responseMs = MOBILE_FOCUS_SWIPE_RESPONSE_MS) {
    if (!mobileFocusMotion.displayedCenter) resetMobileFocusMotion(target);
    mobileFocusMotion.timeConstant = responseMs;
    const result = retargetEyeMotion(mobileFocusMotion, target, performance.now());
    mobileShowcaseFocus = { ...mobileFocusMotion.displayedCenter };
    if (result.settled) {
        mobileShowcaseFocus = { ...target };
        mobileFocusMotion.displayedCenter = { ...target };
        finishInteractivePlacement(app);
        app.renderNow();
        return;
    }
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

function retargetDisplayedEyes(app, target, { immediate = false } = {}) {
    const result = retargetEyeMotion(eyeMotion, target, performance.now());
    if (immediate) {
        if (eyeMotionFrame != null) cancelAnimationFrame(eyeMotionFrame);
        eyeMotionFrame = null;
        snapEyeMotion(eyeMotion);
        return;
    }
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
    const expression = activeRenderSettings(app.settings);
    const eyeState = expression.focusMode === 'animate' && focusAnimation.eyeTimeline
        ? sampleEyeAnimationTimeline(
            focusAnimation.eyeTimeline,
            focusAnimation.elapsedMs,
            expression
        )
        : null;
    const amount = eyeState ? eyeState.blinkAmount : blink.amount;
    const animatedCute = eyeState?.cute ?? expression.cute;
    const animatedAngry = eyeState?.angry ?? expression.angry;
    const expressionChanged = animatedCute !== expression.cute
        || animatedAngry !== expression.angry;
    const lids = amount <= 0 && !expressionChanged
        ? eyeGeometry
        : buildEyeLidGeometry({
            cute: animatedCute + (100 - animatedCute) * amount,
            angry: animatedAngry + (100 - animatedAngry) * amount,
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
    app.animatedExpression = { cute: animatedCute, angry: animatedAngry };
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
    if (app.settings.focusMode === 'animate') return;
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

function previewMotionBlurGhosts(state) {
    if (state.focusMode !== 'animate' || !focusAnimation.timeline) return [];
    const descriptors = resolvePreviewMotionBlurGhosts(state.motionBlur, {
        reduced: performance.now() < previewBlurReducedUntil
    });
    const currentTime = focusAnimation.elapsedMs;
    const current = sampleFocusTimeline(focusAnimation.timeline, currentTime).point;
    return descriptors.flatMap(({ offsetFrames, opacity }) => {
        const time = wrapMotionBlurTime(
            currentTime + offsetFrames * 1000 / 60,
            focusAnimation.timeline.durationMs
        );
        const focus = sampleFocusTimeline(focusAnimation.timeline, time).point;
        if (Math.hypot(focus.x - current.x, focus.y - current.y) < 0.15) return [];
        const geometry = buildCharacterGeometry({
            ...state,
            focusX: focus.x,
            focusY: focus.y,
            focusMode: 'manual'
        });
        return [{ path: geometry.rounded.path, opacity }];
    });
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
    const blurGhosts = previewMotionBlurGhosts(state);
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

    const characterLayer = create('g', {
        'data-layer': 'character'
    });
    blurGhosts.forEach((ghost) => {
        characterLayer.appendChild(create('path', {
            d: ghost.path,
            fill: state.headColor,
            opacity: ghost.opacity,
            'data-motion-blur-ghost': 'true'
        }));
    });
    characterLayer.appendChild(create('path', {
        d: geometry.rounded.path,
        fill: state.headColor,
        'fill-rule': 'nonzero',
        'data-layer': 'head'
    }));

    characterLayer.appendChild(drawEyes(ctx, eyeGeometry, definitions));
    svg.appendChild(characterLayer);

    if (state.showSphere
        || state.showRayGuides
        || state.showBisectors
        || (state.showPoint && !state.followCursor && state.focusMode !== 'animate')
        || (state.focusMode === 'animate'
            && (state.showMotionPath || focusAnimation.editing))) {
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

    if (state.focusMode === 'animate'
        && (state.showMotionPath || focusAnimation.editing)
        && focusAnimation.path) {
        const editing = focusAnimation.editing;
        const motionGuides = create('g', {
            'data-layer': 'motion-path-preview',
            'data-export-exclude': 'true'
        });
        if (editing) {
            const handlesPath = focusAnimation.path.segments.map((segment) => (
                `M ${segment.start.x} ${segment.start.y}`
                + ` L ${segment.control1.x} ${segment.control1.y}`
                + ` M ${segment.end.x} ${segment.end.y}`
                + ` L ${segment.control2.x} ${segment.control2.y}`
            )).join(' ');
            motionGuides.appendChild(create('path', {
                d: handlesPath,
                stroke: '#00ff2a',
                opacity: 0.32,
                ...commonStroke,
                'stroke-width': 0.7,
                'stroke-dasharray': '2 2'
            }));
        }
        motionGuides.appendChild(create('path', {
            d: focusAnimation.path.path,
            stroke: '#00ff2a',
            opacity: editing ? 0.92 : 0.72,
            ...commonStroke,
            'stroke-width': editing ? 1.2 : 0.9,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
        }));
        if (editing) {
            focusAnimation.path.anchors.forEach((anchor, index) => {
                const handles = focusPathEditorHandlePoints(focusAnimation.path, index);
                [
                    { side: 'incoming', point: handles.incoming },
                    { side: 'outgoing', point: handles.outgoing }
                ].forEach(({ side, point }) => {
                    const key = `handle:${index}:${side}`;
                    motionGuides.appendChild(create('circle', {
                        cx: point.x,
                        cy: point.y,
                        r: 3.1,
                        fill: state.backgroundColor,
                        stroke: '#00ff2a',
                        'stroke-width': 0.9,
                        'vector-effect': 'non-scaling-stroke',
                        'pointer-events': 'none'
                    }));
                    motionGuides.appendChild(create('circle', {
                        cx: point.x,
                        cy: point.y,
                        r: 8,
                        fill: 'transparent',
                        class: 'sparky-motion-editor-control',
                        'data-motion-editor-kind': 'handle',
                        'data-motion-editor-index': index,
                        'data-motion-editor-side': side,
                        'data-selected': focusAnimation.selectedEditorControl === key
                            ? 'true'
                            : 'false'
                    }));
                });
            });
        }
        focusAnimation.path.anchors.forEach((anchor, index) => {
            const activeStop = focusAnimation.timeline?.activeStops?.[index] !== false;
            motionGuides.appendChild(create('circle', {
                cx: anchor.x,
                cy: anchor.y,
                r: editing ? 4.2 : index === 0 ? 3.4 : 2.5,
                fill: activeStop ? '#00ff2a' : state.backgroundColor,
                stroke: '#00ff2a',
                'stroke-width': editing ? 1 : 0.75,
                opacity: activeStop ? 0.9 : 0.5,
                'vector-effect': 'non-scaling-stroke',
                'pointer-events': 'none'
            }));
            if (editing) {
                motionGuides.appendChild(create('circle', {
                    cx: anchor.x,
                    cy: anchor.y,
                    r: 10,
                    fill: 'transparent',
                    class: 'sparky-motion-editor-control sparky-motion-editor-anchor',
                    'data-motion-editor-kind': 'anchor',
                    'data-motion-editor-index': index,
                    'data-selected': focusAnimation.selectedEditorControl === `anchor:${index}`
                        ? 'true'
                        : 'false'
                }));
            }
        });
        const current = focusAnimation.currentFocus;
        if (current && !editing) {
            motionGuides.appendChild(create('circle', {
                cx: current.x,
                cy: current.y,
                r: 4.5,
                fill: state.backgroundColor,
                stroke: '#00ff2a',
                'stroke-width': 1.5,
                'vector-effect': 'non-scaling-stroke'
            }));
        }
        guides.appendChild(motionGuides);
    }

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

    if (state.showPoint && !state.followCursor && state.focusMode !== 'animate') {
        append(guides,
            create('path', {
                d: `M ${geometry.focus.x - 9} ${geometry.focus.y} H ${geometry.focus.x + 9} M ${geometry.focus.x} ${geometry.focus.y - 9} V ${geometry.focus.y + 9}`,
                fill: 'none',
                stroke: '#0000FF',
                'stroke-width': 0.75,
                'stroke-linecap': 'square',
                'vector-effect': 'non-scaling-stroke',
                'pointer-events': 'none',
                'data-interactive': 'true',
                'data-export-exclude': 'true'
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

let focusControlsSyncing = false;

function syncManualFocusModeControls(app) {
    const followCursor = Boolean(app.settings.followCursor);
    const manual = document.getElementById('showPoint');
    const follow = document.getElementById('followCursor');
    if (manual) manual.checked = !followCursor;
    if (follow) follow.checked = followCursor;
}

function syncFocusControls(app) {
    syncManualFocusModeControls(app);
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
    forceGlobalPlacement(app);
    focusAnimation.editedPath = null;
    focusAnimation.manuallyEdited = false;
    focusAnimation.editing = false;
    focusAnimation.selectedEditorControl = null;
    const normalized = normalizeIncomingState(source);
    app.settingsStore.setMultiple(normalized, true);
    desktopFollowFocus = normalized.followCursor
        ? { x: normalized.focusX, y: normalized.focusY }
        : null;
    if (focusAnimationReady) {
        syncFocusAnimationControls(app);
        applyFocusMode(app);
    }
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
        if (!mobile && app.settings.focusMode === 'animate') return;
        const renderSettings = activeRenderSettings(app.settings);
        const focus = normalizedFocus(raw, renderSettings);
        const { x, y } = focus;
        if (mobile) {
            retargetMobileFocus(app, { x, y }, responseMs);
            return;
        }
        if (app.settings.followCursor) setTransientFollowFocus(app, x, y);
        else {
            beginInteractivePlacement(app);
            setFocus(app, x, y);
        }
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
            if (app.settings.focusMode === 'animate') return;
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
        if (app.settings.focusMode === 'animate') return;
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
        if (isMobileShowcase()
            || (app.settings.focusMode !== 'animate' && app.settings.followCursor)) scheduleFollow(event);
    });

    const finish = (event) => {
        if (event.pointerId !== pointerId) return;
        if (svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
        pointerId = null;
        if (!isMobileShowcase()) {
            app.history?.endTransaction();
            finishInteractivePlacement(app);
        }
    };
    svg.addEventListener('pointerup', finish);
    svg.addEventListener('pointercancel', finish);
}

function bindMotionPathEditing(app) {
    const svg = document.getElementById('mainSvg');
    if (!svg) return;
    let drag = null;

    const updateFromEvent = (event) => {
        if (!drag || event.pointerId !== drag.pointerId || !focusAnimation.path) return;
        const point = pointFromPointer(svg, event);
        if (!point) return;
        focusAnimation.path = drag.kind === 'anchor'
            ? moveFocusPathAnchor(focusAnimation.path, drag.index, point)
            : moveFocusPathHandle(focusAnimation.path, drag.index, drag.side, point);
        focusAnimation.editedPath = focusAnimation.path;
        focusAnimation.manuallyEdited = true;
        rebuildFocusAnimation(app, {
            restart: false,
            schedule: false,
            regenerate: false,
            preservePlayback: true
        });
    };

    svg.addEventListener('pointerdown', (event) => {
        if (!focusAnimation.editing
            || app.settings.focusMode !== 'animate'
            || isMobileShowcase()) return;
        const control = event.target.closest?.('[data-motion-editor-kind]');
        if (!control) return;
        const index = Number(control.dataset.motionEditorIndex);
        const kind = control.dataset.motionEditorKind;
        if (!Number.isInteger(index) || (kind !== 'anchor' && kind !== 'handle')) return;
        event.preventDefault();
        event.stopPropagation();
        drag = {
            pointerId: event.pointerId,
            kind,
            index,
            side: control.dataset.motionEditorSide || 'outgoing'
        };
        focusAnimation.selectedEditorControl = kind === 'anchor'
            ? `anchor:${index}`
            : `handle:${index}:${drag.side}`;
        svg.setPointerCapture(event.pointerId);
        app.renderNow();
    });
    svg.addEventListener('pointermove', (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        updateFromEvent(event);
    });
    const finish = (event) => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
        drag = null;
        app.renderNow();
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
    if (app.settings.followCursor) {
        commitTransientFollowFocus(app, { syncControls });
    }
    app.settingsStore.setMultiple({
        followCursor: false,
        showPoint: true
    });
    syncManualFocusModeControls(app);
    app.renderNow();
}

function bindManualFocusControls(app) {
    document.getElementById('showPoint')?.addEventListener('change', (event) => {
        if (event.target.checked) disableFollowCursor(app);
    });
    document.getElementById('followCursor')?.addEventListener('change', (event) => {
        if (!event.target.checked) return;
        app.settingsStore.setMultiple({
            showPoint: false,
            followCursor: true
        });
        syncManualFocusModeControls(app);
        app.renderNow();
    });

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
    app.settingsStore.subscribe('showPoint', () => syncManualFocusModeControls(app));
    app.settingsStore.subscribe('followCursor', (enabled) => {
        syncManualFocusModeControls(app);
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

function bindInteractivePlacement(app) {
    const isRangeInput = (target) => target instanceof HTMLInputElement && target.type === 'range';
    document.addEventListener('input', (event) => {
        if (isRangeInput(event.target)) {
            beginInteractivePlacement(app);
            previewBlurReducedUntil = performance.now() + 200;
            if (previewBlurRestoreTimer != null) clearTimeout(previewBlurRestoreTimer);
            previewBlurRestoreTimer = setTimeout(() => {
                previewBlurRestoreTimer = null;
                app.renderNow();
            }, 210);
        }
    }, { capture: true });
    document.addEventListener('change', (event) => {
        if (isRangeInput(event.target)) finishInteractivePlacement(app);
    }, { capture: true });
}

function setTransientFollowFocus(app, x, y) {
    const focus = normalizedFocus({ x, y }, app.settings);
    const polar = normalizedPolar(focusPointToPolar(focus, app.settings, app.settings.focusAngle));
    setFocusControls(app, polar, { displayOnly: true });
    const unchanged = desktopFollowFocus
        && desktopFollowFocus.x === focus.x
        && desktopFollowFocus.y === focus.y;
    desktopFollowFocus = { ...focus };
    if (unchanged) return;
    // Follow cursor is transient preview state. It must not dirty the selected
    // preset or add history entries until Focus is changed persistently with
    // Follow cursor disabled.
    beginInteractivePlacement(app);
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
            { id: 'motionDurationSlider', valueId: 'motionDurationValue', setting: 'motionDuration', min: 1, max: 10, decimals: 0, baseStep: 1, shiftStep: 1 },
            { id: 'motionPointCountSlider', valueId: 'motionPointCountValue', setting: 'motionPointCount', min: 2, max: 16, decimals: 0, baseStep: 1, shiftStep: 2 },
            { id: 'motionComplexitySlider', valueId: 'motionComplexityValue', setting: 'motionComplexity', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'motionSmoothnessSlider', valueId: 'motionSmoothnessValue', setting: 'motionSmoothness', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'motionStopCountSlider', valueId: 'motionStopCountValue', setting: 'motionStopCount', min: 1, max: 6, decimals: 0, baseStep: 1, shiftStep: 2 },
            { id: 'motionSpeedVariationSlider', valueId: 'motionSpeedVariationValue', setting: 'motionSpeedVariation', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'motionBlinkCountSlider', valueId: 'motionBlinkCountValue', setting: 'motionBlinkCount', min: 0, max: 12, decimals: 0, baseStep: 1, shiftStep: 2 },
            { id: 'motionEmotionVariationSlider', valueId: 'motionEmotionVariationValue', setting: 'motionEmotionVariation', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'motionBlurSlider', valueId: 'motionBlurValue', setting: 'motionBlur', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'eyePerspectiveSlider', valueId: 'eyePerspectiveValue', setting: 'eyePerspective', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'eyeSizeSlider', valueId: 'eyeSizeValue', setting: 'eyeSize', min: 0, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
            { id: 'eyeDistanceSlider', valueId: 'eyeDistanceValue', setting: 'eyeDistance', min: -100, max: 100, decimals: 0, baseStep: 1, shiftStep: 10 },
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
            if (storedPresets.Basic?.seeded === true) {
                delete storedPresets.Basic;
                removedObsoleteSeed = true;
            }
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
            'eyePerspective', 'eyeSize', 'eyeDistance', 'cute', 'angry',
            'motionDuration', 'motionPointCount', 'motionComplexity', 'motionSmoothness', 'motionStopCount', 'motionSpeedVariation',
            'motionBlinkCount', 'motionEmotionVariation', 'motionBlur',
            'motionSeed'
        ],
        decimals: 2
    },
    history: { maxSize: 80, debounceMs: 180 },
    snapshot: (tool) => extractEffectiveState(tool),
    restore: (tool, snapshot) => applyState(tool, snapshot),
    collectPreset: (tool) => extractEffectiveState(tool),
    applyPreset: (tool, preset) => applyState(tool, preset),
    syncControls: (tool) => {
        syncFocusControls(tool);
        syncFocusAnimationControls(tool);
    },
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
        tool.shortcuts?.register('space', (event) => {
            if (event.repeat) return;
            toggleFocusFreeze(tool);
        });
    },
    render(ctx) {
        try {
            const renderSettings = activeRenderSettings(ctx.settings);
            syncPageBackground(renderSettings.backgroundColor);
            const renderContext = renderSettings === ctx.settings
                ? ctx
                : { ...ctx, settings: renderSettings };
            const geometry = buildCharacterGeometry(renderSettings);
            const eyeGeometry = buildEyeGeometry(renderSettings, geometry, {
                placementMode: eyePlacementMode === 'global' ? 'global' : 'local',
                previousEyeGeometry: ctx.app.eyeGeometry
            });
            ctx.app.eyePlacementSearchMode = eyeGeometry.placementMode;
            document.documentElement.dataset.eyePlacementSearchMode = eyeGeometry.placementMode;
            retargetDisplayedEyes(ctx.app, eyeGeometry.pairCenter, {
                immediate: false
            });
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
        const frameworkExportPNG = tool.exportPNG.bind(tool);
        tool.animationExporter = new AnimationExporter({
            status: document.getElementById('animationExportStatus'),
            progress: document.getElementById('animationExportProgress'),
            message: document.getElementById('animationExportMessage'),
            cancelButton: document.getElementById('animationExportCancelBtn'),
            exportButtons: [
                document.getElementById('exportPngBtn'),
                document.getElementById('exportSvgBtn')
            ],
            onError(error) {
                if (tool.dialog) {
                    tool.dialog.alert({ title: 'Export failed', text: error.message });
                } else {
                    window.alert(`Export failed: ${error.message}`);
                }
            }
        });
        tool.exportSVG = async (filename) => {
            if (tool.settings.focusMode === 'animate' && !filename) {
                return exportFocusAnimation(tool, 'mp4');
            }
            stopBlink(tool);
            settleMobileFocusMotion();
            forceGlobalPlacement(tool);
            tool.renderNow();
            snapDisplayedEyes(tool);
            const name = filename || `${createSparkyExportBaseName()}.svg`;
            const svgString = createStaticSparkySvg({
                settings: tool.settings,
                characterGeometry: tool.characterGeometry,
                eyeGeometry: tool.eyeGeometry,
                width: tool.settings.width,
                height: tool.settings.height
            });
            tool._downloadText(svgString, name, 'image/svg+xml;charset=utf-8');
            return svgString;
        };
        tool.exportPNG = (filename, scaleFactor) => {
            if (tool.settings.focusMode === 'animate' && !filename) {
                return exportFocusAnimation(tool, 'png-sequence');
            }
            stopBlink(tool);
            settleMobileFocusMotion();
            forceGlobalPlacement(tool);
            tool.renderNow();
            snapDisplayedEyes(tool);
            const name = filename || `${createSparkyExportBaseName()}.png`;
            return frameworkExportPNG(name, scaleFactor);
        };
        desktopFollowFocus = tool.settings.followCursor
            ? { x: tool.settings.focusX, y: tool.settings.focusY }
            : null;
        bindFocusDragging(tool);
        bindMotionPathEditing(tool);
        bindManualFocusControls(tool);
        bindFocusAnimation(tool);
        bindInteractivePlacement(tool);
        syncFocusControls(tool);
        bindBlink(tool);
        bindMobileShowcase(tool);
        document.documentElement.classList.remove('sparky-initializing');
        document.getElementById('resetFocusBtn')?.addEventListener('click', () => {
            disableFollowCursor(tool);
            setPolarFocus(tool, 0, 0);
        });
        document.getElementById('exportSvgBtn')?.addEventListener('click', () => {
            tool.exportSVG().catch((error) => console.error('SVG export failed:', error));
        });
        document.getElementById('exportPngBtn')?.addEventListener('click', () => {
            Promise.resolve(tool.exportPNG()).catch(() => {});
        });
    }
});

export default app;
