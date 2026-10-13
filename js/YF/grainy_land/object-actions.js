import {composeFlowers,compositionRank} from './flower-composition.js?v=petal-motion-1';
import {normalizeSettings,switchMode} from './document.js?v=petal-motion-1';
import {getLayers,withLayers,editLayer,MAX_LAYERS} from './layers.js?v=petal-motion-1';
import {layerSettingsKey} from './layer-data.js?v=petal-motion-1';
import {layerKind,kindLabels,kindModes,modeKinds,sharedParameters,normalizeParameters,effectiveSettings} from './object-model.js?v=petal-motion-1';

export const countKey=kind=>kind==='plant'?'floraCount':'fCount';
export function countLimits(settings,kind){
 const stack=getLayers(settings),objects=stack.filter(l=>layerKind(l,settings)===kind);
 const removable=l=>l.parameterMode!=='individual'&&l.mode==='auto'&&!l.locked;
 return {value:objects.length,min:objects.filter(l=>!removable(l)).length,max:objects.length+MAX_LAYERS-stack.length,removable};
}
const nextId=stack=>{let n=1;while(stack.some(l=>l.id==='object-'+n))n++;return 'object-'+n;};
export function addObject(settings,kind,{auto=false,parameters}={}){
 const s=normalizeSettings(settings),stack=getLayers(s);if(!Object.hasOwn(kindModes,kind))throw Error('Unknown object type.');
 if(stack.length>=MAX_LAYERS)throw Error('Maximum '+MAX_LAYERS+' layers per composition.');
 const family=stack.filter(l=>layerKind(l,s)===kind);let nameIndex=1;while(stack.some(l=>l.name===kindLabels[kind]+' '+nameIndex))nameIndex++;let index=0;while(family.some(l=>l.flora?.index===index))index++;
 const id=nextId(stack),ordinal=Number(id.slice(7)),salt=Math.imul(ordinal,2654435761)>>>0;
 const sourceSettings=kind===modeKinds[s.mode]||s.objectDefaults[kind]?s:{...s,...s.sceneMemory?.[kindModes[kind]],mode:kindModes[kind]};
 const params=normalizeParameters(kind,parameters??sharedParameters(sourceSettings,kind));
 if(kind==='plant'&&!auto){params.floraLayout='single';params.floraCount=1;}
 const layer={id,kind,parameterMode:auto?'auto':'individual',...(auto?{}:{parameters:params}),
  name:kindLabels[kind]+' '+nameIndex,mode:'auto',source:kind==='land'?stack.length%6:0,
  seed:kind==='flower'?s.seed:(s.seed+salt)>>>0,salt,layout:params.layout??'auto',group:kind==='plant'||kind==='flower'?'depth':'terrain',hasBase:true,
  x:!auto&&family.length?Math.sin(family.length*2.4)*.25:0,y:!auto&&family.length?Math.cos(family.length*2.4)*.2:0,
  ...(['plant','flower'].includes(kind)?{flora:{...(kind==='flower'?{generator:'flower'}:{}),index,variant:0,edits:{}}}:{})};
 if(kind==='flower'&&!auto&&!parameters){layer.parameters=normalizeParameters(kind,effectiveSettings({...s,...params,mode:'f'},{...layer,parameterMode:'auto',...(family.length?{composition:{rank:index,lean:Math.sin(index*2.4)}}:{})}));}
 const objectDefaults=auto&&kind!==modeKinds[s.mode]&&!s.objectDefaults[kind]?{...s.objectDefaults,[kind]:params}:s.objectDefaults;
 const context={...s,objectDefaults};
 const next=kind==='flower'?composeFlowers(context,[...stack,layer],{ids:[id],includeIndividual:true}):[...stack,layer];
 return {settings:withLayers(context,next),id};
}
export function resizeObjects(settings,kind,requested){
 let s=normalizeSettings(settings);const limits=countLimits(s,kind),count=Math.max(limits.min,Math.min(limits.max,Math.round(Number(requested)||0)));
 let remove=limits.value-count;
 if(remove>0){const stack=getLayers(s),ids=new Set([...stack].reverse().filter(l=>layerKind(l,s)===kind&&limits.removable(l)).sort((a,b)=>kind==='flower'?compositionRank(b)-compositionRank(a):0).slice(0,remove).map(l=>l.id));s=withLayers(s,stack.filter(l=>!ids.has(l.id)));}
 for(let n=limits.value;n<count;n++)s=addObject(s,kind,{auto:true}).settings;
 return s;
}
export function setParameterMode(settings,id,mode){
 let s=normalizeSettings(settings),l=getLayers(s).find(l=>l.id===id);if(!l||l.locked||!kindModes[l.kind]||['drawn','vector'].includes(l.mode))return s;
 const parameters=normalizeParameters(l.kind,effectiveSettings(s,l));
 if(l.kind==='flower'){parameters.fSizeVariation=0;parameters.fShapeVariation=0;parameters.fPoseVariation=0;}
 if(mode==='auto'&&l.kind!==modeKinds[s.mode]&&!s.objectDefaults[l.kind])s={...s,objectDefaults:{...s.objectDefaults,[l.kind]:parameters}};
 return editLayer(s,id,{parameterMode:mode,parameters:mode==='individual'?parameters:undefined});
}
export function editObjectParameters(settings,id,patch){
 const l=getLayers(settings).find(l=>l.id===id);if(!l||l.locked||l.parameterMode!=='individual')return settings;
 return editLayer(settings,id,{parameters:normalizeParameters(l.kind,{...l.parameters,...patch})});
}
export function editSharedParameters(settings,kind,patch){
 const next=normalizeSettings(kind===modeKinds[settings.mode]?{...settings,...patch}:{...settings,objectDefaults:{...settings.objectDefaults,[kind]:{...sharedParameters(settings,kind),...patch}}});
 return kind==='flower'&&('fDensity' in patch)?withLayers(next,composeFlowers(next,getLayers(next))):next;
}
export function copyObjectToScene(settings,id,mode){
 const source=normalizeSettings(settings),l=getLayers(source).find(l=>l.id===id);if(!l)throw Error('Choose a layer first.');
 if(mode===source.mode)throw Error('Choose another scene.');
 const target=switchMode(source,mode),stack=getLayers(target);if(stack.length>=MAX_LAYERS)throw Error('The destination scene already has '+MAX_LAYERS+' layers.');
 const copy={...structuredClone(l),id:nextId(stack),locked:false,collection:'',parameterMode:'individual',parameters:normalizeParameters(l.kind,effectiveSettings(source,l))};
 for(const part of Object.values(copy.flora?.edits??{}))if(part.group?.startsWith('custom-'))delete part.group;
 if(copy.group.startsWith('custom-'))copy.group=['plant','flower'].includes(l.kind)?'depth':'terrain';
 return {settings:withLayers(target,[...stack,copy]),id:copy.id};
}
