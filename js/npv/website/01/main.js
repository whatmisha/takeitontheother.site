import { SEEDED_PRESETS } from '../../src/core/presets.js';
import { buildGlobalScene } from '../../src/geometry/globalGeometry.js';
import { rotationPreviewOffsets } from '../../src/animation/rotationAnimation.js';
import { MainSphere } from './sphere-renderer.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sphere = new MainSphere(document.querySelector('#main-sphere'));
const logo = document.querySelector('.logo');
const logoSvg = document.querySelector('#logo-sphere');
const logoPreset = SEEDED_PRESETS['Person Five'];
let logoFrame = 0;
let scrollFrame = 0;
let lastScrollTime = 0;
let currentRotation = 0;
let targetRotation = 0;

function drawLogo(progress = 0) {
  const animation = logoPreset.rotationAnimation;
  const scene = buildGlobalScene(logoPreset, rotationPreviewOffsets(
    progress, animation.axis, animation.degrees, animation.easing
  ));
  const paths = scene.elements.filter(mark => mark.frontPath).map(mark => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', mark.frontPath);
    path.setAttribute('fill', logoPreset.ellipseColor);
    return path;
  });
  logoSvg.replaceChildren(...paths);
}

function playLogo() {
  if (logoFrame || reducedMotion.matches || document.hidden) return;
  const start = performance.now();
  const duration = logoPreset.rotationAnimation.duration * 1000;
  const tick = now => {
    const progress = Math.min(1, (now - start) / duration);
    drawLogo(progress);
    if (progress < 1) logoFrame = requestAnimationFrame(tick);
    else {
      logoFrame = 0;
      drawLogo();
    }
  };
  logoFrame = requestAnimationFrame(tick);
}

// Leaving the logo intentionally does not cancel or restart its current turn.
logo.addEventListener('pointerenter', event => {
  if (event.pointerType !== 'touch') playLogo();
});
logo.addEventListener('focus', playLogo);

function animateScroll(now) {
  scrollFrame = 0;
  const delta = lastScrollTime ? Math.min(64, now - lastScrollTime) : 16;
  lastScrollTime = now;
  currentRotation += (targetRotation - currentRotation) * (1 - Math.exp(-delta / 95));
  if (Math.abs(targetRotation - currentRotation) < .015) {
    currentRotation = targetRotation;
    lastScrollTime = 0;
  }
  sphere.draw(currentRotation);
  if (currentRotation !== targetRotation) scrollFrame = requestAnimationFrame(animateScroll);
}

function syncScroll() {
  document.body.classList.toggle('is-scrolled', window.scrollY > 1);
  // One half-turn per viewport of normal document scrolling. New sections
  // can be appended inside .content without a separate scroll container.
  targetRotation = reducedMotion.matches ? 0 : window.scrollY / Math.max(1, window.innerHeight) * 180;
  if (!scrollFrame && !document.hidden) scrollFrame = requestAnimationFrame(animateScroll);
}

addEventListener('scroll', syncScroll, { passive: true });
const resizeObserver = new ResizeObserver(() => {
  sphere.resize();
  syncScroll();
});
resizeObserver.observe(document.querySelector('.graphic-panel'));
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    cancelAnimationFrame(logoFrame);
    cancelAnimationFrame(scrollFrame);
    logoFrame = 0;
    scrollFrame = 0;
    currentRotation = 0;
    drawLogo();
    sphere.draw(0);
  }
  syncScroll();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(logoFrame);
    cancelAnimationFrame(scrollFrame);
    logoFrame = 0;
    scrollFrame = 0;
    lastScrollTime = 0;
    drawLogo();
  } else syncScroll();
});

drawLogo();
syncScroll();
