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
 for(const audio of ['lorencia-pub.mp3','knight.wav','wizard.wav','elf.wav','level-up.wav'])assert.ok(fs.statSync(path.join(ui,'assets/audio',audio)).size>100);
});
