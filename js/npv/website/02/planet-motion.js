const RAD = Math.PI / 180;
export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function axisRotation(axis, degrees) {
  const result = [0, 0, 0, Math.cos(degrees * RAD / 2)];
  result[axis] = Math.sin(degrees * RAD / 2);
  return result;
}

function multiply([x, y, z, w], [a, b, c, d]) {
  return [w*a+x*d+y*c-z*b, w*b-x*c+y*d+z*a, w*c+x*b-y*a+z*d, w*d-x*a-y*b-z*c];
}

// Keep north upright, then lift the chosen center into the visible crop.
export function regionOrientation(longitude, latitude, lift = 0) {
  return multiply(axisRotation(0, lift - latitude), axisRotation(1, -longitude));
}

export function orientationDistance(a, b) {
  return 1 - Math.min(1, Math.abs(a.reduce((sum, value, index) => sum + value * b[index], 0)));
}

export function slerp(a, b, amount) {
  let dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const end = dot < 0 ? b.map(value => -value) : b;
  dot = Math.min(1, Math.abs(dot));
  let first = 1 - amount;
  let second = amount;
  if (dot < .9995) {
    const angle = Math.acos(dot);
    first = Math.sin((1 - amount) * angle) / Math.sin(angle);
    second = Math.sin(amount * angle) / Math.sin(angle);
  }
  const result = a.map((value, index) => value * first + end[index] * second);
  const length = Math.hypot(...result);
  return result.map(value => value / length);
}

export function rotationMatrix([x, y, z, w]) {
  return [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w),
    2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w),
    2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)];
}

export function planetProgress(headingTop, visibleTop, viewportHeight) {
  const height = Math.max(1, viewportHeight - visibleTop);
  const start = viewportHeight - height * .12;
  const end = visibleTop + height * .45;
  const t = clamp((start - headingTop) / (start - end));
  return t * t * (3 - 2 * t);
}

export function focusLift(canvasCenterY, radius, panelTop, panelHeight) {
  return Math.asin(clamp((canvasCenterY - (panelTop + panelHeight * .62)) / radius, -.65, .65)) / RAD;
}
