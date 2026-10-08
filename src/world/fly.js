import * as THREE from 'three';
import {damp} from '../core/util.js';

/* The player, as a housefly (after the film Eega). It goes where the pointer goes, keeps the same size on screen at any
   zoom, and lands when the pointer rests. When the player clicks, holds or drags something, the fly is the one that does
   it: it darts over and stamps on it, leans on it, or carries it. Landed, it does what flies do: rubs its front legs, wipes its head and wings,
   dabs with its proboscis, and turns on the spot. It is never something to click, so it cannot get in the way.
   The fly faces +z; one unit is about one body length. */
const L1=.3,L2=.42;                                                    // thigh and shin
/* a leg pose is {f: swing forward, u: lift of the thigh, b: bend at the knee}; rows are front, middle, hind */
const REST=[{f:.75,u:.5,b:1.7},{f:0,u:.55,b:1.75},{f:-.8,u:.5,b:1.7}],TUCK=[{f:.9,u:-.25,b:1.3},{f:0,u:-.35,b:1.2},{f:-1,u:-.3,b:1.1}];
/* what it does when landed, in order, with how long each lasts */
const ACTS=[['rub',2.4],['idle',1],['head',2.6],['idle',.7],['dab',1.8],['turn',.5],['wings',2.4],['idle',1.2],['rub',1.8],['turn',.5]];

export function buildFly(){
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  const shell=new THREE.MeshStandardMaterial({color:0x10141c,roughness:.3,metalness:.8,emissive:0x1a6a8a,emissiveIntensity:.9});
  const limb=new THREE.MeshStandardMaterial({color:0x222a36,roughness:.5,metalness:.4,emissive:0x2b5568,emissiveIntensity:.8});
  const ball=(r,sx,sy,sz,x,y,z,m=shell,to=body)=>{const o=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),m);o.scale.set(sx,sy,sz);o.position.set(x,y,z);to.add(o);return o};
  const rod=(r,len,m=limb)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.7,len,6),m);return o};
  ball(.3,1,.9,1.5,0,0,-.3);ball(.26,1,.95,1,0,.03,.14);
  /* head: two large eyes, two short antennae between them, and the proboscis underneath */
  const head=new THREE.Group();head.position.set(0,0,.42);body.add(head);ball(.19,1,.9,.9,0,0,.02,shell,head);
  const eye=new THREE.MeshStandardMaterial({color:0x3a0508,emissive:0xff2a3a,emissiveIntensity:2.4,roughness:.3});
  for(const s of[-1,1]){ball(.14,.85,1,1,s*.12,.04,.07,eye,head);
    const a=rod(.02,.13);a.position.set(s*.045,.05,.2);a.rotation.x=1.9;a.rotation.z=-s*.25;head.add(a)}
  const prob=new THREE.Group();prob.position.set(0,-.1,.1);head.add(prob);const pr=rod(.035,.2);pr.position.y=-.1;prob.add(pr);ball(.06,1,.45,1,0,-.21,0,limb,prob);
  /* six legs, each a thigh on a hip and a shin on a knee */
  const legs=[];
  for(const s of[-1,1])for(let i=0;i<3;i++){
    const hip=new THREE.Group(),tilt=new THREE.Group(),knee=new THREE.Group();hip.position.set(s*.13,-.08,[.26,.12,-.02][i]);body.add(hip);hip.add(tilt);
    const th=rod(.032,L1);th.rotation.z=-s*Math.PI/2;th.position.x=s*L1/2;tilt.add(th);knee.position.x=s*L1;tilt.add(knee);
    const sh=rod(.024,L2);sh.rotation.z=-s*Math.PI/2;sh.position.x=s*L2/2;knee.add(sh);
    legs.push({s,i,hip,tilt,knee,f:REST[i].f,u:REST[i].u,b:REST[i].b});
  }
  const wm=new THREE.MeshBasicMaterial({color:0x9fe8ff,transparent:true,opacity:.34,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const wings=[-1,1].map(s=>{const p=new THREE.Group();p.position.set(s*.1,.2,.12);const w=new THREE.Mesh(new THREE.CircleGeometry(.5,14),wm);w.scale.set(.42,1,1);w.rotation.x=-Math.PI/2;w.position.set(s*.16,0,-.42);p.add(w);body.add(p);return{p,s}});

  const W={root:g,pos:g.position,landed:false,act:'fly'},vel=new THREE.Vector3(),prev=new THREE.Vector3(),goal=new THREE.Vector3();
  let t=Math.random()*9,yaw=0,rest=0,ai=0,at=0;
  /* target: where the pointer meets the world. size: how big one unit of fly should be. still: seconds the pointer has not moved. */
  /* job: {kind:'press'|'hold'|'carry', pos} while the fly is acting for the player */
  W.update=(dt,target,size,still,job)=>{
    if(dt<=0)return;t+=dt;const kind=job?job.kind:null;if(kind)target=job.pos;
    const land=kind?kind!=='carry':still>1.6;rest=damp(rest,land?1:0,kind?22:land?3:10,dt);const was=W.landed;W.landed=!kind&&rest>.9;
    const air=1-rest,k=kind?0:size*1.1;                                       // it wanders while flying, and settles onto the spot when it lands
    goal.set(target.x+(Math.sin(t*2.3)+Math.sin(t*3.7+1))*k*air,target.y+size*(kind==='carry'?1.25:.36+2.1*air)+Math.sin(t*4.1)*k*.5*air,target.z+(Math.cos(t*1.9)+Math.sin(t*3.1+2))*k*air);
    prev.copy(g.position);const rate=kind?20:land?5:7;g.position.set(damp(g.position.x,goal.x,rate,dt),damp(g.position.y,goal.y,rate,dt),damp(g.position.z,goal.z,rate,dt));
    vel.subVectors(g.position,prev).divideScalar(dt);const sp=vel.length()/size;
    if(sp>.6&&!W.landed)yaw=Math.atan2(vel.x,vel.z);
    /* landed: work through the list of things a fly does */
    if(W.landed){if(!was){ai=0;at=ACTS[0][1]}at-=dt;if(at<=0){ai=(ai+1)%ACTS.length;at=ACTS[ai][1];if(ACTS[ai][0]==='turn')yaw+=(Math.random()<.5?-1:1)*(.5+Math.random()*.9)}}
    const act=W.act=kind||(W.landed?ACTS[ai][0]:'fly');
    const pump=act==='press'?Math.abs(Math.sin(t*16)):0;body.position.y=damp(body.position.y,act==='press'?.28-pump*.4:act==='hold'?-.1:0,40,dt);
    let d=yaw-g.rotation.y;d=Math.atan2(Math.sin(d),Math.cos(d));g.rotation.y+=d*Math.min(1,dt*(act==='turn'?14:10));
    body.rotation.x=-Math.min(.5,sp*.03)*air+(act==='dab'?.16:act==='rub'?-.08:0)*rest;body.rotation.z=-d*.6*air;g.scale.setScalar(size);
    /* legs */
    for(const l of legs){const base=W.landed||act==='press'||act==='hold'?REST[l.i]:TUCK[l.i];let f=base.f,u=base.u,b=base.b;
      if(act==='press'){u+=.25-pump*.5;b-=.3-pump*.4}                                                              // stamping on it
      else if(act==='hold'){u=.28;b=1.4}                                                                     // flat out, leaning on it
      else if(act==='carry'){u=-.95;b=.45}                                                                   // legs straight down, gripping
      else 
if(act==='rub'&&l.i===0){f=1.38;u=.2+Math.sin(t*5)*.06;b=1+l.s*Math.sin(t*22)*.32}                      // front legs out ahead, sliding past each other
      else if(act==='head'&&l.i===0){f=1.5;u=.95+Math.sin(t*11+l.s)*.28;b=2.25+Math.sin(t*11)*.2}             // front legs up over the eyes
      else if(act==='wings'&&l.i===2){f=-1.4;u=.85+Math.sin(t*12+l.s)*.25;b=1.75+l.s*Math.sin(t*12)*.25}      // hind legs up over the wings
      else if(act==='turn'){u+=Math.sin(t*34+(l.i+(l.s>0?1:0))*Math.PI)*.22}                                  // quick steps, three legs at a time
      const r=act==='fly'?8:16;l.f=damp(l.f,f,r,dt);l.u=damp(l.u,u,r,dt);l.b=damp(l.b,b,r,dt);
      l.hip.rotation.y=-l.s*l.f;l.tilt.rotation.z=l.s*l.u;l.knee.rotation.z=-l.s*l.b}
    /* head and proboscis */
    const hx=act==='dab'?.3:act==='head'?.22:0,hz=act==='head'?Math.sin(t*5.5)*.5:act==='idle'?Math.sin(t*1.3)*.12*(Math.sin(t*.7)>.3?1:0):0,hy=act==='rub'?Math.sin(t*2.1)*.15:0;
    head.rotation.x=damp(head.rotation.x,hx,12,dt);head.rotation.z=damp(head.rotation.z,hz,14,dt);head.rotation.y=damp(head.rotation.y,hy,10,dt);
    prob.scale.y=damp(prob.scale.y,act==='dab'?.75+Math.max(0,Math.sin(t*8))*.6:.5,20,dt);
    /* wings: a blur in the air, folded back on the ground, and they shiver when the hind legs wipe them */
    const flap=Math.sin(t*95)*1.05*air+.12*rest+(act==='wings'?Math.sin(t*40)*.08:act==='hold'?Math.sin(t*70)*.3:0);for(const w of wings){w.p.rotation.z=w.s*(.25+flap*.6);w.p.rotation.y=w.s*(.2+.55*rest)}
    wm.opacity=.3+.3*air;
  };
  return W;
}
