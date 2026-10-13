import test from 'node:test';
import assert from 'node:assert/strict';
import {jsonExportName} from '../export-naming.js';
const date=new Date(2026,9,13,9,30,0);
test('JSON names track current preset, display mode and export time',()=>{
 const session={currentName:'Six cup',isEphemeral:false};
 assert.equal(jsonExportName({mode:'f'},session,date),'grainy-land-six-cup-flora-20261013_09-30-00.json');
 for(const [mode,label] of [['flora','plant'],['abstract','spot'],['landscape','land']])assert.equal(jsonExportName({mode},session,date),`grainy-land-six-cup-${label}-20261013_09-30-00.json`);
 session.currentName='My Flower';assert.match(jsonExportName({mode:'f'},session,date),/my-flower-flora/);
 assert.notEqual(jsonExportName({mode:'f'},session,date),jsonExportName({mode:'f'},session,new Date(2026,9,13,9,30,1)));
});
test('New/shared sessions and Unicode or unsafe preset names produce usable filenames',()=>{
 for(const currentName of [null,'__new__','__shared__'])assert.equal(jsonExportName({mode:'f'},{currentName,isEphemeral:true},date),'grainy-land-flora-20261013_09-30-00.json');
 assert.equal(jsonExportName({mode:'f'},{currentName:'../Мой цветок / A:*?<>|',isEphemeral:false},date),'grainy-land-мой-цветок-a-flora-20261013_09-30-00.json');
 assert.equal(jsonExportName({mode:'f'},undefined,date),'grainy-land-flora-20261013_09-30-00.json');
});
