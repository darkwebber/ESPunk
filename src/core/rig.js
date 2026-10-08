import * as THREE from 'three';
import {clamp,damp} from './util.js';

/* Camera on a damped orbit. The Lens is its distance; chapters set the limits and call fly(). */
export class Rig{
  constructor(camera){
    this.cam=camera;this.t=new THREE.Vector3();this.th=.5;this.ph=1;this.d=30;
    this.g={t:new THREE.Vector3(),th:.5,ph:1,d:30};
    this.lim={dmin:5,dmax:40,phmin:.25,phmax:1.45};this.zoom=true;this.rate=4;this.shake=0;this.locked=false;this.pf=0;
  }
  jump(o){this.fly(o);this.t.copy(this.g.t);this.th=this.g.th;this.ph=this.g.ph;this.d=this.g.d}
  portrait(){return this.cam.aspect<.8}
  /* On a tall screen the board is turned so its long side runs up the screen; the room is viewed down the line from
     board to lamp; the stage is already tall. Each kind of view also gets its own stand-off distance. */
  fly(o){
    let {t,d,th,ph,rate=4}=o;const P=this.portrait(),full=!!t;
    if(full||o.room){
      if(P&&o.room){t=new THREE.Vector3(9,4,-36);d=62;th=-.23;ph=1.2;this.pf=1.8}
      else if(P&&o.stage){t=t.clone();t.x=0;this.pf=1.75}
      else if(P){th=(th||0)*.4-Math.PI/2;this.pf=1.45}
      else this.pf=0;
    }
    if(t)this.g.t.copy(t);if(d!==undefined)this.g.d=d;if(th!==undefined)this.g.th=th;if(ph!==undefined)this.g.ph=ph;this.rate=rate}
  orbit(dx,dy){this.g.th-=dx*.005;this.g.ph=clamp(this.g.ph-dy*.005,this.lim.phmin,this.lim.phmax);this.rate=8}
  wheel(dy){if(!this.zoom)return false;this.g.d=clamp(this.g.d*Math.exp(dy*.0012),this.lim.dmin,this.lim.dmax);this.rate=8;return true}
  update(dt){
    this.t.x=damp(this.t.x,this.g.t.x,this.rate,dt);this.t.y=damp(this.t.y,this.g.t.y,this.rate,dt);this.t.z=damp(this.t.z,this.g.t.z,this.rate,dt);
    this.th=damp(this.th,this.g.th,this.rate,dt);this.ph=damp(this.ph,this.g.ph,this.rate,dt);this.d=damp(this.d,this.g.d,this.rate,dt);
    const s=Math.sin(this.ph),c=this.cam,d=this.d*(this.pf||Math.max(1,Math.pow(1.4/c.aspect,.75)));                 // narrow windows stand further back
    c.position.set(this.t.x+d*s*Math.sin(this.th),this.t.y+d*Math.cos(this.ph),this.t.z+d*s*Math.cos(this.th));
    if(this.shake>0){this.shake=Math.max(0,this.shake-dt*2.5);const k=this.shake*this.d*.02;c.position.x+=(Math.random()-.5)*k;c.position.y+=(Math.random()-.5)*k}
    c.lookAt(this.t);
  }
  /* screen pixels per world unit at the focus distance */
  pxPerUnit(h){return h/(2*this.d*Math.tan(this.cam.fov*Math.PI/360))}
}
