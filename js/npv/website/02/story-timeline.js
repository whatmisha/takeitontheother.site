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


// Match the globe's 170 ms response instead of snapping text to each scroll event.
export function advanceCopies(current, target, delta, immediate = false) {
  if (immediate) return {copies: target.map(copy => ({...copy})), moving: false};
  const amount = 1 - Math.exp(-clamp(delta, 0, 64) / 170);
  let moving = false;
  const copies = target.map((destination, index) => {
    const previous = current[index];
    const approach = (value, end, tolerance) => {
      if (Math.abs(end - value) <= tolerance) return end;
      moving = true;
      return value + (end - value) * amount;
    };
    return {
      y: previous.opacity === 0 ? destination.y : approach(previous.y, destination.y, .05),
      opacity: approach(previous.opacity, destination.opacity, .001)
    };
  });
  return {copies, moving};
}
