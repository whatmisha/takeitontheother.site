const word = document.querySelector("#word");
const text = word.textContent.trim();

const SIDE_PADDING = 10;
const TARGET_AXIS_MIN = 0;
const TARGET_AXIS_MAX = 100;
const NEUTRAL_AXIS_VALUE = 50;
const FONT_SIZE_MEASURE = 100;
const GAMMA_MIN = 0.05;
const GAMMA_MAX = 12;
const SEARCH_STEPS = 18;
const INERTIA = 0.16;
const SNAP_DISTANCE = 0.05;
const initialPointerX = Number(new URLSearchParams(window.location.search).get("x"));
const startPointerX = Number.isFinite(initialPointerX) ? initialPointerX : window.innerWidth / 2;

const state = {
    pointerX: startPointerX,
    targetPointerX: startPointerX,
    raf: 0,
    needsFontSize: true,
};

word.textContent = "";

const letters = [...text].map((character) => {
    const span = document.createElement("span");
    span.className = "letter";
    span.textContent = character;
    span.setAttribute("aria-hidden", "true");
    word.appendChild(span);
    return span;
});

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getTargetWidth() {
    return Math.max(window.innerWidth - SIDE_PADDING * 2, 1);
}

function setLetterWidths(widthValues) {
    letters.forEach((letter, index) => {
        letter.style.setProperty("--width-value", widthValues[index].toFixed(2));
    });
}

function measureWordWidth() {
    return word.getBoundingClientRect().width;
}

function updateFontSizeForViewport() {
    word.style.setProperty("--word-font-size", `${FONT_SIZE_MEASURE}px`);
    setLetterWidths(letters.map(() => NEUTRAL_AXIS_VALUE));

    const neutralWidth = measureWordWidth();
    const targetFontSize = neutralWidth > 0
        ? FONT_SIZE_MEASURE * getTargetWidth() / neutralWidth
        : FONT_SIZE_MEASURE;

    word.style.setProperty("--word-font-size", `${targetFontSize}px`);
    state.needsFontSize = false;
}

function getNormalizedDistances() {
    const activeX = clamp(state.pointerX, SIDE_PADDING, window.innerWidth - SIDE_PADDING);
    const distances = letters.map((letter) => {
        const letterRect = letter.getBoundingClientRect();
        const letterCenterX = letterRect.left + letterRect.width / 2;

        return Math.abs(letterCenterX - activeX);
    });
    const nearestDistance = Math.min(...distances);
    const farthestDistance = Math.max(...distances);
    const distanceRange = farthestDistance - nearestDistance || 1;

    return distances.map((distance) => {
        return clamp((distance - nearestDistance) / distanceRange, 0, 1);
    });
}

function getWidthValues(normalizedDistances, gamma) {
    return normalizedDistances.map((distance) => {
        const widthValue = Math.pow(distance, gamma) * TARGET_AXIS_MAX;

        return clamp(widthValue, TARGET_AXIS_MIN, TARGET_AXIS_MAX);
    });
}

function measureAtGamma(normalizedDistances, gamma) {
    setLetterWidths(getWidthValues(normalizedDistances, gamma));

    return measureWordWidth();
}

function findBestGamma(normalizedDistances) {
    const targetWidth = getTargetWidth();
    let lowGamma = GAMMA_MIN;
    let highGamma = GAMMA_MAX;
    let lowWidth = measureAtGamma(normalizedDistances, lowGamma);
    let highWidth = measureAtGamma(normalizedDistances, highGamma);
    let bestGamma = lowGamma;
    let bestError = Math.abs(lowWidth - targetWidth);
    const highError = Math.abs(highWidth - targetWidth);

    if (highError < bestError) {
        bestGamma = highGamma;
        bestError = highError;
    }

    const minReachableWidth = Math.min(lowWidth, highWidth);
    const maxReachableWidth = Math.max(lowWidth, highWidth);

    if (targetWidth <= minReachableWidth || targetWidth >= maxReachableWidth) {
        return bestGamma;
    }

    const decreasesWithGamma = lowWidth > highWidth;

    for (let step = 0; step < SEARCH_STEPS; step += 1) {
        const midGamma = (lowGamma + highGamma) / 2;
        const midWidth = measureAtGamma(normalizedDistances, midGamma);
        const midError = Math.abs(midWidth - targetWidth);

        if (midError < bestError) {
            bestGamma = midGamma;
            bestError = midError;
        }

        if (decreasesWithGamma) {
            if (midWidth > targetWidth) {
                lowGamma = midGamma;
            } else {
                highGamma = midGamma;
            }
        } else if (midWidth < targetWidth) {
            lowGamma = midGamma;
        } else {
            highGamma = midGamma;
        }
    }

    return bestGamma;
}

function applyWidthGradient() {
    const normalizedDistances = getNormalizedDistances();
    const bestGamma = findBestGamma(normalizedDistances);

    setLetterWidths(getWidthValues(normalizedDistances, bestGamma));
}

function advancePointer() {
    const distance = state.targetPointerX - state.pointerX;

    if (Math.abs(distance) <= SNAP_DISTANCE) {
        state.pointerX = state.targetPointerX;

        return false;
    }

    state.pointerX += distance * INERTIA;

    return true;
}

function updateWidths() {
    state.raf = 0;
    const isPointerMoving = advancePointer();

    if (state.needsFontSize) {
        updateFontSizeForViewport();
    }

    applyWidthGradient();
    applyWidthGradient();

    if (isPointerMoving) {
        requestUpdate();
    }
}

function requestUpdate() {
    if (state.raf) {
        return;
    }

    state.raf = window.requestAnimationFrame(updateWidths);
}

function setPointerX(clientX) {
    state.targetPointerX = clamp(clientX, 0, window.innerWidth);
    requestUpdate();
}

window.addEventListener("pointermove", (event) => {
    setPointerX(event.clientX);
});

window.addEventListener("mousemove", (event) => {
    setPointerX(event.clientX);
});

window.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];

    if (touch) {
        setPointerX(touch.clientX);
    }
}, { passive: true });

window.addEventListener("resize", () => {
    state.pointerX = clamp(state.pointerX, 0, window.innerWidth);
    state.targetPointerX = clamp(state.targetPointerX, 0, window.innerWidth);
    state.needsFontSize = true;
    requestUpdate();
});

document.fonts.ready.then(updateWidths);
updateWidths();
