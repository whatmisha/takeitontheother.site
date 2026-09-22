let mic, fft;
let resolution = 300;
let isRunning = false;
let isPaused = false; // Pause variable
let thresholdSlider; // Threshold slider
let thresholdValue = 0.01; // Minimum contrast (due to slider inversion with 0.2)
let invertedMode = true; // Inversion mode (white lines on black or black lines on white)
let modeXSlider, modeYSlider; // Mode sliders
let modeX = 1, modeY = 8; // Initial mode values: min X, medium Y
let sensitivitySlider; // Sensitivity slider
let sensitivity = 5.0; // Maximum microphone sensitivity
let smoothingSlider; // Smoothing slider
let smoothingValue = 0.5; // Medium smoothing
// Smoothing parameters
let currentNX = 1;
let currentNY = 8;
let currentAmplitude = 1.0;
let gradientModeCheckbox;
let useGradientMode = false; // Disable gradient mode by default (enable contrast)
let noiseCheckbox; // Checkbox for noise effect
let useNoiseEffect = true; // Noise effect is on by default
let diagLinesCheckbox; // Checkbox for diagonal lines
let showDiagLines = false; // Diagonal lines are off by default
let invertCheckbox; // Checkbox for color inversion
let lastFrameState = null; // To store the last state on pause
let audioReactiveXCheckbox, audioReactiveYCheckbox; // Отдельные чекбоксы для X и Y
let useAudioReactiveXMode = true; // Аудио-реактивный режим для X включен по умолчанию
let useAudioReactiveYMode = true; // Аудио-реактивный режим для Y включен по умолчанию

function setup() {
  // Create canvas and place it in the container
  const canvas = createCanvas(600, 600);
  canvas.parent('canvas-container');
  pixelDensity(1);

  // Setup audio analyzers
  mic = new p5.AudioIn();
  fft = new p5.FFT(smoothingValue, 1024); // Increased FFT size for better resolution
  fft.setInput(mic);

  noStroke();
  
  // Create sliders for threshold and modes
  createControlSliders();
  
  // Отключаем слайдеры X и Y при старте, так как аудио-реактивный режим включен по умолчанию
  if (useAudioReactiveXMode || useAudioReactiveYMode) {
    toggleSliderInteractivity(false);
  }
  
  // Setup interface
  setupInterface();
  
  // Draw initial state
  drawStaticPattern(modeX, modeY);
}

// Add keyPressed function to handle spacebar for pause
function keyPressed() {
  if (key === ' ' && isRunning) { // Check for spacebar and if mic is running
    isPaused = !isPaused;
    console.log(isPaused ? 'Pause activated' : 'Pause deactivated');
  }
  return false; // Prevent default behavior
}

function draw() {
  if (!isRunning || isPaused) {
    // If paused and we have a saved state - do nothing
    if (isPaused && lastFrameState !== null) return;
    
    // If not paused or no saved state - just exit
    if (!isPaused) return;
  }
  
  // Get audio spectrum
  let spectrum = fft.analyze();
  
  // Measure overall microphone volume
  let volume = mic.getLevel();
  
  // Get energy in different ranges
  let bass = fft.getEnergy("bass") * sensitivity;
  let lowMid = fft.getEnergy("lowMid") * sensitivity;
  let mid = fft.getEnergy("mid") * sensitivity;
  let highMid = fft.getEnergy("highMid") * sensitivity;
  let treble = fft.getEnergy("treble") * sensitivity;
  
  // Normalize values to react even to quiet sounds
  let bassNorm = normalizeEnergy(bass);
  let trebleNorm = normalizeEnergy(treble);

  // Define target values based on audio
  let targetNX, targetNY;
  
  // Handle X mode based on audio reactivity setting
  if (useAudioReactiveXMode) {
    // Calculate X mode directly from audio (more dramatic effect)
    // Инвертируем зависимость - высокий уровень басов даёт низкие значения X
    // Используем sensitivity для влияния на диапазон изменения
    const minX = 1;
    const maxX = 12;
    // При высокой чувствительности - больший диапазон изменения параметра
    const rangeX = map(sensitivity, 0.5, 5, (maxX - minX) * 0.3, maxX - minX);
    // Центр диапазона и диапазон изменения зависят от чувствительности
    const centerX = maxX - rangeX / 2;
    targetNX = map(bassNorm, 0, 1, centerX + rangeX/2, centerX - rangeX/2);
    // Ограничиваем значения
    targetNX = constrain(targetNX, minX, maxX);
    
    // Update X slider position visually
    modeXSlider.value(targetNX);
    
    // Update base value for smooth transitions
    modeX = targetNX;
  } else {
    // Standard mode - X slider sets base value with subtle audio influence
    targetNX = modeX + map(bassNorm, 0, 1, 0, 5); // Sound influences in range +0 to +5
  }
  
  // Handle Y mode based on audio reactivity setting
  if (useAudioReactiveYMode) {
    // Calculate Y mode directly from audio (more dramatic effect)
    // Используем sensitivity для влияния на диапазон изменения
    const minY = 1;
    const maxY = 12;
    // При высокой чувствительности - больший диапазон изменения параметра
    const rangeY = map(sensitivity, 0.5, 5, (maxY - minY) * 0.3, maxY - minY);
    // Центр диапазона и диапазон изменения зависят от чувствительности
    const centerY = minY + rangeY / 2;
    targetNY = map(trebleNorm, 0, 1, centerY - rangeY/2, centerY + rangeY/2);
    // Ограничиваем значения
    targetNY = constrain(targetNY, minY, maxY);
    
    // Update Y slider position visually
    modeYSlider.value(targetNY);
    
    // Update base value for smooth transitions
    modeY = targetNY;
  } else {
    // Standard mode - Y slider sets base value with subtle audio influence
    targetNY = modeY + map(trebleNorm, 0, 1, 0, 5);
  }
  
  let targetAmplitude = map(mid, 0, 255 * sensitivity, 0.5, 3);
  
  // Smooth transitions for more fluid animation
  currentNX = lerp(currentNX, targetNX, 1 - smoothingValue);
  currentNY = lerp(currentNY, targetNY, 1 - smoothingValue);
  currentAmplitude = lerp(currentAmplitude, targetAmplitude, 1 - smoothingValue);
  
  // No need to round to integers anymore since we allow fractional values
  let nX = currentNX;
  let nY = currentNY;
  
  // Minimum 1 to avoid errors
  nX = max(1, nX);
  nY = max(1, nY);
  
  // Output information about current parameters and sound level
  console.log(`Volume: ${volume.toFixed(4)}, Bass: ${bassNorm.toFixed(2)}, Treble: ${trebleNorm.toFixed(2)}, nX: ${nX.toFixed(2)}, nY: ${nY.toFixed(2)}, Amplitude: ${currentAmplitude.toFixed(2)}`);

  // Dynamically change threshold value based on volume
  let dynamicThreshold = map(volume, 0, 0.1, thresholdValue * 2, thresholdValue * 0.8);
  dynamicThreshold = constrain(dynamicThreshold, 0.01, 0.2);
  
  // Draw Chladni figure with dynamic threshold
  drawChladniPattern(nX, nY, currentAmplitude, dynamicThreshold);
  
  // Save last state for pause
  if (isRunning) {
    lastFrameState = {
      nX: nX,
      nY: nY,
      amplitude: currentAmplitude,
      threshold: dynamicThreshold
    };
  }
}

// Function to toggle slider interactivity
function toggleSliderInteractivity(enabled) {
  // Now we need to handle X and Y sliders separately
  if (modeXSlider) {
    if (enabled && !useAudioReactiveXMode) {
      modeXSlider.removeAttribute('disabled');
      modeXSlider.style('opacity', '1');
    } else {
      modeXSlider.attribute('disabled', '');
      modeXSlider.style('opacity', '0.5');
    }
  }
  
  if (modeYSlider) {
    if (enabled && !useAudioReactiveYMode) {
      modeYSlider.removeAttribute('disabled');
      modeYSlider.style('opacity', '1');
    } else {
      modeYSlider.attribute('disabled', '');
      modeYSlider.style('opacity', '0.5');
    }
  }
}

// Function to normalize sound energy with amplification of weak signals
function normalizeEnergy(energy) {
  // Non-linear transformation to amplify weak signals
  // Use square root for more even response
  return pow(constrain(energy / (255 * sensitivity), 0, 1), 0.5);
}

function createControlSliders() {
  // Create slider for threshold adjustment
  // Значение 0.2 на слайдере соответствует минимальному контрасту (thresholdValue = 0.01)
  // Значение 0.01 на слайдере соответствует максимальному контрасту (thresholdValue = 0.2)
  thresholdSlider = createSlider(0.01, 0.2, 0.2, 0.01);
  thresholdSlider.parent('threshold-slider-container');
  thresholdSlider.style('width', '100%');
  // Добавляем метки минимального и максимального значений
  let thresholdLabels = createDiv('<span style="float:left">0.01</span><span style="float:right">0.2</span>');
  thresholdLabels.parent('threshold-slider-container');
  thresholdLabels.style('width', '100%');
  thresholdLabels.style('font-size', '12px');
  thresholdLabels.style('color', '#999');
  thresholdLabels.style('margin-top', '2px');
  
  thresholdSlider.input(() => {
    // Инвертируем значение слайдера
    thresholdValue = 0.21 - thresholdSlider.value();
    // Update static pattern if microphone is not active
    if (!isRunning) {
      drawStaticPattern(modeX, modeY);
    }
  });
  
  // Create sliders for X and Y modes
  modeXSlider = createSlider(1, 15, modeX, 0.1);
  modeXSlider.parent('modeX-slider-container');
  modeXSlider.style('width', '100%');
  // Добавляем метки минимального и максимального значений
  let modeXLabels = createDiv('<span style="float:left">1</span><span style="float:right">15</span>');
  modeXLabels.parent('modeX-slider-container');
  modeXLabels.style('width', '100%');
  modeXLabels.style('font-size', '12px');
  modeXLabels.style('color', '#999');
  modeXLabels.style('margin-top', '2px');
  
  modeXSlider.input(() => {
    modeX = modeXSlider.value();
    // Update current state nX immediately
    currentNX = modeX;
    // Update image if microphone is not active
    if (!isRunning) {
      drawStaticPattern(modeX, modeY);
    }
  });
  
  modeYSlider = createSlider(1, 15, modeY, 0.1);
  modeYSlider.parent('modeY-slider-container');
  modeYSlider.style('width', '100%');
  // Добавляем метки минимального и максимального значений
  let modeYLabels = createDiv('<span style="float:left">1</span><span style="float:right">15</span>');
  modeYLabels.parent('modeY-slider-container');
  modeYLabels.style('width', '100%');
  modeYLabels.style('font-size', '12px');
  modeYLabels.style('color', '#999');
  modeYLabels.style('margin-top', '2px');
  
  modeYSlider.input(() => {
    modeY = modeYSlider.value();
    // Update current state nY immediately
    currentNY = modeY;
    // Update image if microphone is not active
    if (!isRunning) {
      drawStaticPattern(modeX, modeY);
    }
  });
  
  // Add slider for sensitivity adjustment
  sensitivitySlider = createSlider(0.5, 5, sensitivity, 0.1);
  sensitivitySlider.parent('sensitivity-slider-container');
  sensitivitySlider.style('width', '100%');
  // Добавляем метки минимального и максимального значений
  let sensitivityLabels = createDiv('<span style="float:left">0.5</span><span style="float:right">5</span>');
  sensitivityLabels.parent('sensitivity-slider-container');
  sensitivityLabels.style('width', '100%');
  sensitivityLabels.style('font-size', '12px');
  sensitivityLabels.style('color', '#999');
  sensitivityLabels.style('margin-top', '2px');
  
  sensitivitySlider.input(() => {
    sensitivity = sensitivitySlider.value();
  });
  
  // Add slider for smoothing adjustment
  smoothingSlider = createSlider(0, 0.95, smoothingValue, 0.05);
  smoothingSlider.parent('smoothing-slider-container');
  smoothingSlider.style('width', '100%');
  // Добавляем метки минимального и максимального значений
  let smoothingLabels = createDiv('<span style="float:left">0</span><span style="float:right">0.95</span>');
  smoothingLabels.parent('smoothing-slider-container');
  smoothingLabels.style('width', '100%');
  smoothingLabels.style('font-size', '12px');
  smoothingLabels.style('color', '#999');
  smoothingLabels.style('margin-top', '2px');
  
  smoothingSlider.input(() => {
    smoothingValue = smoothingSlider.value();
    fft.smooth(smoothingValue);
  });
  
  // Checkbox for gradient mode
  gradientModeCheckbox = createCheckbox('', useGradientMode);
  gradientModeCheckbox.parent('gradient-checkbox-container');
  gradientModeCheckbox.changed(() => {
    useGradientMode = gradientModeCheckbox.checked();
    if (!isRunning) {
      drawStaticPattern(modeX, modeY);
    }
  });
  
  // Checkbox for noise effect
  noiseCheckbox = createCheckbox('', useNoiseEffect);
  noiseCheckbox.parent('noise-checkbox-container');
  noiseCheckbox.changed(() => {
    useNoiseEffect = noiseCheckbox.checked();
    if (!isRunning) {
      drawStaticPattern(modeX, modeY);
    }
  });
  
  // Checkbox for diagonal lines
  diagLinesCheckbox = createCheckbox('', showDiagLines);
  diagLinesCheckbox.parent('diag-lines-checkbox-container');
  diagLinesCheckbox.changed(() => {
    showDiagLines = diagLinesCheckbox.checked();
    if (!isRunning) {
      drawStaticPattern(modeX, modeY);
    }
  });
  
  // Checkbox for color inversion
  invertCheckbox = createCheckbox('', invertedMode);
  invertCheckbox.parent('invert-checkbox-container');
  invertCheckbox.changed(() => {
    invertedMode = invertCheckbox.checked();
    if (!isRunning || isPaused) {
      if (isPaused && lastFrameState) {
        // If paused, use last state
        drawChladniPattern(
          lastFrameState.nX, 
          lastFrameState.nY, 
          lastFrameState.amplitude, 
          lastFrameState.threshold
        );
      } else {
        drawStaticPattern(modeX, modeY);
      }
    }
  });
  
  // Checkbox for audio-reactive X mode
  audioReactiveXCheckbox = createCheckbox('', useAudioReactiveXMode);
  audioReactiveXCheckbox.parent('audio-reactive-x-checkbox-container');
  audioReactiveXCheckbox.changed(() => {
    useAudioReactiveXMode = audioReactiveXCheckbox.checked();
    
    // Toggle slider interactivity based on audio-reactive mode
    toggleSliderInteractivity(!useAudioReactiveXMode);
    
    if (!isRunning) {
      drawStaticPattern(modeX, modeY);
    }
  });
  
  // Checkbox for audio-reactive Y mode
  audioReactiveYCheckbox = createCheckbox('', useAudioReactiveYMode);
  audioReactiveYCheckbox.parent('audio-reactive-y-checkbox-container');
  audioReactiveYCheckbox.changed(() => {
    useAudioReactiveYMode = audioReactiveYCheckbox.checked();
    
    // Toggle slider interactivity based on audio-reactive mode
    toggleSliderInteractivity(!useAudioReactiveYMode);
    
    if (!isRunning) {
      drawStaticPattern(modeX, modeY);
    }
  });
}

function drawChladniPattern(nX, nY, amplitude = 1, threshold = thresholdValue) {
  // Set background based on inversion mode
  background(invertedMode ? 255 : 0);
  
  loadPixels();

  const centerX = width / 2;
  const centerY = height / 2;
  const scale = min(width, height) / 2;
  
  // Pre-calculate maximum wave value to scale contrast
  let maxWaveValue = 0;
  for (let x = 0; x < width; x += 5) { // Check every 5th pixel for speed
    for (let y = 0; y < height; y += 5) {
      let normX = (x - centerX) / scale;
      let normY = (y - centerY) / scale;
      let value = abs(realChladniFormula(normX, normY, nX, nY) * amplitude);
      maxWaveValue = max(maxWaveValue, value);
    }
  }
  maxWaveValue = max(1.0, maxWaveValue); // Avoid division by zero
  
  // Initialize random seed for consistent noise
  randomSeed(42);
  noiseSeed(42);
  
  // Create a density map for particles if noise is enabled
  let particleMap = [];
  if (useNoiseEffect) {
    // Calculate the particle density based on the Chladni pattern
    for (let x = 0; x < width; x += 4) { // Sample fewer points for performance
      for (let y = 0; y < height; y += 4) {
        let normX = (x - centerX) / scale;
        let normY = (y - centerY) / scale;
        let value = abs(realChladniFormula(normX, normY, nX, nY) * amplitude);
        
        // Determine where to place particles based on the pattern
        let normalizedValue = value / maxWaveValue;
        
        if (useGradientMode) {
          // In gradient mode, place particles based on value intensity
          if (random() < pow(normalizedValue, 2) * 0.3) {
            particleMap.push({x, y, intensity: normalizedValue});
          }
        } else {
          // In contrast mode, concentrate particles along the lines (around threshold value)
          let proximity = abs(normalizedValue - (threshold / maxWaveValue));
          if (proximity < 0.05 && random() < 0.8) {
            particleMap.push({x, y, intensity: 1.0});
          }
        }
      }
    }
  }
  
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      // Normalize coordinates to square [-1, 1] x [-1, 1]
      let normX = (x - centerX) / scale;
      let normY = (y - centerY) / scale;
      
      // Calculate Chladni figure using formula for rectangular plate
      let value = realChladniFormula(normX, normY, nX, nY) * amplitude;
      
      // Apply threshold or use gradient
      let pixelValue;
      if (useGradientMode) {
        // Gradient mode - use value directly, without threshold
        pixelValue = map(abs(value), 0, maxWaveValue * 1.2, 0, 255);
      } else {
        // Contrast mode with threshold
        // Use dynamic threshold based on maximum value
        let dynamicThreshold = threshold * maxWaveValue;
        pixelValue = abs(value) < dynamicThreshold ? 0 : 255;
      }
      
      let index = (x + y * width) * 4;
      pixels[index] = invertedMode ? (255 - pixelValue) : pixelValue;
      pixels[index + 1] = invertedMode ? (255 - pixelValue) : pixelValue;
      pixels[index + 2] = invertedMode ? (255 - pixelValue) : pixelValue;
      pixels[index + 3] = 255;
    }
  }

  updatePixels();
  
  // Draw noise particles on top if enabled
  if (useNoiseEffect && particleMap.length > 0) {
    // Create a temporary graphics buffer for the particles
    let particleBuffer = createGraphics(width, height);
    particleBuffer.background(0, 0); // Transparent background
    particleBuffer.noStroke();
    
    // Draw each particle
    for (let particle of particleMap) {
      let size = random(1, 3);
      let alpha = map(particle.intensity, 0, 1, 100, 255);
      particleBuffer.fill(255, alpha);
      
      // Add some randomness to the position
      let jitterX = random(-2, 2);
      let jitterY = random(-2, 2);
      
      particleBuffer.ellipse(particle.x + jitterX, particle.y + jitterY, size, size);
    }
    
    // Add the particle layer
    blend(particleBuffer, 0, 0, width, height, 0, 0, width, height, ADD);
    
    // Clean up the buffer
    particleBuffer.remove();
  }
}

function realChladniFormula(x, y, nX, nY) {
  // More realistic formula for Chladni figures on square plate
  // Use trigonometric functions with wave numbers
  
  // Relative contribution coefficient of each mode
  let ratio = 0.7;
  
  // Additional coefficient for diagonal components
  let diagRatio = showDiagLines ? 0.3 : 0.0; // If diagonal lines are off, set weight to 0
  
  // Main formula for square plate (horizontal and vertical modes)
  let term1 = sin(nX * PI * x) * sin(nY * PI * y);
  let term2 = sin(nY * PI * x) * sin(nX * PI * y);
  
  // Diagonal components (combinations x+y and x-y)
  let diagTerm1 = sin(nX * PI * (x + y) * 0.5) * sin(nY * PI * (x - y) * 0.5);
  let diagTerm2 = sin(nX * PI * (x - y) * 0.5) * sin(nY * PI * (x + y) * 0.5);
  
  // Combine all components with corresponding weights
  return ratio * (term1 + term2) + diagRatio * (diagTerm1 + diagTerm2);
}

function drawStaticPattern(nX, nY) {
  // Draw static figure for initial state
  drawChladniPattern(nX, nY, 1);
}

function setupInterface() {
  // Button setup
  const startButton = select('#start-button');
  const stopButton = select('#stop-button');
  const pauseButton = select('#pause-button'); // Pause button
  const exportPNGButton = select('#export-png-button'); // PNG export button
  
  startButton.mousePressed(() => {
    if (!isRunning) {
      // Request microphone access with enhanced parameters
      userStartAudio().then(() => {
        mic.start();
        // Set high gain level for microphone
        mic.amp(1.0);
        isRunning = true;
        isPaused = false; // Reset pause on start
        console.log('Microphone activated');
        
        // Disable sliders based on audio-reactive modes
        toggleSliderInteractivity(false);
      }).catch(err => {
        console.error('Microphone access error:', err);
        alert('Failed to access microphone. Please allow access and try again.');
      });
    }
  });
  
  stopButton.mousePressed(() => {
    if (isRunning) {
      mic.stop();
      isRunning = false;
      isPaused = false; // Reset pause on stop
      console.log('Microphone stopped');
      // Draw static pattern
      drawStaticPattern(modeX, modeY);
      
      // Re-enable sliders when stopping microphone
      toggleSliderInteractivity(true);
    }
  });
  
  // Add functionality to pause button
  pauseButton.mousePressed(() => {
    if (isRunning) {
      isPaused = !isPaused;
      console.log(isPaused ? 'Pause activated' : 'Pause deactivated');
    }
  });
  
  // Add functionality to PNG export button
  exportPNGButton.mousePressed(() => {
    // Create temporary canvas with double resolution
    let tempCanvas = createGraphics(width * 2, height * 2);
    tempCanvas.pixelDensity(1);
    
    // Draw current Chladni figure on temporary canvas with double scale
    if (isPaused && lastFrameState) {
      // If paused, use last state
      drawExportChladniPattern(
        tempCanvas, 
        lastFrameState.nX, 
        lastFrameState.nY, 
        lastFrameState.amplitude, 
        lastFrameState.threshold
      );
    } else if (isRunning) {
      // If microphone is running, use current parameters
      drawExportChladniPattern(
        tempCanvas, 
        currentNX, // Use raw value instead of int()
        currentNY, // Use raw value instead of int()
        currentAmplitude, 
        thresholdValue
      );
    } else {
      // If stopped, use static parameters
      drawExportChladniPattern(tempCanvas, modeX, modeY, 1, thresholdValue);
    }
    
    // Save image
    saveCanvas(tempCanvas, 'chladni_pattern', 'png');
    
    // Remove temporary canvas
    tempCanvas.remove();
  });
}

// Function to draw on exportable canvas
function drawExportChladniPattern(targetCanvas, nX, nY, amplitude, threshold) {
  // Set background based on inversion mode
  targetCanvas.background(invertedMode ? 255 : 0);
  
  targetCanvas.loadPixels();

  const centerX = targetCanvas.width / 2;
  const centerY = targetCanvas.height / 2;
  const scale = min(targetCanvas.width, targetCanvas.height) / 2;
  
  // Pre-calculate maximum wave value to scale contrast
  let maxWaveValue = 0;
  for (let x = 0; x < targetCanvas.width; x += 10) { // Check every 10th pixel for speed
    for (let y = 0; y < targetCanvas.height; y += 10) {
      let normX = (x - centerX) / scale;
      let normY = (y - centerY) / scale;
      let value = abs(realChladniFormula(normX, normY, nX, nY) * amplitude);
      maxWaveValue = max(maxWaveValue, value);
    }
  }
  maxWaveValue = max(1.0, maxWaveValue); // Avoid division by zero
  
  // Initialize random seed for consistent noise
  randomSeed(42);
  noiseSeed(42);
  
  // Create a density map for particles if noise is enabled
  let particleMap = [];
  if (useNoiseEffect) {
    // Calculate the particle density based on the Chladni pattern
    for (let x = 0; x < targetCanvas.width; x += 4) { // Sample fewer points for performance
      for (let y = 0; y < targetCanvas.height; y += 4) {
        let normX = (x - centerX) / scale;
        let normY = (y - centerY) / scale;
        let value = abs(realChladniFormula(normX, normY, nX, nY) * amplitude);
        
        // Determine where to place particles based on the pattern
        let normalizedValue = value / maxWaveValue;
        
        if (useGradientMode) {
          // In gradient mode, place particles based on value intensity
          if (random() < pow(normalizedValue, 2) * 0.3) {
            particleMap.push({x, y, intensity: normalizedValue});
          }
        } else {
          // In contrast mode, concentrate particles along the lines (around threshold value)
          let proximity = abs(normalizedValue - (threshold / maxWaveValue));
          if (proximity < 0.05 && random() < 0.8) {
            particleMap.push({x, y, intensity: 1.0});
          }
        }
      }
    }
  }
  
  for (let x = 0; x < targetCanvas.width; x++) {
    for (let y = 0; y < targetCanvas.height; y++) {
      // Normalize coordinates to square [-1, 1] x [-1, 1]
      let normX = (x - centerX) / scale;
      let normY = (y - centerY) / scale;
      
      // Calculate Chladni figure using formula for rectangular plate
      let value = realChladniFormula(normX, normY, nX, nY) * amplitude;
      
      // Apply threshold or use gradient
      let pixelValue;
      if (useGradientMode) {
        // Gradient mode - use value directly, without threshold
        pixelValue = map(abs(value), 0, maxWaveValue * 1.2, 0, 255);
      } else {
        // Contrast mode with threshold
        // Use dynamic threshold based on maximum value
        let dynamicThreshold = threshold * maxWaveValue;
        pixelValue = abs(value) < dynamicThreshold ? 0 : 255;
      }
      
      let index = (x + y * targetCanvas.width) * 4;
      targetCanvas.pixels[index] = invertedMode ? (255 - pixelValue) : pixelValue;
      targetCanvas.pixels[index + 1] = invertedMode ? (255 - pixelValue) : pixelValue;
      targetCanvas.pixels[index + 2] = invertedMode ? (255 - pixelValue) : pixelValue;
      targetCanvas.pixels[index + 3] = 255;
    }
  }

  targetCanvas.updatePixels();
  
  // Draw noise particles on top if enabled
  if (useNoiseEffect && particleMap.length > 0) {
    // Create a temporary graphics buffer for the particles
    let particleBuffer = createGraphics(targetCanvas.width, targetCanvas.height);
    particleBuffer.background(0, 0); // Transparent background
    particleBuffer.noStroke();
    
    // Draw each particle
    for (let particle of particleMap) {
      let size = random(1, 3) * 2; // Double the size for export
      let alpha = map(particle.intensity, 0, 1, 100, 255);
      particleBuffer.fill(255, alpha);
      
      // Add some randomness to the position
      let jitterX = random(-2, 2) * 2; // Double the jitter for export
      let jitterY = random(-2, 2) * 2;
      
      particleBuffer.ellipse(particle.x + jitterX, particle.y + jitterY, size, size);
    }
    
    // Add the particle layer
    targetCanvas.blend(particleBuffer, 0, 0, targetCanvas.width, targetCanvas.height, 
                      0, 0, targetCanvas.width, targetCanvas.height, ADD);
    
    // Clean up the buffer
    particleBuffer.remove();
  }
} 