import { getFlatPreset } from './runtime/core/flatPresets.js';
import { buildFlatLayout, buildFlatScene } from './runtime/geometry/flatGeometry.js';
import { matchSurface, projectSurface, surfaceMark, surfaceParameters } from './surface-plan.js';

export function talentSettings(width, height) {
  return {...getFlatPreset('Talent'), width, height, ellipseWidth: 4, ellipseHeight: 4, personIconScale: 300};
}

export class TalentSurface {
  constructor(sphere, canvas) {
    this.sphere = sphere;
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.panel = canvas.parentElement;
    this.field = {x:0,y:0};
    this.active = false;
    this.resize();
    const follow = event => {
      if ((this.progress || 0) < .9 || document.querySelector('.contact-dialog[open]')) return;
      const rect = this.bounds;
      const inside = event.clientX >= rect.left && event.clientX < rect.right
        && event.clientY >= rect.top && event.clientY < rect.bottom;
      this.pointerInside = inside;
      this.field = inside ? {x:event.clientX-rect.left-this.width/2,y:event.clientY-rect.top-this.height/2} : {...this.defaultField};
      this.dirty = true;
      this.onChange?.();
    };
    addEventListener('pointermove', event => { if (event.pointerType !== 'touch') follow(event); }, {passive:true});
    addEventListener('pointerdown', follow, {passive:true});
  }

  resize() {
    const rect = this.panel.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1,2);
    if (rect.width === this.width && rect.height === this.height && dpr === this.dpr) return;
    this.dpr = dpr;
    this.bounds = rect;
    this.width = rect.width; this.height = rect.height;
    this.defaultField = {x:0,y:this.height < 500 ? this.height*.12 : 0};
    if (!this.pointerInside) this.field = {...this.defaultField};
    this.canvas.width = Math.round(this.width*dpr);
    this.canvas.height = Math.round(this.height*dpr);
    this.settings = talentSettings(this.width, this.height);
    this.layout = buildFlatLayout(this.settings);
    this.person = this.layout.elements.map(point => ({...point}));
    this.dirty = true;
    this.points = null;
  }

  capture(frame) {
    const panel = this.panel.getBoundingClientRect();
    const canvas = this.sphere.canvas.getBoundingClientRect();
    this.orientation = [...frame.orientation];
    this.entryFrame = {land:frame.land,regions:{...frame.regions}};
    this.points = projectSurface(this.sphere,frame,{canvasWidth:canvas.width,
      canvasLeft:canvas.left-panel.left,canvasTop:canvas.top-panel.top});
    this.plan = matchSurface(this.points,this.layout.elements,this.width,this.height);
    this.plan.survivors = [...this.plan.matches.keys()].sort((a,b)=>a-b)
      .map(sourceIndex=>({...this.points[sourceIndex],sourceIndex}));
    this.circle = {x:canvas.left-panel.left+canvas.width/2,
      y:canvas.top-panel.top+canvas.height/2,radius:this.sphere.radius*canvas.width/480};
  }

  draw(frame,delta,reducedMotion) {
    const progress = frame.flat || 0;
    this.progress = progress;
    if (progress <= 0) {
      this.canvas.hidden = true;
      this.sphere.canvas.style.opacity = '';
      this.active = false;
      this.points = null;
      return false;
    }
    if (!this.points) this.capture(frame);
    this.active = true;
    this.canvas.hidden = false;
    this.sphere.canvas.style.opacity = '0';
    const parameters = surfaceParameters(progress);
    if (this.dirty) {
      this.targets = buildFlatScene(this.settings,{transientField:this.field,layout:this.layout}).elements;
      this.dirty = false;
    }
    const amount = reducedMotion ? 1 : 1-Math.exp(-delta/85);
    let moving = false;
    this.person.forEach((point,index) => {
      const base = this.layout.elements[index], target = this.targets[index];
      for (const key of ['cx','cy','rx','ry']) {
        const destination = base[key]+(target[key]-base[key])*parameters.person;
        if (Math.abs(destination-point[key]) < .015) point[key]=destination;
        else { point[key]+=(destination-point[key])*amount; moving=true; }
      }
    });
    const ctx = this.context;
    ctx.setTransform(this.canvas.width/this.width,0,0,this.canvas.height/this.height,0,0);
    ctx.clearRect(0,0,this.width,this.height);
    ctx.fillStyle = this.sphere.color;
    ctx.save();
    if (progress < .5) {
      const x = this.plan.focus.x+(this.plan.center.x-this.plan.focus.x)*parameters.pan
        +(this.circle.x-this.plan.focus.x)*parameters.zoom;
      const y = this.plan.focus.y+(this.plan.center.y-this.plan.focus.y)*parameters.pan
        +(this.circle.y-this.plan.focus.y)*parameters.zoom;
      ctx.beginPath();ctx.arc(x,y,this.circle.radius*parameters.zoom,0,Math.PI*2);ctx.clip();
    }
    ctx.beginPath();
    let batch=0;
    const sources = progress === 1 ? this.plan.survivors : this.points;
    sources.forEach((source, index) => {
      if (progress === 1) index = source.sourceIndex;
      const targetIndex = this.plan.matches.get(index);
      const target = targetIndex === undefined ? null : this.person[targetIndex];
      const mark = surfaceMark(source,target,parameters,this.plan);
      if (mark.rx < .015 || mark.ry < .015 || mark.x < -50 || mark.x > this.width+50
        || mark.y < -50 || mark.y > this.height+50) return;
      ctx.moveTo(mark.x+Math.cos(mark.angle)*mark.rx,mark.y+Math.sin(mark.angle)*mark.rx);
      ctx.ellipse(mark.x,mark.y,mark.rx,mark.ry,mark.angle,0,Math.PI*2);
      ctx.closePath();
      if (++batch===256) {ctx.fill();ctx.beginPath();batch=0;}
    });
    if (batch) ctx.fill();
    ctx.restore();
    return moving;
  }
}
