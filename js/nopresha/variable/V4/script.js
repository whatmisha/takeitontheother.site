const word = document.querySelector("#word");
const axisReadout = document.querySelector("#axisReadout");
const cornerMark = document.querySelector(".corner-mark");
const text = word.textContent.trim();
const cornerText = cornerMark.textContent.trim();

const SIDE_PADDING = 10;
const TARGET_AXIS_MIN = 100;
const TARGET_AXIS_MAX = 900;
const TARGET_AXIS_RANGE = TARGET_AXIS_MAX - TARGET_AXIS_MIN;
const NEUTRAL_AXIS_VALUE = 500;
const FONT_SIZE_MEASURE = 100;
const GOLDEN_RATIO = 1.61803398875;
const GAMMA_MIN = 0.05;
const GAMMA_MAX = 12;
const SEARCH_STEPS = 18;
const INERTIA = 0.16;
const SNAP_DISTANCE = 0.05;
const SYSTEM_WEIGHT_CLASSES = {
    thin: { min: 100, max: 220 },
    regular: { min: 330, max: 470 },
    medium: { min: 560, max: 700 },
    bold: { min: 800, max: 900 },
};
const SYSTEM_CLASS_ORDER = [
    "bold",
    "bold",
    "medium",
    "medium",
    "regular",
    "regular",
    "thin",
    "thin",
];
const SYSTEM_CALIBRATION_VALUES = [
    160,
    400,
    630,
    850,
    850,
    630,
    400,
    160,
];
const initialPointerX = Number(new URLSearchParams(window.location.search).get("x"));
const startPointerX = Number.isFinite(initialPointerX) ? initialPointerX : window.innerWidth / 2;

const state = {
    pointerX: startPointerX,
    targetPointerX: startPointerX,
    raf: 0,
    needsFontSize: true,
    mode: "cursor",
    randomAssignments: [],
    cornerRandomValues: [],
    needsRandomFit: false,
};

word.textContent = "";

const letters = [...text].map((character) => {
    const span = document.createElement("span");
    span.className = "letter";
    span.textContent = character;
    span.dataset.letter = character;
    span.setAttribute("aria-hidden", "true");
    word.appendChild(span);
    return span;
});

cornerMark.textContent = "";

const cornerLetters = [...cornerText].map((character) => {
    const span = document.createElement("span");
    span.className = "corner-mark-letter";
    span.textContent = character;
    span.setAttribute("aria-hidden", "true");
    cornerMark.appendChild(span);
    return span;
});

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getTargetWidth() {
    return Math.max(window.innerWidth / GOLDEN_RATIO, 1);
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
    setLetterWidths(letters.map((_, index) => {
        return SYSTEM_CALIBRATION_VALUES[index] || NEUTRAL_AXIS_VALUE;
    }));

    const calibrationWidth = measureWordWidth();
    const targetFontSize = calibrationWidth > 0
        ? FONT_SIZE_MEASURE * getTargetWidth() / calibrationWidth
        : FONT_SIZE_MEASURE;

    document.documentElement.style.setProperty("--word-font-size", `${targetFontSize}px`);
    state.needsFontSize = false;
}

function getNormalizedDistances() {
    const wordRect = word.getBoundingClientRect();
    const pointerRatio = window.innerWidth > 0
        ? clamp(state.pointerX / window.innerWidth, 0, 1)
        : 0.5;
    const activeX = wordRect.left + wordRect.width * pointerRatio;
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
        const widthValue = TARGET_AXIS_MIN + Math.pow(distance, gamma) * TARGET_AXIS_RANGE;

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

    setLetterWidths(getWidthValues(normalizedDistances, bestGamma), true);
}

function getCornerRandomValues() {
    return cornerLetters.map(() => TARGET_AXIS_MIN + Math.random() * TARGET_AXIS_RANGE);
}

function getRandomValueInRange(range) {
    return range.min + Math.random() * (range.max - range.min);
}

function shuffleItems(items) {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        const currentItem = shuffled[index];

        shuffled[index] = shuffled[swapIndex];
        shuffled[swapIndex] = currentItem;
    }

    return shuffled;
}

function getSystemRandomAssignments() {
    const shuffledClasses = shuffleItems(SYSTEM_CLASS_ORDER);
    const assignments = [];

    letters.forEach((letter, index) => {
        const className = shuffledClasses[index];
        const range = SYSTEM_WEIGHT_CLASSES[className];

        assignments[index] = {
            className,
            min: range.min,
            max: range.max,
            value: getRandomValueInRange(range),
        };
    });

    return assignments;
}

function getAssignmentWidthValues(assignments, offset) {
    return assignments.map((assignment) => {
        return clamp(assignment.value + offset, assignment.min, assignment.max);
    });
}

function measureAtAssignmentOffset(assignments, offset) {
    setLetterWidths(getAssignmentWidthValues(assignments, offset));

    return measureWordWidth();
}

function findBestAssignmentOffset(assignments) {
    const targetWidth = getTargetWidth();
    let lowOffset = -TARGET_AXIS_RANGE;
    let highOffset = TARGET_AXIS_RANGE;
    let lowWidth = measureAtAssignmentOffset(assignments, lowOffset);
    let highWidth = measureAtAssignmentOffset(assignments, highOffset);
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
        const midWidth = measureAtAssignmentOffset(assignments, midOffset);
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
    if (!state.randomAssignments.length) {
        state.randomAssignments = getSystemRandomAssignments();
    }

    const bestOffset = findBestAssignmentOffset(state.randomAssignments);

    setLetterWidths(getAssignmentWidthValues(state.randomAssignments, bestOffset), true);
    state.needsRandomFit = false;
}

function setCornerMarkWidths(widthValues) {
    cornerLetters.forEach((letter, index) => {
        letter.style.fontVariationSettings = `"wght" ${widthValues[index].toFixed(2)}`;
    });
}

function updateCornerMarkWidth() {
    if (state.mode === "random" && state.cornerRandomValues.length) {
        setCornerMarkWidths(state.cornerRandomValues);

        return;
    }

    const widthValue = window.innerWidth > 0
        ? clamp(TARGET_AXIS_MIN + (state.pointerX / window.innerWidth) * TARGET_AXIS_RANGE, TARGET_AXIS_MIN, TARGET_AXIS_MAX)
        : TARGET_AXIS_MIN;

    setCornerMarkWidths(cornerLetters.map(() => widthValue));
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

    updateCornerMarkWidth();

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
    state.randomAssignments = getSystemRandomAssignments();
    state.cornerRandomValues = getCornerRandomValues();
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

window.addEventListener("click", (event) => {
    if (state.mode === "random") {
        startCursorMode();

        return;
    }

    state.pointerX = event.clientX;
    state.targetPointerX = event.clientX;
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
