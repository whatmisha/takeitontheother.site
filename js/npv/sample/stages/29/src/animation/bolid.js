import { createMotionPathRegion } from '../geometry/focusBounds.js';
import { clamp } from '../geometry/vector.js';

export const BOLID_MAX_ANGRY = 88;
export const BOLID_FAR_STRENGTH_RATIO = 0.25;

const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const toRadians = (degrees) => degrees * Math.PI / 180;
const directionFromClockAngle = (degrees) => {
    const radians = toRadians(degrees);
    return { x: Math.sin(radians), y: -Math.cos(radians) };
};

export const normalizeBolidTargetAngle = (value) => clamp(finiteOr(value, 180), 0, 360);
export const normalizeBolidTargetDistance = (value) => clamp(finiteOr(value, 40), 0, 100);
export const normalizeBolidIntensity = (value) => clamp(finiteOr(value, 100), 0, 100);

function distanceToCircleAlongRay(focus, direction, center, radius) {
    const offsetX = focus.x - center.x;
    const offsetY = focus.y - center.y;
    const projection = offsetX * direction.x + offsetY * direction.y;
    const constant = offsetX * offsetX + offsetY * offsetY - radius * radius;
    const discriminant = Math.max(0, projection * projection - constant);
    return Math.max(0, -projection + Math.sqrt(discriminant));
}

export function bolidTargetPoint(settings, focus) {
    const region = createMotionPathRegion(settings);
    const direction = directionFromClockAngle(normalizeBolidTargetAngle(
        settings.bolidTargetAngle
    ));
    const maximum = distanceToCircleAlongRay(
        focus,
        direction,
        region.center,
        region.radius
    );
    const amount = normalizeBolidTargetDistance(settings.bolidTargetDistance) / 100;
    return {
        x: focus.x + direction.x * maximum * amount,
        y: focus.y + direction.y * maximum * amount
    };
}

export function bolidTargetPolarFromPoint(settings, focus, raw, fallbackAngle = 180) {
    const deltaX = finiteOr(raw?.x, focus.x) - focus.x;
    const deltaY = finiteOr(raw?.y, focus.y) - focus.y;
    const magnitude = Math.hypot(deltaX, deltaY);
    const angle = magnitude <= 1e-9
        ? normalizeBolidTargetAngle(fallbackAngle)
        : ((Math.atan2(deltaX, -deltaY) * 180 / Math.PI) + 360) % 360;
    const direction = directionFromClockAngle(angle);
    const region = createMotionPathRegion(settings);
    const maximum = distanceToCircleAlongRay(
        focus,
        direction,
        region.center,
        region.radius
    );
    return {
        angle,
        distance: maximum <= 1e-9 ? 0 : clamp(magnitude / maximum * 100, 0, 100)
    };
}

export function resolveBolidStrength(settings) {
    const intensity = normalizeBolidIntensity(settings.bolidIntensity) / 100;
    const linearProximity = 1 - normalizeBolidTargetDistance(settings.bolidTargetDistance) / 100;
    const proximity = linearProximity ** 1.2;
    return intensity * (
        BOLID_FAR_STRENGTH_RATIO
        + (1 - BOLID_FAR_STRENGTH_RATIO) * proximity
    );
}

function seamlessPhase(rawTimeMs, durationMs, frequencyHz) {
    const duration = Math.max(1, finiteOr(durationMs, 5000));
    const time = ((finiteOr(rawTimeMs, 0) % duration) + duration) % duration;
    const cycleCount = Math.max(1, Math.round(duration / 1000 * frequencyHz));
    return ((time / duration * cycleCount) % 1 + 1) % 1;
}

export function resolveBolidPhases(rawTimeMs, durationMs) {
    return {
        primary: seamlessPhase(rawTimeMs, durationMs, 2),
        detail: seamlessPhase(rawTimeMs, durationMs, 5),
        flutter: seamlessPhase(rawTimeMs, durationMs, 9),
        jitter: seamlessPhase(rawTimeMs, durationMs, 13)
    };
}

export function settingsAtBolidTime(settings, rawTimeMs, durationMs) {
    if (settings.focusMode !== 'bolid') return settings;
    const duration = Math.max(
        1,
        finiteOr(durationMs, finiteOr(settings.motionDuration, 5) * 1000)
    );
    const phases = resolveBolidPhases(rawTimeMs, duration);
    const strength = resolveBolidStrength(settings);
    const baseAngry = clamp(finiteOr(settings.angry, 0), 0, 100);
    return {
        ...settings,
        bolidActive: true,
        bolidStrength: strength,
        bolidPrimaryPhase: phases.primary,
        bolidDetailPhase: phases.detail,
        bolidFlutterPhase: phases.flutter,
        bolidJitterPhase: phases.jitter,
        rayLengthVariation: strength * 34,
        rayWidthVariation: strength * 16,
        rayModulationFrequency: 1,
        rayModulationPhase: phases.primary * 360,
        angry: settings.bolidAngryEyes === false
            ? baseAngry
            : Math.min(
                BOLID_MAX_ANGRY,
                baseAngry + (BOLID_MAX_ANGRY - baseAngry) * strength
            )
    };
}

/**
 * A time-independent Bolid profile used only to place the eye rig. The visible
 * head keeps every broad wave, flutter and tremor; the eye scaffold retains the
 * target direction and deformation strength without inheriting frame-to-frame
 * changes that can make the optical placement solver jump between basins.
 */
export function bolidEyeScaffoldSettings(settings) {
    if (!settings.bolidActive) return settings;
    return {
        ...settings,
        bolidEyeScaffold: true,
        bolidPrimaryPhase: 0,
        bolidDetailPhase: 0,
        bolidFlutterPhase: 0,
        bolidJitterPhase: 0,
        rayModulationPhase: 0
    };
}

const shortestAngleDelta = (from, to) => ((to - from + 540) % 360) - 180;

export function bolidRayAdjustment(settings, index, count, angleDeg) {
    const strength = clamp(finiteOr(settings.bolidStrength, 0), 0, 1);
    if (!settings.bolidActive || strength <= 1e-9) {
        return {
            angleOffset: 0,
            lengthFactor: 1,
            widthFactor: 1,
            tipOffset: { x: 0, y: 0 }
        };
    }

    const flightAngle = normalizeBolidTargetAngle(settings.bolidTargetAngle) - 90;
    const trailAngle = flightAngle + 180;
    const rayDirection = {
        x: Math.cos(toRadians(angleDeg)),
        y: Math.sin(toRadians(angleDeg))
    };
    const trailDirection = {
        x: Math.cos(toRadians(trailAngle)),
        y: Math.sin(toRadians(trailAngle))
    };
    const lateralDirection = { x: -trailDirection.y, y: trailDirection.x };
    const alignment = rayDirection.x * trailDirection.x + rayDirection.y * trailDirection.y;
    const rearWeight = 0.18 + 0.82 * ((alignment + 1) / 2) ** 1.6;
    const position = count <= 1 ? 0 : index / (count - 1) - 0.5;
    const primaryPhase = finiteOr(settings.bolidPrimaryPhase, 0) * Math.PI * 2;
    const detailPhase = finiteOr(settings.bolidDetailPhase, 0) * Math.PI * 2;
    const flutterPhase = finiteOr(settings.bolidFlutterPhase, 0) * Math.PI * 2;
    const jitterPhase = finiteOr(settings.bolidJitterPhase, 0) * Math.PI * 2;
    const scaffold = Boolean(settings.bolidEyeScaffold);
    const broadWave = Math.sin(primaryPhase + position * Math.PI * 1.35);
    const detailWave = scaffold
        ? 0
        : Math.sin(detailPhase - position * Math.PI * 2.4 + 0.8);
    const flutter = broadWave * 0.76 + detailWave * 0.24;
    const tremor = scaffold
        ? 0
        : Math.sin(flutterPhase + position * Math.PI * 6.2) * 0.64
            + Math.sin(jitterPhase - position * Math.PI * 9.4 + 0.65) * 0.36;
    const pulse = scaffold
        ? 1
        : 0.88 + 0.12 * Math.sin(primaryPhase + position * Math.PI);
    const tremorWeight = strength * (0.25 + rearWeight * 0.75);
    const trailDistance = 72 * strength * rearWeight * pulse
        + 2.8 * tremorWeight * tremor;
    const lateralDistance = 11 * strength * (0.3 + rearWeight * 0.7) * flutter
        + 5.2 * tremorWeight * tremor;
    const comb = shortestAngleDelta(angleDeg, trailAngle)
        * 0.11 * strength * rearWeight;

    return {
        angleOffset: comb
            + flutter * 2.8 * strength * rearWeight
            + tremor * 1.9 * tremorWeight,
        lengthFactor: 1 + 0.16 * strength * rearWeight + tremor * 0.022 * tremorWeight,
        widthFactor: 1 - 0.1 * strength * rearWeight - tremor * 0.014 * tremorWeight,
        tipOffset: {
            x: trailDirection.x * trailDistance + lateralDirection.x * lateralDistance,
            y: trailDirection.y * trailDistance + lateralDirection.y * lateralDistance
        }
    };
}
