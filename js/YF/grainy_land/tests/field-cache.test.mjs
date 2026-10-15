import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {defaults,switchMode} from '../document.js';
import {getLayers,editLayer} from '../layers.js';
import {bakeFlora} from '../flora-field.js';
const fixtures=[
  {
    "type": "fan",
    "width": 653,
    "height": 441,
    "pixels": "2862555fa2bcb25fc17bb5a37cd82fb778f9b72646a7f60929ef2a009e845a1c",
    "colors": "3b6fa5efcc1b06c0d1816fe5616787ab31cc54a66a24d830eee40f3bdeb8c5f7"
  },
  {
    "type": "cup",
    "width": 653,
    "height": 441,
    "pixels": "bfbd9f097f01b6003797d2b69da5cc69d79fcd65d40ceb8a99fa5cfc3f17f1b6",
    "colors": "ea501a99700a8b6452c932325fb786d8fe3180130f49f1345c10f3bd21fb91bb"
  },
  {
    "type": "lobed",
    "width": 653,
    "height": 441,
    "pixels": "a4edc506ce461b4c59d47b130b1df37811c5c40768b1c7b6a71e5f997de097be",
    "colors": "032646d3a3a6019bee8f6c403f44159fb0e2d2d5c5d87a864d237467ef6f34f9"
  },
  {
    "type": "radial",
    "width": 653,
    "height": 441,
    "pixels": "6d1b23a2e66c3b120789e0f3c2b490b2f10b40a6b82547534158ef95dce7d6e9",
    "colors": "920debfa1dbc1043b04dd5c6a31a2938705935b170f487c47f2f2680b56a47e6"
  },
  {
    "type": "plant",
    "width": 589,
    "height": 441,
    "pixels": "c0bb6417c7da1f6669639025ed121782d5d064631476340d10c384286bf65a38",
    "colors": "a6287d80af6b1990012e8ce038c1a255bb9847e200dca904b4b34043bb5bf2ff"
  }
];
const hash=value=>createHash('sha256').update(value).digest('hex');
test('separating shape and color preserves approved field pixels for every family',()=>{
 for(const baseline of fixtures){
  const settings={...switchMode(defaults,baseline.type==='plant'?'flora':'f'),fType:baseline.type==='plant'?'radial':baseline.type};
  const field=bakeFlora(getLayers(settings).find(l=>l.flora),settings);
  assert.equal(field.width,baseline.width);assert.equal(field.height,baseline.height);
  assert.equal(hash(field.pixels),baseline.pixels);assert.equal(hash(field.colors),baseline.colors);
 }
});
test('recoloring reuses contours; surface and transforms reuse the entire local field',()=>{
 const settings={...switchMode(defaults,'f'),fColorVariation:0,fPetalColors:0},layer=getLayers(settings).find(l=>l.flora);
 const first=bakeFlora(layer,settings),recolored=bakeFlora(layer,{...settings,depth:'#AA5500'});
 assert.equal(first.pixels,recolored.pixels);assert.equal(first.owners,recolored.owners);
 assert.notDeepEqual(first.colors,recolored.colors);
 const restored=bakeFlora(layer,settings);assert.equal(restored.pixels,first.pixels);assert.deepEqual(restored.colors,first.colors);
 assert.equal(bakeFlora({...layer,x:.2,y:.3,rotation:30,scaleX:2}, {...settings,grain:90,glow:100}),restored);
 const changed=editLayer(settings,layer.id,{flora:{...layer.flora,variant:layer.flora.variant+1}});
 assert.notEqual(bakeFlora(getLayers(changed).find(l=>l.id===layer.id),changed).pixels,restored.pixels);
});
