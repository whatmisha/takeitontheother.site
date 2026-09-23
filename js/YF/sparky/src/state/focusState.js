import { clamp } from '../geometry/vector.js';
import {
    constrainFocusControlPoint,
    focusPointToPolar
} from '../geometry/focusBounds.js?v=20260828-2';

export function normalizedFocus(raw, state) {
    const constrained = constrainFocusControlPoint(raw, state);
    const rounded = {
        x: Number(constrained.x.toFixed(3)),
        y: Number(constrained.y.toFixed(3))
    };
    const final = constrainFocusControlPoint(rounded, state);
    return {
        x: Number(final.x.toFixed(6)),
        y: Number(final.y.toFixed(6))
    };
}

export function centeredFocus(state) {
    return normalizedFocus({
        x: state.boundaryCenterX,
        y: state.boundaryCenterY
    }, state);
}

export function normalizedPolar(raw = {}) {
    return {
        angle: clamp(Number(raw.angle) || 0, 0, 360),
        distance: clamp(Number(raw.distance) || 0, 0, 100)
    };
}

export function resolveManualFocusMode(state = {}) {
    const followCursor = Boolean(state.followCursor);
    return {
        followCursor,
        showPoint: !followCursor
    };
}

export function resolveEffectivePersistenceState(
    current,
    transientFocus,
    { mobileShowcase = false } = {}
) {
    if (mobileShowcase || !current.followCursor || !transientFocus) return { ...current };
    const focus = normalizedFocus(transientFocus, current);
    const polar = normalizedPolar(focusPointToPolar(focus, current, current.focusAngle));
    return {
        ...current,
        focusX: focus.x,
        focusY: focus.y,
        focusAngle: polar.angle,
        focusDistance: polar.distance
    };
}
