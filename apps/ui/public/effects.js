import * as THREE from './vendor/three.module.js';

// Lightweight, animated spell geometry. Shared shapes/textures; bounded transient objects.
const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=64;
const context=glowCanvas.getContext('2d');const gradient=context.createRadialGradient(32,32,0,32,32,32);
gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.16,'rgba(255,255,255,.9)');gradient.addColorStop(.42,'rgba(255,255,255,.3)');gradient.addColorStop(1,'rgba(255,255,255,0)');context.fillStyle=gradient;context.fillRect(0,0,64,64);
const glowTexture=new THREE.CanvasTexture(glowCanvas);
const shapes={arrow:new THREE.CylinderGeometry(.035,.035,1.55,6),head:new THREE.ConeGeometry(.13,.38,6),crystal:new THREE.OctahedronGeometry(.18),shard:new THREE.ConeGeometry(.1,.65,5),line:new THREE.PlaneGeometry(1,1)};
const palette={slash:'#ffc56f',stab:'#ffeba8',evil:'#b18aff',hellfire:'#ff7537',multishot:'#adffd3',icearrow:'#75dcff'};
const additive=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
function sprite(color,size){const material=new THREE.SpriteMaterial({map:glowTexture,color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});const s=new THREE.Sprite(material);s.scale.set(size,size,size);return s;}
function arc(radius,width,color,angle=Math.PI*2){const g=new THREE.RingGeometry(Math.max(.01,radius-width),radius,80,1,0,angle);const m=new THREE.Mesh(g,additive(color));m.rotation.x=-Math.PI/2;m.userData.ownGeometry=true;return m;}
function release(root){root.traverse(o=>{if(o.material)o.material.dispose();if(o.userData.ownGeometry)o.geometry.dispose();});}
export class SpellEffects{
 constructor(parent,heightAt){this.parent=parent;this.heightAt=heightAt;this.items=[];}
 clear(){for(const item of this.items){this.parent.remove(item.root);release(item.root);}this.items=[];}
 add(root,duration,update){if(this.items.length>=100){const old=this.items.shift();this.parent.remove(old.root);release(old.root);}this.parent.add(root);this.items.push({root,duration,age:0,update});return root;}
 place(root,x,z,y=.15){root.position.set(x,this.heightAt(x,z)+y,z);return root;}
 fade(root,opacity){root.traverse(o=>{if(o.material)o.material.opacity=(o.userData.baseOpacity??1)*opacity;});}
 update(dt){for(let i=this.items.length-1;i>=0;i--){const item=this.items[i];item.age+=dt;const t=Math.min(1,item.age/item.duration);item.update(t,dt);if(t>=1){this.parent.remove(item.root);release(item.root);this.items.splice(i,1);}}}
 attack(skill,x,z,angle,range){
  if(skill==='slash')this.slash(x,z,range);
  else if(skill==='stab')this.stab(x,z,angle,range);
  else if(skill==='hellfire')this.hellfire(x,z,range);
  else this.muzzle(skill,x,z,angle);
 }
 slash(x,z,radius){
  const group=this.place(new THREE.Group(),x,z,.7);
  for(let i=0;i<3;i++){const blade=arc(radius*(1-i*.12),.19,palette.slash,Math.PI*1.1);blade.position.y=i*.16;blade.rotation.z=i*Math.PI*2/3;group.add(blade);const glow=arc(radius*(1-i*.12)+.06,.42,palette.slash,Math.PI*1.1);glow.position.y=i*.16-.01;glow.rotation.z=i*Math.PI*2/3;glow.userData.baseOpacity=.16;group.add(glow);const core=arc(radius*(1-i*.12)-.05,.04,'#fff8db',Math.PI*.95);core.position.y=i*.16+.02;core.rotation.z=i*Math.PI*2/3;group.add(core);}
  this.add(group,.58,t=>{group.rotation.y=t*Math.PI*2.4;group.scale.setScalar(.68+.32*Math.sin(t*Math.PI/2));this.fade(group,Math.sin(Math.PI*t)**.65);});
  this.burst(x,z,palette.slash,12,.8);
 }
 stab(x,z,angle,length){
  const group=this.place(new THREE.Group(),x,z,.95);group.rotation.y=angle;
  for(const [width,color,opacity]of [[.5,palette.stab,.36],[.11,'#fff9e4',1]]){const line=new THREE.Mesh(shapes.line,additive(color,opacity));line.rotation.x=-Math.PI/2;line.scale.set(width,length,1);line.position.z=length/2;line.userData.baseOpacity=opacity;group.add(line);}
  const tip=new THREE.Mesh(shapes.head,additive('#fff1bb'));tip.rotation.x=Math.PI/2;tip.position.z=length;group.add(tip);
  this.add(group,.38,t=>{group.scale.z=.4+.6*(1-(1-t)**3);this.fade(group,(1-t)**.6);});
 }
 hellfire(x,z,radius){
  const group=this.place(new THREE.Group(),x,z,.08);const ring=arc(radius,.2,'#ff9e49');group.add(ring);const inner=arc(radius*.83,.045,'#ffdd8c');group.add(inner);
  const halo=sprite('#ff7428',radius*2);halo.position.y=.2;halo.userData.baseOpacity=.34;group.add(halo);
  const flames=[];for(let i=0;i<28;i++){const a=i/28*Math.PI*2,r=radius*(.5+Math.random()*.4);const f=sprite(i%3?'#ff793d':'#ffe5a0',.7+Math.random()*.5);f.position.set(Math.sin(a)*r,.1,Math.cos(a)*r);group.add(f);flames.push({f,y:.6+Math.random()*1.6});}
  this.add(group,1.05,t=>{const expansion=.35+.65*(1-(1-t)**3);ring.scale.setScalar(expansion);inner.scale.setScalar(expansion);inner.rotation.z=t*.8;for(const {f,y}of flames){f.position.y=t*y*2.5;f.scale.set(.75*(1-t)+.15,1.4*(1-t)+.3,1);}this.fade(group,Math.sin(Math.PI*t)**.7);});
  this.burst(x,z,'#ffb45d',22,radius*.7);
 }
 muzzle(skill,x,z,angle){const color=palette[skill];const group=this.place(new THREE.Group(),x,z,1);const flash=sprite(color,skill==='evil'?1.25:.7);group.add(flash);this.add(group,.23,t=>{group.scale.setScalar(.5+t);this.fade(group,1-t);});}
 impact(skill,x,z){
  if(skill==='icearrow'){const group=this.place(new THREE.Group(),x,z,.05);const ring=arc(2.2,.13,palette.icearrow);group.add(ring);const shards=[];for(let i=0;i<8;i++){const a=i/8*Math.PI*2,m=new THREE.Mesh(shapes.shard,additive(i%2?'#75dcff':'#d8faff'));m.position.set(Math.sin(a)*.5,.4,Math.cos(a)*.5);m.rotation.z=Math.sin(a)*.6;m.rotation.x=Math.cos(a)*.6;group.add(m);shards.push({m,a});}this.add(group,.65,t=>{ring.scale.setScalar(.2+t);for(const {m,a}of shards){m.position.x=Math.sin(a)*(.5+t);m.position.z=Math.cos(a)*(.5+t);m.position.y=.4+Math.sin(t*Math.PI)*.5;}this.fade(group,1-t);});}
  this.burst(x,z,palette[skill]||'#d0baff',skill==='evil'?10:7,.8);
 }
 burst(x,z,color,count,radius){const group=this.place(new THREE.Group(),x,z,.65),embers=[];for(let i=0;i<count;i++){const glow=sprite(color,.12+Math.random()*.16),a=Math.random()*Math.PI*2;group.add(glow);embers.push({glow,x:Math.sin(a)*radius,z:Math.cos(a)*radius,y:.3+Math.random()*1.4});}this.add(group,.55,t=>{for(const e of embers)e.glow.position.set(e.x*t,e.y*t-t*t,e.z*t);this.fade(group,1-t);});}
 createProjectile(shot){
  const root=new THREE.Group(),color=palette[shot.skill];
  if(shot.skill==='evil'){const core=sprite('#eee2ff',.48);root.add(core);const aura=sprite(color,.9);root.add(aura);for(const side of [-1,1]){const eye=sprite('#ffffff',.1);eye.position.set(side*.1,.06,.1);root.add(eye);}}
  else{const shaft=new THREE.Mesh(shapes.arrow,additive(color));shaft.rotation.x=Math.PI/2;root.add(shaft);const head=new THREE.Mesh(shot.skill==='icearrow'?shapes.crystal:shapes.head,additive('#eaffff'));if(shot.skill!=='icearrow')head.rotation.x=Math.PI/2;head.position.z=.86;root.add(head);root.add(sprite(color,.4));}
  const trail=[];for(let i=0;i<7;i++){const glow=sprite(color,(shot.skill==='evil'?.55:.25)*(1-i/9));glow.material.opacity=.65*(1-i/8);root.add(glow);trail.push(glow);}root.userData.trail=trail;root.userData.history=[];root.userData.skill=shot.skill;return root;
 }
 moveProjectile(root,shot,target){
  root.position.set(shot.x,this.heightAt(shot.x,shot.z)+1,shot.z);if(target)root.rotation.y=Math.atan2(target.x-shot.x,target.z-shot.z);
  const history=root.userData.history;history.unshift(root.position.clone());if(history.length>15)history.pop();root.updateMatrixWorld(true);
  for(let i=0;i<root.userData.trail.length;i++){const past=history[Math.min(history.length-1,i*2+1)];if(past){root.userData.trail[i].position.copy(root.worldToLocal(past.clone()));}}
 }
 disposeProjectile(root){release(root);}
}
