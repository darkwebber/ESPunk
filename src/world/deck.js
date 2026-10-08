import * as THREE from 'three';
import {mat,box,cyl,damp} from '../core/util.js';
import {buildVoid} from './city.js';

/* A general lane table used by the timing stations: any number of lanes run toward the player, bars slide down them
   to a white line, and one or two markers stand on that line. What a lane, a bar or a marker means is up to the station. */
export const NOWZ=6,LANE0=-6,U=1.5;                         // line position, far end of the lanes, units per tick

export function buildDeck(){
  const root=new THREE.Group(),W={root,n:0,xs:[],hit:[],lanes:[]};root.visible=false;W.void=buildVoid();root.add(W.void.root);
  const floor=cyl(13,.5,mat(0x0a0c10,{roughness:.6}),0,-.25,0,64);floor.receiveShadow=true;root.add(floor);
  const edge=new THREE.Mesh(new THREE.TorusGeometry(13,.05,8,96),new THREE.MeshBasicMaterial({color:new THREE.Color(0x5fe3ff).multiplyScalar(.8)}));edge.rotation.x=Math.PI/2;root.add(edge);
  root.add(new THREE.HemisphereLight(0x9fb4e0,0x0a0806,.55));const key=new THREE.DirectionalLight(0xbfd0ff,.7);key.position.set(-6,12,10);root.add(key);
  W.line=box(1,.05,.09,new THREE.MeshBasicMaterial({color:new THREE.Color(0xffffff).multiplyScalar(.8)}),0,.05,NOWZ);root.add(W.line);
  const laneG=new THREE.Group();root.add(laneG);

  /* two markers: a hexagonal pad under a cone of light */
  W.marks=[0xffffff,0xffe08a].map(c=>{const g=new THREE.Group();g.add(cyl(1,.16,mat(0x1a1d24,{roughness:.4,metalness:.5}),0,.08,0,6));
    const rim=new THREE.Mesh(new THREE.TorusGeometry(1,.05,8,6),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(.95)}));rim.rotation.x=Math.PI/2;rim.position.y=.17;g.add(rim);
    const cone=new THREE.Mesh(new THREE.ConeGeometry(1.5,12,32,1,true),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.045,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));cone.position.y=6;g.add(cone);
    g.position.set(0,0,NOWZ);g.visible=false;root.add(g);return{g,x:0}});
  /* a chip the player can fit, for the stations that hand out a rule */
  W.chips=[0x9be7a8,0xffb347].map((c,i)=>{const m=box(.9,.24,.9,new THREE.MeshStandardMaterial({color:0x0b0d10,emissive:c,emissiveIntensity:1.3,roughness:.4}),-9.5+i*0,.5,3+i*2.2);m.visible=false;root.add(m);return m});
  W.wave=new THREE.Mesh(new THREE.RingGeometry(.975,1,128),new THREE.MeshBasicMaterial({color:new THREE.Color(0x5fe3ff).multiplyScalar(2),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  W.wave.rotation.x=-Math.PI/2;W.wave.position.y=.05;root.add(W.wave);

  const pool=[],geo=new THREE.BoxGeometry(1,1,1);
  for(let i=0;i<90;i++){const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x111111,transparent:true,roughness:.5}));m.visible=false;root.add(m);pool.push(m)}

  /* lanes: [{name,color}] */
  W.setup=(lanes,width=13)=>{
    while(laneG.children.length)laneG.remove(laneG.children[0]);W.hit=[];W.lanes=lanes;W.n=lanes.length;
    const sp=Math.min(3.4,width/W.n);W.sp=sp;W.xs=lanes.map((l,i)=>(i-(W.n-1)/2)*sp);
    lanes.forEach((l,i)=>{const s=new THREE.Mesh(new THREE.PlaneGeometry(sp*.86,NOWZ-LANE0+1.4),new THREE.MeshBasicMaterial({color:l.color,transparent:true,opacity:.07,depthWrite:false}));
      s.rotation.x=-Math.PI/2;s.position.set(W.xs[i],.02,(NOWZ+LANE0)/2+.7);laneG.add(s);W.hit.push(s);
      laneG.add(box(sp*.5,.3,.3,new THREE.MeshStandardMaterial({color:0x111111,emissive:l.color,emissiveIntensity:.8}),W.xs[i],.15,LANE0-.5))});
    W.line.scale.x=sp*W.n+.6;W.marks.forEach(m=>m.g.visible=false);W.chips.forEach(c=>c.visible=false);W.bars([]);
    for(const m of W.marks)m.g.scale.setScalar(Math.min(1.25,sp/2.4));
  };
  W.head=i=>new THREE.Vector3(W.xs[i],.6,LANE0-.5);
  W.now=i=>new THREE.Vector3(W.xs[i],.3,NOWZ);
  W.dim=(i,on)=>{W.hit[i].material.opacity=on?.02:.07};
  const Z=t=>Math.min(NOWZ+.5,Math.max(LANE0,NOWZ-t*U));
  /* bars: {lane, t0, t1 in ticks from now, color, solid (bright block) or tail (faint), w (lanes spanned)} */
  W.bars=list=>{for(let i=0;i<pool.length;i++){const b=list[i],m=pool[i];if(!b){m.visible=false;continue}
    const za=Z(b.t1),zb=Z(b.t0),l=zb-za;m.visible=l>.03;if(!m.visible)continue;const w=(b.w||1)*W.sp-W.sp*.22;
    m.scale.set(w,b.solid?.22:.06,Math.max(.03,l-(b.solid?.08:0)));m.position.set(W.xs[b.lane]+((b.w||1)-1)*W.sp/2,b.solid?.14:.05,(za+zb)/2);
    m.material.emissive.set(b.color);m.material.emissiveIntensity=b.solid?1.1:.5;m.material.opacity=b.solid?1:.3}};
  W.mark=(k,lane)=>{const m=W.marks[k];m.g.visible=lane!=null;if(lane!=null)m.x=W.xs[lane]};
  W.update=dt=>{W.void.update(dt);for(const m of W.marks)m.g.position.x=damp(m.g.position.x,m.x,16,dt)};
  return W;
}
