import test from 'node:test';
import assert from 'node:assert/strict';
import {CLASSES,createRun,tick,spawnEnemy,chooseUpgrade,ARENA} from '../packages/game/src/index.js';
test('all three heroes can defeat a nearby enemy with automatic attacks',()=>{
 for(const hero of CLASSES){const s=createRun(hero.id,()=>.5);const e=spawnEnemy(s,0);e.x=1;e.z=0;s.spawnTimer=100;for(let i=0;i<300;i++)tick(s,1/60);assert.equal(s.kills,1,hero.id);assert.ok(s.gems.length+s.xp>0||s.level>1);}
});
test('jewels award a level and upgrades pause the simulation',()=>{
 const s=createRun('knight');s.gems.push({uid:1,x:0,z:0,xp:12});tick(s,1/60);assert.equal(s.phase,'upgrade');const t=s.time;tick(s,1);assert.equal(s.time,t);assert.equal(s.level,2);assert.ok(chooseUpgrade(s,s.choices[0]));assert.equal(s.phase,'playing');assert.equal(s.pendingLevels,0);
});
test('dash has a cooldown and arena boundaries cannot be crossed',()=>{
 const s=createRun('elf');s.spawnTimer=100;s.x=ARENA-.1;tick(s,.1,{x:1,dash:true});assert.equal(s.x,ARENA);assert.ok(s.dashCooldown>0);const remaining=s.dashCooldown;tick(s,.1,{x:1,dash:true});assert.ok(s.dashCooldown<remaining);
});
test('wave progression unlocks enemies and the final guardian',()=>{
 const s=createRun('wizard',()=>.99);s.time=269.99;s.spawnTimer=0;tick(s,.02);assert.equal(s.wave,10);assert.equal(s.enemies[0].id,'giant');assert.equal(s.enemies.filter(e=>e.elite).length,1);tick(s,.02);assert.equal(s.enemies.filter(e=>e.elite).length,1);
});
test('survival requires both five minutes and defeating the guardian',()=>{
 const s=createRun('knight');s.time=300;s.bossSpawned=true;s.spawnTimer=100;tick(s,.01);assert.equal(s.phase,'playing');s.bossDefeated=true;tick(s,.01);assert.equal(s.phase,'won');
});
test('death ends a run and pause freezes movement',()=>{
 const s=createRun('knight');s.phase='paused';tick(s,1,{x:1});assert.equal(s.x,0);s.phase='playing';s.hp=1;const e=spawnEnemy(s,4);e.x=e.z=0;tick(s,.01);assert.equal(s.phase,'dead');
});
