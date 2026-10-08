import * as THREE from 'three';
import {tween,ease,clamp,save} from '../core/util.js';
import {TOP} from '../world/bench.js';
import {dress,cascade} from '../chapters/ch0.js';
import {STATIONS,T as words} from '../core/hud.js';
import {restart,signOff,mark} from './kit.js';

const F='"Paper Mono",ui-monospace,monospace',PAPER='#e8e1cf',DIM='#8a877f',AMBER='#ffb347',RED='#ff5a4d',GREEN='#9be7a8',MAG='#ff5fd2',CYAN='#5fe3ff';

/* ================= station 10 · sleep =================
   On a battery, a chip that waits awake is dead in a day. You switch it off by hand and find it can no longer hear
   the button; then choose how deeply it sleeps and what wakes it, against two needs: a year of life, a fast answer. */
const DEPTH=[{label:'always awake',mA:80,wake:0},{label:'radio naps',mA:25,wake:.003},{label:'light sleep',mA:.8,wake:.001},{label:'deep sleep',mA:.01,wake:.3}],MAH=2000;
const life=mA=>MAH/mA/24,lifeText=d=>d<2?Math.round(d*24)+' hours':d<60?Math.round(d)+' days':d<700?Math.round(d/30.4)+' months':'years';
export async function s10(G,flow){
  const {hud,audio,rig}=G,W=G.bench,P=W.power;
  const S=G.state={mode:'intro',di:0,by:'timer',asleep:false,batt:1,lapse:0,dead:false,presses:0,lit:0,tried:false,woke:false};
  dress(G,true);rig.zoom=true;rig.lim={dmin:3.4,dmax:80,phmin:.25,phmax:1.45};rig.fly({...G.VIEW.board,rate:2});
  hud.slip('station 10 · sleep',[{id:'dead',text:'run it from a battery'},{id:'hand',text:'put it to sleep by hand'},{id:'fit',text:'a year of battery, and still quick'}]);
  hud.scope('battery');G.setKnobs([{label:'—',rate:1}],0,true);
  const resp=()=>S.by==='timer'&&S.di>=2?10:DEPTH[S.di].wake,okLife=()=>life(DEPTH[S.di].mA)>=365,okResp=()=>resp()<=.5;
  const draw=()=>S.dead?0:S.mode==='fit'||S.mode==='test'?DEPTH[S.di].mA:S.asleep?.01:80;
  G.act.chip=()=>{if(S.mode==='hand'){S.asleep=!S.asleep;if(!S.asleep)S.woke=true;audio.sfx(S.asleep?'step':'boot');hud.idle=0}else if(S.mode==='fit'){S.by='timer';audio.sfx('step')}};
  G.act.press=()=>{
    if(S.mode==='hand'){audio.sfx('click');if(S.asleep)S.tried=true;else{S.lit=1;S.presses++}}
    else if(S.mode==='fit'){S.by='button';audio.sfx('step')}
    else if(S.mode==='test'){audio.sfx('click');tween(resp(),()=>{}).then(()=>{S.lit=1.2;S.presses++;audio.sfx('ok')})}
  };
  G.thing(W.modHit,{name:'the chip',at:W.halo.position,on:()=>S.mode==='hand'||S.mode==='fit',click:()=>G.act.chip()});
  G.thing(W.btnHit,{name:'the button',at:W.btnPos,on:()=>S.mode==='hand'||S.mode==='fit'||S.mode==='test',click:()=>G.act.press()});
  G.update=dt=>{
    if(S.lapse>0){const hours=S.lapse*dt;S.batt=Math.max(0,S.batt-draw()*hours/MAH);if(S.batt<=0&&!S.dead){S.dead=true;S.lapse=0;P.level=.05;P.flow=0;W.ledRed.material.emissiveIntensity=0;audio.sfx('reset')}}
    if(S.lit>0){S.lit-=dt;W.ledBlue.material.emissiveIntensity=5}else W.ledBlue.material.emissiveIntensity=0;
    const sleeping=!S.dead&&((S.mode==='hand'&&S.asleep)||((S.mode==='fit'||S.mode==='test')&&S.di>=2&&S.lit<=0));P.level=S.dead?.05:sleeping?.25:1;P.flow=S.dead||sleeping?0:1;
    if(S.mode==='fit'){hud.tag('wb',W.btnPos,'wake on a press'+(S.by==='button'?' ✓':''),S.by==='button'?'amber':'');hud.tag('wt',W.halo.position,'wake on a timer, every 10 s'+(S.by==='timer'?' ✓':''),S.by==='timer'?'amber':'')}
    const g=hud.ctx,w=1040,h=440;g.clearRect(0,0,w,h);g.textBaseline='middle';g.textAlign='left';
    g.strokeStyle='rgba(232,225,207,.4)';g.lineWidth=3;g.strokeRect(60,40,620,70);g.fillRect(684,58,12,34);g.fillStyle=S.batt>.25?GREEN:RED;g.fillRect(66,46,608*S.batt,58);
    const line=(y,k,v,ok)=>{g.font=`500 20px ${F}`;g.fillStyle=DIM;g.fillText(k,60,y);g.font=`600 30px ${F}`;g.fillStyle=ok==null?PAPER:ok?GREEN:RED;g.fillText(v,420,y)};
    const mA=draw();line(180,'it is drawing',S.dead?'nothing · dead':mA>=1?mA+' mA':Math.round(mA*1000)+' µA',null);
    if(S.mode==='fit'||S.mode==='test'){line(250,'the battery lasts',lifeText(life(mA)),okLife());line(320,'press to light',resp()>=1?'up to '+resp()+' s':resp()>=.01?resp()+' s':'instant',okResp())}
    else line(250,'at this rate it lasts',lifeText(life(Math.max(mA,.01))),null);
  };
  await hud.talk(['a remote on a cable is not much of a remote. so the cable goes, and a battery takes its place.','the instrument shows the battery. leave the board on the shelf overnight, waiting for a press.']);
  await tween(.6,k=>{W.plug.position.lerpVectors(W.plugIn,W.plugHome,k);W.plug.rotation.y=-.45*k;W.updateCable()},ease.io);S.lapse=9;S.mode='lapse';
  await flow.until(()=>S.dead);hud.done('dead');await flow.sleep(.6);
  await hud.talk(['dead by the next evening.','nobody pressed anything. it spent every one of those hours wide awake, radio on, waiting.','a new battery, then. this time, when nothing is happening, switch the chip off yourself: {click|tap} the chip to put it to sleep.']);
  S.dead=false;S.batt=1;S.mode='hand';W.ledRed.material.emissiveIntensity=3;hud.note('sleep');
  hud.setHint({text:['{click|tap} the silver chip to put it to sleep.'],target:()=>W.halo.position,auto:()=>{S.asleep=true}});
  await flow.until(()=>S.asleep);hud.setHint(null);
  await hud.talk(['look at what it draws now: about a thousandth of what it did. at that rate the battery outlives the remote.','now press the button.']);
  hud.setHint({text:['{click|tap} the button at the corner of the board.'],target:()=>W.btnPos,auto:()=>{S.tried=true}});
  await flow.until(()=>S.tried);hud.setHint(null);
  await hud.talk(['nothing. a sleeping chip does not notice a button.','wake it yourself first, then press.']);
  hud.setHint({text:['{click|tap} the chip to wake it. then {click|tap} the button.'],target:()=>S.asleep?W.halo.position:W.btnPos,auto:()=>{S.asleep=false;S.woke=true;S.presses=1;S.lit=1}});
  await flow.until(()=>S.woke&&S.presses>=1);hud.setHint(null);hud.done('hand');
  await hud.talk(['it works, if someone wakes the chip before every press. that someone cannot be you.','so a small part of the chip never sleeps: a tiny clock that sips almost nothing, and can watch one or two pins. it wakes the rest.',
    'two things to choose. the knob sets how deeply the chip sleeps. deeper saves more, and takes longer to wake.','and what wakes it: {click|tap} the button to wake on a press, or the chip to wake on a timer every ten seconds and look.',
    'you need a year from one battery, and a lamp that answers within half a second. both lines on the instrument must be green.']);
  S.mode='fit';S.asleep=false;hud.note('wake');G.setKnobs(DEPTH.map(d=>({label:d.label,rate:1})),0,false);G.onKnob=i=>{S.di=i;hud.wantKnob(false)};hud.wantKnob(true);
  hud.setHint({text:['turn the knob to sleep more deeply, and watch how long the battery lasts.','deep sleep, woken by a press on the button.'],auto:()=>{G.setKnob(3);S.by='button'}});
  await flow.until(()=>okLife()&&okResp());await flow.sleep(.8);hud.setHint(null);hud.untag('wb');hud.untag('wt');G.onKnob=null;G.knob.locked=true;hud.refresh();
  await hud.talk(['deep sleep, woken by the press itself. almost nothing is drawn until the moment you need it.','it costs a third of a second to wake. watch a year go by, then press.']);
  S.mode='test';S.batt=1;S.lapse=2600;await flow.sleep(3);S.lapse=0;
  hud.setHint({text:['{click|tap} the button.'],target:()=>W.btnPos,auto:()=>G.act.press()});const p=S.presses;await flow.until(()=>S.presses>p);hud.done('fit');
  await hud.talk('a year on the shelf, most of the battery left, and it still answers.');
  await signOff(G,10,'sleep','the remote runs from a battery: the chip sleeps deeply, a tiny clock keeps watch, and a press on the button wakes it.',['sleep','wake']);
}

/* ================= station 11 · the fuse =================
   You play the thief: read the memory out, and find the password in plain letters. Then burn fuses, which cannot
   be undone, to scramble the memory and to refuse any program but yours. The burns stay in the save. */
const HEXD='0123456789ABCDEF';
export async function s11(G,flow){
  const {hud,audio,rig}=G,W=G.bench,fz=save.data.fuses||(save.data.fuses={});
  const S=G.state={mode:'intro',dumps:0,dump:0,burn:0,which:null,evil:0,refused:false,t:0,lines:[]};
  dress(G,true);rig.zoom=true;rig.lim={dmin:3.4,dmax:80,phmin:.25,phmax:1.45};rig.fly({...G.VIEW.board,rate:2});
  hud.slip('station 11 · the fuse',[{id:'dump',text:'read the chip’s memory, as a thief'},{id:'enc',text:'scramble it for good'},{id:'boot',text:'refuse any program but yours'}]);
  hud.scope('memory read-out');G.setKnobs([{label:'—',rate:1}],0,true);
  const rnd=n=>{let x=Math.sin(n*127.1)*43758.5453;return x-Math.floor(x)};
  const mk=()=>{const plain=['lamp remote v1 ..','channel=6 .......','peer=3C:90 ......','wifi=HomeNet ....','pass=horse-battery','sleep=deep ......','wake=button .....'];
    S.lines=plain.map((p,r)=>{const txt=fz.enc?[...p].map((c,i)=>'▒░#?%&@§¤¶~^'[Math.floor(rnd(r*31+i)*12)]).join(''):p;
      return{hex:[...p.slice(0,8)].map((c,i)=>{const v=fz.enc?Math.floor(rnd(r*17+i)*256):c.charCodeAt(0);return HEXD[v>>4]+HEXD[v&15]}).join(' '),txt,hot:!fz.enc&&p.startsWith('pass')}})};
  G.act.read=()=>{if(S.mode==='dump'||S.mode==='dump2'){mk();S.dump=.01;S.dumps++;audio.sfx('probe')}else if(S.mode==='evil'||S.mode==='evil2'){if(fz.boot){S.refused=true;audio.sfx('wrong')}else{S.evil=3;audio.sfx('bite')}}};
  G.act.burn=which=>{S.which=which;S.burn=1;fz[which]=true;save.store();audio.sfx('bite');hud.jolt(.2);G.bloom.strength=1.6;tween(1,k=>G.bloom.strength=.7+1*(1-k))};
  G.thing(W.modHit,{name:'the chip',at:W.halo.position,hold:true,chip:true,on:()=>S.mode!=='intro'&&S.mode!=='wait',click:()=>G.act.read()});
  G.update=dt=>{
    S.t+=dt;if(S.dump>0&&S.dump<1)S.dump=Math.min(1,S.dump+dt/2.2);
    const burning=(S.mode==='burn1'||S.mode==='burn2')&&((G.held&&G.held.chip)||S.botHold);
    if(burning){S.burn=Math.min(1,S.burn+dt/2.2);if(G.frames%6===0)audio.sfx('tick');if(S.burn>=1&&!fz[S.mode==='burn1'?'enc':'boot'])G.act.burn(S.mode==='burn1'?'enc':'boot')}else if(S.burn<1)S.burn=Math.max(0,S.burn-dt);
    if(S.evil>0){S.evil-=dt;W.ledBlue.material.emissiveIntensity=(S.evil*6%1)>.5?5:0}else W.ledBlue.material.emissiveIntensity=0;
    if(S.mode!=='intro'&&S.mode!=='wait')G.beacons[0].at(W.halo.position,.95);else G.beacons[0].hide();
    const g=hud.ctx,w=1040,h=440;g.clearRect(0,0,w,h);g.textBaseline='middle';g.textAlign='left';
    if(S.mode==='burn1'||S.mode==='burn2'){
      g.font=`500 20px ${F}`;g.fillStyle=DIM;g.fillText(S.mode==='burn1'?'fuses that hold the scrambling key':'fuse that says: run only my program',60,80);
      const n=S.mode==='burn1'?8:1,done=fz[S.mode==='burn1'?'enc':'boot'];for(let i=0;i<n;i++){const x=80+i*110,burnt=done||S.burn*n>i+.5;g.strokeStyle=burnt?RED:AMBER;g.lineWidth=5;g.beginPath();g.moveTo(x,170);
        if(burnt){g.lineTo(x+24,170);g.moveTo(x+52,170)}g.lineTo(x+76,170);g.stroke();g.fillStyle=burnt?RED:AMBER;g.fillRect(x-6,160,10,20);g.fillRect(x+72,160,10,20)}
      g.font=`600 22px ${F}`;g.fillStyle=done?RED:PAPER;g.fillText(done?'burned. this cannot be undone.':words('{hold the mouse button down on the chip|press and hold on the chip} to burn'),60,290);
      g.strokeStyle='rgba(232,225,207,.3)';g.strokeRect(60,330,700,22);g.fillStyle=RED;g.fillRect(62,332,696*(done?1:S.burn),18);return}
    if(S.mode==='evil'||S.mode==='evil2'){g.font=`600 26px ${F}`;g.fillStyle=S.refused?GREEN:S.evil>0?RED:PAPER;
      g.fillText(S.refused?'not signed by the owner. refused to start.':S.evil>0?'the thief’s program is running':words('{click|tap} the chip to load the thief’s program'),60,200);return}
    const rows=Math.floor(S.lines.length*S.dump+.001);g.font=`500 21px ${F}`;
    for(let r=0;r<rows;r++){const l=S.lines[r],y=60+r*50;if(l.hot){g.fillStyle='rgba(255,90,77,.22)';g.fillRect(40,y-22,960,44)}g.fillStyle=DIM;g.fillText(l.hex,60,y);g.fillStyle=l.hot?RED:fz.enc?DIM:PAPER;g.fillText(l.txt,540,y)}
    if(!S.dumps){g.fillStyle=PAPER;g.font=`600 22px ${F}`;g.fillText(words('{click|tap} the chip to read its memory'),60,200)}
  };
  await hud.talk(['the remote works. one day you lose it on a bus.','whoever finds it holds your board in their hand, with all the time in the world. play that person.','everything the chip knows is kept in its memory. reading it out takes a cable and a free program. {click|tap} the chip.']);
  S.mode='dump';hud.setHint({text:['{click|tap} the silver chip.'],target:()=>W.halo.position,auto:()=>G.act.read()});
  await flow.until(()=>S.dumps>=1&&S.dump>=1);hud.setHint(null);hud.done('dump');hud.note('dump');
  if(fz.enc)await hud.talk(['scrambled. you burned these fuses the first time you played this station, and they stay burned.','that is the point of them.']);
  else{
    await hud.talk(['your Wi-Fi name and password, in plain letters. the thief now has the key to your house network.','the cure is to scramble the memory with a secret key, so that a read-out gives only noise. but the key has to be kept somewhere a thief cannot read.',
      'the chip has a place: fuses. tiny links inside it that can be burned through, once, and never mended. burned in the right pattern, they are the key, and only the chip’s own insides can sense them.',
      'burning them is permanent. on a real chip there is no undo, and there is none here: it will stay in your save. {hold the mouse button down on the chip|press and hold on the chip} to burn them.']);
    S.mode='burn1';S.burn=0;hud.scope('fuses');hud.setHint({text:['{hold the mouse button down|keep your finger down} on the chip until the bar fills.'],target:()=>W.halo.position,auto:()=>G.act.burn('enc')});
    await flow.until(()=>fz.enc);hud.setHint(null);await flow.sleep(1.2);
    S.mode='dump2';S.dumps=0;S.dump=0;hud.scope('memory read-out');await hud.talk('done, for good. now be the thief again and read the memory.');
    hud.setHint({text:['{click|tap} the chip.'],target:()=>W.halo.position,auto:()=>G.act.read()});await flow.until(()=>S.dumps>=1&&S.dump>=1);hud.setHint(null);
    await hud.talk('noise. the chip unscrambles it as it runs, using a key that never leaves it.');
  }
  hud.done('enc');hud.note('efuse');
  await hud.talk(['the thief has one more idea. if the memory cannot be read, replace it: load a different program, one that does whatever the thief likes with your lamp.','{click|tap} the chip to load it.']);
  S.mode='evil';S.refused=false;hud.scope('the chip starting up');hud.setHint({text:['{click|tap} the chip.'],target:()=>W.halo.position,auto:()=>G.act.read()});
  if(fz.boot){await flow.until(()=>S.refused);hud.setHint(null);await hud.talk('refused. that fuse, too, was burned the first time.')}
  else{
    await flow.until(()=>S.evil>0);hud.setHint(null);await flow.sleep(2.2);
    await hud.talk(['it ran. the chip will run anything it is given.','one more fuse changes that. burn it, and the chip checks a signature on every program before starting it. only programs signed by you will ever run again.','the same warning: this cannot be undone.']);
    S.mode='burn2';S.burn=0;hud.scope('fuses');hud.setHint({text:['{hold the mouse button down|keep your finger down} on the chip until the bar fills.'],target:()=>W.halo.position,auto:()=>G.act.burn('boot')});
    await flow.until(()=>fz.boot);hud.setHint(null);await flow.sleep(1.2);
    S.mode='evil2';S.refused=false;hud.scope('the chip starting up');await hud.talk('now try the thief’s program again.');
    hud.setHint({text:['{click|tap} the chip.'],target:()=>W.halo.position,auto:()=>G.act.read()});await flow.until(()=>S.refused);hud.setHint(null);
  }
  hud.done('boot');S.mode='wait';
  await hud.talk(['refused. the lost remote is now a brick to anyone but you.','an honest note: researchers have broken protections like these on some chips, with a lot of equipment and effort. fuses raise the cost of an attack. they do not make one impossible.']);
  await signOff(G,11,'the fuse','the memory is scrambled with a key held in fuses, and the chip refuses any program you did not sign. both are permanent.',['dump','efuse']);
}

/* ================= station 12 · one press =================
   Nothing to build. You press, and ride the press through everything you made, one step per line. Then at real speed. */
export async function s12(G,flow){
  const {hud,audio,rig}=G,W=G.bench,P=W.power,st=save.data.stats;
  const S=G.state={mode:'intro',presses:0};
  dress(G,true);W.setLamp(false);rig.zoom=true;rig.lim={dmin:3.4,dmax:90,phmin:.25,phmax:1.45};rig.fly({...G.VIEW.board,rate:2});
  hud.slip('station 12 · one press',[{id:'ride',text:'press once, and follow it'},{id:'real',text:'press again, at real speed'}]);
  G.act.press=()=>{if(S.mode==='ready'||S.mode==='real'){S.presses++;audio.sfx('click');rig.shake=.08}};
  G.thing(W.btnHit,{name:'the button',at:W.btnPos,on:()=>S.mode==='ready'||S.mode==='real',click:()=>G.act.press()});
  G.update=()=>{if(S.mode==='ready'||S.mode==='real')G.beacons[0].at(W.btnPos.clone().setY(TOP+.05),.4);else G.beacons[0].hide()};
  const ring=(mesh,from,reach,dur)=>{mesh.position.copy(from);return tween(dur,k=>{mesh.scale.setScalar(.3+k*reach);mesh.material.opacity=.9*(1-k*k)},ease.lin)};
  await hud.talk(['there is nothing left to build.','when this began, you pressed a button and nothing happened. press it now. then keep your hands off, and follow the press.']);
  S.mode='ready';hud.setHint({text:['{click|tap} the button at the corner of the board.'],target:()=>W.btnPos,auto:()=>G.act.press()});
  await flow.until(()=>S.presses>=1);hud.setHint(null);S.mode='ride';
  rig.fly({t:new THREE.Vector3(-1.6,.4,.8),d:4.6,th:.3,ph:.8,rate:2});
  await hud.talk('the contacts touch, and bounce. the chip takes the first touch and looks away while they settle. one press, counted once.');
  await tween(.9,k=>P.btn=k,ease.lin);
  await hud.talk('the press arrives on a pin. a moment ago the chip was in deep sleep, drawing almost nothing. the pin wakes it.');
  rig.fly({t:new THREE.Vector3(1.4,.5,0),d:5,th:.4,ph:.8,rate:2});W.halo.material.opacity=.8;
  await hud.talk('inside, a job is waiting for exactly this. it stands highest, so one of the two cores drops what it was doing and takes it within a tick.');
  W.regMat.emissiveIntensity=2;rig.fly({t:new THREE.Vector3(-.2,.4,-.4),d:5,th:.2,ph:.75,rate:2});
  await hud.talk('the job asks the radio to speak. that takes a gulp of power, and the tank beside the chip covers it while the regulator catches up. the chip does not blink.');
  W.regMat.emissiveIntensity=0;W.antMat.emissiveIntensity=4;rig.fly({t:new THREE.Vector3(2.4,.5,0),d:5,th:.55,ph:.8,rate:2});
  await hud.talk('the antenna shakes. the message leaves as bits, a million a second, with a check on the end, addressed from your board.');
  rig.fly({...G.VIEW.room,rate:2});audio.sfx('zap');ring(W.ring,W.antPos,92,2.2);await flow.sleep(1.6);W.antMat.emissiveIntensity=0;
  await hud.talk('it crosses the room on the channel both boards agreed on, through everybody else’s noise.');
  W.farLed.material.emissiveIntensity=3;
  await hud.talk('the listener hears it. the check adds up. the address is yours. it obeys.');
  W.setLamp(true);audio.sfx('fanfare');G.bloom.strength=1.5;tween(2,k=>G.bloom.strength=.7+.9*(1-k));ring(W.ring2,W.farPos,92,1.6);
  await hud.talk(['and it sends a receipt back, so your board knows.','all of that, every station you built, takes a few thousandths of a second.']);
  hud.done('ride');P.btn=0;W.halo.material.opacity=0;
  W.setLamp(false);W.farLed.material.emissiveIntensity=3;
  await hud.talk('the lamp is off again. now do it the way it is meant to be done, at full speed. press.');
  S.mode='real';const p=S.presses;hud.setHint({text:['{click|tap} your board.'],auto:()=>G.act.press()});
  const hit=new THREE.Mesh(new THREE.BoxGeometry(9,4,6));hit.visible=false;hit.position.set(0,1,0);W.root.add(hit);flow.until(()=>false).catch(()=>W.root.remove(hit));G.thing(hit,{on:()=>S.mode==='real',click:()=>G.act.press()});
  await flow.until(()=>S.presses>p);hud.setHint(null);audio.sfx('zap');ring(W.ring,W.antPos,92,.35);await flow.sleep(.12);W.setLamp(true);audio.sfx('ok');hud.done('real');await flow.sleep(1.4);
  await hud.talk(['one press. one lamp. no wire.','and nothing in between that you do not understand.']);
  mark(G,12);
  await hud.page(`<h2>one press</h2><p>thirteen stations, from a dead board to a lamp across the room.</p>
    <h3>along the way</h3><div class="nums"><div><b>${st.resets}</b>restarts you caused</div><div><b>${save.data.notes.length}</b>notebook pages</div><div><b>${st.handMisses||0}</b>jobs late, by hand</div></div>
    <h3>what you built</h3><ul>${STATIONS.map((n,i)=>`<li>${String(i).padStart(2,'0')} · ${n}</li>`).join('')}</ul><button class="sign">back to the bench &rarr;</button>`);
  G.go('roam');
}
