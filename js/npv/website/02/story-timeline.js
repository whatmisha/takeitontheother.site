import { clamp } from './planet-motion.js';
export const smoothstep = (start, end, value) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

export function storyLayout(copyHeights, height, mobile = false) {
  const anchor = mobile ? height / 2 + 28 : Math.max(132, height / 2 - 92);
  const bottom = mobile ? 96 : 24;
  let start = 0;
  const scenes = copyHeights.map(copyHeight => {
    const overflow = Math.max(0, anchor + copyHeight + bottom - height);
    const scene = { start, anchor, copyHeight, overflow, duration: height + overflow };
    start += scene.duration;
    return scene;
  });
  return { scenes, height, total: start };
}

export function storyAt(scroll, layout, reduced = false) {
  const { scenes, height } = layout;
  let index = 0;
  while (index < scenes.length - 1 && scroll >= scenes[index + 1].start) index++;
  const scene = scenes[index];
  const local = Math.max(0, scroll - scene.start);
  const read = Math.min(scene.overflow, local);
  let transition = index < scenes.length - 1
    ? smoothstep(scene.overflow + height * .65, scene.duration, local) : 0;
  if (reduced) transition = transition < .5 ? 0 : 1;
  const copies = scenes.map(item => ({ y: item.anchor, opacity: 0 }));
  const base = scene.anchor - read;
  const travel = scene.copyHeight + 48;
  copies[index] = { y: base - travel * transition, opacity: 1 - smoothstep(.1, .9, transition) };
  if (index < scenes.length - 1) {
    const next = scenes[index + 1];
    copies[index + 1] = {
      y: next.anchor + (base + travel - next.anchor) * (1 - transition),
      opacity: smoothstep(.05, .7, transition)
    };
  }
  return { copies, active: index + (transition >= .5 ? 1 : 0),
    planetTurn: (scroll - scenes[1].start) / height,
    // Finish the vertical roll when land starts appearing, including any
    // extra reading distance on short/mobile viewports.
    sphereTurn: Math.min(0, (scroll - scenes[0].overflow) / height - .65) * 180,
    land: clamp(index + transition), flat: clamp(index + transition - 1) };
}


export function rebaseStoryScroll(scroll, previous, next) {
  let index=0;
  while (index<previous.scenes.length-1 && scroll>=previous.scenes[index+1].start) index++;
  const before=previous.scenes[index], after=next.scenes[index];
  const local=Math.max(0,scroll-before.start);
  const position=local<=before.overflow
    ? (before.overflow ? local/before.overflow*after.overflow : 0)
    : after.overflow+(local-before.overflow)/previous.height*next.height;
  return clamp(after.start+position,0,Math.max(0,next.total-next.height));
}
