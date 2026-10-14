import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ui=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../apps/ui/public');
test('all three heroes and five enemy models include valid geometry and local textures',()=>{
 for(const id of ['knight','wizard','elf','spider','budge','bull','hound','giant']){
  const model=JSON.parse(fs.readFileSync(path.join(ui,'assets/models',id+'.json')));
  assert.ok(model.max[1]>model.min[1]);assert.ok(model.parts.length);
  for(const part of model.parts){assert.equal(part.positions.length%9,0);assert.equal(part.uvs.length,part.positions.length/3*2);assert.ok(part.positions.every(Number.isFinite));if(part.texture)assert.ok(fs.existsSync(path.join(ui,part.texture)),part.texture);if(part.frames)for(const f of part.frames)assert.equal(f.length,part.positions.length);}
 }
});
test('Lorencia pub music and every skill effect are bundled locally',()=>{
 for(const audio of ['lorencia-pub.mp3','knight.wav','wizard.wav','elf.wav','level-up.wav','evil.wav','hellfire.wav','ice.wav','stab.wav'])assert.ok(fs.statSync(path.join(ui,'assets/audio',audio)).size>100);
});

test('player armor has distinct original idle, walk, run and attack animation frames',()=>{
 for(const id of ['knight','wizard','elf']){
  const model=JSON.parse(fs.readFileSync(path.join(ui,'assets/models',id+'.json')));
  for(const clip of ['idle','walk','run','attack','attack2'])assert.ok(model.clips[clip].count>=4);
  assert.ok(model.sockets.right.length>0);
  const {start,count}=model.clips.run;assert.ok(model.parts.some(p=>p.frames[start].some((value,i)=>Math.abs(value-p.frames[start+Math.floor(count/2)][i])>.001)),`${id} run cycle should move the armor`);
 }
});
test('Lorencia terrain and object placements retain source provenance',()=>{
 const terrain=JSON.parse(fs.readFileSync(path.join(ui,'assets/lorencia-terrain.json')));
 assert.equal(terrain.heights.length,(terrain.size+1)**2);assert.ok(terrain.source.includes('World1/Terrain.map'));
 const objects=JSON.parse(fs.readFileSync(path.join(ui,'assets/lorencia-objects.json')));
 assert.equal(objects.source,'World1/Terrain.obj');assert.ok(objects.objects.length>400);
 for(const model of objects.models)assert.ok(fs.existsSync(path.join(ui,'assets/models',model+'.json')));
});

test('S20 run clips contain a full forward foot stride, not an idle pose',()=>{
 for(const id of ['knight','wizard','elf']){
  const model=JSON.parse(fs.readFileSync(path.join(ui,'assets/models',id+'.json'))),clip=model.clips.run;let maximum=0;
  for(const part of model.parts)for(let vertex=0;vertex<part.positions.length;vertex+=3){if(part.positions[vertex+1]>.45)continue;const forward=part.frames.slice(clip.start,clip.start+clip.count).map(frame=>frame[vertex+2]);maximum=Math.max(maximum,Math.max(...forward)-Math.min(...forward));}
  assert.ok(maximum>.4,`${id} feet should stride at least 40 cm, got ${maximum}`);
 }
});
test('arena selection excludes houses, walls and large props',async()=>{
 const {keepArenaProp}=await import('../apps/ui/public/scene-layout.js');
 assert.equal(keepArenaProp(115,{height:3,width:4,depth:4}),false);
 assert.equal(keepArenaProp(133,{height:2,width:2,depth:2}),false,'invisible client markers are not scenery');
 assert.equal(keepArenaProp(75,{height:3,width:4,depth:2}),false);
 assert.equal(keepArenaProp(30,{height:7,width:2,depth:2}),false);
 assert.equal(keepArenaProp(58,{height:2,width:1.5,depth:1.5}),true);
});
