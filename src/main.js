import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {Flow,CANCEL,tickTweens,save,Beacon,clamp} from './core/util.js';
import {Rig} from './core/rig.js';
import {audio} from './core/audio.js';
import {hud} from './core/hud.js';
import {buildBench} from './world/bench.js';
import {buildStage} from './world/stage.js';
import {buildDeck} from './world/deck.js';
import {s02,s03,s04} from './stations/a.js';
import {s06,s07,s08,s09} from './stations/b.js';
import {s10,s11,s12} from './stations/c.js';
import {STATIONS} from './core/hud.js';
import {ch0,roam} from './chapters/ch0.js';
import {ch1} from './chapters/ch1.js';
import {ch3} from './chapters/ch3.js';
import {makeBot} from './bot.js';
import {buildFly} from './world/fly.js';

const $=id=>document.getElementById(id);
/* the board's silk is drawn on a canvas, so the typeface has to be there first */
await Promise.race([document.fonts.load('600 30px "Paper Mono"'),new Promise(r=>setTimeout(r,2500))]).catch(()=>{});

const canvas=$('gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x070612);scene.fog=new THREE.FogExp2(0x0c0a20,.0042);
scene.environment=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.22;
const camera=new THREE.PerspectiveCamera(42,1,.05,1100);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.7,.6,.9);composer.addPass(bloom);composer.addPass(new OutputPass());
/* finishing pass: film grain, a vignette, and lens fringing that spikes when the chip resets */
const finish=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0},amt:{value:0},rows:{value:800}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float time,amt,rows;varying vec2 vUv;
   float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+time)*43758.5453);}
   float h0(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
   void main(){vec2 d=vUv-.5;float r=dot(d,d),t=floor(time*24.);vec2 uv=vUv;
    /* a reset or a cut tears rows sideways and drops blocks out of place */
    float row=floor(vUv.y*42.);uv.x+=amt*.07*step(.5,h0(vec2(row,t)))*(h0(vec2(row,t+7.))-.5);
    vec2 blk=floor(vUv*vec2(12.,8.));uv.x+=step(1.-amt*.22,h0(blk+t))*(h0(blk-t)-.5)*.12;
    vec2 o=d*(r*.012+amt*.03)+vec2(amt*.008,0.);
    vec3 c=vec3(texture2D(tDiffuse,uv+o).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-o).b);
    /* grade: shadows lean to indigo, colour is pushed a little */
    float l=dot(c,vec3(.299,.587,.114));c=mix(c,c*vec3(.84,.94,1.14)+vec3(.012,0.,.03),1.-smoothstep(0.,.45,l));c=mix(vec3(l),c,1.14);
    c*=1.-.05*(.5+.5*sin(vUv.y*rows*1.5708));                       // scanlines, four pixels apart
    c*=1.-r*.95;c+=(h(vUv*vec2(1733.,977.))-.5)*.035;gl_FragColor=vec4(c,1.);}`});
composer.addPass(finish);

save.load();
/* station number -> the function that plays it */
const ORDER=['ch0','ch1','s02','s03','s04','ch3','s06','s07','s08','s09','s10','s11','s12'],PLAY={ch0,ch1,s02,s03,s04,ch3,s06,s07,s08,s09,s10,s11,s12,roam};
const G=window.game={ORDER,
  scene,camera,renderer,bloom,hud,audio,save,rig:new Rig(camera),
  knob:{stops:[{label:'1 s = 1 s',rate:1}],i:0,locked:true,label:null},onKnob:null,glitch:0,
  paused:true,flow:null,chapter:null,station:-1,update:null,act:{},state:null,things:[],
  pointer:{x:.5,y:.5,down:false},held:null,keys:new Set(),
  bench:buildBench(),stage:buildStage(),deck:buildDeck(),beacons:[0xffb347,0xffb347,0xffb347,0xff5fd2].map(c=>new Beacon(c)),
  VIEW:{room:{t:new THREE.Vector3(4,3,-14),d:68,th:.32,ph:1.3,room:true},bench:{t:new THREE.Vector3(-1.6,.4,.4),d:15,th:.3,ph:.95},board:{t:new THREE.Vector3(.3,.4,.2),d:7.4,th:.1,ph:.74}},

  /* the knob on the instrument is time. Stations decide what its stops mean. */
  setKnobs(stops,i=0,locked=false){this.knob={stops,i,locked,label:null};audio.warp(Math.log10(stops[i].warp||1));hud.refresh()},
  setKnob(i,force=false){
    const K=this.knob;if(K.locked&&!force){audio.sfx('wrong');return}
    i=clamp(i,0,K.stops.length-1);if(i===K.i)return;K.i=i;audio.warp(Math.log10(K.stops[i].warp||1));audio.sfx('dial');hud.refresh();hud.idle=0;if(this.onKnob)this.onKnob(i);
  },
  rate(){return this.knob.stops[this.knob.i].rate},
  /* something in the world the player can click, drag, or hold */
  thing(obj,o){const t={obj,on:()=>true,...o};this.things.push(t);return t},
  showBench(){this.bench.root.visible=true;this.stage.root.visible=this.deck.root.visible=false;scene.fog.density=.0042},
  showStage(){this.stage.root.visible=true;this.bench.root.visible=this.deck.root.visible=false;scene.fog.density=.012},
  showDeck(){this.deck.root.visible=true;this.bench.root.visible=this.stage.root.visible=false;scene.fog.density=.012},
  async dive(fn){audio.sfx('whoosh');this.rig.fly({d:this.rig.g.d*.35,rate:3});await hud.fade(true);await fn();await hud.fade(false)},

  go(name){
    if(this.flow)this.flow.cancel();
    this.things.length=0;if(this.flyJob&&this.flyJob.kind!=='press')this.flyJob=null;this.act={};this.update=null;this.onKnob=null;this.held=null;this.rig.locked=false;
    hud.clearTags();hud.scope(null);hud.hush();hud.slip('',[]);hud.wantKnob(false);this.beacons.forEach(b=>b.hide());
    this.setKnobs([{label:'1 s = 1 s',rate:1}],0,true);this.chapter=name;this.station=ORDER.indexOf(name);save.data.at=name;save.store();document.title=(this.station>=0?`${String(this.station).padStart(2,'0')} · ${STATIONS[this.station]}`:'the bench')+' — One Press';audio.music.scene(name);if(this.station>=0)hud.card(this.station,STATIONS[this.station]);this.holdMode=false;hud.refresh();
    const flow=this.flow=new Flow();
    PLAY[name](this,flow).catch(e=>{if(e!==CANCEL){console.error(e);hud.hush();hud.say('error: '+(e.message||e))}});
  },
  menu(on){
    if(on){const d=save.data.done,next=ORDER.findIndex((id,i)=>!d[i]);   // stations already built, plus the next one
      $('menuStations').innerHTML='<button data-m="roam">the bench</button>'+ORDER.map((id,i)=>d[i]||i===next?`<button data-m="${id}">station ${String(i).padStart(2,'0')} · ${STATIONS[i]}</button>`:'').join('')}
    $('menu').classList.toggle('off',!on);this.paused=on},
};
scene.add(G.bench.root,G.stage.root,G.deck.root);G.fly=buildFly();scene.add(G.fly.root);G.beacons.forEach(b=>scene.add(b.mesh));
hud.init(G);G.bot=makeBot(G);G.rig.jump(G.VIEW.room);G.rig.lim.dmax=80;
audio.on=save.data.sound;document.body.classList.toggle('calm',save.data.calm);

/* ---------- input ---------- */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
function pick(ev,filter){
  const r=canvas.getBoundingClientRect();ndc.set((ev.clientX-r.left)/r.width*2-1,-((ev.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);
  const live=G.things.filter(t=>t.on()&&(!filter||filter(t))),hits=ray.intersectObjects(live.map(t=>t.obj),true);
  for(const h of hits){for(let o=h.object;o;o=o.parent){const t=live.find(t=>t.obj===o);if(t){pick.point=h.point;return t}}}
  return null;
}
const canDrag=t=>t&&t.drag&&(!t.dragOn||t.dragOn());
let down=null,hover=null;const touches=new Map();let pinch=0;
canvas.addEventListener('pointerdown',ev=>{if(G.paused)return;audio.resume();touches.set(ev.pointerId,[ev.clientX,ev.clientY]);G.pointer.x=ev.clientX/innerWidth;G.pointer.y=ev.clientY/innerHeight;
  if(touches.size===2){const[a,b]=[...touches.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);if(down&&down.drag)down.t.drag.end();down=null;G.held=null;return}
  const t=pick(ev);G.pointer.down=true;
  down={lx:ev.clientX,ly:ev.clientY,t,moved:0,drag:false};if(t)G.flyJob={kind:t.hold?'hold':'press',pos:(surface(ray)||pick.point).clone(),until:clock+.9,thing:t};G.held=t&&t.hold?t:null;canvas.setPointerCapture(ev.pointerId)});
addEventListener('pointermove',ev=>{G.pointer.x=ev.clientX/innerWidth;G.pointer.y=ev.clientY/innerHeight});
canvas.addEventListener('pointermove',ev=>{
  if(touches.has(ev.pointerId))touches.set(ev.pointerId,[ev.clientX,ev.clientY]);
  if(touches.size===2){const[a,b]=[...touches.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch&&!G.rig.locked)G.rig.wheel((pinch-d)*3);pinch=d;return}
  if(!down){const t=G.paused?null:pick(ev);if(t!==hover){hover=t;canvas.style.cursor=t?(canDrag(t)?'grab':'pointer'):'';if(t)audio.sfx('hover');if(t&&t.name)hud.tag('hover',t.at||t.obj.position,t.name,'faint');else hud.untag('hover')}return}
  const dx=ev.clientX-down.lx,dy=ev.clientY-down.ly;down.lx=ev.clientX;down.ly=ev.clientY;down.moved+=Math.abs(dx)+Math.abs(dy);
  if(canDrag(down.t)){if(down.moved>5){pick(ev);if(!down.drag){down.drag=true;canvas.style.cursor='grabbing';if(G.flyJob)G.flyJob.kind='carry';down.t.drag.start&&down.t.drag.start()}down.t.drag.move(ray,dx,dy)}}
  else if(down.t&&down.t.hold||G.holdMode){const t=pick(ev,t=>t.hold);G.held=t;if(t)G.flyJob={kind:'hold',pos:(surface(ray)||pick.point).clone(),thing:t};else G.flyJob=null}
  else if(down.moved>4&&!G.rig.locked)G.rig.orbit(dx,dy);
});
const up=()=>{if(!down)return;const d=down;down=null;if(G.flyJob&&G.flyJob.kind!=='press')G.flyJob=null;G.pointer.down=false;G.held=null;canvas.style.cursor='';if(d.drag)d.t.drag.end();else if(d.t&&d.moved<6&&d.t.click)d.t.click()};
const lift=ev=>{touches.delete(ev.pointerId);pinch=0;up()};canvas.addEventListener('pointerup',lift);canvas.addEventListener('pointercancel',lift);
canvas.addEventListener('wheel',ev=>{ev.preventDefault();if(!G.paused&&!G.rig.locked)G.rig.wheel(ev.deltaY)},{passive:false});
function overlay(){return['title','menu','book','page'].find(id=>!$(id).classList.contains('off'))}
addEventListener('keydown',ev=>{
  const o=overlay();
  if(ev.key==='Escape'){if(o==='book')hud.book(false);else if(o==='menu')G.menu(false);else if(!o)G.menu(true);return}
  if(ev.key==='Tab'){ev.preventDefault();if(o==='book')hud.book(false);else if(!o)hud.book(true);return}
  if(G.paused)return;const k=ev.key.toLowerCase();G.keys.add(k);
  if((k==='z'||k==='enter'||k===' ')&&!ev.repeat&&hud.advance()){ev.preventDefault();return}
  if(k==='q')G.setKnob(G.knob.i-1);else if(k==='e')G.setKnob(G.knob.i+1);else if(k==='h')hud.nextHint();
  else if(G.act.key&&!ev.repeat)G.act.key(k);
});
addEventListener('keyup',ev=>G.keys.delete(ev.key.toLowerCase()));

/* ---------- title: the first press does nothing ---------- */
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function begin(fresh){
  audio.init();audio.resume();audio.music.start();
  if(fresh){
    save.wipe();$('btnPress').classList.add('down');audio.sfx('click');$('btnContinue').classList.add('off');
    await wait(900);$('titleLine').textContent='nothing happens.';await wait(1700);$('titleLine').textContent='the board is dead. start there.';await wait(1500);
  }
  hud.refresh();$('title').classList.add('off');hud.show(true);G.paused=false;
  /* pick up at the station that was open when the page was last closed; a station restarts from its own beginning */
  const at=save.data.at;G.go(!fresh&&PLAY[at]?at:save.data.done[0]?'roam':'ch0');
}
/* Progress lives in this browser's local storage: no account, and it survives a refresh or a restart of the browser. */
const built=ORDER.filter((id,i)=>save.data.done[i]).length,resume=built>0||(save.data.at&&save.data.at!=='ch0');
$('btnPress').classList.remove('off');
if(resume){
  const at=save.data.at,n=ORDER.indexOf(at);
  $('btnPress').firstElementChild.textContent='continue';$('btnPress').onclick=()=>begin(false);
  $('titleLine').textContent=(n>=0?`station ${String(n).padStart(2,'0')} · ${STATIONS[n]}`:'the bench')+` · ${built} of 13 built`;
  const b=$('btnContinue');b.textContent='start over';b.classList.remove('off');let sure=false;
  b.onclick=()=>{if(!sure){sure=true;b.textContent='erase all progress? press again';setTimeout(()=>{sure=false;b.textContent='start over'},4000);return}
    $('btnPress').firstElementChild.textContent='press';$('titleLine').textContent='a board. a lamp across the room.';begin(true)};
}else $('btnPress').onclick=()=>begin(true);
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});   // ask the browser not to clear it under storage pressure
$('menu').addEventListener('click',ev=>{
  const m=ev.target.dataset.m;if(!m)return;
  if(m==='resume')G.menu(false);
  else if(PLAY[m]){G.menu(false);G.go(m)}
  else if(m==='sound'){save.data.sound=!save.data.sound;audio.mute(!save.data.sound);save.store();ev.target.textContent='sound: '+(save.data.sound?'on':'off')}
  else if(m==='motion'){save.data.calm=!save.data.calm;document.body.classList.toggle('calm',save.data.calm);save.store();ev.target.textContent='motion: '+(save.data.calm?'reduced':'full')}
  else if(m==='wipe'){save.wipe();location.reload()}
});

/* ---------- loop ---------- */
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);composer.setSize(w,h);finish.uniforms.rows.value=h;camera.aspect=w/h;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();
let last=performance.now(),idleT=0,clock=0,offX=0,offY=0;
/* Aim the camera at the middle of the free area (right of the slip, above the dock), so the action is never under the HUD. */
function aim(dt){
  const w=innerWidth,h=innerHeight;let tx=0,ty=0;
  if(!$('hud').classList.contains('off')&&!overlay()){const s=$('slip').getBoundingClientRect(),d=$('dock').getBoundingClientRect();
    if(w>720){tx=s.right*.42;ty=-Math.max(0,h-d.top)*.34}else ty=((s.bottom+d.top)/2-h/2)}
  offX+=(tx-offX)*Math.min(1,dt*4);offY+=(ty-offY)*Math.min(1,dt*4);
  camera.setViewOffset(w,h,-Math.round(offX),-Math.round(offY),w,h);
}G.frames=0;G.slow=0;
function advance(dt){
  clock+=dt;
  if(!G.paused){
    if(G.flow)G.flow.update(dt);
    if(G.update)G.update(dt);
    if(G.bench.root.visible)G.bench.update(dt,1);
    if(G.stage.root.visible)G.stage.update(dt,G.stageSpeed||6);
    if(G.deck.root.visible)G.deck.update(dt);
    G.beacons.forEach(b=>b.update(dt));
  }else if(!$('title').classList.contains('off')){idleT+=dt;G.rig.g.th=.32+Math.sin(idleT*.12)*.12;G.rig.rate=1;G.bench.update(dt,1)}
  G.glitch=Math.max(0,G.glitch-dt*2.2);finish.uniforms.time.value=clock%100;finish.uniforms.amt.value=save.data.calm?0:G.glitch;
  tickTweens(dt);aim(dt);G.rig.update(dt);hud.update(G.paused?0:dt);flyTo(dt);
}
/* the fly goes to where the pointer meets the plane the camera is looking at; on the title it circles the board */
const flyRay=new THREE.Raycaster(),flyNdc=new THREE.Vector2(),flyPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),flyAt=new THREE.Vector3(),flyTmp=new THREE.Vector3();let flyPX=0,flyPY=0,flyStill=0;
/* the first solid, visible surface a ray meets in whichever place is showing; hit boxes, glows and lane tints do not count */
function surface(rc){
  const root=[G.bench,G.stage,G.deck].find(w=>w.root.visible).root;rc.params.Points.threshold=0;rc.params.Line.threshold=0;
  for(const h of rc.intersectObject(root,true)){const o=h.object;if(!o.isMesh||!o.material||o.material.transparent)continue;
    let p=o,seen=true;for(;p;p=p.parent)if(!p.visible){seen=false;break}if(seen)return h.point}
  return null;
}
function flyTo(dt){
  const P=G.pointer,T=G.rig.t,dist=camera.position.distanceTo(T);
  if(Math.abs(P.x-flyPX)+Math.abs(P.y-flyPY)>.002||P.down){flyStill=0;flyPX=P.x;flyPY=P.y}else flyStill+=dt;
  if(!$('title').classList.contains('off')){flyAt.set(Math.sin(clock*.5)*dist*.16,T.y+dist*.05,T.z+dist*.45+Math.cos(clock*.5)*dist*.1);G.fly.update(dt,flyAt,dist*.03,0);return}
  flyNdc.set(P.x*2-1,1-P.y*2);flyRay.setFromCamera(flyNdc,camera);flyPlane.constant=-T.y;
  const hit=surface(flyRay);                                       // stand on whatever is under the pointer, not inside it
  if(hit&&hit.distanceTo(T)<dist*.7)flyAt.copy(hit);
  else{if(!flyRay.ray.intersectPlane(flyPlane,flyAt))flyAt.copy(T);const off=flyAt.clone().sub(T),max=dist*.7;if(off.length()>max)flyAt.copy(T).addScaledVector(off.normalize(),max)}
  /* acting for the player: stamp on what was clicked, lean on what is held, carry what is dragged.
     A dragged thing that does not itself move (a wire being pulled from a pin) is followed at the pointer instead. */
  const J=G.flyJob;
  if(J){
    if(J.kind==='carry'){J.thing.obj.getWorldPosition(flyTmp);if(!J.home)J.home=flyTmp.clone();J.pos.copy(flyTmp.distanceTo(J.home)>1e-3?flyTmp:flyAt)}
    else if(J.kind==='press'&&!down&&clock>J.until)G.flyJob=null;
    if(G.flyJob){G.fly.update(dt,J.pos,dist*.03,0,J);return}
  }
  G.fly.update(dt,flyAt,dist*.03,flyStill);
}
function frame(now){
  const raw=(now-last)/1000;last=now;G.frames++;if(raw>.034)G.slow++;
  if(!G.manual)advance(Math.min(.05,raw));
  composer.render();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
/* test hook: run the game forward by hand, independent of the display */
G.step=async(sec,dt=1/60)=>{G.manual=true;for(let i=0,n=Math.round(sec/dt);i<n;i++){advance(dt);await null;await null;await null}composer.render();G.manual=false};
