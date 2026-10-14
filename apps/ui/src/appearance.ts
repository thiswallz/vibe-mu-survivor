import * as THREE from 'three';
export function prepareActor(root){
 root.traverse(mesh=>{if(mesh.isMesh){mesh.material=mesh.material.clone();mesh.userData.baseEmissive=mesh.material.emissive?.clone();mesh.userData.baseIntensity=mesh.material.emissiveIntensity||0;}});
}
export function disposeActor(root){root.traverse(m=>{if(m.material)m.material.dispose();});}
export function flashActor(root,power,color='#ffdfac'){
 root.traverse(mesh=>{if(mesh.isMesh&&mesh.material.emissive&&!mesh.userData.chrome){mesh.material.emissive.copy(mesh.userData.baseEmissive||new THREE.Color(0));mesh.material.emissive.lerp(new THREE.Color(color),power);mesh.material.emissiveIntensity=(mesh.userData.baseIntensity||0)+power*1.3;}});
}
export function enhanceArmor(root,level,chrome,shiny,equipment){
 root.userData.enhancement=level;root.userData.armorSparkles=[];
 const body=root.userData.body;
 for(const original of [...body.children]){
  if(!original.isMesh||!original.userData.armor)continue;
  const pieceLevel=equipment?.[original.userData.slot]?.enhancement;const activeLevel=equipment?(pieceLevel||0):level;
  const mat=original.material;mat.roughness=activeLevel?.23:.83;mat.metalness=activeLevel?.48:.12;
  mat.emissiveMap=activeLevel?mat.map:null;mat.emissive.set(activeLevel?'#ffffff':'#000000');mat.emissiveIntensity=activeLevel===15?.62:activeLevel===13?.36:0;
  original.userData.baseEmissive=mat.emissive.clone();original.userData.baseIntensity=mat.emissiveIntensity;mat.needsUpdate=true;
  if(!activeLevel)continue;
  const material=new THREE.MeshMatcapMaterial({matcap:chrome,color:activeLevel===15?'#fff5e0':'#ffe1a3',transparent:true,opacity:activeLevel===15?.55:.36,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  const clock={value:0};material.onBeforeCompile=shader=>{shader.uniforms.muShineTime=clock;shader.fragmentShader='uniform float muShineTime;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('vec4 matcapColor = texture2D( matcap, uv );','vec2 shineUV = uv + vec2(sin(muShineTime * .8) * .13, cos(muShineTime * .6) * .13); vec4 matcapColor = texture2D( matcap, shineUV );');};
  const overlay=new THREE.Mesh(original.geometry,material);overlay.userData.chrome=true;overlay.userData.level=activeLevel;overlay.userData.upperBody=original.userData.upperBody;overlay.userData.clock=clock;original.add(overlay);original.userData.overlay=overlay;
  if(shiny)for(let i=0;i<(activeLevel===15?2:1);i++){
   const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:shiny,color:'#fff2c0',transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
   original.add(glow);root.userData.armorSparkles.push({mesh:original,glow,index:Math.floor(original.geometry.attributes.position.count*(.27+i*.43)),level:activeLevel,phase:root.userData.armorSparkles.length*1.73});
  }
 }
}
export function updateArmor(root,time){
 const level=root.userData.enhancement;if(!level)return;
 root.userData.body.traverse(mesh=>{if(mesh.userData.chrome){mesh.userData.clock.value=time;mesh.material.opacity=(mesh.userData.level===15?.55:.36)+Math.sin(time*2)*.06;}});
 for(const spark of root.userData.armorSparkles){
  const {mesh,glow,index,phase}=spark,base=mesh.geometry.attributes.position,frames=mesh.geometry.morphAttributes.position,weights=mesh.morphTargetInfluences||[];
  glow.position.fromBufferAttribute(base,index);let total=0;const point=new THREE.Vector3();
  for(let j=0;j<weights.length;j++)if(weights[j]>.001){point.addScaledVector(new THREE.Vector3().fromBufferAttribute(frames[j],index),weights[j]);total+=weights[j];}
  glow.position.multiplyScalar(1-total).add(point);const pulse=Math.max(0,Math.sin(time*3+phase))**8;glow.material.opacity=pulse*.9;glow.scale.setScalar((spark.level===15?.22:.14)*(1+pulse*.7));
 }
}
export function createAura(texture,shiny){
 const group=new THREE.Group();const circle=new THREE.Mesh(new THREE.PlaneGeometry(8.4,8.4),new THREE.MeshBasicMaterial({map:texture,color:'#91bcff',transparent:true,opacity:.38,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));circle.rotation.x=-Math.PI/2;circle.position.y=.1;group.add(circle);group.userData.circle=circle;group.userData.orbs=[];
 for(let i=0;i<3;i++){const orb=new THREE.Sprite(new THREE.SpriteMaterial({map:shiny,color:'#b7d4ff',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));orb.scale.setScalar(.5);group.add(orb);group.userData.orbs.push(orb);}return group;
}
export function updateAura(group,time,level){group.visible=level>0;if(!level)return;group.userData.circle.rotation.z=time*.4;group.userData.circle.material.opacity=.28+Math.sin(time*4)*.1;for(let i=0;i<3;i++){const a=time*1.8+i*Math.PI*2/3;group.userData.orbs[i].position.set(Math.sin(a)*3.5,.8+Math.sin(a*2)*.3,Math.cos(a)*3.5);}group.scale.setScalar(level===2?1.05:1);}
