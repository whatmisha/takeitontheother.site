import { SEEDED_PRESETS } from '../../src/core/presets.js';
import { buildGlobalScene } from '../../src/geometry/globalGeometry.js';
import { rotationPreviewOffsets } from '../../src/animation/rotationAnimation.js';
import { MainSphere } from './sphere-renderer.js';
import { PlanetExperience } from './planet-experience.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sphere = new MainSphere(document.querySelector('#main-sphere'));
const planet = new PlanetExperience(sphere, reducedMotion);
const logo = document.querySelector('.logo');
const logoSvg = document.querySelector('#logo-sphere');
const logoPreset = SEEDED_PRESETS['Person Five'];
let logoFrame = 0;
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

// Match later section spacing to the actual space after the first screen.
// Its own bottom padding is independent, so this cannot create a resize loop.
const content = document.querySelector('.content');
const firstScreen = content.querySelector('.screen');
const firstCopy = firstScreen.querySelector('.screen-copy');
const spacingObserver = new ResizeObserver(() => {
  const gap = Math.max(0, firstScreen.getBoundingClientRect().bottom - firstCopy.getBoundingClientRect().bottom);
  content.style.setProperty('--section-gap', `${gap}px`);
  planet.sync();
});
spacingObserver.observe(firstScreen);
spacingObserver.observe(firstCopy);
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    cancelAnimationFrame(logoFrame);
    logoFrame = 0;
    drawLogo();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(logoFrame);
    logoFrame = 0;
    drawLogo();
  }
});

drawLogo();
