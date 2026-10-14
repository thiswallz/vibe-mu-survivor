import {createInventoryPanel} from './inventory-panel.js';
import {SLOTS,itemKey,equipItem,unequipSlot,autoEquip,applyEquipment,chooseDropSlots} from '@mu-survivor/game/equipment';
import {GameAudio,MONSTER_AUDIO} from './audio.js';
import {ITEMS,mergeInventory,openKundun} from '@mu-survivor/game/loot';
import {readInventory,readProfile,saveProfile,saveRunInventory,bankRun} from './inventory.js';
import {prepareActor,disposeActor,flashActor,enhanceArmor,updateArmor,createAura,updateAura} from './appearance.js';
import {SpellEffects} from './effects.js';
import {keepArenaProp,solidArenaProp} from './scene-layout.js';
import * as THREE from 'three';
import {CLASSES,ENEMIES,SKILLS,UPGRADES,ARMOR,STARTER_ARMOR,WAVE_SECONDS,SURGE_SECONDS,upgradeDefinition,createRun,tick,chooseUpgrade,setSkill,positionClear,DURATION,ARENA} from '@mu-survivor/game';
const $=id=>document.getElementById(id);
const icons={knight:'⚔',wizard:'✦',elf:'➶'};
let selected='knight',run=null,ready=false,muted=false,last=0,accumulator=0,toastTimer=0,dashRequested=false;
const keys=new Set(),stick={x:0,z:0},pointer={active:false,x:0,y:0};
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(error){$('load-status').textContent='WebGL is unavailable. Enable hardware acceleration and reopen this page.';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
$('world').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#17282a');scene.fog=new THREE.FogExp2('#17282a',.019);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,180);
scene.add(new THREE.HemisphereLight('#c8dcc8','#243434',2.25));
const sun=new THREE.DirectionalLight('#f0d4ad',3.1);sun.position.set(-12,22,14);scene.add(sun);
const blue=new THREE.DirectionalLight('#73b2c8',1.4);blue.position.set(12,9,-20);scene.add(blue);
let chromeTexture,auraTexture,shinyTexture;let terrainData,objectData;const scenery=[],obstacles=[];
const assets={},textures={},loader=new THREE.TextureLoader();
async function loadTexture(url){if(!textures[url])textures[url]=loader.loadAsync(url).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;});return textures[url];}
async function loadModel(name){
 const response=await fetch(`assets/models/${name}.json`);if(!response.ok)throw new Error(`Missing model: ${name}`);const data=await response.json();const template=new THREE.Group();
 for(const part of data.parts){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(part.uvs,2));g.computeVertexNormals();
  if(part.frames){g.morphAttributes.position=part.frames.map(frame=>new THREE.Float32BufferAttribute(frame,3));}
  const map=part.texture?await loadTexture(part.texture):null;
  const mat=new THREE.MeshStandardMaterial({map,color:map?'#ffffff':'#b3aaa0',roughness:.83,metalness:.12,side:THREE.DoubleSide,alphaTest:.45});
  const terrainObject=Number(name.split('-')[1]);if(name.startsWith('lorencia-')&&terrainObject<=27&&map){mat.alphaMap=map;mat.alphaTest=.12;}if(name.startsWith('lorencia-')&&[50,51].includes(terrainObject)){mat.transparent=true;mat.blending=THREE.AdditiveBlending;mat.depthWrite=false;mat.alphaTest=0;mat.emissiveMap=map;mat.emissive.set('#ffffff');mat.emissiveIntensity=.8;}
  if(name.startsWith('skill-')){mat.transparent=true;mat.blending=THREE.AdditiveBlending;mat.depthWrite=false;mat.alphaTest=0;mat.emissive.set('#666666');mat.emissiveMap=map;mat.emissiveIntensity=1.2;}const mesh=new THREE.Mesh(g,mat);mesh.userData.upperBody=!!part.upperBody;mesh.userData.armor=/player-(head_|upper_|lower_|gloves_|boots_)/i.test(part.texture||'');mesh.userData.sourceTexture=part.sourceTexture;mesh.userData.slot=part.slot;template.add(mesh);
 }
 assets[name]={template,data};
}
function model(name,height,fit=false){
 const {template,data}=assets[name];const root=new THREE.Group();const object=template.clone();const scale=height/(fit?Math.max(...data.max.map((value,i)=>value-data.min[i])):data.max[1]-data.min[1]);object.scale.setScalar(scale);object.position.y=-data.min[1]*scale;
 // Center horizontally without changing the model's pose.
 object.position.x=-(data.min[0]+data.max[0])/2*scale;object.position.z=-(data.min[2]+data.max[2])/2*scale;root.add(object);root.userData.body=object;root.userData.model=name;
 return root;
}
const floorGroup=new THREE.Group(),menuGroup=new THREE.Group(),playGroup=new THREE.Group();scene.add(floorGroup,menuGroup,playGroup);playGroup.visible=false;
let heroModel;const heroPreviews={};
function ring(radius,color){const m=new THREE.Mesh(new THREE.RingGeometry(radius-.035,radius,80),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;return m;}
function shadow(radius){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');const gr=ctx.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.6)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,64,64);const m=new THREE.Mesh(new THREE.PlaneGeometry(radius*2,radius*2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.035;return m;}
const shadowTemplate=shadow(1);
function addShadow(root,size){const s=shadowTemplate.clone();s.scale.setScalar(size);root.add(s)}
function weapon(root,id,item){
 const name=id==='knight'?'sword':id==='wizard'?'staff':'bow';const attachment=new THREE.Group();attachment.add(assets[item?ITEMS[item.id].model:'weapon-'+name].template.clone());root.userData.weaponItem=item?.id||'starter-'+name;root.userData.body.add(attachment);root.userData.weapon=attachment;root.userData.socket=id==='elf'?'left':'right';
}
const poseMatrix=new THREE.Matrix4(),poseMatrix2=new THREE.Matrix4(),posePos=new THREE.Vector3(),posePos2=new THREE.Vector3(),poseQ=new THREE.Quaternion(),poseQ2=new THREE.Quaternion(),poseScale=new THREE.Vector3();
function setPose(root,clipName,seconds,loop=true,dt=1/60){
 const data=assets[root.userData.model].data;const clip=data.clips?.[clipName];if(!clip)return;
 const value=loop?(seconds*clip.fps)%clip.count:Math.min(clip.count-1,seconds/.45*(clip.count-1));const index=Math.floor(value),blend=value-index;const a=clip.start+index,b=clip.start+(loop?(index+1)%clip.count:Math.min(index+1,clip.count-1));
 const weights=root.userData.poseWeights||=new Float32Array(data.parts[0].frames.length);const smoothing=1-Math.exp(-dt*22);for(let i=0;i<weights.length;i++){const desired=(i===a?1-blend:0)+(i===b?blend:0);weights[i]+=(desired-weights[i])*smoothing;}root.userData.body.traverse(child=>{if(child.morphTargetInfluences)for(let i=0;i<weights.length;i++)child.morphTargetInfluences[i]=weights[i];});
 const socket=data.sockets?.[root.userData.socket];if(socket&&root.userData.weapon){poseMatrix.fromArray(socket[a]).decompose(posePos,poseQ,poseScale);poseMatrix2.fromArray(socket[b]).decompose(posePos2,poseQ2,poseScale);posePos.lerp(posePos2,blend);poseQ.slerp(poseQ2,blend);root.userData.weapon.position.lerp(posePos,1-Math.exp(-dt*22));root.userData.weapon.quaternion.slerp(poseQ,1-Math.exp(-dt*22));}
}
function attackPose(root,clipName,elapsed,duration,moving,dt){
 const data=assets[root.userData.model].data,clip=data.clips[clipName];const p=Math.min(1,Math.max(0,elapsed/duration)),v=p*(clip.count-1),index=Math.floor(v),blend=v-index,a=clip.start+index,b=clip.start+Math.min(index+1,clip.count-1),strength=Math.sin(Math.PI*p)**.35;
 root.userData.body.traverse(mesh=>{if(!mesh.morphTargetInfluences||moving&&!mesh.userData.upperBody&&root.userData.model.startsWith('knight')===false)return;for(let i=0;i<mesh.morphTargetInfluences.length;i++){const attack=(i===a?1-blend:0)+(i===b?blend:0);mesh.morphTargetInfluences[i]=mesh.morphTargetInfluences[i]*(1-strength)+attack*strength;}});
 const sockets=data.sockets[root.userData.socket];poseMatrix.fromArray(sockets[a]).decompose(posePos,poseQ,poseScale);poseMatrix2.fromArray(sockets[b]).decompose(posePos2,poseQ2,poseScale);posePos.lerp(posePos2,blend);poseQ.slerp(poseQ2,blend);root.userData.weapon.position.lerp(posePos,strength*(1-Math.exp(-dt*32)));root.userData.weapon.quaternion.slerp(poseQ,strength*(1-Math.exp(-dt*32)));
}
let appearanceKey='';
function equippedActor(id,equipment,height){
 const base=assets[id],armor=assets[id+'-armor'],template=new THREE.Group(),parts=[];
 for(const slot of SLOTS.filter(s=>s!=='weapon')){
  const source=equipment[slot]?armor:base;source.template.children.forEach((mesh,i)=>{if(mesh.userData.slot===slot){template.add(mesh.clone());parts.push(source.data.parts[i]);}});
 }
 const key=id+'-equipped';assets[key]={template,data:{...base.data,parts}};
 const root=model(key,height);weapon(root,id,equipment.weapon);prepareActor(root);root.userData.equipment=equipment;
 enhanceArmor(root,Math.max(0,...Object.values(equipment).filter(Boolean).map(i=>i.enhancement||0)),chromeTexture,shinyTexture,equipment);return root;
}
function refreshAppearance(){
 const key=run.hero.id+JSON.stringify(run.equipment);if(key===appearanceKey)return;appearanceKey=key;
 if(heroModel){playGroup.remove(heroModel);disposeActor(heroModel);}heroModel=equippedActor(run.hero.id,run.equipment,2.4);addShadow(heroModel,1);playGroup.add(heroModel);
}
function refreshPreviewGear(){
 const profile=readProfile();for(let i=0;i<CLASSES.length;i++){
  const hero=CLASSES[i],old=heroPreviews[hero.id];if(!old)continue;
  const key=JSON.stringify(profile.loadouts[hero.id]);if(old.userData.gearKey===key)continue;
  const p=equippedActor(hero.id,profile.loadouts[hero.id],4.2);p.userData.gearKey=key;p.position.copy(old.position);menuGroup.remove(old);disposeActor(old);menuGroup.add(p);heroPreviews[hero.id]=p;addShadow(p,1.4);
 }
}
const itemIcons={};
function makeItemIcons(){
 const iconsRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});iconsRenderer.setSize(96,96);iconsRenderer.outputColorSpace=THREE.SRGBColorSpace;
 const iconScene=new THREE.Scene(),iconCamera=new THREE.PerspectiveCamera(35,1,.01,100);iconScene.add(new THREE.HemisphereLight('#ffffff','#687267',3));const light=new THREE.DirectionalLight('#ffe6bc',3);light.position.set(2,4,5);iconScene.add(light);
 for(const item of Object.values(ITEMS)){
  const itemObject=assets[item.model].template.clone(),box=new THREE.Box3().setFromObject(itemObject),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());itemObject.position.sub(center);const group=new THREE.Group();group.add(itemObject);group.scale.setScalar(1.4/Math.max(size.x,size.y,size.z));iconScene.add(group);iconCamera.position.set(1.7,1.1,2.7);iconCamera.lookAt(0,0,0);iconsRenderer.render(iconScene,iconCamera);itemIcons[item.id]=iconsRenderer.domElement.toDataURL('image/png');iconScene.remove(group);
 }iconsRenderer.dispose();
}
function heightAt(x,z){
 if(!terrainData)return 0;const size=terrainData.size,spacing=terrainData.spacing;const tx=Math.max(0,Math.min(size-.001,(x+size*spacing/2)/spacing)),ty=Math.max(0,Math.min(size-.001,(size*spacing/2-z)/spacing));const ix=Math.floor(tx),iy=Math.floor(ty),fx=tx-ix,fy=ty-iy,h=terrainData.heights;
 const a=h[iy*(size+1)+ix]*(1-fx)+h[iy*(size+1)+ix+1]*fx,b=h[(iy+1)*(size+1)+ix]*(1-fx)+h[(iy+1)*(size+1)+ix+1]*fx;return a*(1-fy)+b*fy;
}
async function world(){
 const terrain=await loadTexture('assets/textures/lorencia-terrain.jpg');terrain.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const size=terrainData.size,spacing=terrainData.spacing;const geometry=new THREE.PlaneGeometry(size*spacing,size*spacing,size,size);geometry.rotateX(-Math.PI/2);const positions=geometry.getAttribute('position');
 for(let i=0;i<positions.count;i++)positions.setY(i,heightAt(positions.getX(i),positions.getZ(i)));geometry.computeVertexNormals();
 // Source map rows follow MU +Y; WebGL world uses -Z.
 terrain.repeat.y=-1;terrain.offset.y=1;
 const ground=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:terrain,color:'#b9c5b0',roughness:1}));floorGroup.add(ground);
 // Every prop comes from Terrain.obj, with its original type, position, rotation and scale.
 let lightCount=0;
 for(const source of objectData.objects){
  const p=assets[source.model].template.clone();p.position.fromArray(source.position);p.rotation.set(...source.rotation);p.scale.setScalar(source.scale);p.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(p);const dimensions={height:box.max.y-box.min.y,width:box.max.x-box.min.x,depth:box.max.z-box.min.z};if(!keepArenaProp(source.type,dimensions))continue;floorGroup.add(p);scenery.push(p);if(solidArenaProp(source.type,dimensions))obstacles.push({minX:box.min.x,maxX:box.max.x,minZ:box.min.z,maxZ:box.max.z});
  if([50,51,52,90].includes(source.type)&&lightCount++<6){const light=new THREE.PointLight('#f4ad69',7,7,2);light.position.copy(p.position).add(new THREE.Vector3(0,2,0));floorGroup.add(light);}
 }
 const boundary=ring(ARENA+1,'#b8be8d');boundary.position.y=.04;floorGroup.add(boundary);
 for(let i=0;i<3;i++){
  const hero=CLASSES[i],p=model(hero.id,4.2);weapon(p,hero.id);p.position.set(3.5+i*5.5,heightAt(3.5+i*5.5,-3),-3);heroPreviews[hero.id]=p;menuGroup.add(p);addShadow(p,1.4);
  const r=ring(1.65,hero.color);r.position.copy(p.position);r.position.y+=.05;menuGroup.add(r);
 }
}
const gameAudio=new GameAudio();
function effect(id,position){const distance=position&&run?Math.hypot(position.x-run.x,position.z-run.z):0;gameAudio.effect(id,distance);}
function startMusic(){gameAudio.startMusic();}
$('sound').onclick=()=>{muted=!muted;gameAudio.setMuted(muted);$('sound').textContent=muted?'♪ SOUND OFF':'♪ SOUND ON';$('sound').setAttribute('aria-label',muted?'Unmute audio':'Mute audio');startMusic()};
function inventoryRows(items){return items.length?mergeInventory([],items).map(item=>`<li><span style="color:${ITEMS[item.id].color}">◆</span><b>${ITEMS[item.id].name}${item.enhancement?' +'+item.enhancement:''}</b><strong>×${item.quantity}</strong></li>`).join(''):'<li>No items collected yet.</li>';}
let menuInventory=null,inventoryWasPlaying=false;
function inventoryContext(){return run||menuInventory;}
function persistEquipment(){const context=inventoryContext();const saved=saveRunInventory(context);if(!saved)toast('Browser storage unavailable');refreshStash();if(run)refreshAppearance();else refreshPreviewGear();}
function closeInventory(){inventoryPanel.hide();if(run&&inventoryWasPlaying){run.phase='playing';lastPhase='';$('overlay').hidden=true;}else if(run)modal();inventoryWasPlaying=false;}
const inventoryPanel=createInventoryPanel({context:inventoryContext,icon:id=>itemIcons[id],
 equip:item=>{if(equipItem(inventoryContext(),item))persistEquipment();},unequip:slot=>{unequipSlot(inventoryContext(),slot);persistEquipment();},
 openBox:()=>{const context=inventoryContext(),slot=chooseDropSlots(context.hero.id,context.equipment)[0],result=openKundun(context.inventory,context.hero.id,slot);if(!result)return null;context.inventory=result.items;autoEquip(context,result.reward);persistEquipment();effect('armor');toast(ITEMS[result.reward.id].name+' found');return result.reward;},close:closeInventory});
function openInventory(){
 if(!ready)return;if(inventoryPanel.visible){closeInventory();return;}
 if(!run){const profile=readProfile(),hero=CLASSES.find(h=>h.id===selected);menuInventory={hero,inventory:profile.items,equipment:profile.loadouts[selected],maxHp:hero.hp,hp:hero.hp,damage:hero.damage,gearHp:0};applyEquipment(menuInventory);}
 inventoryWasPlaying=run?.phase==='playing';if(inventoryWasPlaying){run.phase='paused';lastPhase='paused';$('overlay').hidden=true;}keys.clear();stick.x=stick.z=0;pointer.active=false;inventoryPanel.open();
}
function refreshStash(){$('stash').textContent='INVENTORY · '+readInventory().reduce((n,i)=>n+i.quantity,0);}
$('stash').onclick=openInventory;
refreshStash();
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.().catch(()=>{});};
function cards(){
 $('cards').innerHTML=CLASSES.map((h,i)=>`<button class="hero-card ${h.id===selected?'selected':''}" style="--accent:${h.color}" data-hero="${h.id}" aria-pressed="${h.id===selected}"><div class="card-top"><span>${h.role}</span><span>${h.id===selected?'●':`0${i+1}`}</span></div><h3>${h.name}</h3><p>${h.description}</p><div class="card-skill"><span>${icons[h.id]}</span>${h.skill}</div></button>`).join('');
 for(const el of document.querySelectorAll('[data-hero]'))el.onclick=()=>{selected=el.dataset.hero;cards();startMusic()};
}
cards();
const spellEffects=new SpellEffects(playGroup,heightAt);
const enemies=new Map(),shots=new Map(),gems=new Map(),lootModels=new Map();let aura=null,protectionAura=null;
function clearPlay(){appearanceKey='';spellEffects.clear();if(heroModel)disposeActor(heroModel);for(const enemy of enemies.values())disposeActor(enemy);for(const shot of shots.values())spellEffects.disposeProjectile(shot);for(const child of [...playGroup.children])playGroup.remove(child);enemies.clear();shots.clear();gems.clear();for(const m of lootModels.values())disposeActor(m);lootModels.clear();}
function start(){
 if(!ready)return;inventoryPanel.hide();clearPlay();run=createRun(selected);const profile=readProfile();run.inventory=profile.items;run.equipment=profile.loadouts[selected];run.dropSlots=chooseDropSlots(selected,run.equipment,run.random);applyEquipment(run);run.obstacles=obstacles;run.x=10;for(let i=0;!positionClear(run.x,run.z,obstacles)&&i<60;i++){run.x=10+Math.cos(i*.8)*i*.2;run.z=Math.sin(i*.8)*i*.2;}heroModel=null;refreshAppearance();protectionAura=createAura(auraTexture,shinyTexture);playGroup.add(protectionAura);aura=ring(1.05,run.hero.color);aura.position.y=.05;playGroup.add(aura);menuGroup.visible=false;playGroup.visible=true;$('menu').hidden=true;$('hud').hidden=false;$('overlay').hidden=true;document.body.classList.add('playing');keys.clear();stick.x=stick.z=0;pointer.active=false;camera.position.set(0,22,20);camera.lookAt(0,0,0);$('hero-name').textContent=run.hero.name.toUpperCase();$('skill-name').textContent=run.hero.skill;$('skill-icon').textContent=icons[selected];skillButtons();startMusic();toast('The gates have fallen. Survive.');
}
$('begin').onclick=start;
function goMenu(){inventoryPanel.hide();if(run)saveRunInventory(run);run=null;refreshPreviewGear();clearPlay();menuGroup.visible=true;playGroup.visible=false;$('menu').hidden=false;$('hud').hidden=true;$('overlay').hidden=true;document.body.classList.remove('playing');keys.clear();stick.x=stick.z=0;pointer.active=false;}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200)}
const time=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
let lastPhase='',lastWave=1;
function modal(){
 if(!run)return;const s=run;const show=['upgrade','paused','dead','won'].includes(s.phase);$('overlay').hidden=!show;if(!show)return;
 if(s.phase==='upgrade'){
  $('modal').innerHTML=`<span class="eyebrow">LEVEL ${s.level} · A JEWEL OF BLESSING</span><h2>Power answers the call.</h2><p>Choose one blessing for the battle ahead.</p><div class="upgrade-options">${s.choices.map(id=>{const u=upgradeDefinition(s,id);return `<button class="upgrade" data-upgrade="${id}"><span>${u.icon}</span><b>${u.name}</b><p>${u.text}</p></button>`}).join('')}</div>`;
  for(const el of document.querySelectorAll('[data-upgrade]'))el.onclick=()=>{chooseUpgrade(s,el.dataset.upgrade);events();skillButtons();lastPhase='';modal()};
 }else if(s.phase==='paused'){
  $('modal').innerHTML='<span class="eyebrow">TAKE A BREATH</span><h2>The battle can wait.</h2><p>Move with WASD or arrows. Your skills attack automatically.<br>Collect blue jewels to grow stronger. Space or right click to dash.</p><div class="modal-actions"><button class="primary" id="resume">RESUME BATTLE</button><button class="secondary" id="leave">CHOOSE HERO</button></div>';$('resume').onclick=()=>{s.phase='playing';lastPhase='';modal()};$('leave').onclick=goMenu;
 }else{
  const won=s.phase==='won',saved=bankRun(s);refreshStash();$('modal').innerHTML=`<span class="eyebrow">${won?'LORENCIA STANDS':'EVERY LEGEND BEGINS SOMEWHERE'}</span><h2>${won?'You held the line.':'The horde prevails.'}</h2><p>${won?'Three minutes. Ten waves. One hero. The sanctuary lives another day.':'Return stronger. A different blessing can change everything.'}</p><div class="results"><div><b>${time(s.time)}</b><span>SURVIVED</span></div><div><b>${s.kills}</b><span>ENEMIES SLAIN</span></div><div><b>${s.level}</b><span>HERO LEVEL</span></div></div><div class="run-loot"><span class="eyebrow">COLLECTED · ${s.loot.collected.length} / 5</span><ul class="loot-list">${inventoryRows(s.loot.collected)}</ul><p>${saved.saved?'Saved to your stash for future stages.':'Browser storage unavailable; items could not be saved.'}</p></div><div class="modal-actions"><button class="primary" id="retry">PLAY AGAIN ↗</button><button class="secondary" id="leave">CHOOSE HERO</button><button class="secondary" id="end-inventory">INVENTORY</button></div>`;$('retry').onclick=start;$('leave').onclick=goMenu;$('end-inventory').onclick=openInventory;
 }
 const first=$('modal').querySelector('button');first?.focus();
}
function pause(){if(!run)return;if(run.phase==='playing')run.phase='paused';else if(run.phase==='paused')run.phase='playing';else return;keys.clear();pointer.active=false;stick.x=stick.z=0;modal();}
function skillButtons(){if(!run)return;$('skill-select').innerHTML=SKILLS[run.hero.id].map((skill,i)=>{const locked=!run.unlockedSkills.includes(skill.id);return `<button class="skill-choice ${run.skill===skill.id?'active':''} ${locked?'locked':''}" data-skill="${skill.id}" aria-pressed="${run.skill===skill.id}" ${locked?'disabled':''} title="${locked?'Learn this skill when you level up.':skill.description}"><span class="mu-skill-icon" style="background-position:${-((skill.icon-1)%8)*20}px ${-Math.floor((skill.icon-1)/8)*28}px"></span><kbd>${locked?'LOCKED':i+1}</kbd><b>${skill.name}</b></button>`;}).join('');for(const button of document.querySelectorAll('[data-skill]'))button.onclick=()=>{setSkill(run,button.dataset.skill);skillButtons();};}
$('pause').onclick=pause;
$('dash-button').onclick=()=>{dashRequested=true;};
addEventListener('keydown',e=>{if(e.code==='KeyI'&&!e.repeat){openInventory();return;}if(inventoryPanel.visible){if(e.code==='Escape')closeInventory();return;}if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&!e.repeat)pause();if(run&&['Digit1','Digit2'].includes(e.code)){setSkill(run,SKILLS[run.hero.id][Number(e.code.slice(-1))-1].id);skillButtons();}keys.add(e.code)});addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();if(run?.phase==='playing')pause()});
addEventListener('visibilitychange',()=>{if(document.hidden&&run?.phase==='playing')pause()});
renderer.domElement.addEventListener('pointerdown',e=>{if(run?.phase==='playing'){pointer.active=true;pointer.x=e.clientX;pointer.y=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);if(e.button===2)keys.add('Space')}});
renderer.domElement.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY});renderer.domElement.addEventListener('pointerup',()=>{pointer.active=false;keys.delete('Space')});renderer.domElement.addEventListener('pointercancel',()=>{pointer.active=false;keys.delete('Space')});renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
$('joystick').addEventListener('pointerdown',e=>{e.currentTarget.setPointerCapture(e.pointerId);updateStick(e)});$('joystick').addEventListener('pointermove',e=>{if(e.buttons)updateStick(e)});for(const type of ['pointerup','pointercancel'])$('joystick').addEventListener(type,()=>{stick.x=stick.z=0;$('joystick').firstElementChild.style.transform='';});
function updateStick(e){const r=$('joystick').getBoundingClientRect();const x=(e.clientX-r.left-r.width/2)/34,z=(e.clientY-r.top-r.height/2)/34;const len=Math.max(1,Math.hypot(x,z));stick.x=x/len;stick.z=z/len;$('joystick').firstElementChild.style.transform=`translate(${stick.x*26}px,${stick.z*26}px)`;}
const ray=new THREE.Raycaster(),floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hitPoint=new THREE.Vector3();
function input(){
 let walk=false;let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stick.x,z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+stick.z;
 if(pointer.active&&!x&&!z){ray.setFromCamera(new THREE.Vector2(pointer.x/innerWidth*2-1,-pointer.y/innerHeight*2+1),camera);if(ray.ray.intersectPlane(floorPlane,hitPoint)){const dx=hitPoint.x-run.x,dz=hitPoint.z-run.z,d=Math.hypot(dx,dz);if(d>.8){x=dx/d;z=dz/d;walk=d<3}}}
 const dash=keys.has('Space')||dashRequested;dashRequested=false;return {x,z,dash,walk};
}
const gemGeo=new THREE.OctahedronGeometry(.18),gemMat=new THREE.MeshStandardMaterial({color:'#74bfdc',emissive:'#2a688e',emissiveIntensity:1.2,metalness:.5,roughness:.2});
function renderRun(dt,t){
 const s=run;refreshAppearance();t=s.time;heroModel.position.set(s.x,heightAt(s.x,s.z),s.z);const clip=s.moving?(s.walking?'walk':'run'):'idle',clipData=assets[s.hero.id].data.clips[clip];const animationSeconds=s.moving?s.travel/(s.walking?2.9:3.8)*clipData.count/clipData.fps:t;setPose(heroModel,clip,animationSeconds,true,dt);if(s.attackAnimation>0)attackPose(heroModel,s.animationSkill===SKILLS[s.hero.id][1].id?'attack2':'attack',s.attackDuration-s.attackAnimation,s.attackDuration,s.moving,dt);const facing=s.attackAnimation>0?s.attackFacing:s.facing;const turn=Math.atan2(Math.sin(facing-heroModel.rotation.y),Math.cos(facing-heroModel.rotation.y));heroModel.rotation.y+=turn*(1-Math.exp(-dt*16));heroModel.userData.body.rotation.x=s.hitFlash>0?Math.sin(s.hitFlash*28)*.06:0;heroModel.visible=true;updateArmor(heroModel,t);flashActor(heroModel,s.hitFlash/.32,'#ff6050');$('hit-vignette').style.opacity=String(s.hitFlash/.32*.75);protectionAura.position.copy(heroModel.position);updateAura(protectionAura,t,s.auraLevel);aura.position.set(s.x,heightAt(s.x,s.z)+.07,s.z);
 const desired=new THREE.Vector3(s.x,20+heightAt(s.x,s.z),s.z+18);camera.position.lerp(desired,1-Math.exp(-dt*5));camera.lookAt(s.x,heightAt(s.x,s.z),s.z);
 sync(s.enemies,enemies,e=>{const m=model(e.id,e.size);addShadow(m,e.size*.45);prepareActor(m);playGroup.add(m);return m},(m,e)=>{
  m.position.set(e.x,heightAt(e.x,e.z),e.z);m.rotation.y=Math.atan2(s.x-e.x,s.z-e.z);m.traverse(child=>{if(child.isMesh&&child.morphTargetInfluences){const phase=(t*3+e.uid*.37)%4,frame=Math.floor(phase),f=phase-frame;child.morphTargetInfluences.fill(0);child.morphTargetInfluences[frame]=1-f;child.morphTargetInfluences[(frame+1)%4]=f;}});m.userData.body.rotation.z=Math.sin(e.hit*30)*.09;flashActor(m,Math.max(0,e.hit/.16));
 },m=>disposeActor(m));
 sync(s.shots,shots,p=>{const m=spellEffects.createProjectile(p);playGroup.add(m);return m},(m,p)=>spellEffects.moveProjectile(m,p,s.enemies.find(e=>e.uid===p.target)),m=>spellEffects.disposeProjectile(m));
 sync(s.loot.drops,lootModels,drop=>{const m=model(ITEMS[drop.id].model,drop.id==='kundun-box'?.65:.7,true);prepareActor(m);playGroup.add(m);return m},(m,drop)=>{m.position.set(drop.x,heightAt(drop.x,drop.z)+.28+Math.sin(t*2+drop.uid)*.09,drop.z);m.rotation.y=t*.7;},m=>disposeActor(m));
 sync(s.gems,gems,g=>{const m=new THREE.Mesh(gemGeo,gemMat);playGroup.add(m);return m},(m,g)=>{m.position.set(g.x,heightAt(g.x,g.z)+.32+Math.sin(t*3+g.uid)*.06,g.z);m.rotation.y=t*1.5;});
 spellEffects.update(dt);$('orb-value').textContent=Math.ceil(s.hp);$('health-orb-fill').style.clipPath=`inset(${(1-s.hp/s.maxHp)*100}% 0 0 0)`;const activeSkill=SKILLS[s.hero.id].find(k=>k.id===s.skill);$('skill-name').textContent=activeSkill.name;$('health-fill').style.width=`${s.hp/s.maxHp*100}%`;$('health-text').textContent=`${Math.ceil(s.hp)} / ${s.maxHp}`;$('level').textContent=`LV. ${s.level}`;$('kills').textContent=`${s.kills} KILLS`;$('timer').textContent=time(s.time);$('xp-fill').style.width=`${s.xp/s.xpNeeded*100}%`;$('xp-text').textContent=`LEVEL ${s.level} · ${s.xp} / ${s.xpNeeded} EXP`;$('wave').textContent=`WAVE ${String(s.wave).padStart(2,'0')} / 10`;$('wave-fill').style.width=`${(s.time%WAVE_SECONDS)/WAVE_SECONDS*100}%`;$('dash-state').textContent=s.dashCooldown>0?`${s.dashCooldown.toFixed(1)}s`:'DASH';$('dash-button').style.setProperty('--ready',`${(1-s.dashCooldown/3)*100}%`);for(const button of document.querySelectorAll('[data-skill]')){const skill=SKILLS[s.hero.id].find(k=>k.id===button.dataset.skill);button.style.setProperty('--cooldown',button.dataset.skill===s.skill?`${Math.min(1,Math.max(0,s.attackTimer/(s.cooldown*skill.cooldown)))*100}%`:'0%');}
 const waveNames=['The first shadows','A restless clearing','Wings in the dark','The swarm grows','Steel meets fury','No way back','The hunt begins','A wall of darkness','Giants awaken','The final stand'];$('wave-title').textContent=s.time%WAVE_SECONDS>=WAVE_SECONDS-SURGE_SECONDS?'Horde surge':waveNames[s.wave-1];$('wave').parentElement.classList.toggle('surging',s.time%WAVE_SECONDS>=WAVE_SECONDS-SURGE_SECONDS);$('horde-count').textContent=`${s.enemies.length} ENEMIES IN THE ARENA`;const pieceCount=Object.entries(s.equipment).filter(([slot,item])=>slot!=='weapon'&&item).length;$('gear-status').textContent=`${pieceCount?pieceCount+'/5 armor pieces':'Unarmored'}${s.equipment.weapon?' · '+ITEMS[s.equipment.weapon.id].name:''}${s.auraLevel?' · AURA '+s.auraLevel:''}`;
 if(lastWave!==s.wave){lastWave=s.wave;toast(`Wave ${s.wave} · ${waveNames[s.wave-1]}`)}
 const boss=s.enemies.find(e=>e.elite);$('boss-health').hidden=!boss;if(boss)$('boss-fill').style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;
 if(s.time>=DURATION&&!s.bossDefeated)$('objective').textContent='Finish the Lorencia Guardian';else $('objective').textContent='Survive 03:00 · defeat the guardian';
 if(lastPhase!==s.phase){lastPhase=s.phase;modal();}
}
function sync(items,map,create,update,dispose=null){const ids=new Set();for(const item of items){ids.add(item.uid);let object=map.get(item.uid);if(!object){object=create(item);map.set(item.uid,object)}update(object,item)}for(const [id,object]of map)if(!ids.has(id)){playGroup.remove(object);dispose?.(object);map.delete(id)}}
function events(){let hitNumbers=0;for(const e of run.events){
 if(e.type==='attack'){const skill=SKILLS[run.hero.id].find(k=>k.id===e.skill);effect(skill.sound);spellEffects.attack(e.skill,e.x,e.z,e.facing,e.range);}
 else if(e.type==='impact')spellEffects.impact(e.skill,e.x,e.z);
 else if(e.type==='hit'){const actor=enemies.get(e.uid);if(actor)flashActor(actor,1);if(hitNumbers++<8)spellEffects.hit(e.x,e.z,e.size,e.damage,e.critical);effect('hit');}
 else if(e.type==='death'){spellEffects.death(enemies.get(e.uid),e.x,e.z,e.size);effect(MONSTER_AUDIO[e.id].death,e);}
 else if(e.type==='monster-idle')effect(MONSTER_AUDIO[e.id].idle,e);
 else if(e.type==='monster-attack')effect(MONSTER_AUDIO[e.id].attack,e);
 else if(e.type==='loot-drop')toast(ITEMS[e.id].name+' dropped · move close to collect');
 else if(e.type==='loot-pickup'){saveRunInventory(run);refreshStash();effect('armor');toast(ITEMS[e.id].name+(e.enhancement?' +'+e.enhancement:'')+(e.equipped?' equipped':' collected'));}
 else if(e.type==='hurt'){spellEffects.burst(run.x,run.z,'#ff7f80',12,.8);effect('hurt-'+run.hero.id);}
 else if(e.type==='level')effect('level-up');
 else if(e.type==='reward'){effect(e.id==='armor'||e.id.startsWith('enhance')?'armor':'level-up');toast(e.id==='armor'?ARMOR[run.hero.id].name+' equipped':e.id==='unlock-skill'?'New skill learned':e.id==='aura'?'Aura awakened':e.id==='enhance13'?'Armor enhanced to +13':e.id==='enhance15'?'Armor enhanced to +15':'Blessing acquired');}
 else if(e.type==='surge')toast('Wave '+e.wave+' · The horde surges!');
 else if(e.type==='boss')toast('The Lorencia Guardian awakens.');
}}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);
function animate(ms){requestAnimationFrame(animate);const dt=Math.min((ms-last)/1000,.1)||.016;last=ms;const t=ms/1000;
 if(run){
  accumulator+=dt;while(accumulator>=1/60){tick(run,1/60,input());events();accumulator-=1/60;}
  renderRun(run.phase==='playing'?dt:0,t);
 }else{
  lastPhase='';lastWave=1;accumulator=0;const previewX=heroPreviews[selected]?.position.x||0;camera.position.set(innerWidth<700?previewX:9.5,10,innerWidth<700?23:25);camera.lookAt(innerWidth<700?previewX:4.5,.2,-3);
  for(const h of CLASSES){const m=heroPreviews[h.id];if(m){m.rotation.y=Math.sin(t*.35)*.14-.2;m.position.y=heightAt(m.position.x,m.position.z);setPose(m,'idle',t);m.scale.setScalar(h.id===selected?1:.9)}}
 }
 for(const prop of scenery)prop.visible=prop.position.distanceTo(camera.position)<67;renderer.render(scene,camera);
}
async function init(){try{[terrainData,objectData]=await Promise.all([fetch('assets/lorencia-terrain.json').then(r=>r.json()),fetch('assets/lorencia-objects.json').then(r=>r.json())]);await Promise.all(['knight','wizard','elf','knight-armor','wizard-armor','elf-armor','spider','budge','bull','hound','giant','weapon-sword','weapon-staff','weapon-bow',...Object.values(ITEMS).map(item=>item.model),...objectData.models].map(loadModel));[chromeTexture,auraTexture,shinyTexture]=await Promise.all(['assets/textures/effect-chrome01.png','assets/textures/effect-aurawave_blue_00.png','assets/textures/effect-shiny01.png'].map(loadTexture));$('load-status').textContent='Building the clearing…';await world();makeItemIcons();ready=true;refreshPreviewGear();$('loading').hidden=true;$('begin').disabled=false;$('begin').innerHTML='ENTER LORENCIA <span>↗</span>';requestAnimationFrame(animate);}catch(error){console.error(error);$('load-status').textContent=`Could not load the demo: ${error.message}. Start it with npm start from App.`;}}
init();
// Small inspectable state for local QA; no accounts, services or persisted gameplay.
window.muDemo={get run(){return run},get ready(){return ready},get renderer(){return renderer},get hero(){return heroModel},get obstacles(){return obstacles},get scenery(){return scenery},get effects(){return spellEffects},get previews(){return heroPreviews},get camera(){return camera},get inventory(){return inventoryPanel},openInventory,start,goMenu,select:id=>{if(CLASSES.some(c=>c.id===id)){selected=id;cards()}},pause};
