import * as THREE from 'three';
import {tween,ease,clamp,save} from '../core/util.js';
import {TOP} from '../world/bench.js';
import {NOTES,STATIONS} from '../core/hud.js';

/* Station 0 · wake it. No radio, no instruments. You learn what the board is, give it power, find that an awake
   chip still does nothing, and give it its first instruction by joining the button to the light.
   It ends with the smallest complete thing a computer does: you press, it answers. */
const plane=new THREE.Plane(),hitP=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0);
const TAP='click';   // hud rewords this for touch

/* put the bench into a known state */
export function dress(G,powered){
  const W=G.bench,P=W.power,pw=save.data.stats.power;G.showBench();
  W.plug.position.copy(powered?W.plugIn:W.plugHome);W.plug.rotation.y=powered?0:-.45;W.updateCable();
  P.a=P.b=P.en=powered?1:0;P.level=1;P.flow=powered?1:0;P.btn=P.out=0;P.feed=1;W.wire.visible=false;
  W.ledRed.material.emissiveIntensity=powered?3:0;W.ledBlue.material.emissiveIntensity=0;W.antMat.emissiveIntensity=0;W.regMat.emissiveIntensity=0;
  W.tray.visible=false;for(const id in W.caps){const c=W.caps[id];c.mesh.visible=false;c.mesh.position.copy(c.home)}
  if(powered&&save.data.done[1]&&pw&&W.caps[pw.cap]){const c=W.caps[pw.cap];c.mesh.visible=true;c.mesh.position.set(W.capPos.x,TOP+c.h/2,W.capPos.z)}
  W.halo.material.opacity=0;W.ring.material.opacity=0;
}
/* amber wave across the board when a station comes alive */
export function cascade(G,amount=1){
  const w=G.bench.wave;G.bloom.strength=.7+amount*.9;
  tween(1.6,k=>{w.scale.setScalar(.3+k*9);w.material.opacity=amount*(1-k);G.bloom.strength=.7+amount*.9*(1-k)},ease.out);
}
/* while the button is held, the press runs into the chip and the answer runs out to the light */
function pressLoop(G,S){
  const W=G.bench,P=W.power,on=!!(G.held&&G.held.btn)||S.botPress;
  if(on&&!S.wasOn){G.audio.sfx('click');S.presses=(S.presses||0)+1}S.wasOn=on;
  P.btn=clamp(P.btn+(on?.12:-.12));P.out=clamp(P.out+(on&&P.btn>.9?.14:-.14));W.ledBlue.material.emissiveIntensity=P.out>.95?5:0;
}

export async function ch0(G,flow){
  const {hud,audio,rig}=G,W=G.bench,P=W.power;
  const S=G.state={seen:{},plugged:false,mode:'intro',tried:false,wired:false,presses:0,blink:0};
  dress(G,false);rig.lim={dmin:3.4,dmax:80,phmin:.25,phmax:1.45};rig.zoom=true;rig.jump(G.VIEW.room);
  hud.slip('station 00 · wake it',[{id:'look',text:'find out what is on the board'},{id:'plug',text:'give it power'},{id:'wire',text:'give it one instruction'},{id:'press',text:'press, and get an answer'}]);
  const PARTS={
    chip:{at:W.halo.position,hit:W.modHit,r:.95,name:'the chip',say:'the chip. a whole computer sits under this metal lid. it can follow instructions, millions of them every second. but only instructions someone has given it.'},
    btn:{at:W.btnPos,hit:W.btnHit,r:.4,name:'the button',say:'the button. your press arrives here. it is only a switch: it does nothing on its own, but the chip can feel when it is down.'},
    led:{at:W.ledPos,hit:W.ledHit,r:.35,name:'a light',say:'a small blue light. the chip can switch it on and off. until we can reach the lamp, this light will stand in for it.'},
    usb:{at:W.usb.position,hit:W.usb,r:.5,name:'the socket',say:'the socket. electricity comes in here, through a cable. nothing on the board works without it.'},
    ant:{at:W.antPos,hit:W.antHit,r:.55,name:'the antenna',say:'the antenna: this gold zigzag. it lets the chip send messages through the air, with no wire. we will need it to reach the lamp. not yet.'}};

  G.act.look=async id=>{if(S.seen[id]||S.mode!=='tour'||S.reading)return;S.reading=true;S.seen[id]=true;audio.sfx('probe');hud.tag('part_'+id,PARTS[id].at,PARTS[id].name);hud.idle=0;await hud.talk(PARTS[id].say);S.reading=false};
  G.act.plug=async()=>{
    if(S.plugged||S.mode!=='plug')return;S.plugged=true;audio.sfx('plug');const from=W.plug.position.clone(),r0=W.plug.rotation.y;
    await tween(.3,k=>{W.plug.position.lerpVectors(from,W.plugIn,k);W.plug.rotation.y=r0*(1-k);W.updateCable()},ease.out);rig.shake=.25;
  };
  G.act.try=()=>{if(S.mode!=='try'||S.tried)return;S.tried=true;audio.sfx('click');rig.shake=.08};
  G.act.wire=async()=>{
    if(S.wired||S.mode!=='wire')return;S.wired=true;W.wire.visible=false;audio.sfx('cap');
    await tween(.7,k=>P.btn=k,ease.lin);await tween(.5,k=>P.out=k,ease.lin);W.ledBlue.material.emissiveIntensity=5;audio.sfx('ok');
    await tween(.9,()=>{});W.ledBlue.material.emissiveIntensity=0;P.btn=P.out=0;
  };
  G.act.press=on=>{S.botPress=on};

  /* ----- the aim ----- */
  await hud.talk(['across the room is a lamp. on the desk is a small board with a button on it.','the aim of this whole game: press that button, and the lamp turns on. with no wire between them.','{(to read on, press Z, or click this strip.)|(to read on, tap this strip.)}']);
  rig.fly({t:new THREE.Vector3(.1,.4,.2),d:8.6,th:.1,ph:.74,rate:1.4});
  await hud.talk(['this is an ESP32 board. it is a complete computer, the size of a stick of gum.',`five things on it matter today. each has a ring around it. ${TAP} one.`]);

  /* ----- the tour: one part at a time, explained in the strip ----- */
  S.mode='tour';for(const id in PARTS)G.thing(PARTS[id].hit,{on:()=>S.mode==='tour'&&!S.seen[id]&&!S.reading,click:()=>G.act.look(id)});
  hud.setHint({text:[`five parts have a ring around them. ${TAP} each one.`],target:()=>{for(const id in PARTS)if(!S.seen[id])return PARTS[id].at;return null},auto:async()=>{for(const id in PARTS){S.seen[id]=true;hud.tag('part_'+id,PARTS[id].at,PARTS[id].name)}}});
  G.update=()=>{let n=0;if(!S.reading)for(const id in PARTS)if(!S.seen[id]&&n<4)G.beacons[n++].at(new THREE.Vector3().copy(PARTS[id].at).setY(TOP+.06),PARTS[id].r);for(;n<4;n++)G.beacons[n].hide()};
  await flow.until(()=>Object.keys(S.seen).length===5&&!S.reading);G.update=null;G.beacons.forEach(b=>b.hide());hud.done('look');hud.setHint(null);
  await hud.talk(['so the plan: the button feels your press, the chip decides what to do about it, and something lights up.','none of it works yet. the board has no power. drag the cable into the socket.']);
  for(const id in PARTS)hud.untag('part_'+id);rig.fly({...G.VIEW.bench,rate:1.6});

  /* ----- power ----- */
  S.mode='plug';
  G.thing(W.plug,{on:()=>!S.plugged,click:()=>hud.say('drag it into the socket.'),drag:{
    move(r){plane.set(UP,-W.plugIn.y);if(!r.ray.intersectPlane(plane,hitP))return;
      hitP.x=clamp(hitP.x,-16,-3.1);hitP.z=clamp(hitP.z,-7,8);const near=clamp(1-(hitP.distanceTo(W.plugIn)-1)/5);W.plug.position.copy(hitP);W.plug.rotation.y=-.45*(1-near);W.updateCable()},
    end(){if(W.plug.position.distanceTo(W.plugIn)<1.8)G.act.plug()}}});
  hud.setHint({text:['drag the plug to the silver socket on the left end of the board.'],target:()=>W.plug.position,auto:()=>G.act.plug()});
  G.update=()=>{if(!S.plugged){G.beacons[0].at(W.plug.position,.9);G.beacons[1].at(new THREE.Vector3(-2.7,TOP+.05,0),.45)}};
  await flow.until(()=>S.plugged);G.beacons.forEach(b=>b.hide());G.update=null;hud.setHint(null);hud.hush();
  await flow.sleep(.35);audio.sfx('power');rig.fly({...G.VIEW.board,rate:1.6});
  await tween(1,k=>P.a=k,ease.lin);hud.tag('vbus',W.points.vbus,'5 volts','amber');
  await hud.talk(['electricity arrives with a pressure behind it. the pressure is measured in volts. the cable pushes at 5 volts.','the chip is delicate. it wants 3.3 volts, and 5 would damage it.']);
  hud.tag('reg',W.reg.position.clone().setY(TOP+.2),'the regulator','amber');
  await hud.talk('so the power goes through this black part first: the regulator. it lowers 5 volts to 3.3, and from there it feeds everything on the board.');
  await tween(1,k=>P.b=k,ease.lin);W.ledRed.material.emissiveIntensity=3;audio.sfx('click');hud.tag('v33',W.points.reg,'3.3 volts','amber');
  await tween(.8,k=>P.en=k,ease.lin);P.flow=1;audio.sfx('boot');S.blink=1.4;cascade(G,.5);
  G.update=dt=>{if(S.blink>0){S.blink-=dt;W.ledBlue.material.emissiveIntensity=(S.blink*5%1)>.5&&S.blink>0?4:0}};
  hud.untag('vbus');hud.untag('reg');hud.untag('v33');rig.fly({t:new THREE.Vector3(-.4,.4,-.2),d:6.2,th:.5,ph:.8,rate:2});
  hud.tag('red',W.ledRedPos,'red light','red');await hud.talk('this red light, by the top edge, means the power is on.');hud.untag('red');
  hud.tag('blue',W.ledPos,'blue light','cyan');S.blink=1.6;await hud.talk('and the blue one blinked as the chip woke up. it is running now.');hud.untag('blue');
  rig.fly({...G.VIEW.board,rate:1.6});hud.done('plug');hud.note('vbus');hud.note('reg');hud.note('en');

  /* ----- awake, and it does nothing ----- */
  S.mode='try';hud.tag('btn',W.btnPos,'the button');
  await hud.talk(`so it should work now. press the button on the board. (${TAP} it.)`);
  G.thing(W.btnHit,{btn:true,hold:true,on:()=>S.mode==='try'||S.mode==='wire'||S.mode==='press',click:()=>G.act.try(),dragOn:()=>S.mode==='wire',drag:{
    start(){W.wire.visible=true},
    move(r){plane.set(UP,-(TOP+.12));if(!r.ray.intersectPlane(plane,hitP))return;W.wire.geometry.setFromPoints([W.btnPos,hitP.clone()])},
    end(){if(hitP.distanceTo(W.ledPos)<.8)G.act.wire();else{W.wire.visible=false;audio.sfx('wrong')}}}});
  hud.setHint({text:['the button is at the near-left corner of the board.'],target:()=>W.btnPos,auto:()=>G.act.try()});
  const blink=G.update;G.update=dt=>{blink(dt);if(S.mode==='try'&&!S.tried)G.beacons[0].at(W.btnPos.clone().setY(TOP+.05),.4);else if(S.mode==='wire'&&!S.wired){G.beacons[0].at(W.btnPos.clone().setY(TOP+.05),.4);G.beacons[1].at(W.ledPos.clone().setY(TOP+.05),.35)}else G.beacons.forEach(b=>b.hide());if(S.mode==='press')pressLoop(G,S)};
  await flow.until(()=>S.tried);hud.setHint(null);await flow.sleep(.9);
  await hud.talk(['nothing.','the chip has power, and it is awake. but a chip does only what it has been told, and nobody has told this one anything.','so tell it. drag from the button to the blue light.']);
  hud.note('prog');S.mode='wire';hud.tag('led',W.ledPos,'the light','cyan');
  hud.setHint({text:['press on the button, keep holding, and drag across to the blue light.'],target:()=>W.ledPos,auto:()=>G.act.wire()});
  await flow.until(()=>S.wired&&P.out===0);hud.setHint(null);hud.done('wire');
  await hud.talk(['that is its first instruction: while the button is down, switch the light on.','notice the path it took. the press does not run straight to the light. it goes into the chip, the chip decides, and the answer comes out again.','it goes in and out through pins: the gold dots along both edges. pins are the chip’s only way to touch the world outside it.','try it. press and hold the button.']);
  hud.note('pin');S.mode='press';S.presses=0;
  hud.setHint({text:['press and hold on the button.'],target:()=>W.btnPos,auto:()=>{S.botPress=true;tween(1.2,()=>{}).then(()=>S.botPress=false)}});
  await flow.until(()=>S.presses>=1&&P.out>.95);await flow.until(()=>P.out===0,6);hud.setHint(null);hud.done('press');
  save.data.done[0]=true;save.store();hud.refresh();audio.music.grow();audio.sfx('fanfare');cascade(G,1);
  await hud.talk(['there. you press, it answers. that is a complete computer doing a complete job.','but the light is here on the desk. the lamp is over there.']);
  hud.untag('btn');hud.untag('led');
  await hud.page(`<h2>station 00 · wake it</h2>
    <p>the board has power, the chip is awake, and it follows one instruction: while the button is down, the light is on.</p>
    <h3>now in your notebook</h3><ul>${['vbus','reg','en','prog','pin'].map(i=>`<li>${NOTES[i].t}</li>`).join('')}</ul>
    <button class="sign">sign off &rarr;</button>`);
  G.go('roam');
}

/* the bench between stations: the button works (and the lamp, once it has a listener), and the next station is marked */
export async function roam(G,flow){
  const {hud,rig,audio}=G,W=G.bench,d=save.data.done,S=G.state={presses:0,seen:0};
  dress(G,true);W.setLamp(false);rig.zoom=true;rig.lim={dmin:3.4,dmax:90,phmin:.25,phmax:1.45};rig.fly({...G.VIEW.board,d:9,rate:2});
  const n=G.ORDER.findIndex((id,i)=>!d[i]),nn=String(n).padStart(2,'0'),ant=n===1;
  const next=n<0?null:{go:G.ORDER[n],at:ant?W.antPos:W.halo.position,r:ant?.55:.95,hit:ant?W.antHit:W.modHit,name:`station ${nn}<small>${STATIONS[n]}</small>`};
  hud.slip('the bench',[{id:'next',text:next?`station ${nn} · ${STATIONS[n]}: click the ${ant?'antenna':'chip'}`:'every station is built. press the button.'}]);
  G.act.enter=()=>next&&G.go(next.go);
  G.thing(W.btnHit,{btn:true,hold:true,name:'the button',at:W.btnPos});
  if(next){G.thing(next.hit,{click:()=>G.act.enter()});hud.tag('next',next.at,next.name,'cyan');hud.setHint({text:[`${TAP} the part with the ring around it.`],target:()=>next.at,auto:()=>G.act.enter()})}
  G.update=()=>{pressLoop(G,S);if(next)G.beacons[0].at(new THREE.Vector3().copy(next.at).setY(TOP+.06),next.r,0x5fe3ff);
    if(d[3]&&S.presses>S.seen){S.seen=S.presses;audio.sfx('zap');W.ring.position.copy(W.antPos);tween(.5,k=>{W.ring.scale.setScalar(.3+k*92);W.ring.material.opacity=.9*(1-k)});W.setLamp(!W.lampIsOn);if(rig.g.d<40)rig.fly({...G.VIEW.room,rate:2.5})}};
  hud.say(n<0?'thirteen stations, all built. press the button whenever you like.':!d[3]?'the button lights the light on the board. the lamp is still out of reach.':'press the button: the lamp across the room answers. '+(13-Object.values(d).filter(Boolean).length)+' stations to go.');
  await flow.until(()=>false);
}
