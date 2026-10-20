import { LayoutCache } from './layout-cache.js';
const cache = new LayoutCache();
self.onmessage = async ({data: {version, cssSize}}) => {
  const entry = cache.get(cssSize);
  const {axes, ...settings} = entry.layout;
  const coordinates = Float64Array.from(axes.flatMap(axis => [axis.x,axis.y,axis.z]));
  // Paint the sphere before spending time on geography. Keep cache buffers owned
  // by the worker; transfer fresh arrays so revisiting a width remains safe.
  self.postMessage({type:'layout',version,settings,coordinates},[coordinates.buffer]);
  const cached = await cache.masks(entry);
  const masks = {land:cached.land.slice(),regions:Object.fromEntries(
    Object.entries(cached.regions).map(([id,values])=>[id,values.slice()]))};
  self.postMessage({type:'geography',version,masks},[masks.land.buffer,
    ...Object.values(masks.regions).map(values=>values.buffer)]);
};
