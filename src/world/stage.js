import * as THREE from 'three';
import {mat,box,cyl,damp} from '../core/util.js';
import {buildVoid} from './city.js';

/* Chapter 3's place: a stage inside the chip. One lit core, a riser whose steps are priorities, three tasks. Not to scale. */
export const TASKS=[
  {id:'BUTTON',color:0x5fe3ff,css:'#5fe3ff',x:-4.6,geo:()=>new THREE.OctahedronGeometry(1.05)},
  {id:'RADIO', color:0xff5fd2,css:'#ff5fd2',x:0,   geo:()=>new THREE.TorusGeometry(.78,.3,14,32)},
  {id:'LOGGER',color:0xffb347,css:'#ffb347',x:4.6, geo:()=>new THREE.BoxGeometry(1.35,1.35,1.35)},
];
const stepTop=p=>.8*(p+1),stepZ=p=>-4-1.7*p;
/* each job has a lane running toward the player; bars slide down it to the white line, where the core works */
export const NOWZ=6.6,LANE0=-2,U=1.4,CORE=new THREE.Vector3(0,1.5,NOWZ);

export function buildStage(){
  const root=new THREE.Group(),W={root,tasks:{},steps:[]};root.visible=false;W.void=buildVoid();root.add(W.void.root);
  const floorTex=(()=>{const c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d');g.fillStyle='#0a0c10';g.fillRect(0,0,1024,1024);
    g.strokeStyle='rgba(95,227,255,.14)';for(let r=60;r<512;r+=46){g.lineWidth=r%92?1:2.5;g.beginPath();g.arc(512,512,r,0,7);g.stroke()}
    for(let a=0;a<24;a++){g.beginPath();g.moveTo(512,512);g.lineTo(512+512*Math.cos(a*Math.PI/12),512+512*Math.sin(a*Math.PI/12));g.stroke()}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t})();
  const floor=cyl(12,.6,mat(0x0a0c10,{roughness:.6}),0,-.3,0,64);root.add(floor);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(12,64),new THREE.MeshStandardMaterial({map:floorTex,roughness:.55,metalness:.2}));disc.rotation.x=-Math.PI/2;disc.position.y=.005;disc.receiveShadow=true;root.add(disc);
  const edge=new THREE.Mesh(new THREE.TorusGeometry(12,.05,8,96),new THREE.MeshBasicMaterial({color:new THREE.Color(0x5fe3ff).multiplyScalar(.9)}));edge.rotation.x=Math.PI/2;root.add(edge);W.edge=edge;

  /* the core: a pad under a cone of light; a second, locked one beside it */
  const pad=cyl(1.35,.16,mat(0x1a1d24,{roughness:.4,metalness:.5}),CORE.x,.08,CORE.z,6);W.coreG=new THREE.Group();W.coreX=0;root.add(W.coreG);W.coreG.add(pad);
  W.padRim=new THREE.Mesh(new THREE.TorusGeometry(1.35,.05,8,6),new THREE.MeshBasicMaterial({color:new THREE.Color(0xffffff).multiplyScalar(.95)}));W.padRim.rotation.x=Math.PI/2;W.padRim.position.set(CORE.x,.17,CORE.z);W.coreG.add(W.padRim);
  W.cone=new THREE.Mesh(new THREE.ConeGeometry(1.9,13,40,1,true),new THREE.MeshBasicMaterial({color:0xcfe8ff,transparent:true,opacity:.04,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));W.cone.position.set(CORE.x,6.5,CORE.z);W.coreG.add(W.cone);
  const sp=new THREE.SpotLight(0xffffff,3.2,0,.24,.5,0);sp.position.set(CORE.x,14,CORE.z);sp.target.position.set(CORE.x,0,CORE.z);sp.castShadow=true;sp.shadow.mapSize.set(1024,1024);W.coreG.add(sp,sp.target);
  root.add(cyl(1.1,.12,mat(0x121419,{roughness:.6}),9.6,.06,2.4,6));W.core1=new THREE.Vector3(9.6,.4,2.4);

  /* riser: step p is priority p. It lies flat until the player has earned the rule, then rises. */
  W.rise=0;W.riser=new THREE.Group();root.add(W.riser);
  for(let p=0;p<4;p++){const st=box(15.5,stepTop(p),1.7,mat(0x12151b,{roughness:.5,metalness:.3}),0,stepTop(p)/2,stepZ(p));st.userData.prio=p;st.receiveShadow=true;W.riser.add(st);W.steps.push(st);
    W.riser.add(box(15.5,.03,.05,new THREE.MeshBasicMaterial({color:new THREE.Color(0x5fe3ff).multiplyScalar(.5+p*.4)}),0,stepTop(p)+.015,stepZ(p)+.83))}
  W.stepLabel=p=>new THREE.Vector3(-8.6,stepTop(p)*W.rise+.3,stepZ(p));
  W.home=(t,p)=>new THREE.Vector3(t.x,stepTop(p)*W.rise+1.4,W.rise>.5?stepZ(p):LANE0-1);

  root.add(new THREE.HemisphereLight(0x9fb4e0,0x0a0806,.5));
  const key=new THREE.DirectionalLight(0xbfd0ff,.7);key.position.set(-6,12,10);root.add(key);

  for(const d of TASKS){
    const m=new THREE.MeshStandardMaterial({color:new THREE.Color(d.color).multiplyScalar(.3),emissive:d.color,emissiveIntensity:.5,roughness:.4,metalness:.1});
    const mesh=new THREE.Mesh(d.geo(),m);mesh.castShadow=true;const hit=new THREE.Mesh(new THREE.SphereGeometry(1.25,10,8));hit.visible=false;mesh.add(hit);
    const t={...d,mesh,mat:m,hit,prio:1,st:'sleep',target:new THREE.Vector3(d.x,1.4,LANE0-1),flash:0,spin:Math.random()*6};mesh.position.copy(t.target);root.add(mesh);W.tasks[d.id]=t;
  }
  /* lanes, the line where work happens, and a pool of bars */
  W.lanes={};for(const d of TASKS){const l=new THREE.Mesh(new THREE.PlaneGeometry(2.7,NOWZ-LANE0+1.2),new THREE.MeshBasicMaterial({color:d.color,transparent:true,opacity:.07,depthWrite:false}));
    l.rotation.x=-Math.PI/2;l.position.set(d.x,.02,(NOWZ+LANE0)/2+.6);l.visible=false;root.add(l);W.lanes[d.id]=l}
  W.nowLine=box(13,.05,.09,new THREE.MeshBasicMaterial({color:new THREE.Color(0xffffff).multiplyScalar(.8)}),0,.05,NOWZ-.7);root.add(W.nowLine);
  const tails=[],heads=[],slabGeo=new THREE.BoxGeometry(2.3,1,1);
  for(let i=0;i<30;i++){const a=new THREE.Mesh(slabGeo,new THREE.MeshBasicMaterial({transparent:true,opacity:.2,depthWrite:false})),b=new THREE.Mesh(slabGeo,new THREE.MeshStandardMaterial({color:0x111111,emissiveIntensity:1.1,roughness:.5}));a.visible=b.visible=false;root.add(a,b);tails.push(a);heads.push(b)}
  const Z=tau=>Math.min(NOWZ+.4,Math.max(LANE0,NOWZ-.7-tau*U));
  /* list: {x,color,t0,t1 (how long it may wait),h0,h1 (work still to do),late,done} in ticks from now */
  W.setSlabs=list=>{for(let i=0;i<30;i++){const s=list[i],a=tails[i],b=heads[i];if(!s){a.visible=b.visible=false;continue}
    const za=Z(s.t1),zb=Z(s.t0),la=zb-za;a.visible=la>.02;a.scale.set(1,.06,Math.max(.02,la));a.position.set(s.x,.06,(za+zb)/2);a.material.color.set(s.late?0xff5a4d:s.color);a.material.opacity=s.done?.07:.2;
    const ha=Z(s.h1),hb=Z(s.h0),lh=hb-ha;b.visible=lh>.02&&!s.done;b.scale.set(.92,.22,Math.max(.02,lh-.08));b.position.set(s.x,.16,(ha+hb)/2);b.material.emissive.set(s.late?0xff5a4d:s.color)}};

  /* the baton and its stand */
  W.batonRest=new THREE.Vector3(-8.6,1.6,4.6);root.add(cyl(.5,.2,mat(0x1a1d24,{metalness:.5,roughness:.4}),-8.6,.1,4.6,16));
  W.baton=cyl(.09,1.5,new THREE.MeshStandardMaterial({color:0xfff0c0,emissive:0xffe08a,emissiveIntensity:2.2}),0,0,0,10);W.baton.position.copy(W.batonRest);W.baton.visible=false;root.add(W.baton);W.batonHolder=null;
  /* the rule chip the player earns by rescuing BUTTON by hand, and its socket on the baton stand */
  W.socket=box(1.1,.08,1.1,mat(0x0e1014,{roughness:.5,metalness:.4}),-8.6,.24,6.2);W.socket.visible=false;root.add(W.socket);
  W.chipMat=new THREE.MeshStandardMaterial({color:0x0b0d10,emissive:0x9be7a8,emissiveIntensity:1.4,roughness:.4});
  W.chip=box(.8,.22,.8,W.chipMat,0,0,0);W.chipHome=new THREE.Vector3(-5.6,.6,7.4);W.chipIn=new THREE.Vector3(-8.6,.4,6.2);W.chip.position.copy(W.chipHome);W.chip.visible=false;root.add(W.chip);
  /* the watchdog: a ring that drains, with two eyes */
  const dog=new THREE.Group();dog.position.set(6.6,6.3,-6.5);W.dogMat=new THREE.MeshBasicMaterial({color:new THREE.Color(0xff5a4d).multiplyScalar(1.5)});
  W.dogRing=new THREE.Mesh(new THREE.TorusGeometry(1.2,.07,8,48),W.dogMat);dog.add(W.dogRing);
  for(const x of[-.4,.4]){const e=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),W.dogMat);e.position.set(x,.1,.1);dog.add(e)}
  dog.visible=false;root.add(dog);W.dog=dog;W.dogLevel=1;
  /* completion pulse */
  W.wave=new THREE.Mesh(new THREE.RingGeometry(.975,1,128),new THREE.MeshBasicMaterial({color:new THREE.Color(0x5fe3ff).multiplyScalar(2),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  W.wave.rotation.x=-Math.PI/2;W.wave.position.y=.05;root.add(W.wave);

  let time=0;const v=new THREE.Vector3();
  W.update=(dt,speed=6)=>{
    time+=dt;W.void.update(dt);W.riser.scale.y=Math.max(.02,W.rise);W.coreG.position.x=damp(W.coreG.position.x,W.coreX,speed*2,dt);
    for(const id in W.tasks){const t=W.tasks[id],m=t.mesh,run=t.st==='run';
      m.position.x=damp(m.position.x,t.target.x,speed,dt);m.position.y=damp(m.position.y,t.target.y+(t.st==='ready'?Math.sin(time*3+t.x)*.12:0),speed,dt);m.position.z=damp(m.position.z,t.target.z,speed,dt);
      t.spin+=dt*(run?5:t.st==='ready'?.9:.15);m.rotation.set(t.spin*.4,t.spin,0);
      t.flash=Math.max(0,t.flash-dt*2);
      const want=run?1.05:t.st==='ready'?.75+.25*Math.sin(time*5):t.st==='wait'?.2:.1;t.mat.emissiveIntensity=damp(t.mat.emissiveIntensity,want,10,dt);
      t.mat.emissive.set(t.flash>0?0xff5a4d:t.color);const s=damp(m.scale.x,run?1.2:t.st==='sleep'?.8:1,8,dt);m.scale.setScalar(s);
    }
    if(W.baton.visible){const h=W.batonHolder?W.tasks[W.batonHolder].mesh.position:null;v.copy(h||W.batonRest);if(h){v.x+=Math.cos(time*3)*1.3;v.z+=Math.sin(time*3)*1.3;v.y+=.2}
      W.baton.position.lerp(v,1-Math.exp(-speed*dt));W.baton.rotation.z=h?time*2:0}
    if(W.dog.visible){W.dogRing.scale.setScalar(.35+.65*W.dogLevel);W.dog.position.y=6.3+Math.sin(time*2)*.15;W.dog.rotation.z=(1-W.dogLevel)*Math.sin(time*30)*.12}
    W.cone.material.opacity=.04+.01*Math.sin(time*2);
  };
  return W;
}
