import {MAX_LAYERS} from './layer-limits.js?v=petal-motion-1';
// Object identity and parameter inheritance do not depend on the active scene.
export const modeKinds={landscape:'land',abstract:'spot',flora:'plant',f:'flower'};
export const kindModes={land:'landscape',spot:'abstract',plant:'flora',flower:'f'};
export const modeLabels={landscape:'Land',abstract:'Spot',flora:'Plant',f:'Flora'};
export const kindLabels={land:'Landform',spot:'Spot',plant:'Plant',flower:'Flower',drawn:'Drawn',vector:'Vector'};
export const flowerDefaults={fType:'radial',fScale:110,fPetals:6,fOpening:75,fWidth:55,fCurl:35,fAsymmetry:40,fRecognition:60,fTilt:35,fRotation:0,fCenterX:50,fCenterY:53,fStem:65,fBend:35,fMerge:30,fColorVariation:70,fPetalColors:60,fColorPattern:'grouped',fLayers:null};
export const flowerRanges={fScale:[5,360,1],fPetals:[3,12,1],fOpening:[0,100,1],fWidth:[0,100,1],fCurl:[-100,100,1],fAsymmetry:[0,100,1],fRecognition:[0,100,1],fTilt:[0,85,1],fRotation:[-180,180,1],fCenterX:[5,95,1],fCenterY:[5,95,1],fStem:[0,100,1],fBend:[-100,100,1],fMerge:[0,100,1],fColorVariation:[0,100,1],fPetalColors:[0,100,1]};
export const plantDefaults={floraLayout:'cluster',floraCount:4,floraScale:112,floraRecognition:55,floraBranches:3,floraOpening:76,floraBend:60,floraMerge:65,floraFusion:35,floraLayers:null};
export const plantRanges={floraCount:[0,MAX_LAYERS,1],floraScale:[50,180,1],floraRecognition:[0,100,1],floraBranches:[1,5,1],floraOpening:[0,100,1],floraBend:[0,100,1],floraMerge:[0,100,1],floraFusion:[0,100,1]};
export const terrainDefaults={scale:100,complexity:2,flow:48,folds:65,horizon:53,relief:62,layout:'auto'};
export const terrainRanges={scale:[40,220,1],complexity:[1,6,1],flow:[0,100,1],folds:[0,100,1],horizon:[15,80,1],relief:[0,100,1]};
export const variationDefaults={fCount:1,fDensity:55,fMinSize:20,fMaxSize:150,fSizeVariation:90,fShapeVariation:55,fPoseVariation:60};
export const variationRanges={fCount:[0,MAX_LAYERS,1],fDensity:[0,100,1],fMinSize:[5,100,1],fMaxSize:[100,250,1],fSizeVariation:[0,100,1],fShapeVariation:[0,100,1],fPoseVariation:[0,100,1]};
export const parameterRanges=kind=>kind==='plant'?plantRanges:kind==='flower'?{...flowerRanges,...variationRanges}:terrainRanges;
export const baseParameters=kind=>kind==='plant'?plantDefaults:kind==='flower'?{...flowerDefaults,...variationDefaults}:terrainDefaults;
export const layerKind=(layer,settings)=>(Object.hasOwn(kindLabels,layer.kind)?layer.kind:null)??(layer.flora?(layer.flora.generator==='flower'?'flower':'plant'):layer.mode==='vector'?'vector':layer.mode==='drawn'&&!layer.hasBase?'drawn':modeKinds[settings.mode]??'land');
export function normalizeParameters(kind,value={}){
 const defaults=baseParameters(kind),out={};
 for(const [key,[min,max,step]] of Object.entries(parameterRanges(kind))){const n=Number(value[key]);out[key]=Math.round(Math.max(min,Math.min(max,value[key]!=null&&Number.isFinite(n)?n:defaults[key]))/step)*step;}
 if(kind==='flower'){out.fType=['fan','cup','lobed','radial'].includes(value.fType)?value.fType:'radial';out.fColorPattern=['grouped','alternating','scattered'].includes(value.fColorPattern)?value.fColorPattern:'grouped';}
 else if(kind==='plant')out.floraLayout=['single','cluster','field'].includes(value.floraLayout)?value.floraLayout:'cluster';
 else out.layout=['auto','basin','ridge','valley','fold'].includes(value.layout)?value.layout:'auto';
 return out;
}
export function sharedParameters(settings,kind){
 const unified=settings.schemaVersion===2;
 const p=normalizeParameters(kind,unified?settings.objectDefaults?.[kind]:kind===modeKinds[settings.mode]?settings:settings.objectDefaults?.[kind]);
 const stack=unified?settings.layers:settings[({landscape:'landscapeLayers',abstract:'abstractLayers',flora:'floraLayers',f:'fLayers'})[settings.mode]];
 if(kind==='plant'&&stack)p.floraCount=objectCount(settings,stack,kind);
 if(kind==='flower'&&stack)p.fCount=objectCount(settings,stack,kind);
 return p;
}
export function layerParameters(settings,layer){const kind=layerKind(layer,settings);return layer.parameterMode==='individual'?normalizeParameters(kind,layer.parameters):sharedParameters(settings,kind);}
export function effectiveSettings(settings,layer){
 const kind=layerKind(layer,settings),params=layerParameters(settings,layer),s={...settings,...params,mode:kindModes[kind]??settings.mode};
 if(kind==='flower'&&layer.parameterMode!=='individual'&&layer.composition){
  let seed=(layer.seed+(layer.flora?.index??0)*2654435761)>>>0;
  const r=()=>{seed=Math.imul(seed^seed>>>15,2246822519)>>>0;return seed/4294967295*2-1;};
  const rank=layer.composition?.rank??layer.flora?.index??0,lean=layer.composition?.lean??r();
  const weight=rank===0?.86+(r()+1)*.07:rank<3?.40+(r()+1)*.17:rank%6===3?Math.pow((r()+1)*.5,3)*.05:Math.pow((r()+1)*.5,1.7)*.72;
  const size=(s.fMinSize+(s.fMaxSize-s.fMinSize)*weight)/100;
  s.fScale*=1+(size-1)*s.fSizeVariation/100;
  s.fOpening+=(r()*.40+(rank===0?.12:-.10))*s.fShapeVariation;
  s.fWidth+=r()*.38*s.fShapeVariation;s.fCurl+=r()*.70*s.fShapeVariation;
  s.fAsymmetry+=r()*.25*s.fShapeVariation;
  s.fTilt+=(r()*.35+(rank===0?-.12:.28))*s.fPoseVariation;
  s.fRotation+=(lean*.50+r()*.18)*s.fPoseVariation;
  s.fBend+=(lean*.55+r()*.18)*s.fPoseVariation;
  s.fStem*=1+(rank===0?r()*.15:rank<3?-.3+r()*.2:-.55+r()*.2)*s.fPoseVariation/100;

 }
 return {...s,...normalizeParameters(kind,s)};
}
export function normalizeObjectDefaults(value){return Object.fromEntries(Object.keys(kindModes).filter(k=>value?.[k]&&typeof value[k]==='object').map(k=>[k,normalizeParameters(k,value[k])]));}
export function objectCount(settings,stack,kind){return stack.filter(l=>layerKind(l,settings)===kind).length;}

export function normalizeComposition(value){
 if(!value||typeof value!=='object'||!Number.isFinite(value.rank))return null;
 const rank=Math.max(0,Math.min(31,Math.round(value.rank)));
 return {...(Number.isFinite(value.stemExtension)?{stemExtension:Math.round(Math.max(0,Math.min(4,value.stemExtension))*10000)/10000,stemLengthRef:Math.max(1,Math.min(100,Math.round(Number(value.stemLengthRef)||65)))}:{}),rank,role:rank===0?'hero':rank<3?'support':'accent',lean:Math.round(Math.max(-1,Math.min(1,Number(value.lean)||0))*10000)/10000};
}
