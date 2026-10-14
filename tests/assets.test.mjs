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
