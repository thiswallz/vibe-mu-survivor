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
 const s=createRun('wizard',()=>.99);s.time=161.99;s.spawnTimer=0;tick(s,.02);assert.equal(s.wave,10);assert.equal(s.enemies[0].id,'giant');assert.equal(s.enemies.filter(e=>e.elite).length,1);tick(s,.02);assert.equal(s.enemies.filter(e=>e.elite).length,1);
});
test('survival requires both three minutes and defeating the guardian',()=>{
 const s=createRun('knight');s.time=180;s.bossSpawned=true;s.spawnTimer=100;tick(s,.01);assert.equal(s.phase,'playing');s.bossDefeated=true;tick(s,.01);assert.equal(s.phase,'won');
});
test('death ends a run and pause freezes movement',()=>{
 const s=createRun('knight');s.phase='paused';tick(s,1,{x:1});assert.equal(s.x,0);s.phase='playing';s.hp=1;const e=spawnEnemy(s,4);e.x=e.z=0;tick(s,.01);assert.equal(s.phase,'dead');
});

test('each class can switch skills and both skills damage enemies',async()=>{
 const {SKILLS,setSkill}=await import('../packages/game/src/index.js');
 for(const hero of CLASSES)for(const skill of SKILLS[hero.id]){
  const s=createRun(hero.id,()=>.5);s.spawnTimer=100;s.unlockedSkills.push(skill.id);setSkill(s,skill.id);s.attackTimer=0;
  const e=spawnEnemy(s,4);e.x=2;e.z=0;e.speed=0;const hp=e.hp;
  for(let i=0;i<60;i++)tick(s,1/60);
  assert.ok(e.hp<hp,`${hero.id} ${skill.id} should damage a target`);
  if(skill.id==='icearrow')assert.ok(e.slow>0,'Ice Arrow should slow its target');
  assert.equal(setSkill(s,'invalid'),false);
 }
});

test('solid prop footprints block walking and allow sliding along their edge',async()=>{
 const {moveEntity,positionClear}=await import('../packages/game/src/index.js');const obstacles=[{minX:1,maxX:3,minZ:-1,maxZ:1}];const actor={x:0,z:0};
 assert.equal(positionClear(2,0,obstacles),false);
 for(let i=0;i<100;i++)moveEntity(actor,.08,0,obstacles);
 assert.ok(actor.x<1-.42,'walking must stop before the prop');
 for(let i=0;i<40;i++)moveEntity(actor,.08,.08,obstacles);
 assert.ok(actor.z>1.42,'diagonal input should slide around the footprint');
});
test('walking into an obstacle freezes the stride instead of running in place',()=>{
 const s=createRun('knight');s.obstacles=[{minX:.43,maxX:2,minZ:-2,maxZ:2}];s.spawnTimer=100;
 tick(s,1/60,{x:1});assert.equal(s.x,0);assert.equal(s.moving,false);assert.equal(s.travel,0);
});

test('second skill is learned as a level-up reward and cannot be used while locked',async()=>{
 const {SKILLS,setSkill}=await import('../packages/game/src/index.js');const s=createRun('wizard');assert.equal(setSkill(s,SKILLS.wizard[1].id),false);s.gems.push({uid:1,x:0,z:0,xp:12});tick(s,1/60);assert.ok(s.choices.includes('unlock-skill'));chooseUpgrade(s,'unlock-skill');assert.ok(s.unlockedSkills.includes('hellfire'));assert.equal(s.skill,'hellfire');
});
test('armor, enhancement and aura rewards improve combat and protection',async()=>{
 const {upgradeDefinition}=await import('../packages/game/src/index.js');const s=createRun('knight');s.level=8;const hp=s.maxHp,damage=s.damage;
 for(const id of ['armor','enhance13','enhance15','aura']){s.phase='upgrade';s.choices=[id];s.pendingLevels=1;assert.ok(upgradeDefinition(s,id));chooseUpgrade(s,id);}
 assert.equal(s.enhancement,15);assert.equal(s.maxHp,hp+35);assert.ok(s.damage>damage*1.3);assert.equal(s.auraLevel,1);
 const e=spawnEnemy(s,4);e.x=3;e.z=0;e.speed=0;s.spawnTimer=100;s.attackTimer=100;const before=e.hp;tick(s,.02);assert.ok(e.hp<before,'aura should damage nearby enemies');
});
test('wave finales spawn substantially larger packs and emit a surge cue',()=>{
 const regular=createRun('knight',()=>.5);regular.time=10;regular.spawnTimer=0;tick(regular,.01);
 const finale=createRun('knight',()=>.5);finale.time=13;finale.spawnTimer=0;tick(finale,.01);assert.ok(finale.enemies.length>=regular.enemies.length*3);assert.ok(finale.events.some(e=>e.type==='surge'));
});
test('hits and deaths carry monster identity for correct feedback and audio',()=>{
 const s=createRun('knight');s.spawnTimer=100;const e=spawnEnemy(s,0);e.x=1;e.z=0;tick(s,.01);const death=s.events.find(e=>e.type==='death');assert.equal(death.id,'spider');assert.equal(death.uid,e.uid);assert.ok(s.events.some(e=>e.type==='hit'&&e.damage>0));
});
