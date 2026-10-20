import { ContactDialog } from './contact-dialog.js';
import { SEEDED_PRESETS } from '../../src/core/presets.js';
import { buildGlobalScene } from '../../src/geometry/globalGeometry.js';
import { rotationPreviewOffsets } from '../../src/animation/rotationAnimation.js';
import { MainSphere } from './sphere-renderer.js';
import { PlanetExperience } from './planet-experience.js';
import { TalentSurface } from './talent-surface.js';
import { Story } from './story.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sphere = new MainSphere(document.querySelector('#main-sphere'));
const surface = new TalentSurface(sphere, document.querySelector('#talent-surface'));
const planet = new PlanetExperience(sphere, reducedMotion, surface);
const story = new Story(reducedMotion, state => planet.setStoryState(state));
new ContactDialog();
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
