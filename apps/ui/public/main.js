import * as THREE from './vendor/three.module.js';
import {CLASSES,ENEMIES,UPGRADES,createRun,tick,chooseUpgrade,DURATION,ARENA} from './shared/game.js';
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
const assets={},textures={},loader=new THREE.TextureLoader();
async function loadTexture(url){if(!textures[url])textures[url]=loader.loadAsync(url).then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;});return textures[url];}
async function loadModel(name){
 const response=await fetch(`assets/models/${name}.json`);if(!response.ok)throw new Error(`Missing model: ${name}`);const data=await response.json();const template=new THREE.Group();
 for(const part of data.parts){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(part.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(part.uvs,2));g.computeVertexNormals();
  if(part.frames){g.morphAttributes.position=part.frames.map(frame=>new THREE.Float32BufferAttribute(frame,3));}
  const map=part.texture?await loadTexture(part.texture):null;
  const mat=new THREE.MeshStandardMaterial({map,color:map?'#ffffff':'#b3aaa0',roughness:.83,metalness:.12,side:THREE.DoubleSide,alphaTest:.45});
  const mesh=new THREE.Mesh(g,mat);template.add(mesh);
 }
 assets[name]={template,data};
}
function model(name,height){
 const {template,data}=assets[name];const root=new THREE.Group();const object=template.clone();const scale=height/(data.max[1]-data.min[1]);object.scale.setScalar(scale);object.position.y=-data.min[1]*scale;
 // Center horizontally without changing the model's pose.
 object.position.x=-(data.min[0]+data.max[0])/2*scale;object.position.z=-(data.min[2]+data.max[2])/2*scale;root.add(object);root.userData.body=object;
 return root;
}
function mesh(geometry,color,extra={}){return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.8,...extra}));}
const floorGroup=new THREE.Group(),menuGroup=new THREE.Group(),playGroup=new THREE.Group();scene.add(floorGroup,menuGroup,playGroup);playGroup.visible=false;
let heroModel;const heroPreviews={};
function ring(radius,color){const m=new THREE.Mesh(new THREE.RingGeometry(radius-.035,radius,80),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;return m;}
function shadow(radius){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');const gr=ctx.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.6)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,64,64);const m=new THREE.Mesh(new THREE.PlaneGeometry(radius*2,radius*2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.035;return m;}
const shadowTemplate=shadow(1);
function addShadow(root,size){const s=shadowTemplate.clone();s.scale.setScalar(size);root.add(s)}
function weapon(root,id){
 const w=new THREE.Group();const gold='#c6af75',silver='#b8c9c7';
 if(id==='knight'){
  const blade=mesh(new THREE.BoxGeometry(.12,1.15,.055),silver,{metalness:.8,roughness:.25});blade.position.y=.65;w.add(blade);const guard=mesh(new THREE.BoxGeometry(.4,.06,.1),gold);guard.position.y=.08;w.add(guard);w.position.set(-.55,.6,.1);w.rotation.z=-.5;
 }else if(id==='wizard'){
  const staff=mesh(new THREE.CylinderGeometry(.04,.055,1.8,6),gold);staff.position.y=.65;w.add(staff);const jewel=mesh(new THREE.OctahedronGeometry(.17), '#9aacfa',{emissive:'#647dff',emissiveIntensity:2});jewel.position.y=1.6;w.add(jewel);w.position.set(-.6,.2,0);
 }else{
  const bow=mesh(new THREE.TorusGeometry(.55,.045,6,20,Math.PI),'#cdb479');bow.rotation.z=-Math.PI/2;w.add(bow);const string=mesh(new THREE.CylinderGeometry(.008,.008,1.1,4),'#b4d4bc');w.add(string);w.position.set(-.7,1.0,.1);
 }root.add(w);
}
async function world(){
 const grass=await loadTexture('assets/textures/world1-tilegrass01.png');grass.wrapS=grass.wrapT=THREE.RepeatWrapping;grass.repeat.set(38,38);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({map:grass,color:'#68785f',roughness:1}));ground.rotation.x=-Math.PI/2;floorGroup.add(ground);
 const pathTex=(await loadTexture('assets/textures/world1-tileground02.png')).clone();pathTex.wrapS=pathTex.wrapT=THREE.RepeatWrapping;pathTex.repeat.set(3,24);pathTex.needsUpdate=true;
 for(const angle of [0,Math.PI/2]){const p=new THREE.Mesh(new THREE.PlaneGeometry(6,63),new THREE.MeshStandardMaterial({map:pathTex,color:'#879388',roughness:1}));p.rotation.x=-Math.PI/2;p.rotation.z=angle;p.position.y=.008;floorGroup.add(p)}
 const platform=mesh(new THREE.CylinderGeometry(5.6,5.9,.17,64),'#65766c',{map:pathTex});platform.position.y=.035;floorGroup.add(platform);const centerRing=ring(5.4,'#839483');centerRing.position.y=.13;floorGroup.add(centerRing);
 const boundary=ring(ARENA+1,'#80a28d');boundary.position.y=.04;floorGroup.add(boundary);
 // Original Lorencia trees, stone statues and rocks frame the playable clearing.
 let seed=42;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<60;i++){
  const a=i/60*Math.PI*2;const r=32+rand()*13;const name=i%3===0?'rock':'tree';const p=model(name,name==='tree'?7+rand()*4:1+rand()*1.7);p.position.set(Math.cos(a)*r,0,Math.sin(a)*r);p.rotation.y=rand()*7;floorGroup.add(p);
 }
 for(const [x,z] of [[-12,-12],[12,-12],[-12,12],[12,12]]){
  const statue=model('statue',4.1);statue.position.set(x,0,z);statue.rotation.y=Math.atan2(-x,-z);floorGroup.add(statue);
  const base=mesh(new THREE.BoxGeometry(2.3,.3,2.3),'#5d6b60');base.position.set(x,.15,z);floorGroup.add(base);
 }
 for(const [x,z] of [[-7,-7],[7,-7],[-7,7],[7,7],[-24,0],[24,0],[0,24],[0,-24]]){
  const post=mesh(new THREE.CylinderGeometry(.12,.25,1.6,6),'#465151');post.position.set(x,.8,z);floorGroup.add(post);const flame=mesh(new THREE.OctahedronGeometry(.22),'#eeb074',{emissive:'#ff9a43',emissiveIntensity:3});flame.position.set(x,1.8,z);floorGroup.add(flame);
  const light=new THREE.PointLight('#f3a258',9,6,2);light.position.set(x,2,z);floorGroup.add(light);
 }
 for(let i=0;i<3;i++){
  const hero=CLASSES[i],p=model(hero.id,4.2);weapon(p,hero.id);p.position.set(-2+i*5.5,.37,-3);heroPreviews[hero.id]=p;menuGroup.add(p);addShadow(p,1.4);
  const base=mesh(new THREE.CylinderGeometry(1.8,1.95,.35,32),'#424f49');base.position.copy(p.position);base.position.y=.17;menuGroup.add(base);const r=ring(1.75,hero.color);r.position.copy(p.position);r.position.y=.36;menuGroup.add(r);
 }
 const dots=new THREE.BufferGeometry(),positions=[];for(let i=0;i<160;i++)positions.push((rand()-.5)*70,rand()*8+.5,(rand()-.5)*70);dots.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));scene.add(new THREE.Points(dots,new THREE.PointsMaterial({color:'#c1d5bc',size:.05,transparent:true,opacity:.4})));
}
const music=new Audio('assets/audio/lorencia-pub.mp3');music.loop=true;music.volume=.24;
const sounds={};for(const id of ['knight','wizard','elf','level-up'])sounds[id]=Array.from({length:3},()=>{const a=new Audio(`assets/audio/${id}.wav`);a.volume=id==='level-up'?.4:.16;return a;});
function effect(id){if(muted)return;const pool=sounds[id];const a=pool.find(a=>a.paused)||pool[0];a.currentTime=0;a.play().catch(()=>{});}
function startMusic(){if(!muted)music.play().catch(()=>{});}
$('sound').onclick=()=>{muted=!muted;music.muted=muted;for(const pool of Object.values(sounds))for(const a of pool)a.muted=muted;$('sound').textContent=muted?'♪ SOUND OFF':'♪ SOUND ON';$('sound').setAttribute('aria-label',muted?'Unmute audio':'Mute audio');startMusic()};
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.().catch(()=>{});};
function cards(){
 $('cards').innerHTML=CLASSES.map((h,i)=>`<button class="hero-card ${h.id===selected?'selected':''}" style="--accent:${h.color}" data-hero="${h.id}" aria-pressed="${h.id===selected}"><div class="card-top"><span>${h.role}</span><span>${h.id===selected?'●':`0${i+1}`}</span></div><h3>${h.name}</h3><p>${h.description}</p><div class="card-skill"><span>${icons[h.id]}</span>${h.skill}</div></button>`).join('');
 for(const el of document.querySelectorAll('[data-hero]'))el.onclick=()=>{selected=el.dataset.hero;cards();startMusic()};
}
cards();
const enemies=new Map(),shots=new Map(),gems=new Map(),particles=[];let aura=null;
function clearPlay(){for(const p of particles)if(p.pulse){p.m.geometry.dispose();p.m.material.dispose();}for(const child of [...playGroup.children])playGroup.remove(child);enemies.clear();shots.clear();gems.clear();particles.length=0;}
function start(){
 if(!ready)return;clearPlay();run=createRun(selected);heroModel=model(selected,2.4);weapon(heroModel,selected);addShadow(heroModel,1);playGroup.add(heroModel);aura=ring(1.05,run.hero.color);aura.position.y=.05;playGroup.add(aura);menuGroup.visible=false;playGroup.visible=true;$('menu').hidden=true;$('hud').hidden=false;$('overlay').hidden=true;document.body.classList.add('playing');keys.clear();stick.x=stick.z=0;pointer.active=false;camera.position.set(0,22,20);camera.lookAt(0,0,0);$('hero-name').textContent=run.hero.name.toUpperCase();$('skill-name').textContent=run.hero.skill;$('skill-icon').textContent=icons[selected];startMusic();toast('The gates have fallen. Survive.');
}
$('begin').onclick=start;
function goMenu(){run=null;clearPlay();menuGroup.visible=true;playGroup.visible=false;$('menu').hidden=false;$('hud').hidden=true;$('overlay').hidden=true;document.body.classList.remove('playing');keys.clear();stick.x=stick.z=0;pointer.active=false;}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200)}
const time=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
let lastPhase='',lastWave=1;
function modal(){
 if(!run)return;const s=run;const show=['upgrade','paused','dead','won'].includes(s.phase);$('overlay').hidden=!show;if(!show)return;
 if(s.phase==='upgrade'){
  $('modal').innerHTML=`<span class="eyebrow">LEVEL ${s.level} · A JEWEL OF BLESSING</span><h2>Power answers the call.</h2><p>Choose one blessing for the battle ahead.</p><div class="upgrade-options">${s.choices.map(id=>{const u=UPGRADES.find(u=>u.id===id);return `<button class="upgrade" data-upgrade="${id}"><span>${u.icon}</span><b>${u.name}</b><p>${u.text}</p></button>`}).join('')}</div>`;
  for(const el of document.querySelectorAll('[data-upgrade]'))el.onclick=()=>{chooseUpgrade(s,el.dataset.upgrade);lastPhase='';modal()};
 }else if(s.phase==='paused'){
  $('modal').innerHTML='<span class="eyebrow">TAKE A BREATH</span><h2>The battle can wait.</h2><p>Move with WASD or arrows. Your skills attack automatically.<br>Collect blue jewels to grow stronger. Space or right click to dash.</p><div class="modal-actions"><button class="primary" id="resume">RESUME BATTLE</button><button class="secondary" id="leave">CHOOSE HERO</button></div>';$('resume').onclick=()=>{s.phase='playing';lastPhase='';modal()};$('leave').onclick=goMenu;
 }else{
  const won=s.phase==='won';$('modal').innerHTML=`<span class="eyebrow">${won?'LORENCIA STANDS':'EVERY LEGEND BEGINS SOMEWHERE'}</span><h2>${won?'You held the line.':'The horde prevails.'}</h2><p>${won?'Five minutes. Ten waves. One hero. The sanctuary lives another day.':'Return stronger. A different blessing can change everything.'}</p><div class="results"><div><b>${time(s.time)}</b><span>SURVIVED</span></div><div><b>${s.kills}</b><span>ENEMIES SLAIN</span></div><div><b>${s.level}</b><span>HERO LEVEL</span></div></div><div class="modal-actions"><button class="primary" id="retry">PLAY AGAIN ↗</button><button class="secondary" id="leave">CHOOSE HERO</button></div>`;$('retry').onclick=start;$('leave').onclick=goMenu;
 }
 const first=$('modal').querySelector('button');first?.focus();
}
function pause(){if(!run)return;if(run.phase==='playing')run.phase='paused';else if(run.phase==='paused')run.phase='playing';else return;keys.clear();pointer.active=false;stick.x=stick.z=0;modal();}
$('pause').onclick=pause;
$('dash-button').onclick=()=>{dashRequested=true;};
addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&!e.repeat)pause();keys.add(e.code)});addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();if(run?.phase==='playing')pause()});
addEventListener('visibilitychange',()=>{if(document.hidden&&run?.phase==='playing')pause()});
renderer.domElement.addEventListener('pointerdown',e=>{if(run?.phase==='playing'){pointer.active=true;pointer.x=e.clientX;pointer.y=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);if(e.button===2)keys.add('Space')}});
renderer.domElement.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY});renderer.domElement.addEventListener('pointerup',()=>{pointer.active=false;keys.delete('Space')});renderer.domElement.addEventListener('pointercancel',()=>{pointer.active=false;keys.delete('Space')});renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
$('joystick').addEventListener('pointerdown',e=>{e.currentTarget.setPointerCapture(e.pointerId);updateStick(e)});$('joystick').addEventListener('pointermove',e=>{if(e.buttons)updateStick(e)});for(const type of ['pointerup','pointercancel'])$('joystick').addEventListener(type,()=>{stick.x=stick.z=0;$('joystick').firstElementChild.style.transform='';});
function updateStick(e){const r=$('joystick').getBoundingClientRect();const x=(e.clientX-r.left-r.width/2)/34,z=(e.clientY-r.top-r.height/2)/34;const len=Math.max(1,Math.hypot(x,z));stick.x=x/len;stick.z=z/len;$('joystick').firstElementChild.style.transform=`translate(${stick.x*26}px,${stick.z*26}px)`;}
const ray=new THREE.Raycaster(),floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hitPoint=new THREE.Vector3();
function input(){
 let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+stick.x,z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+stick.z;
 if(pointer.active&&!x&&!z){ray.setFromCamera(new THREE.Vector2(pointer.x/innerWidth*2-1,-pointer.y/innerHeight*2+1),camera);if(ray.ray.intersectPlane(floorPlane,hitPoint)){const dx=hitPoint.x-run.x,dz=hitPoint.z-run.z,d=Math.hypot(dx,dz);if(d>.8){x=dx/d;z=dz/d}}}
 const dash=keys.has('Space')||dashRequested;dashRequested=false;return {x,z,dash};
}
const shotGeo=new THREE.SphereGeometry(.14,6,5),gemGeo=new THREE.OctahedronGeometry(.18),particleGeo=new THREE.SphereGeometry(.09,4,3);
const shotMats={wizard:new THREE.MeshBasicMaterial({color:'#a9b6ff'}),elf:new THREE.MeshBasicMaterial({color:'#b9efd2'})},gemMat=new THREE.MeshStandardMaterial({color:'#74bfdc',emissive:'#2a688e',emissiveIntensity:1.2,metalness:.5,roughness:.2});
const particleMats={gold:new THREE.MeshBasicMaterial({color:'#edc794',transparent:true}),blue:new THREE.MeshBasicMaterial({color:'#aabaff',transparent:true}),red:new THREE.MeshBasicMaterial({color:'#d05a54',transparent:true})};
function sparks(x,z,color='gold',count=6){for(let i=0;i<count&&particles.length<140;i++){const m=new THREE.Mesh(particleGeo,particleMats[color]);m.position.set(x,.8,z);playGroup.add(m);particles.push({m,vx:(Math.random()-.5)*6,vz:(Math.random()-.5)*6,vy:Math.random()*4,life:.45,max:.45})}}
function pulse(x,z,color,size){const m=ring(size,color);m.position.set(x,.1,z);playGroup.add(m);particles.push({m,life:.4,max:.4,pulse:true});}
function renderRun(dt,t){
 const s=run;heroModel.position.set(s.x,Math.sin(t*9)*.035,s.z);heroModel.rotation.y=s.facing;heroModel.visible=s.invulnerable<=0||Math.floor(t*18)%2===0;aura.position.set(s.x,.07,s.z);
 const desired=new THREE.Vector3(s.x,22,s.z+20);camera.position.lerp(desired,1-Math.exp(-dt*5));camera.lookAt(s.x,0,s.z);
 sync(s.enemies,enemies,e=>{const m=model(e.id,e.size);addShadow(m,e.size*.45);playGroup.add(m);return m},(m,e)=>{
  m.position.set(e.x,0,e.z);m.rotation.y=Math.atan2(s.x-e.x,s.z-e.z);m.traverse(child=>{if(child.isMesh&&child.morphTargetInfluences){const phase=(t*3+e.uid*.37)%4,frame=Math.floor(phase),f=phase-frame;child.morphTargetInfluences.fill(0);child.morphTargetInfluences[frame]=1-f;child.morphTargetInfluences[(frame+1)%4]=f;}});m.scale.setScalar(e.hit>0?1.06:1);
 });
 sync(s.shots,shots,p=>{const m=new THREE.Mesh(shotGeo,shotMats[p.kind]);if(p.kind==='elf')m.scale.set(.5,.5,2.3);playGroup.add(m);return m},(m,p)=>{m.position.set(p.x,1,p.z);const target=s.enemies.find(e=>e.uid===p.target);if(target)m.rotation.y=Math.atan2(target.x-p.x,target.z-p.z)});
 sync(s.gems,gems,g=>{const m=new THREE.Mesh(gemGeo,gemMat);playGroup.add(m);return m},(m,g)=>{m.position.set(g.x,.32+Math.sin(t*3+g.uid)*.06,g.z);m.rotation.y=t*1.5;});
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){playGroup.remove(p.m);if(p.pulse){p.m.geometry.dispose();p.m.material.dispose()}particles.splice(i,1);continue}if(p.pulse){p.m.scale.setScalar(1+(1-p.life/p.max)*.6);p.m.material.opacity=p.life/p.max*.8;}else{p.m.position.x+=p.vx*dt;p.m.position.z+=p.vz*dt;p.m.position.y+=p.vy*dt;p.vy-=9*dt;p.m.scale.setScalar(p.life/p.max)}}
 $('health-fill').style.width=`${s.hp/s.maxHp*100}%`;$('health-text').textContent=`${Math.ceil(s.hp)} / ${s.maxHp}`;$('level').textContent=`LV. ${s.level}`;$('kills').textContent=`${s.kills} KILLS`;$('timer').textContent=time(s.time);$('xp-fill').style.width=`${s.xp/s.xpNeeded*100}%`;$('xp-text').textContent=`LEVEL ${s.level} · ${s.xp} / ${s.xpNeeded} EXP`;$('wave').textContent=`WAVE ${String(s.wave).padStart(2,'0')} / 10`;$('wave-fill').style.width=`${(s.time%30)/30*100}%`;$('dash-state').textContent=s.dashCooldown>0?`DASH · ${s.dashCooldown.toFixed(1)}s`:'DASH READY';
 const waveNames=['The first shadows','A restless clearing','Wings in the dark','The swarm grows','Steel meets fury','No way back','The hunt begins','A wall of darkness','Giants awaken','The final stand'];$('wave-title').textContent=waveNames[s.wave-1];
 if(lastWave!==s.wave){lastWave=s.wave;toast(`Wave ${s.wave} · ${waveNames[s.wave-1]}`)}
 const boss=s.enemies.find(e=>e.elite);$('boss-health').hidden=!boss;if(boss)$('boss-fill').style.width=`${Math.max(0,boss.hp/boss.maxHp*100)}%`;
 if(s.time>=DURATION&&!s.bossDefeated)$('objective').textContent='Finish the Lorencia Guardian';else $('objective').textContent='Survive 05:00 · defeat the guardian';
 if(lastPhase!==s.phase){lastPhase=s.phase;modal();}
}
function sync(items,map,create,update){const ids=new Set();for(const item of items){ids.add(item.uid);let object=map.get(item.uid);if(!object){object=create(item);map.set(item.uid,object)}update(object,item)}for(const [id,object]of map)if(!ids.has(id)){playGroup.remove(object);map.delete(id)}}
function events(){for(const e of run.events){if(e.type==='attack'){effect(e.hero);if(e.hero==='knight')pulse(e.x,e.z,run.hero.color,run.slashRange);}
 else if(e.type==='burst'){sparks(e.x,e.z,'blue',10);pulse(e.x,e.z,'#9fafff',2)}else if(e.type==='death')sparks(e.x,e.z);else if(e.type==='hurt'){sparks(run.x,run.z,'red');}else if(e.type==='level')effect('level-up');else if(e.type==='boss')toast('The Lorencia Guardian awakens.');}}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);
function animate(ms){requestAnimationFrame(animate);const dt=Math.min((ms-last)/1000,.1)||.016;last=ms;const t=ms/1000;
 if(run){
  accumulator+=dt;while(accumulator>=1/60){tick(run,1/60,input());events();accumulator-=1/60;}
  renderRun(run.phase==='playing'?dt:0,t);
 }else{
  lastPhase='';lastWave=1;accumulator=0;const previewX=heroPreviews[selected]?.position.x||0;camera.position.set(innerWidth<700?previewX:4,10,innerWidth<700?23:21);camera.lookAt(innerWidth<700?previewX:-3,1.5,-3);
  for(const h of CLASSES){const m=heroPreviews[h.id];if(m){m.rotation.y=Math.sin(t*.35)*.14-.2;m.position.y=.37+Math.sin(t*1.8)*.04;m.scale.setScalar(h.id===selected?1:.9)}}
 }
 renderer.render(scene,camera);
}
async function init(){try{await Promise.all(['knight','wizard','elf','spider','budge','bull','hound','giant','tree','rock','statue'].map(loadModel));$('load-status').textContent='Building the clearing…';await world();ready=true;$('loading').hidden=true;$('begin').disabled=false;$('begin').innerHTML='ENTER LORENCIA <span>↗</span>';requestAnimationFrame(animate);}catch(error){console.error(error);$('load-status').textContent=`Could not load the demo: ${error.message}. Start it with npm start from App.`;}}
init();
// Small inspectable state for local QA; no accounts, services or persisted gameplay.
window.muDemo={get run(){return run},get ready(){return ready},get renderer(){return renderer},start,goMenu,select:id=>{if(CLASSES.some(c=>c.id===id)){selected=id;cards()}},pause};
