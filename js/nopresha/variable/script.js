const word = document.querySelector("#word");
const axisReadout = document.querySelector("#axisReadout");
const cornerAsterisk = document.querySelector(".corner-asterisk");
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
    mode: "cursor",
    randomBaseValues: [],
    needsRandomFit: false,
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

function updateAxisReadout(widthValues) {
    axisReadout.textContent = widthValues
        .map((widthValue, index) => `${text[index]} ${widthValue.toFixed(1)}`)
        .join(" · ");
}

function setLetterWidths(widthValues, shouldUpdateReadout = false) {
    letters.forEach((letter, index) => {
        letter.style.setProperty("--width-value", widthValues[index].toFixed(2));
    });

    if (shouldUpdateReadout) {
        updateAxisReadout(widthValues);
    }
}

function measureWordWidth() {
    return word.getBoundingClientRect().width;
}

function updateFontSizeForViewport() {
    document.documentElement.style.setProperty("--word-font-size", `${FONT_SIZE_MEASURE}px`);
    setLetterWidths(letters.map(() => NEUTRAL_AXIS_VALUE));

    const neutralWidth = measureWordWidth();
    const targetFontSize = neutralWidth > 0
        ? FONT_SIZE_MEASURE * getTargetWidth() / neutralWidth
        : FONT_SIZE_MEASURE;

    document.documentElement.style.setProperty("--word-font-size", `${targetFontSize}px`);
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

function getOffsetWidthValues(baseValues, offset) {
    return baseValues.map((widthValue) => {
        return clamp(widthValue + offset, TARGET_AXIS_MIN, TARGET_AXIS_MAX);
    });
}

function measureAtOffset(baseValues, offset) {
    setLetterWidths(getOffsetWidthValues(baseValues, offset));

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

    setLetterWidths(getWidthValues(normalizedDistances, bestGamma), true);
}

function getRandomBaseValues() {
    return letters.map(() => Math.random() * TARGET_AXIS_MAX);
}

function findBestOffset(baseValues) {
    const targetWidth = getTargetWidth();
    let lowOffset = -TARGET_AXIS_MAX;
    let highOffset = TARGET_AXIS_MAX;
    let lowWidth = measureAtOffset(baseValues, lowOffset);
    let highWidth = measureAtOffset(baseValues, highOffset);
    let bestOffset = lowOffset;
    let bestError = Math.abs(lowWidth - targetWidth);
    const highError = Math.abs(highWidth - targetWidth);

    if (highError < bestError) {
        bestOffset = highOffset;
        bestError = highError;
    }

    const minReachableWidth = Math.min(lowWidth, highWidth);
    const maxReachableWidth = Math.max(lowWidth, highWidth);

    if (targetWidth <= minReachableWidth || targetWidth >= maxReachableWidth) {
        return bestOffset;
    }

    const increasesWithOffset = highWidth > lowWidth;

    for (let step = 0; step < SEARCH_STEPS; step += 1) {
        const midOffset = (lowOffset + highOffset) / 2;
        const midWidth = measureAtOffset(baseValues, midOffset);
        const midError = Math.abs(midWidth - targetWidth);

        if (midError < bestError) {
            bestOffset = midOffset;
            bestError = midError;
        }

        if (increasesWithOffset) {
            if (midWidth < targetWidth) {
                lowOffset = midOffset;
            } else {
                highOffset = midOffset;
            }
        } else if (midWidth > targetWidth) {
            lowOffset = midOffset;
        } else {
            highOffset = midOffset;
        }
    }

    return bestOffset;
}

function applyRandomWidths() {
    if (!state.randomBaseValues.length) {
        state.randomBaseValues = getRandomBaseValues();
    }

    const bestOffset = findBestOffset(state.randomBaseValues);

    setLetterWidths(getOffsetWidthValues(state.randomBaseValues, bestOffset), true);
    state.needsRandomFit = false;
}

function updateAsteriskWidth() {
    const widthValue = window.innerWidth > 0
        ? clamp((state.pointerX / window.innerWidth) * TARGET_AXIS_MAX, TARGET_AXIS_MIN, TARGET_AXIS_MAX)
        : TARGET_AXIS_MIN;

    cornerAsterisk.style.setProperty("--asterisk-width-value", widthValue.toFixed(2));
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
    const needsFontSize = state.needsFontSize;

    if (state.needsFontSize) {
        updateFontSizeForViewport();
    }

    if (state.mode === "random") {
        if (state.needsRandomFit || needsFontSize) {
            applyRandomWidths();
        }
    } else {
        applyWidthGradient();
        applyWidthGradient();
    }

    updateAsteriskWidth();

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

function startRandomMode() {
    state.mode = "random";
    state.randomBaseValues = getRandomBaseValues();
    state.needsRandomFit = true;
    requestUpdate();
}

function startCursorMode() {
    state.mode = "cursor";
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

window.addEventListener("click", () => {
    if (state.mode === "random") {
        startCursorMode();

        return;
    }

    startRandomMode();
});

window.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.key !== " ") {
        return;
    }

    event.preventDefault();

    if (!event.repeat) {
        startRandomMode();
    }
});

window.addEventListener("resize", () => {
    state.pointerX = clamp(state.pointerX, 0, window.innerWidth);
    state.targetPointerX = clamp(state.targetPointerX, 0, window.innerWidth);
    state.needsFontSize = true;
    requestUpdate();
});

document.fonts.ready.then(() => {
    state.needsFontSize = true;
    updateWidths();
});
updateWidths();
