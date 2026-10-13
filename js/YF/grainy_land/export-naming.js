import {modeLabels} from './object-model.js?v=petal-motion-1';
const pad=value=>String(value).padStart(2,'0');
// Preserve Unicode names while excluding path separators and filesystem punctuation.
const slug=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,64).replace(/-+$/,'');
export function jsonExportName(settings,presets,date=new Date()){
 const mode=slug(modeLabels[settings.mode]??'Land');
 const name=presets&&!presets.isEphemeral?slug(presets.currentName):'';
 const stamp=`${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
 return ['grainy-land',name,mode,stamp].filter(Boolean).join('-')+'.json';
}
