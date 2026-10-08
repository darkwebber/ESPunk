import * as THREE from 'three';
import {tween,ease,clamp,save,box,mat} from '../core/util.js';
import {TOP} from '../world/bench.js';
import {dress} from '../chapters/ch0.js';
import {enterDeck,clock,lanePick,restart,signOff} from './kit.js';
import {T as words} from '../core/hud.js';

const F='"Paper Mono",ui-monospace,monospace',PAPER='#e8e1cf',DIM='#8a877f',AMBER='#ffb347',RED='#ff5a4d',GREEN='#9be7a8',MAG='#ff5fd2',CYAN='#5fe3ff';
const CLOCK=[{label:'stopped',rate:0},{label:'2 ticks / s',rate:2},{label:'12 ticks / s',rate:12},{label:'1000 ticks / s · full speed',rate:1000}];

/* ================= station 06 · two cores =================
   More work than one core has time for: no ordering can save it. The second core can. Then two cores writing one
   number at the same instant lose an update, until a lock makes them take turns for that step. */
const JOBS=[{id:'BUTTON',name:'watch the button',color:0x5fe3ff,p:6,w:1,d:1,o:2,prio:3},{id:'RADIO',name:'keep the radio alive',color:0xff5fd2,p:4,w:2,d:4,o:0,prio:2},{id:'LOGGER',name:'write the log',color:0xffb347,p:4,w:2,d:4,o:1,prio:1}];
export async function s06(G,flow){
  const {hud,audio}=G,D=G.deck;
  const S=G.state={t:0,mode:'intro',core:[0,0,0],two:false,lock:false,run:null,late:0,want:0,got:0,last:null,lane:null,view:'late'};
  await enterDeck(G,JOBS,10);
  hud.slip('station 06 · two cores',[{id:'see',text:'watch one core drown'},{id:'split',text:'share the work between two cores'},{id:'lock',text:'make the count come out right'}]);
  hud.scope('core 0 and core 1');G.setKnobs(CLOCK,0,true);
  let J;const reset=()=>{J=JOBS.map(j=>({...j,rem:0,due:1e9,rel:-1,bad:false}));S.t=0;S.acc=0;S.late=0;S.want=0;S.got=0;S.runs=[null,null];S.jobs=new Map()};reset();
  /* decide who runs during tick t: each core takes its most important ready job; with the lock, two writers never overlap */
  const begin=t=>{
    J.forEach((j,i)=>{if(t>=j.o&&(t-j.o)%j.p===0){j.rem=j.w;j.due=t+j.d;j.rel=t;j.bad=false}});
    const pick=c=>{let b=-1;J.forEach((j,i)=>{if(j.rem>0&&S.core[i]===c&&(b<0||j.prio>J[b].prio))b=i});return b};
    let r=[pick(0),S.two?pick(1):-1];
    const writes=i=>i>=0&&i!==1&&J[i].rem===1;                       // BUTTON and LOGGER add one to the shared number as they finish
    if(writes(r[0])&&writes(r[1])){if(S.lock)r[1]=-1;else{S.got--}}  // same instant: with no lock one addition is lost
    for(const i of r)if(i>=0){if(writes(i)){S.want++;S.got++}J[i].rem--;if(J[i].rem===0)S.jobs.set(i+':'+J[i].rel,'done')}
    J.forEach((j,i)=>{if(j.rem>0&&t+1>=j.due&&!j.bad){j.bad=true;S.late++;S.jobs.set(i+':'+j.rel,'late');if(S.rate()<20)audio.sfx('miss')}});
    S.runs=r;if(S.rate()<20)audio.sfx('tick');
  };
  S.rate=()=>S.demo?6:G.rate();
  const stop=()=>{S.last={late:S.late,want:S.want,got:S.got,ticks:S.t,full:S.t>=1000};S.run=null;S.demo=false;if(G.knob.i!==0){G.knob.i=0;hud.refresh()}audio.sfx(S.last.late||S.last.want!==S.last.got?'wrong':'ok')};
  const start=()=>{reset();S.last=null;S.run=true;begin(0)};
  G.onKnob=i=>{hud.wantKnob(false);if(i===0){if(S.run)stop()}else if(!S.run)start()};
  G.act.move=i=>{if(S.mode!=='split'||S.run)return;S.core[i]=1-S.core[i];audio.sfx('step');hud.idle=0};
  G.act.fit=()=>{if(S.mode!=='lock'||S.lock||S.run)return;S.lock=true;audio.sfx('cap');hud.tag('chip',D.chips[0].position,'lock · fitted','')};
  lanePick(G,S,i=>S.mode==='split'&&!S.run,i=>G.act.move(i));G.thing(D.chips[0],{on:()=>D.chips[0].visible&&!S.lock,click:()=>G.act.fit()});
  G.update=dt=>{
    if(S.run){clock(S,dt,S.rate(),t=>{begin(t+1)});if(S.t>=(S.demo?20:1000))stop()}
    const tn=S.t+(S.run?S.frac:0),bars=[];
    J.forEach((j,i)=>{for(let r=j.o+Math.max(0,Math.ceil((tn-j.d-1-j.o)/j.p))*j.p;r<tn+8;r+=j.p){const st=S.jobs.get(i+':'+r),cur=j.rel===r,rem=st==='done'?0:cur?j.rem:r>S.t?j.w:0,a=Math.max(r,tn),late=st==='late';
      bars.push({lane:i,t0:r-tn,t1:r+j.d-tn,color:late?0xff5a4d:j.color});if(rem>0)bars.push({lane:i,t0:a-tn,t1:a+rem-tn,color:late?0xff5a4d:j.color,solid:true})}});
    D.bars(bars);D.mark(0,S.runs[0]>=0&&S.runs[0]!=null?S.runs[0]:null);D.mark(1,S.two&&S.runs[1]>=0&&S.runs[1]!=null?S.runs[1]:null);
    JOBS.forEach((j,i)=>hud.tag('lane'+i,D.head(i),`${j.id}<small>${j.name}${S.two?' · core '+S.core[i]:''}</small>`,''));
    const g=hud.ctx,w=1040,h=440;g.clearRect(0,0,w,h);g.textBaseline='middle';g.textAlign='left';
    if(S.view==='late'){g.font=`500 20px ${F}`;g.fillStyle=DIM;g.fillText('ticks run',80,110);g.fillText('jobs late',560,110);g.font=`200 150px ${F}`;g.fillStyle=PAPER;g.fillText(S.t,80,250);g.fillStyle=S.late?RED:GREEN;g.fillText(S.late,560,250)}
    else{g.font=`500 20px ${F}`;g.fillStyle=DIM;g.fillText('things that happened',80,110);g.fillText('the number in memory',560,110);g.font=`200 150px ${F}`;g.fillStyle=PAPER;g.fillText(S.want,80,250);g.fillStyle=S.want===S.got?GREEN:RED;g.fillText(S.got,560,250)}
    g.font=`500 19px ${F}`;g.fillStyle=DIM;g.fillText(S.run?'running':'stopped · turn the knob to run',80,390);
  };
  await hud.talk(['your program has grown. the radio job and the log both do twice the work they used to.','the button still stands highest, so the core still goes to it first. watch what happens to the other two.']);
  S.demo=true;start();await flow.until(()=>S.last);hud.done('see');
  await hud.talk([`${S.last.late} jobs late in twenty ticks, and the order was right.`,'no ordering can fix this. add it up: there is more work arriving than one core has time to do. something will always be late.',
    'but this chip has been holding something back. it has two cores. the second has done nothing so far.','every job is on core 0. {click|tap} a job’s lane to move it to core 1. then turn the knob to run the clock.']);
  S.two=true;S.mode='split';G.knob.locked=false;hud.refresh();hud.wantKnob(true);
  hud.setHint({text:['{click|tap} a lane to move that job to the other core. then turn the knob.','the two heavy jobs should not share a core.'],auto:()=>{S.core=[0,0,1];G.setKnob(3)}});
  for(;;){S.last=null;await flow.until(()=>S.last);if(S.last.full&&!S.last.late)break;
    hud.say(S.last.late?`${S.last.late} late. one of the cores still has more than it can do. move a job across and run again.`:'nobody late so far. run the full thousand ticks: turn the knob all the way up.');hud.wantKnob(true)}
  hud.done('split');hud.note('cores');hud.setHint(null);
  await hud.talk(['a thousand ticks and nobody late. two cores really do work at the same instant.','which causes a new kind of trouble. the button job and the log both keep count of what they have done, in the same place in memory.',
    'to add one, a job reads the number, adds one, and writes it back. run it again, and compare what happened with what memory says.']);
  S.view='count';S.mode='count';hud.scope('one number, two writers');hud.wantKnob(true);hud.setHint({text:['turn the knob to run the clock.'],auto:()=>G.setKnob(3)});
  S.last=null;await flow.until(()=>S.last&&S.last.full);hud.setHint(null);
  await hud.talk([`${S.last.want} things happened. memory says ${S.last.got}.`,'now and then both cores do it at the very same instant. both read 41. both add one. both write 42. two things happened, and the number went up by one.',
    'nothing crashed and nothing looked wrong, which is what makes this kind of bug so nasty.','the cure is a lock: whoever is changing the number holds the lock, and the other waits the instant it takes. fit it.']);
  S.mode='lock';D.chips[0].visible=true;hud.tag('chip',D.chips[0].position,'a lock','');
  hud.setHint({text:['{click|tap} the green chip at the left, then run the clock.'],target:()=>D.chips[0].position,auto:()=>{G.act.fit();G.setKnob(3)}});
  for(;;){S.last=null;await flow.until(()=>S.last);if(S.lock&&S.last.full&&S.last.want===S.last.got&&!S.last.late)break;hud.say(!S.lock?'the lock is not fitted yet. {click|tap} the green chip.':'run the full thousand ticks.');hud.wantKnob(true)}
  hud.done('lock');
  await hud.talk('every addition counted, and still nobody late. it is the same baton as before, doing a new job.');
  await signOff(G,6,'two cores','the work is split across both cores so nothing is late, and a lock keeps two cores from changing one number at the same instant.',['cores','race']);
}

/* ================= station 07 · buses =================
   The chip talks to other chips down wires. On a serial wire both ends must agree on the speed. On a shared bus
   every device has an address, and nothing is said until the right one answers. */
const BAUD=[9600,19200,57600,115200,230400],TEXT='presses: 3';
export async function s07(G,flow){
  const {hud,audio,rig}=G,W=G.bench;
  const S=G.state={mode:'intro',bi:0,part:1,temp:null,shown:null,log:[],calls:0,t:0,autoT:0};
  dress(G,true);rig.zoom=true;rig.lim={dmin:3.4,dmax:80,phmin:.25,phmax:1.45};rig.fly({t:new THREE.Vector3(.4,.3,-1.4),d:10,th:.1,ph:.7,rate:2});
  hud.slip('station 07 · buses',[{id:'baud',text:'make the display readable'},{id:'call',text:'show the temperature'}]);
  /* two small parts on the desk, wired to the board */
  const extra=new THREE.Group();W.root.add(extra);flow.until(()=>false).catch(()=>W.root.remove(extra));
  const disp=box(1.9,.2,1.1,mat(0x10131a,{roughness:.4}),-1.2,.1,-3.3),glass=box(1.6,.03,.8,new THREE.MeshStandardMaterial({color:0x05070a,emissive:0x5fe3ff,emissiveIntensity:.5}),-1.2,.21,-3.3);
  const sens=box(.9,.2,.9,mat(0x3a1f5a,{roughness:.5}),2,.1,-3.3);sens.visible=false;extra.add(disp,glass,sens);
  const wire=(a,b)=>{const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color:0xd4a94a}));extra.add(l);return l};
  wire(new THREE.Vector3(-1.2,.25,-2.75),new THREE.Vector3(-.6,TOP,-1.27));const w2=wire(new THREE.Vector3(2,.25,-2.85),new THREE.Vector3(.4,TOP,-1.27));w2.visible=false;
  const dPos=new THREE.Vector3(-1.2,.4,-3.3),sPos=new THREE.Vector3(2,.4,-3.3);
  const garble=(s,i)=>i===3?s:[...s].map((c,k)=>'▒░#?%&@§¤¶~^'[(c.charCodeAt(0)*(i+3)+k*7)%12]).join('');
  hud.scope('the display');G.setKnobs(BAUD.map(b=>({label:b+' bits / s',rate:1})),0,true);G.onKnob=i=>{S.bi=i;hud.wantKnob(false);audio.sfx('tick')};
  G.act.call=who=>{
    if(S.mode!=='call')return;S.calls++;audio.sfx('probe');hud.idle=0;
    if(who==='sensor'){S.temp=23;S.log=['chip: number 76, are you there?','sensor: here.','sensor: 23 degrees.']}
    else{S.shown=S.temp;S.log=['chip: number 3C, are you there?','display: here.',S.temp==null?'chip: …nothing to tell you yet.':'chip: show “23 °C”.']}
  };
  G.thing(disp,{name:'the display',at:dPos,on:()=>S.mode==='call',click:()=>G.act.call('display')});G.thing(sens,{name:'the sensor',at:sPos,on:()=>S.mode==='call'&&sens.visible,click:()=>G.act.call('sensor')});
  G.update=dt=>{
    S.t+=dt;hud.tag('disp',dPos,'the display'+(S.part===2?'<small>number 3C</small>':''),'cyan');if(sens.visible)hud.tag('sens',sPos,'a temperature sensor<small>number 76</small>','');
    const g=hud.ctx,w=1040,h=440;g.clearRect(0,0,w,h);g.textBaseline='middle';g.textAlign='left';
    if(S.part===1){
      g.font=`300 76px ${F}`;g.fillStyle=S.bi===3?CYAN:RED;g.fillText(garble(TEXT,S.bi),60,110);
      /* why: the chip's bits against the moments the display looks */
      const L=60,R=w-40,bitW=(R-L)/10*BAUD[3]/BAUD[S.bi],bits=[0,1,0,1,1,0,0,1,0,1,1,0,1,0,0,1,1,0,1,0,1,1,0,0,1,0,1,0,0,1,1,0,1,1,0,1,0,0,1,0];
      g.font=`500 17px ${F}`;g.fillStyle=DIM;g.fillText('what the chip sends',L,206);g.fillText('when the display looks',L,372);
      for(let i=0;i<bits.length&&L+i*bitW<R;i++){g.fillStyle=bits[i]?AMBER:'rgba(232,225,207,.1)';g.fillRect(L+i*bitW+1,226,Math.min(bitW,R-L-i*bitW)-2,54)}
      for(let k=0;k<10;k++){const x=L+(k+.5)*(R-L)/10,i=Math.floor((x-L)/bitW),mid=Math.abs(((x-L)/bitW)%1-.5)<.26&&S.bi===3;g.strokeStyle=S.bi===3?GREEN:RED;g.lineWidth=3;g.beginPath();g.moveTo(x,292);g.lineTo(x,340);g.stroke();g.beginPath();g.arc(x,346,6,0,7);g.fillStyle=g.strokeStyle;g.fill()}
    }else{
      g.font=`300 76px ${F}`;g.fillStyle=CYAN;g.fillText(S.shown==null?'-- °C':S.shown+' °C',60,110);
      g.font=`500 17px ${F}`;g.fillStyle=DIM;g.fillText('on the wires',60,206);g.font=`500 22px ${F}`;S.log.forEach((l,i)=>{g.fillStyle=l.startsWith('chip')?AMBER:PAPER;g.fillText(l,60,250+i*40)});
    }
    if(S.mode==='auto'){S.autoT+=dt;if(S.autoT>1.1){S.autoT=0;S.temp=23+((S.calls++)%3===2?1:0);S.shown=S.temp;S.log=['chip: number 76?  sensor: '+S.temp+' degrees.','chip: number 3C?  display: here.','chip: show “'+S.temp+' °C”.'];audio.sfx('tick')}}
  };
  await hud.talk(['a remote with a tiny screen would be nice: something to show how many times you have pressed.','screens come as separate parts with a chip of their own. yours is wired to the board. the board sends it letters down that wire, one bit after another.','the instrument is the display’s screen for now. it is showing rubbish.']);
  await hud.talk(['there is only one wire for the bits, and nothing else: no signal to say “a bit starts now.”','so the display counts time by itself, and looks at the wire once per bit. the red marks are when it looks. the amber blocks are what the chip sends.',
    'they do not line up. your board is sending slowly, and the display is looking fast, so it reads some bits several times over.','the knob sets how fast your board sends. turn it until the display looks once at the middle of every bit.']);
  S.mode='baud';G.knob.locked=false;hud.refresh();hud.wantKnob(true);hud.setHint({text:['turn the knob and watch the marks under the blocks.','one mark per block: 115200 bits a second.'],auto:()=>G.setKnob(3)});
  await flow.until(()=>S.bi===3);await flow.sleep(.8);hud.done('baud');hud.note('baud');hud.setHint(null);G.onKnob=null;G.knob.locked=true;hud.refresh();
  await hud.talk(['“presses: 3”. both ends now agree on the speed, and that is the only thing that was wrong.','this kind of wire is called a serial port. it is how the board talks to your computer, too.','one wire per part gets crowded fast. so here is a second part, sharing with the display: a temperature sensor.']);
  S.part=2;S.mode='call';sens.visible=true;w2.visible=true;audio.sfx('unlock');hud.scope('the display');G.setKnobs([{label:'shared bus',rate:1}],0,true);
  await hud.talk(['on a shared bus every part hears everything. so each part has a number, and stays silent until it hears its own.','the chip calls a number, waits for that part to answer, and only then do the two of them talk.','put the temperature on the display. {click|tap} a part to have the chip call its number.']);
  hud.setHint({text:['the display can only show what the chip already knows. ask the sensor first.','{click|tap} the sensor, then {click|tap} the display.'],target:()=>S.temp==null?sPos:dPos,auto:()=>{G.act.call('sensor');G.act.call('display')}});
  await flow.until(()=>S.shown===23);hud.done('call');hud.note('i2c');hud.setHint(null);
  await hud.talk(['ask the sensor, then tell the display. two calls, down the same pair of wires.','the chip can do that a few thousand times a second. once a second is plenty.']);
  S.mode='auto';await flow.sleep(3.6);hud.untag('disp');hud.untag('sens');
  await signOff(G,7,'buses','the board now talks to other chips: a serial wire where both ends agree on the speed, and a shared bus where each part answers to its own number.',['baud','i2c']);
}

/* ================= station 08 · wi-fi =================
   Everybody shares one channel. You send in the gaps by hand, then let the chip listen first; then two of your own
   devices, following the same rule, start at the same instant, until each waits a random moment. */
const busy=t=>{const k=((t%16)+16)%16;return k<3||k===9||k===10||k===15};
export async function s08(G,flow){
  const {hud,audio}=G,D=G.deck;
  const S=G.state={clear:()=>!busy(S.t+1)&&!busy(S.t+2),t:0,mode:'intro',rate:0,listen:false,rnd:false,phone:false,seed:7,ok:0,lost:0,frames:[],me:null,ph:null,wait:[-1,-1],hist:[]};
  await enterDeck(G,[{name:'everyone else',color:0x8a8f9a},{name:'your board',color:0xff5fd2},{name:'your phone',color:0x5fe3ff}],9);
  hud.slip('station 08 · wi-fi',[{id:'hand',text:'get three messages through by hand'},{id:'listen',text:'make the board listen first'},{id:'rnd',text:'stop your own devices colliding'}]);
  hud.scope('channel 6');G.setKnobs([{label:'—',rate:1}],0,true);hud.untag('lane2');
  const rand=()=>{S.seed=(S.seed*1103515245+12345)&0x7fffffff;return(S.seed>>8)%4};
  const sending=who=>S.frames.find(f=>f.who===who&&f.end>S.t);
  /* a message takes two ticks; it is lost if anything else is on the channel during either of them */
  const send=(who,at)=>{S.frames.push({who,start:at,end:at+2,bad:false})};
  const begin=t=>{
    for(const f of S.frames)if(f.end===t&&!f.done){f.done=true;S.hist.push(f.bad?0:1);if(f.who===1){if(f.bad){S.lost++;audio.sfx('miss')}else{S.ok++;audio.sfx('ok')}}}
    /* every message announces how long it will take, so a listener knows whether the silence is long enough for its own */
    const idle=!busy(t)&&!busy(t+1)&&!S.frames.some(f=>f.start<=t&&f.end>t);
    for(const who of[1,2]){if(who===2&&!S.phone)continue;if(who===1&&!S.listen)continue;if(sending(who)||S.frames.some(f=>f.who===who&&f.start>=t))continue;
      if(!idle){S.wait[who-1]=-1;continue}                               // channel busy: wait for silence and start over
      if(S.wait[who-1]<0)S.wait[who-1]=S.rnd?rand():0;
      if(S.wait[who-1]===0){send(who,t);S.wait[who-1]=-1}else S.wait[who-1]--}
    for(const f of S.frames)if(f.start<=t&&f.end>t&&(busy(t)||S.frames.some(o=>o!==f&&o.start<=t&&o.end>t)))f.bad=true;
    if(S.rate<20)audio.sfx('tick');S.frames=S.frames.filter(f=>f.end>t-12);
  };
  G.act.send=()=>{if(S.mode!=='hand'||S.listen||sending(1)||S.frames.some(f=>f.who===1&&f.start>S.t))return;send(1,S.t+1);audio.sfx('take',2);hud.idle=0};
  G.act.fit=k=>{if(k===0&&S.mode==='listenfit'&&!S.listen){S.listen=true;audio.sfx('cap');hud.tag('chip0',D.chips[0].position,'listening first','')}
    if(k===1&&S.mode==='rndfit'&&!S.rnd){S.rnd=true;audio.sfx('cap');hud.tag('chip1',D.chips[1].position,'waiting a random moment','amber')}};
  D.chips.forEach((c,k)=>G.thing(c,{on:()=>c.visible,click:()=>G.act.fit(k)}));D.hit.forEach(m=>G.thing(m,{on:()=>S.mode==='hand',click:()=>G.act.send()}));
  G.act.key=k=>{if(k===' ')G.act.send()};
  G.update=dt=>{
    clock(S,dt,S.rate,t=>begin(t+1));const tn=S.t+S.frac,bars=[];
    for(let t=Math.floor(tn)-1;t<tn+8.5;t++)if(busy(t))bars.push({lane:0,t0:t-tn,t1:t+1-tn,color:0x8a8f9a,solid:true});
    for(const f of S.frames)if(f.end>tn-1.2)bars.push({lane:f.who,t0:f.start-tn,t1:f.end-tn,color:f.bad?0xff5a4d:f.who===1?0xff5fd2:0x5fe3ff,solid:true});
    D.bars(bars);D.mark(0,sending(1)?1:null);D.mark(1,S.phone&&sending(2)?2:null);
    const g=hud.ctx,w=1040,h=440;g.clearRect(0,0,w,h);g.textBaseline='middle';g.textAlign='left';g.font=`500 20px ${F}`;g.fillStyle=DIM;g.fillText('got through',80,110);g.fillText('lost',560,110);
    g.font=`200 150px ${F}`;g.fillStyle=GREEN;g.fillText(S.ok,80,250);g.fillStyle=S.lost?RED:PAPER;g.fillText(S.lost,560,250);
    g.font=`500 19px ${F}`;g.fillStyle=DIM;g.fillText(S.mode==='hand'?words('{click|tap} to send · a message takes two ticks'):'your board’s messages',80,390);
  };
  await hud.talk(['the lamp works from the button. now you want to switch it from your phone as well, from anywhere in the house.','that is what Wi-Fi is for. but Wi-Fi is one shared space: your board, your phone, the laptop, the neighbours, all on the same channel.',
    'two messages at once on one channel destroy each other. so everything depends on taking turns.','the grey bars are other people’s messages. yours takes two ticks. {click|tap} to send it, and find a gap long enough.']);
  S.mode='hand';S.rate=1.3;hud.setHint({text:['send just as a grey bar finishes crossing the line, when you can see a gap of at least two ticks behind it.'],auto:()=>{S.ok=3}});
  await flow.until(()=>S.ok>=3);hud.done('hand');hud.setHint(null);S.rate=0;
  await hud.talk(['three through. but you could see the traffic coming. a radio cannot see the future.','all a radio can do is listen to the channel right now. so the rule is: listen first, and only talk into silence. fit the green chip.']);
  S.mode='listenfit';D.chips[0].visible=true;hud.tag('chip0',D.chips[0].position,'listen before talking','');hud.setHint({text:['{click|tap} the green chip at the left.'],target:()=>D.chips[0].position,auto:()=>G.act.fit(0)});
  await flow.until(()=>S.listen);hud.setHint(null);S.ok=0;S.lost=0;S.frames=[];S.rate=6;await flow.until(()=>S.ok>=5);S.rate=0;hud.done('listen');
  await hud.talk(['the board waits for silence, then sends. nothing lost.','now add your phone. it follows exactly the same rule. watch what two polite devices do.']);
  S.phone=true;hud.tag('lane2',D.head(2),'your phone','');S.ok=0;S.lost=0;S.frames=[];S.rate=5;await flow.until(()=>S.lost>=3);S.rate=0;
  await hud.talk(['every single one lost.','both waited for silence. both heard the silence begin at the same instant. both started talking at the same instant.',
    'the cure is odd and it works: when the silence comes, each device waits a little longer, a random amount. whoever picked the shorter wait goes first, and the other hears it and holds back.','fit the amber chip.']);
  S.mode='rndfit';D.chips[1].visible=true;hud.tag('chip1',D.chips[1].position,'wait a random moment','amber');hud.setHint({text:['{click|tap} the amber chip at the left.'],target:()=>D.chips[1].position,auto:()=>G.act.fit(1)});
  await flow.until(()=>S.rnd);hud.setHint(null);S.ok=0;S.lost=0;S.frames=[];S.rate=6;await flow.until(()=>S.ok>=8);S.rate=0;hud.done('rnd');hud.note('csma');
  await hud.talk(['mostly clean. now and then two devices pick the same wait and collide, and then they simply try again with a longer one.','one more thing about Wi-Fi: nothing goes straight from phone to board. everything goes to the router first, and the router passes it on.',
    'that is how a phone anywhere can reach your lamp. it is also why this path is slower than the direct shout you built in station 03.']);
  await signOff(G,8,'wi-fi','your board shares a crowded channel politely: it listens first, then waits a random moment, so the phone can reach the lamp through the router.',['csma','router']);
}

/* ================= station 09 · bluetooth =================
   Seven channels instead of one. The link hops between them in a known order; you follow by hand until it is too
   fast; then Wi-Fi sits on three of the channels and eats every hop that lands there, until you strike them out. */
const HOPS=[3,6,1,4,0,5,2,4,1,6,3,0,2,5];
export async function s09(G,flow){
  const {hud,audio}=G,D=G.deck;
  const S=G.state={next:()=>hop(S.t+1),t:0,mode:'intro',rate:0,lane:3,auto:false,wifi:false,bad:[0,0,0,0,0,0,0],hits:0,streak:0,lost:0,hist:[]};
  await enterDeck(G,[1,2,3,4,5,6,7].map(n=>({name:n===1?'channel 1':n===7?'7':String(n),color:0x5fe3ff})),13);
  hud.slip('station 09 · bluetooth',[{id:'hand',text:'follow the hops by hand'},{id:'auto',text:'let the chip hop'},{id:'map',text:'strike out the bad channels'}]);
  hud.scope('hops that arrived');G.setKnobs([{label:'—',rate:1}],0,true);
  const hop=t=>{const ok=[0,1,2,3,4,5,6].filter(i=>!S.bad[i]),h=HOPS[((t%14)+14)%14];return ok.includes(h)?h:ok[(h+t)%ok.length]};   // struck channels are skipped
  const blocked=(l,t)=>S.wifi&&l>=2&&l<=4&&((t%8)+8)%8<5;
  const begin=t=>{const want=hop(t),at=S.auto?want:S.lane,ok=at===want&&!blocked(want,t);if(S.auto)S.lane=want;
    S.hist.push(ok?1:0);if(S.hist.length>40)S.hist.shift();if(ok){S.hits++;S.streak++;if(S.rate<20)audio.sfx('take',want)}else{S.lost++;S.streak=0;if(S.rate<20)audio.sfx('miss')}};
  const pick=lanePick(G,S,i=>S.mode==='hand'||S.mode==='map',i=>{if(S.mode==='map'){S.bad[i]=S.bad[i]?0:1;if(S.bad.filter(b=>!b).length<2)S.bad[i]=0;D.dim(i,S.bad[i]);S.streak=0;audio.sfx('step')}});
  G.act.key=k=>{if(S.mode==='hand')pick.key(k)};G.act.lane=i=>pick.set(i);
  G.act.fit=()=>{if(S.mode!=='autofit'||S.auto)return;S.auto=true;audio.sfx('cap');hud.tag('chip0',D.chips[0].position,'hopping by itself','')};
  G.thing(D.chips[0],{on:()=>D.chips[0].visible,click:()=>G.act.fit()});
  G.update=dt=>{
    if(S.mode==='hand')pick.held();clock(S,dt,S.rate,t=>begin(t+1));const tn=S.t+S.frac,bars=[];
    for(let t=Math.floor(tn);t<tn+8.5;t++){bars.push({lane:hop(t),t0:t-tn,t1:t+1-tn,color:0x5fe3ff,solid:true})}
    if(S.wifi)for(let t=Math.floor(tn/8)*8-8;t<tn+9;t+=8)bars.push({lane:2,w:3,t0:t-tn,t1:t+5-tn,color:0xff5a4d});
    D.bars(bars);D.mark(0,S.lane);for(let i=0;i<7;i++)if(S.mode==='map'||S.bad[i])hud.tag('x'+i,D.now(i),S.bad[i]?'struck out':'','red bare',26);
    const g=hud.ctx,w=1040,h=440;g.clearRect(0,0,w,h);g.textBaseline='middle';g.textAlign='left';g.font=`500 20px ${F}`;g.fillStyle=DIM;g.fillText('the last forty hops',60,70);
    S.hist.forEach((v,i)=>{g.fillStyle=v?GREEN:RED;g.fillRect(60+i*23,110,17,120)});
    g.font=`300 60px ${F}`;g.fillStyle=PAPER;g.fillText(`${S.streak} in a row`,60,320);g.font=`500 19px ${F}`;g.fillStyle=DIM;g.fillText(S.wifi?'red band: Wi-Fi using channels 3, 4 and 5':'no Wi-Fi nearby',60,395);
  };
  await hud.talk(['Wi-Fi needs a router. out in the garden there is none, and you would still like your phone to work the lamp.','phones have a second radio for exactly this: Bluetooth. it uses the same air as Wi-Fi, in a very different way.',
    'Wi-Fi picks one wide channel and stays on it. Bluetooth cuts the air into many narrow channels, seven here, and never stays on one. it jumps to a new channel for every message.','both ends know the order of the jumps. the blue bars show it. {click|tap} a lane to move there before each bar lands.']);
  S.mode='hand';S.rate=.85;hud.setHint({text:['{click|tap} the lane the next blue bar is in, before it reaches the white line.{ keys 1 to 7 also work.|}'],auto:()=>{S.hits=8}});
  await flow.until(()=>S.hits>=8);hud.done('hand');hud.note('hop');hud.setHint(null);S.rate=0;
  await hud.talk(['that was under one hop a second. a real link makes 1600 hops a second.','try a handful.']);
  S.hits=0;S.lost=0;S.rate=5;await flow.until(()=>S.lost>=6);S.rate=0;
  await hud.talk('hopeless by hand, and trivial for a chip: both ends work out the next channel from the same formula. fit the green chip.');
  S.mode='autofit';D.chips[0].visible=true;hud.tag('chip0',D.chips[0].position,'let the chip hop','');hud.setHint({text:['{click|tap} the green chip at the left.'],target:()=>D.chips[0].position,auto:()=>G.act.fit()});
  await flow.until(()=>S.auto);hud.setHint(null);S.streak=0;S.hist=[];S.rate=8;await flow.until(()=>S.streak>=20);hud.done('auto');S.rate=0;
  await hud.talk(['every hop lands. why bother hopping at all? because of what happens next.','someone in the house starts a video. their Wi-Fi sits on a wide slice of the air: channels 3, 4 and 5 here.']);
  S.wifi=true;S.streak=0;S.hist=[];S.rate=8;await flow.sleep(6);S.rate=0;
  await hud.talk(['every hop that lands under the red band is lost. but only those. a radio that stayed on one channel would have lost everything.','it can do better still. it can notice which channels keep failing, and stop using them. the order of hops then skips straight over them.',
    'strike out the bad channels: {click|tap} a lane to cross it off. then watch.']);
  S.mode='map';S.rate=8;S.streak=0;hud.setHint({text:['{click|tap} the lanes the red band covers: 3, 4 and 5.','{click|tap} a struck lane again to bring it back.'],auto:()=>{S.bad=[0,0,1,1,1,0,0];for(let i=0;i<7;i++)D.dim(i,S.bad[i]);S.streak=0}});
  await flow.until(()=>S.streak>=30);S.rate=0;hud.done('map');hud.note('afh');hud.setHint(null);for(let i=0;i<7;i++)hud.untag('x'+i);
  await hud.talk(['thirty in a row, with Wi-Fi blaring next to it.','inside this chip, Wi-Fi and Bluetooth even share the one antenna. they take turns on it, thousands of times a second, and each stays out of the other’s way like this.']);
  await signOff(G,9,'bluetooth','the link hops between channels in an order both ends know, and strikes out the ones that Wi-Fi is sitting on.',['hop','afh'],`<div><b>${S.bad.filter(b=>b).length}</b>channels struck out</div>`);
}
