import * as THREE from 'three';

export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const damp=(a,b,rate,dt)=>lerp(a,b,1-Math.exp(-rate*dt));
export const ease={io:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,out:t=>1-Math.pow(1-t,3),lin:t=>t,
  back:t=>{const c=1.70158;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)}};

/* tweens run on real time */
const tweens=new Set();
export function tween(dur,fn,e=ease.io){return new Promise(res=>{fn(0,0);tweens.add({t:0,dur,fn,e,res})})}
export function tickTweens(dt){for(const w of tweens){w.t+=dt;const k=clamp(w.t/w.dur);w.fn(w.e(k),k);if(k>=1){tweens.delete(w);w.res()}}}

/* A chapter is one async function. Its waits go through a Flow so leaving the chapter cancels them. */
export const CANCEL=Symbol('cancel');
export class Flow{
  constructor(){this.dead=false;this.waits=new Set()}
  until(cond,timeout=Infinity){
    if(this.dead)return Promise.reject(CANCEL);
    return new Promise((res,rej)=>this.waits.add({cond,left:timeout,res,rej}));
  }
  sleep(s){return this.until(()=>false,s)}
  update(dt){
    for(const w of this.waits){w.left-=dt;let ok=false;try{ok=!!w.cond()}catch(e){console.error(e)}
      if(ok||w.left<=0){this.waits.delete(w);w.res(ok)}}
  }
  cancel(){this.dead=true;for(const w of this.waits)w.rej(CANCEL);this.waits.clear()}
}

/* save file: small, and the game must run without it */
const KEY='one-press-save-v1';
const fresh=()=>({tools:{},done:{},notes:[],stats:{resets:0,handMisses:0,collisions:0},sound:true,calm:false});
export const save={data:fresh(),
  load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s)this.data={...fresh(),...s,stats:{...fresh().stats,...s.stats}}}catch(e){}return this.data},
  store(){try{localStorage.setItem(KEY,JSON.stringify(this.data))}catch(e){}},
  wipe(){this.data=fresh();try{localStorage.removeItem(KEY)}catch(e){}}};

/* small builders */
export const mat=(color,o={})=>new THREE.MeshStandardMaterial({color,roughness:.7,metalness:0,...o});
export const glowMat=(color,intensity=2)=>new THREE.MeshStandardMaterial({color:0x111111,emissive:color,emissiveIntensity:intensity,roughness:.6});
export function box(w,h,d,m,x=0,y=0,z=0){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);return o}
export function cyl(r,h,m,x=0,y=0,z=0,seg=24){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),m);o.position.set(x,y,z);return o}

/* A path that lights up along its length: flat segments revealed by set(0..1). */
export class Trace{
  constructor(pts,width,color,y){
    this.group=new THREE.Group();this.mat=glowMat(color,2.2);this.segs=[];this.len=0;this.pts=pts.map(p=>new THREE.Vector3(p[0],y,p[1]));
    for(let i=0;i+1<this.pts.length;i++){
      const a=this.pts[i],b=this.pts[i+1],l=a.distanceTo(b),m=new THREE.Mesh(new THREE.BoxGeometry(1,.012,width),this.mat);
      m.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);this.group.add(m);this.segs.push({m,a,b,l,at:this.len});this.len+=l;
    }
    this.p=-1;this.set(0);
  }
  set(p){
    if(p===this.p)return;this.p=p;const d=p*this.len;
    for(const s of this.segs){const f=clamp((d-s.at)/s.l);s.m.visible=f>.001;if(!s.m.visible)continue;
      const l=s.l*f+(f>=1?.03:0);s.m.scale.x=l;s.m.position.lerpVectors(s.a,s.b,f/2)}
  }
  at(u,out=new THREE.Vector3()){
    const d=clamp(u)*this.len;for(const s of this.segs)if(d<=s.at+s.l)return out.lerpVectors(s.a,s.b,(d-s.at)/s.l);
    return out.copy(this.pts[this.pts.length-1]);
  }
}

/* The brightest pulsing thing on screen: a ring that marks what to touch next. */
export class Beacon{
  constructor(color=0xffb347){
    this.mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,depthTest:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    this.mat.color.multiplyScalar(2.2);
    this.mesh=new THREE.Mesh(new THREE.RingGeometry(.9,1,48),this.mat);this.mesh.rotation.x=-Math.PI/2;this.mesh.renderOrder=20;this.mesh.visible=false;this.r=1;this.t=0;
  }
  at(pos,r=.3,color){this.mesh.position.copy(pos);this.r=r;this.mesh.visible=true;if(color!==undefined){this.mat.color.set(color).multiplyScalar(2.2)}return this}
  hide(){this.mesh.visible=false}
  update(dt){if(!this.mesh.visible)return;this.t=(this.t+dt*.8)%1;const k=ease.out(this.t);this.mesh.scale.setScalar(this.r*(.6+1.4*k));this.mat.opacity=.95*(1-k)}
}
