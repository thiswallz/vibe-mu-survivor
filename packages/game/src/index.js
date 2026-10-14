export const CLASSES = [
 { id:'knight', name:'Dark Knight', title:'The blade of Lorencia', skill:'Twisting Slash', role:'MELEE · DURABLE', color:'#efb46c', hp:160, speed:6.4, damage:32, cooldown:0.8, range:3.8, description:'Stand your ground. A sweeping blade cuts through everything around you.' },
 { id:'wizard', name:'Dark Wizard', title:'Master of the arcane', skill:'Evil Spirits', role:'MAGIC · AREA DAMAGE', color:'#9bafff', hp:105, speed:6.1, damage:25, cooldown:0.75, range:17, description:'Call the spirits. Seeking magic strikes the horde, or burn it with Hellfire.' },
 { id:'elf', name:'Fairy Elf', title:'The silent guardian', skill:'Multiple Shot', role:'RANGED · AGILE', color:'#7eddb8', hp:120, speed:7.2, damage:23, cooldown:0.62, range:20, description:'Keep your distance. Twin arrows seek out enemies while you slip away.' }
];
export const SKILLS={
 knight:[{id:'slash',name:'Twisting Slash',description:'Spin through nearby enemies.',icon:41,sound:'knight',range:3.8,cooldown:1,damage:1},{id:'stab',name:'Death Stab',description:'Pierce a line of enemies.',icon:43,sound:'stab',range:6,cooldown:1.5,damage:1.8}],
 wizard:[{id:'evil',name:'Evil Spirits',description:'Seeking spirits attack three targets.',icon:9,sound:'evil',range:17,cooldown:1.2,damage:.85},{id:'hellfire',name:'Hellfire',description:'Burn every enemy around you.',icon:10,sound:'hellfire',range:6.5,cooldown:2.5,damage:2.2}],
 elf:[{id:'multishot',name:'Multiple Shot',description:'Fire multiple seeking arrows.',icon:24,sound:'elf',range:20,cooldown:1,damage:1},{id:'icearrow',name:'Ice Arrow',description:'A powerful arrow slows its target.',icon:51,sound:'ice',range:20,cooldown:1.5,damage:1.8}]
};
export function setSkill(s,id){if(!['playing','paused'].includes(s.phase))return false;if(!SKILLS[s.hero.id].some(skill=>skill.id===id))return false;s.skill=id;s.attackTimer=Math.max(s.attackTimer,.15);return true;}
export const ENEMIES = [
 { id:'spider', name:'Spider', hp:28, speed:2.6, damage:8, size:0.95, xp:3, color:'#a39967' },
 { id:'budge', name:'Budge Dragon', hp:45, speed:3.5, damage:10, size:1.25, xp:5, color:'#be9863' },
 { id:'bull', name:'Bull Fighter', hp:85, speed:2.35, damage:15, size:1.8, xp:8, color:'#b9684c' },
 { id:'hound', name:'Hound', hp:60, speed:4.2, damage:12, size:1.45, xp:6, color:'#9a8584' },
 { id:'giant', name:'Giant', hp:170, speed:1.7, damage:22, size:2.9, xp:15, color:'#a9a588' }
];
export const DURATION=300, ARENA=29;
export const UPGRADES=[
 {id:'damage', icon:'✦', name:'Greater power', text:'All attacks deal 25% more damage.', apply:s=>s.damage*=1.25},
 {id:'haste', icon:'ϟ', name:'Spell haste', text:'Attack 15% faster.', apply:s=>s.cooldown=Math.max(.18,s.cooldown*.85)},
 {id:'speed', icon:'➶', name:'Wind walker', text:'Move 12% faster.', apply:s=>s.speed*=1.12},
 {id:'magnet', icon:'◇', name:'Jewel seeker', text:'Collect jewels from 40% farther away.', apply:s=>s.magnet*=1.4},
 {id:'vitality', icon:'♡', name:'Blessing of life', text:'Gain 30 maximum health and restore 50.', apply:s=>{s.maxHp+=30;s.hp=Math.min(s.maxHp,s.hp+50)}},
 {id:'multishot', icon:'⋔', name:'Echoing strike', text:'Add a projectile or widen your slash.', apply:s=>{s.projectiles++;s.slashRange+=.5}}
];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createRun(id,random=Math.random){
 const hero=CLASSES.find(c=>c.id===id); if(!hero)throw new Error('Unknown class');
 return {hero,random,skill:SKILLS[id][0].id,moving:false,walking:false,attackAnimation:0,phase:'playing',time:0,wave:1,hp:hero.hp,maxHp:hero.hp,speed:hero.speed,damage:hero.damage,cooldown:hero.cooldown,slashRange:hero.range,projectiles:id==='elf'?2:1,magnet:3.1,x:0,z:0,facing:0,enemies:[],shots:[],gems:[],events:[],kills:0,level:1,xp:0,xpNeeded:12,spawnTimer:.8,attackTimer:0,dashCooldown:0,dashTime:0,invulnerable:0,bossSpawned:false,bossDefeated:false,nextId:1,choices:[],pendingLevels:0};
}
function event(s,type,data={}){s.events.push({type,...data})}
export function spawnEnemy(s,type,elite=false){
 const a=s.random()*Math.PI*2,r=19+s.random()*5;
 const def=ENEMIES[type]; const scale=1+(s.wave-1)*.095;
 const e={...def,uid:s.nextId++,type,x:Math.max(-ARENA+1,Math.min(ARENA-1,s.x+Math.cos(a)*r)),z:Math.max(-ARENA+1,Math.min(ARENA-1,s.z+Math.sin(a)*r)),hp:def.hp*scale*(elite?12:1),maxHp:def.hp*scale*(elite?12:1),elite,hit:0};
 if(elite){e.size=4.5;e.speed=2;e.damage=28;e.name='Lorencia Guardian';}
 s.enemies.push(e);return e;
}
function hurt(s,e,damage){
 if(e.hp<=0)return;e.hp-=damage;e.hit=.16;event(s,'hit',{x:e.x,z:e.z,damage});
 if(e.hp<=0){s.kills++;s.gems.push({uid:s.nextId++,x:e.x,z:e.z,xp:e.elite?60:e.xp});event(s,'death',{x:e.x,z:e.z,color:e.color});if(e.elite)s.bossDefeated=true;}
}
function levelUp(s){
 s.phase='upgrade';s.choices=[...UPGRADES].sort(()=>s.random()-.5).slice(0,3).map(u=>u.id);event(s,'level');
}
export function chooseUpgrade(s,id){
 if(s.phase!=='upgrade'||!s.choices.includes(id))return false;
 UPGRADES.find(u=>u.id===id).apply(s);s.choices=[];s.pendingLevels--;
 if(s.pendingLevels>0)levelUp(s);else s.phase='playing';return true;
}
export function tick(s,dt,input={}){
 s.events=[];if(s.phase!=='playing')return;s.time+=dt;s.wave=Math.min(10,1+Math.floor(s.time/30));
 s.attackAnimation=Math.max(0,s.attackAnimation-dt);s.invulnerable=Math.max(0,s.invulnerable-dt);s.dashCooldown=Math.max(0,s.dashCooldown-dt);s.dashTime=Math.max(0,s.dashTime-dt);
 let mx=input.x||0,mz=input.z||0,len=Math.hypot(mx,mz);if(len>1){mx/=len;mz/=len}
 if(input.dash&&s.dashCooldown===0&&len>0){s.dashTime=.2;s.dashCooldown=3;s.invulnerable=.35;event(s,'dash')}
 s.moving=len>.01;s.walking=!!input.walk||len<.5;const speed=s.speed*(s.dashTime>0?3:s.walking?.65:1);s.x=Math.max(-ARENA,Math.min(ARENA,s.x+mx*speed*dt));s.z=Math.max(-ARENA,Math.min(ARENA,s.z+mz*speed*dt));if(len>.01)s.facing=Math.atan2(mx,mz);
 s.spawnTimer-=dt;
 if(s.spawnTimer<=0&&s.enemies.length<120){
  const unlocked=Math.min(5,1+Math.floor((s.wave-1)/2));spawnEnemy(s,Math.floor(s.random()*unlocked));s.spawnTimer=Math.max(.22,.95-s.wave*.073);
 }
 if(s.time>=270&&!s.bossSpawned){spawnEnemy(s,4,true);s.bossSpawned=true;event(s,'boss')}
 s.attackTimer-=dt;
 const living=s.enemies.filter(e=>e.hp>0);
 if(s.attackTimer<=0&&living.length){
  const nearest=[...living].sort((a,b)=>dist(a,s)-dist(b,s));
  const skill=SKILLS[s.hero.id].find(k=>k.id===s.skill);const range=skill.id==='slash'?s.slashRange:skill.range;
  if(dist(nearest[0],s)<range){
   s.attackTimer=s.cooldown*skill.cooldown;s.attackAnimation=.45;s.animationSkill=skill.id;
   if(!s.moving)s.facing=Math.atan2(nearest[0].x-s.x,nearest[0].z-s.z);
   event(s,'attack',{hero:s.hero.id,skill:skill.id,x:s.x,z:s.z,facing:s.facing});
   const damage=s.damage*skill.damage;
   if(skill.id==='slash'||skill.id==='hellfire'){for(const e of living)if(dist(e,s)<range+e.size*.2)hurt(s,e,damage);}
   else if(skill.id==='stab'){
    const target=nearest[0],d=dist(target,s),dx=(target.x-s.x)/(d||1),dz=(target.z-s.z)/(d||1);
    for(const e of living){const x=e.x-s.x,z=e.z-s.z,along=x*dx+z*dz,across=Math.abs(x*dz-z*dx);if(along>-.5&&along<range&&across<1.15+e.size*.2)hurt(s,e,damage);}
   }else{
    const count=skill.id==='evil'?s.projectiles+2:skill.id==='icearrow'?Math.max(1,s.projectiles-1):s.projectiles;
    for(let i=0;i<count;i++){
     const target=nearest[i%nearest.length];s.shots.push({uid:s.nextId++,x:s.x,z:s.z,target:target.uid,life:2.5,damage,speed:s.hero.id==='elf'?24:16,kind:s.hero.id,skill:skill.id});
    }
   }
  }
 }
 for(const p of s.shots){
  p.life-=dt;const target=s.enemies.find(e=>e.uid===p.target&&e.hp>0);if(!target){p.life=0;continue}
  const d=dist(p,target);if(d<p.speed*dt+.45){
   hurt(s,target,p.damage);if(p.skill==='icearrow'){target.slow=2.5;event(s,'ice',{x:target.x,z:target.z})}
   if(p.kind==='wizard'){for(const e of s.enemies)if(e.uid!==target.uid&&dist(e,target)<2.5)hurt(s,e,p.damage*.65);event(s,'burst',{x:target.x,z:target.z})}p.life=0;
  }else{p.x+=(target.x-p.x)/d*p.speed*dt;p.z+=(target.z-p.z)/d*p.speed*dt}
 }
 s.shots=s.shots.filter(p=>p.life>0);
 for(const e of s.enemies){
  if(e.hp<=0)continue;e.slow=Math.max(0,(e.slow||0)-dt);e.hit=Math.max(0,e.hit-dt);const d=dist(e,s);
  if(d>.65){e.x+=(s.x-e.x)/d*e.speed*(e.slow>0?.45:1)*dt;e.z+=(s.z-e.z)/d*e.speed*(e.slow>0?.45:1)*dt;}
  if(d<.6+e.size*.27&&s.invulnerable===0){s.hp=Math.max(0,s.hp-e.damage);s.invulnerable=.7;event(s,'hurt');}
 }
 s.enemies=s.enemies.filter(e=>e.hp>0);
 for(const g of s.gems){const d=dist(g,s);if(d<s.magnet){const move=Math.min(d,dt*14);g.x+=(s.x-g.x)/(d||1)*move;g.z+=(s.z-g.z)/(d||1)*move;}if(d<.7){s.xp+=g.xp;g.collected=true}}
 s.gems=s.gems.filter(g=>!g.collected);
 // Combine old distant gems to bound retained geometry in a long run.
 if(s.gems.length>300){const a=s.gems.shift();s.gems[0].xp+=a.xp;}
 while(s.xp>=s.xpNeeded){s.xp-=s.xpNeeded;s.level++;s.pendingLevels++;s.xpNeeded=Math.round(s.xpNeeded*1.24+4);}
 if(s.hp<=0){s.phase='dead';event(s,'end');}
 else if(s.time>=DURATION&&s.bossDefeated){s.phase='won';event(s,'end');}
 else if(s.pendingLevels>0)levelUp(s);
}
