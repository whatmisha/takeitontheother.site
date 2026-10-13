import {modeKinds,modeLabels,kindLabels,kindModes,parameterRanges,sharedParameters,layerParameters} from './object-model.js?v=petal-motion-1';
import {addObject,countLimits,countKey,resizeObjects,setParameterMode,editObjectParameters,editSharedParameters,copyObjectToScene} from './object-actions.js?v=petal-motion-1';
import {getLayers,MAX_LAYERS} from './layers.js?v=petal-motion-1';
import {normalizeSettings} from './document.js?v=petal-motion-1';
const byId=id=>document.getElementById(id);
const labels={floraCount:'Plants',fCount:'Flowers',fDensity:'Density',fMinSize:'Min size, %',fMaxSize:'Max size, %',fColorVariation:'Flower colors',fPetalColors:'Petal colors',scale:'Scale',complexity:'Complexity',flow:'Flow',folds:'Folds',horizon:'Horizon',relief:'Relief',floraScale:'Plant size',floraRecognition:'Recognizability',floraBranches:'Blossoms',floraOpening:'Opening',floraBend:'Bend',floraMerge:'Merge parts',floraFusion:'Merge plants',fScale:'Flower size',fPetals:'Petals',fOpening:'Opening',fWidth:'Petal width',fCurl:'Curl',fAsymmetry:'Asymmetry',fRecognition:'Recognizability',fTilt:'View angle',fRotation:'Rotation',fCenterX:'Center X',fCenterY:'Center Y',fStem:'Stem length',fBend:'Stem bend',fMerge:'Merge parts',fSizeVariation:'Size variation',fShapeVariation:'Shape variation',fPoseVariation:'Pose variation'};
const choices=kind=>kind==='flower'?['fType','Flower type',{fan:'Fan',cup:'Cup',lobed:'Lobed',radial:'Radial'}]:kind==='plant'?['floraLayout','Arrangement',{single:'Centered',cluster:'Cluster',field:'Field'}]:['layout','Layout',{auto:'Auto',basin:'Basin',ridge:'Ridge',valley:'Valley',fold:'Fold'}];
export class ObjectUI {
 constructor(tool,change,editor){Object.assign(this,{tool,change,editor});this.abort=new AbortController();this.blocks=new Map();}
 on(element,event,fn){element.addEventListener(event,fn,{signal:this.abort.signal});}
 apply(settings,label){this.change(this.tool,settings,label);}
 end(){if(this.editing){this.editing=false;this.tool.history.endTransaction();}}
 live(settings,label){if(!this.editing){this.tool.history.flush();this.tool.history.beginTransaction(label);this.editing=true;}this.tool.applySnapshot(normalizeSettings(settings));this.tool.presets?.markDirty();}
 add(kind){this.end();try{const result=addObject(this.tool.settings,kind);this.apply(result.settings,'Add '+kindLabels[kind]);this.editor.select(result.id);this.editor.setTool('move');}catch(e){this.editor.report(e.message);}}
 init(){
  document.querySelectorAll('[data-add-kind]').forEach(b=>this.on(b,'click',()=>this.add(b.dataset.addKind)));
  document.querySelectorAll('[data-parameter-mode]').forEach(b=>this.on(b,'click',()=>{this.end();this.apply(setParameterMode(this.tool.settings,this.editor.selected,b.dataset.parameterMode),'Parameter mode');}));
  this.on(byId('copyObjectScene'),'change',()=>{const mode=byId('copyObjectScene').value;if(!mode)return;this.end();try{const result=copyObjectToScene(this.tool.settings,this.editor.selected,mode);this.apply(result.settings,'Copy object to '+modeLabels[mode]);this.editor.select(result.id);}catch(e){this.editor.report(e.message);}byId('copyObjectScene').value='';});
  this.on(byId('sharedObjectSettings'),'click',()=>{const l=this.editor.layer();if(!l)return;const panel=byId('compositionPanel');if(panel.classList.contains('panel-collapsed'))panel.querySelector('.collapse-icon').click();const target=byId('shared-'+l.kind)??byId(l.kind==='flower'?'flowerComposition':l.kind==='plant'?'floraComposition':'compositionPanel');if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({block:'nearest'});});
  for(const kind of ['plant','flower']){
   const key=countKey(kind),range=byId(key+'Slider'),number=byId(key+'Value');
   for(const input of [range,number]){
    const update=()=>{if(!input.value.trim()||!Number.isFinite(Number(input.value)))return;this.live(resizeObjects(this.tool.settings,kind,Number(input.value)),kindLabels[kind]+' count');};
    this.on(input,'input',update);this.on(input,'change',()=>{update();this.end();});this.on(input,'blur',()=>this.end());
   }
  }
  this.on(byId('fColorPattern'),'change',()=>{this.end();this.apply(editSharedParameters(this.tool.settings,'flower',{fColorPattern:byId('fColorPattern').value}),'Flower color pattern');});
  for(const input of [byId('fDensitySlider'),byId('fDensityValue')]){
   const update=()=>{if(input.value.trim()&&Number.isFinite(Number(input.value)))this.live(editSharedParameters(this.tool.settings,'flower',{fDensity:Number(input.value)}),'Flower density');};
   this.on(input,'input',update);this.on(input,'change',()=>{update();this.end();});this.on(input,'blur',()=>this.end());
  }
  this.on(window,'blur',()=>this.end());return this;
 }
 buildFields(host,kind,local,id){
  const controls=[],selects=[choices(kind)];
  if(kind==='flower')selects.push(['fColorPattern','Color pattern',{grouped:'Grouped',alternating:'Alternating',scattered:'Scattered'}]);
  const patch=values=>Object.hasOwn(values,'floraCount')?resizeObjects(this.tool.settings,kind,values.floraCount):Object.hasOwn(values,'fCount')?resizeObjects(this.tool.settings,kind,values.fCount):local?editObjectParameters(this.tool.settings,this.editor.selected,values):editSharedParameters(this.tool.settings,kind,values);
  for(const [selectKey,selectLabel,options] of (local&&kind==='plant'?[]:selects)){
   const label=document.createElement('label');label.className='stacked-select-label';label.textContent=selectLabel;label.htmlFor=id+'-'+selectKey;
   const select=document.createElement('select');select.id=label.htmlFor;select.className='style-select';select.setAttribute('aria-label',kindLabels[kind]+' '+selectLabel);
   for(const [value,name]of Object.entries(options)){const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);}
   this.on(select,'change',()=>this.apply(patch({[selectKey]:select.value}),'Object '+selectLabel));host.append(label,select);controls.push({key:selectKey,input:select});
  }
  for(const [key,[min,max,step]]of Object.entries(parameterRanges(kind))){
   if(local&&(['floraCount','fCount','fDensity','fMinSize','fMaxSize'].includes(key)||key.endsWith('Variation')))continue;
   const row=document.createElement('div');row.className='control-group';
   const label=document.createElement('label'),name=document.createElement('span'),value=document.createElement('input'),range=document.createElement('input');name.textContent=labels[key]??key;
   range.type='range';range.min=min;range.max=max;range.step=step;range.id=id+'-'+key;label.htmlFor=range.id;range.setAttribute('aria-label',kindLabels[kind]+' '+name.textContent);
   value.type='text';value.inputMode='decimal';value.min=min;value.max=max;value.step=step;value.className='value-display';value.setAttribute('aria-label',kindLabels[kind]+' '+name.textContent+' value');
   label.append(name,value);row.append(label,range);host.append(row);controls.push({key,input:range,value});
   for(const input of [range,value]){const update=()=>{if(input.value.trim()&&Number.isFinite(Number(input.value)))this.live(patch({[key]:Number(input.value)}),'Object '+name.textContent);};this.on(input,'input',update);this.on(input,'change',()=>{update();this.end();});this.on(input,'blur',()=>this.end());}
  }
  return controls;
 }
 sync(){
  const s=this.tool.settings,stack=getLayers(s),native=modeKinds[s.mode],l=this.editor.layer(),editable=l&&kindModes[l.kind]&&!['drawn','vector'].includes(l.mode);
  const propertyKey=editable?l.id+':'+l.kind+':'+l.parameterMode:'';
  if(this.propertyKey!==propertyKey){this.end();this.propertyKey=propertyKey;const host=byId('individualObjectFields');host.replaceChildren();this.localFields=editable&&l.parameterMode==='individual'?this.buildFields(host,l.kind,true,'individual'):[];}
  byId('objectParameterControls').hidden=!editable;byId('individualObjectFields').parentElement.hidden=!editable||l.parameterMode!=='individual';
  if(editable){
   document.querySelectorAll('[data-parameter-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.parameterMode===l.parameterMode));b.disabled=l.locked;});
   byId('sharedObjectSettings').hidden=l.parameterMode==='individual';byId('sharedObjectSettings').textContent='Shared '+kindLabels[l.kind]+' settings';
   const params=layerParameters(s,l);for(const c of this.localFields){c.input.value=params[c.key];if(c.value&&document.activeElement!==c.value)c.value.value=params[c.key];}
  }
  byId('fColorPattern').value=s.fColorPattern;byId('fDensitySlider').value=s.fDensity;if(document.activeElement!==byId('fDensityValue'))byId('fDensityValue').value=s.fDensity;
  byId('copyObjectScene').disabled=!l;
  for(const option of byId('copyObjectScene').options)if(option.value)option.disabled=option.value===s.mode;
  document.querySelectorAll('[data-add-kind]').forEach(b=>{b.disabled=stack.length>=MAX_LAYERS;});
  for(const kind of ['plant','flower']){const limits=countLimits(s,kind),key=countKey(kind);for(const input of [byId(key+'Slider'),byId(key+'Value')]){input.min=limits.min;input.max=limits.max;input.value=limits.value;}byId(key+'Slider').title=limits.min?limits.min+' Individual, pinned or locked objects are protected.':'Total '+(kind==='plant'?'Plants':'Flowers')+' in this scene.';}
  const foreign=Object.keys(kindModes).filter(kind=>kind!==native&&stack.some(l=>l.kind===kind&&l.parameterMode!=='individual'&&!['drawn','vector'].includes(l.mode)));
  for(const [kind,block]of this.blocks)block.host.hidden=!foreign.includes(kind);
  for(const kind of foreign){
   let block=this.blocks.get(kind);if(!block){const host=document.createElement('details');host.id='shared-'+kind;host.className='ui-disclosure compact-details';const summary=document.createElement('summary');summary.innerHTML=kindLabels[kind]+' · shared'+'<svg class="ui-disclosure__chevron" width="10" height="6" viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';host.append(summary);byId('foreignObjectSettings').append(host);block={host,controls:this.buildFields(host,kind,false,'shared-'+kind)};this.blocks.set(kind,block);}
   block.host.hidden=false;const params=sharedParameters(s,kind);for(const c of block.controls){c.input.value=params[c.key];if(['floraCount','fCount'].includes(c.key)){const limits=countLimits(s,kind);c.input.min=limits.min;c.input.max=limits.max;}if(c.value&&document.activeElement!==c.value)c.value.value=params[c.key];}
  }
 }
 destroy(){this.end();this.abort.abort();}
}
