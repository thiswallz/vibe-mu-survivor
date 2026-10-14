import * as THREE from './vendor/three.module.js';
export function prepareActor(root){
 root.traverse(mesh=>{if(mesh.isMesh){mesh.material=mesh.material.clone();mesh.userData.baseEmissive=mesh.material.emissive?.clone();mesh.userData.baseIntensity=mesh.material.emissiveIntensity||0;}});
}
export function disposeActor(root){root.traverse(m=>{if(m.material)m.material.dispose();});}
export function flashActor(root,power,color='#ffdfac'){
 root.traverse(mesh=>{if(mesh.isMesh&&mesh.material.emissive&&!mesh.userData.chrome){mesh.material.emissive.copy(mesh.userData.baseEmissive||new THREE.Color(0));mesh.material.emissive.lerp(new THREE.Color(color),power);mesh.material.emissiveIntensity=(mesh.userData.baseIntensity||0)+power*1.3;}});
}
export function enhanceArmor(root,level,chrome){
 const body=root.userData.body;for(const original of [...body.children]){
  if(!original.isMesh||!original.userData.armor)continue;
  const mat=original.material;mat.roughness=level?.3:.83;mat.emissiveMap=level?mat.map:null;mat.emissive.set(level===15?'#c9b9ff':level===13?'#af7134':'#000000');mat.emissiveIntensity=level===15?.38:level===13?.2:0;original.userData.baseEmissive=mat.emissive.clone();original.userData.baseIntensity=mat.emissiveIntensity;mat.needsUpdate=true;
  if(level){const overlay=new THREE.Mesh(original.geometry,new THREE.MeshMatcapMaterial({matcap:chrome,color:level===15?'#e9daff':'#ffe4a1',transparent:true,opacity:level===15?.46:.3,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));overlay.userData.chrome=true;overlay.userData.upperBody=original.userData.upperBody;original.add(overlay);original.userData.overlay=overlay;}
 }
}
export function createAura(texture,shiny){
 const group=new THREE.Group();const circle=new THREE.Mesh(new THREE.PlaneGeometry(8.4,8.4),new THREE.MeshBasicMaterial({map:texture,color:'#91bcff',transparent:true,opacity:.38,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));circle.rotation.x=-Math.PI/2;circle.position.y=.1;group.add(circle);group.userData.circle=circle;group.userData.orbs=[];
 for(let i=0;i<3;i++){const orb=new THREE.Sprite(new THREE.SpriteMaterial({map:shiny,color:'#b7d4ff',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));orb.scale.setScalar(.5);group.add(orb);group.userData.orbs.push(orb);}return group;
}
export function updateAura(group,time,level){group.visible=level>0;if(!level)return;group.userData.circle.rotation.z=time*.4;group.userData.circle.material.opacity=.28+Math.sin(time*4)*.1;for(let i=0;i<3;i++){const a=time*1.8+i*Math.PI*2/3;group.userData.orbs[i].position.set(Math.sin(a)*3.5,.8+Math.sin(a*2)*.3,Math.cos(a)*3.5);}group.scale.setScalar(level===2?1.05:1);}
