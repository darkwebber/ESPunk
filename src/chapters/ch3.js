import * as THREE from 'three';
import {tween,ease,save} from '../core/util.js';
import {Sched,HAND_TASKS,BATON_TASKS} from '../sim/sched.js';
import {TASKS,CORE,NOWZ,LANE0,U} from '../world/stage.js';
import {NOTES} from '../core/hud.js';

/* Station 3 · one core. Hold a task to give it the core. The clock speeds up until no hand can keep pace; then the
   riser comes up and standing order becomes the rule. The time knob is the clock: turn it and the chip runs.
   You can always reach in and hold a task yourself, and that is how the last problem gets solved. */
const IDS=TASKS.map(t=>t.id),CSS=Object.fromEntries(TASKS.map(t=>[t.id,t.css]));
const HAND=[[1.5,6],[1.05,8],[.72,10],[.48,12],[.32,14]];          // [seconds per tick, ticks]
const JOB={BUTTON:'watch the button',RADIO:'keep the radio alive',LOGGER:'write the log'};
const TAP='click';   // hud rewords this for touch
const SLACK={BUTTON:0,RADIO:3,LOGGER:3};
const WDT=8,F='"Paper Mono",ui-monospace,monospace';
const CLOCK=[{label:'stopped',rate:0,warp:1e-4},{label:'1 tick / s',rate:1,warp:1e-3},{label:'10 ticks / s',rate:10,warp:1e-2},{label:'1000 ticks / s · full speed',rate:1000,warp:1}];

function drawTimeline(G,S){
  const g=G.hud.ctx,w=1040,h=440,L=150,R=w-18,T=64,rowH=108,N=36,cw=(R-L)/N,sim=S.sim;
  g.clearRect(0,0,w,h);g.textBaseline='middle';
  g.font=`600 20px ${F}`;g.textAlign='left';g.fillStyle='#e8e1cf';g.fillText(S.head||'',L,24);
  IDS.forEach((id,r)=>{g.font=`600 19px ${F}`;g.fillStyle=CSS[id];g.textAlign='left';g.fillText(id,10,T+r*rowH+rowH/2-8);g.strokeStyle='rgba(232,225,207,.1)';g.lineWidth=1;g.strokeRect(L,T+r*rowH+8,R-L,rowH-26)});
  if(!sim)return;
  const log=sim.log,from=Math.max(0,log.length-N+1);
  for(let i=from;i<log.length;i++){
    const e=log[i],x=L+(i-from)*cw;
    if(e.t%5===0){g.fillStyle='#8a877f';g.textAlign='center';g.font=`500 15px ${F}`;g.fillText(e.t,x+cw/2,T-10)}
    IDS.forEach((id,r)=>{
      const y=T+r*rowH+8,hh=rowH-26;
      if(e.run===id){g.fillStyle=CSS[id];g.shadowColor=CSS[id];g.shadowBlur=10;g.fillRect(x+1.5,y,cw-3,hh);g.shadowBlur=0;if(e.hand){g.fillStyle='#07090a';g.fillRect(x+cw/2-3,y+hh/2-3,6,6)}}
      else if(e.blocked.includes(id)){g.save();g.beginPath();g.rect(x+1,y,cw-2,hh);g.clip();g.strokeStyle='#e8e1cf';g.lineWidth=2;g.beginPath();for(let k=-hh;k<cw;k+=9){g.moveTo(x+k,y+hh);g.lineTo(x+k+hh,y)}g.stroke();g.restore()}
      else if(e.ready.includes(id)){g.fillStyle=CSS[id]+'44';g.fillRect(x+1.5,y+hh-12,cw-3,12)}
      if(e.released.includes(id)){g.fillStyle='#e8e1cf';g.beginPath();g.moveTo(x+1,y-7);g.lineTo(x+13,y-7);g.lineTo(x+1,y+7);g.fill()}
      if(e.late.includes(id)){g.strokeStyle='#ff5a4d';g.lineWidth=5;g.beginPath();g.moveTo(x+6,y+8);g.lineTo(x+cw-6,y+hh-8);g.moveTo(x+cw-6,y+8);g.lineTo(x+6,y+hh-8);g.stroke()}
    });
  }
  const x=L+(log.length-from)*cw;if(x<R-2&&S.frac!=null){g.fillStyle='rgba(232,225,207,.16)';g.fillRect(x,T,cw*S.frac,rowH*3-18);g.strokeStyle='#e8e1cf';g.lineWidth=1.5;g.strokeRect(x,T,cw,rowH*3-18)}
  g.font=`500 15px ${F}`;g.fillStyle='#8a877f';g.textAlign='right';g.fillText('▮ ran   ▂ waiting   ▨ waiting for the baton   ✕ late',R,h-14);
}

export async function ch3(G,flow){
  const {hud,audio,rig}=G,W=G.stage,st=save.data.stats;
  const S=G.state={phase:'hand',round:0,lane:null,jobs:new Map(),sim:null,run:null,last:null,keyHeld:null,over:null,inherit:false,chip:false,rescued:false,handLate:0,answered:0,frac:null,head:'',acc:0,bites:0,tickLen:0,tickT:0};
  await G.dive(async()=>{
    G.showStage();rig.zoom=true;rig.lim={dmin:16,dmax:44,phmin:.4,phmax:1.3};rig.jump({t:new THREE.Vector3(1.2,0,3.6),d:30,th:0,ph:.68,stage:true});
    for(const id of IDS)W.lanes[id].visible=false;W.setSlabs([]);W.coreX=0;
    W.rise=0;W.baton.visible=false;W.dog.visible=false;W.chip.visible=false;W.socket.visible=false;W.batonHolder=null;W.chip.position.copy(W.chipHome);
    for(const id of IDS){W.tasks[id].prio=1;W.tasks[id].st='sleep';W.tasks[id].target=W.home(W.tasks[id],1)}
  });
  G.stageSpeed=7;hud.scope('core 0 · who ran');
  hud.slip('station 05 · one core',[{id:'hand',text:'give every job the core, by hand'},{id:'rule',text:'rank the tasks so a rule does it'},{id:'inv',text:'find out why BUTTON starves'},{id:'inh',text:'make your fix a rule'}]);
  hud.tag('core',()=>new THREE.Vector3(W.coreG.position.x,.2,CORE.z+1.9),'the core','bare');hud.tag('core1',W.core1,'core 1<small>station 06</small>','bare faint');

  const place=(id,prio)=>{const t=W.tasks[id];if(prio!==undefined)t.prio=prio;t.target=W.home(t,t.prio)};
  const mark=(sim,e)=>{for(const id of e.late){const k=sim.by[id];S.jobs.set(id+':'+(k.due-k.deadline),'late')}if(e.run){const k=sim.by[e.run],key=e.run+':'+(k.due-k.deadline);if(k.st==='sleep'&&!S.jobs.has(key))S.jobs.set(key,'done');W.coreX=W.tasks[e.run].x}};
  /* the bars on the lanes: every job in view, how long it may wait, and how much work it still needs */
  function slabs(){
    const sim=S.sim,list=[];if(!sim||S.phase==='done'||S.phase==='pause'){W.setSlabs(list);return}
    const fr=S.frac||0,tn=sim.t+fr,look=(NOWZ-LANE0)/U;let sv=null;
    /* who has the core during the tick now in progress: the lane you chose, or whoever the rule picks */
    if(!sim.bite&&(S.phase==='hand'||S.run)){sim.release();const el=sim.eligible(),h=S.phase==='hand'?S.lane:held();
      sv=h&&sim.by[h]&&el.includes(sim.by[h])?h:S.phase==='hand'?null:(sim.pick()||{}).id||null;if(sv&&S.phase!=='hand')W.coreX=W.tasks[sv].x}
    for(const k of sim.tasks){const t=W.tasks[k.id];if(!t.mesh.visible)continue;
      for(let r=k.offset+Math.max(0,Math.ceil((tn-k.deadline-1-k.offset)/k.period))*k.period;r<tn+look;r+=k.period){
        const end=r+k.deadline,stt=S.jobs.get(k.id+':'+r),cur=k.st==='ready'&&k.due-k.deadline===r,rem=stt==='done'?0:cur?Math.max(0,k.rem-(sv===k.id?fr:0)):r>=sim.t?k.work:0,a=Math.max(r,tn);
        list.push({x:t.x,color:t.color,t0:r-tn,t1:end-tn,h0:a-tn,h1:Math.min(a+rem,Math.max(end,a+.05))-tn,late:stt==='late'||(rem>0&&a+rem>end+.02),done:stt==='done'||rem<=0})}}
    W.setSlabs(list);
  }
  function label(id,sim){
    const t=W.tasks[id],k=sim&&sim.by[id];let s=S.phase==='hand'?JOB[id]:S.phase==='rule'?(SLACK[id]?'can wait '+SLACK[id]+' ticks':'cannot wait'):'priority '+t.prio;
    if(k&&S.phase!=='hand'&&sim.waitingOnBaton(k))s='waiting for the baton';
    hud.tag('t_'+id,()=>t.mesh.position,`<span style="color:${t.css}">${id}</span><small>${s}</small>`,'',-26);
  }
  /* show the simulation on the stage; e is the tick that just ran, or null for "about to run" */
  function show(sim,e,quiet){
    for(const id of IDS){const k=sim.by[id],t=W.tasks[id];
      t.st=e&&e.run===id?'run':sim.waitingOnBaton(k)?'wait':k.st==='ready'?'ready':'sleep';
      if(e&&e.late.includes(id)){t.flash=1;if(!quiet)audio.sfx('miss')}
      place(id);label(id,sim)}
    W.batonHolder=sim.holder?sim.holder.id:null;
    if(W.dog.visible&&sim.watch){W.dogLevel=1-Math.min(1,sim.by[sim.watch].waited/sim.wdt);const n=Math.round(W.dogLevel*WDT);hud.tag('dog',()=>W.dog.position,'watchdog<small>'+'▮'.repeat(n)+'▯'.repeat(WDT-n)+'</small>','red bare',-44)}
    if(e&&e.run&&!quiet)audio.sfx('take',sim.by[e.run].prio);
  }
  /* which task the player is holding right now: pointer or keys 1 2 3 */
  const held=()=>{const k=['1','2','3'].findIndex(c=>G.keys.has(c));if(k>=0)return IDS[k];if(S.over)return S.over;const t=G.held;return t&&t.task||null};

  /* ===== 1 · by hand ===== */
  G.setKnobs([{label:'clock',rate:1}],0,true);G.holdMode=true;
  G.act.hold=id=>{if(S.phase==='hand')S.lane=id;else S.over=id};   // for keyboard-free testing
  G.act.lane=id=>{if(S.phase!=='hand'||!id||!W.tasks[id].mesh.visible||S.lane===id)return;S.lane=id;audio.sfx('take',IDS.indexOf(id));hud.idle=0};
  G.act.key=k=>{const vis=IDS.filter(id=>W.tasks[id].mesh.visible),i=vis.indexOf(S.lane);if('123'.includes(k))G.act.lane(IDS[+k-1]);else if(k==='arrowleft'||k==='a')G.act.lane(vis[Math.max(0,i-1)]);else if(k==='arrowright'||k==='d')G.act.lane(vis[Math.min(vis.length-1,i+1)])};
  for(const id of IDS)G.thing(W.lanes[id],{task:id,hold:true,on:()=>S.phase!=='done'&&W.lanes[id].visible});
  for(const id of IDS)G.thing(W.tasks[id].mesh,{task:id,hold:true,on:()=>S.phase!=='done'&&W.tasks[id].mesh.visible,dragOn:()=>S.phase==='rule'&&!S.run,
    drag:{move(r){const h=r.intersectObjects(W.steps)[0];if(h)G.act.setPrio(id,h.object.userData.prio)},end(){}}});
  G.update=dt=>{
    if(S.tickLen){S.tickT+=dt;S.frac=Math.min(1,S.tickT/S.tickLen)}
    if(S.phase==='hand'&&G.held&&G.held.task)G.act.lane(G.held.task);
    if(S.phase==='hand'&&S.lane)W.coreX=W.tasks[S.lane].x;
    if(S.phase==='hand'&&S.sim){const h=S.lane,el=S.sim.eligible();
      for(const id of IDS){const t=W.tasks[id],k=S.sim.by[id],can=!!k&&el.includes(k);if(!k&&t.mesh.visible){t.st='ready';place(id);continue}t.st=can&&h===id?'run':can?'ready':'sleep';place(id)}}
    if(S.run)advance(dt);
    slabs();drawTimeline(G,S);
  };
  /* the jobs arrive one at a time, each with a reason to exist */
  for(const id of IDS)W.tasks[id].mesh.visible=false;
  const intro=async(id,lines)=>{W.tasks[id].mesh.visible=true;W.lanes[id].visible=true;W.tasks[id].st='ready';audio.sfx('probe');label(id,null);await hud.talk(lines)};
  async function round(defs,plan){
    const sim=S.sim=new Sched({tasks:defs});S.round++;S.jobs=new Map();
    for(const[len,n]of plan){
      G.knob.label=(1/len).toFixed(1)+' ticks / s';hud.refresh();audio.sfx('dial');
      for(let i=0;i<n;i++){
        sim.release();for(const id of IDS)if(sim.by[id])label(id,sim);S.tickLen=len;S.tickT=0;
        await flow.sleep(len);
        const h=S.lane,e=sim.step(h&&sim.by[h]&&sim.eligible().includes(sim.by[h])?h:null);e.hand=true;mark(sim,e);S.handLate+=e.late.length;if(e.run==='BUTTON')S.answered++;
        for(const id of e.late){W.tasks[id].flash=1;audio.sfx('miss')}if(e.run)audio.sfx('take',IDS.indexOf(e.run));audio.sfx('tick');
        S.head=`by hand · tick ${sim.t} · late ${S.handLate}`;
      }
    }
    S.tickLen=0;S.frac=null;
  }
  await hud.talk(['you are inside the chip now.','it has one worker, called a core. a core does one job at a time.','until now your program had one job: watch the button, switch the light. real programs have several jobs at once, and yours is about to.',
    'the instrument keeps a record here: one row for each job, one column for each moment. a filled cell means that job had the core then.']);
  await intro('BUTTON',['the first job: watch the button. the moment you press, this job has to run. if it waits, the lamp lights late.','each job has a lane. work for it arrives as a bar, sliding down the lane toward the white line.','the hexagon on the line is the core. work only gets done while the core is standing in that lane as the bar crosses the line.',`${TAP} a lane to move the core there. it stays until you move it. catch the bars.`]);
  hud.setHint({text:[`${TAP} the lane a bar is coming down, before the bar reaches the white line.{ keys 1 2 3 and the arrow keys also move the core.|}`,'a bar that crosses the line with the core somewhere else turns red: that job was late.']});
  await round([{id:'BUTTON',prio:1,period:3,work:1,deadline:1,offset:1}],[[1.6,8]]);
  await intro('LOGGER',['a second job, in its own lane: write a log, notes for whoever has to debug this later.','its bars have a pale tail. the bright part is the work. the tail is how long that work can wait. the core can catch it anywhere along the tail.','the button’s bars have no tail at all: it cannot wait. and the core can still only be in one lane.']);
  await round([{id:'BUTTON',prio:1,period:4,work:1,deadline:1,offset:1},{id:'LOGGER',prio:1,period:3,work:1,deadline:3,offset:0}],[[1.4,9]]);
  await intro('RADIO',['a third job: keep the radio link to the lamp alive. its bars are twice as long: twice the work each time.','and the lanes start to speed up, toward the pace a real chip keeps.']);
  await round(HAND_TASKS([1,1,1]),HAND.slice(1));
  S.tickLen=0;S.frac=null;S.phase='pause';st.handMisses=S.handLate;save.store();G.holdMode=false;
  for(const id of IDS){W.tasks[id].st='sleep';place(id)}
  hud.done('hand');hud.note('tick');hud.setHint(null);
  await hud.talk([`${S.handLate} bars went red. each red bar in the button’s lane is a lamp that lit late.`,'and that was three bars a second. a real chip handles a thousand a second. nobody can move the core by hand at that pace.','so you stop moving it, and write down who goes first instead.']);

  /* ===== 2 · the riser: standing order is the rule ===== */
  rig.fly({t:new THREE.Vector3(1.2,2.2,-.6),d:38,th:0,ph:.8,rate:1.6,stage:true});
  audio.sfx('power');await tween(1.6,k=>{W.rise=k;for(const id of IDS)place(id)},ease.io);
  S.phase='rule';S.sim=null;S.head='stopped · turn the knob to run';
  for(let p=0;p<4;p++)hud.tag('step'+p,W.stepLabel(p),p===3?'most important':p===0?'least important':'','bare faint');
  for(const id of IDS){W.tasks[id].st='ready';place(id);label(id,null)}
  G.act.setPrio=(id,p)=>{if(S.phase!=='rule'||S.run||W.tasks[id].prio===p)return;place(id,p);label(id,null);audio.sfx('step');hud.idle=0};
  G.setKnobs(CLOCK,0,false);hud.wantKnob(true);
  /* the knob is the clock: off "stopped" starts a run, back to "stopped" ends it */
  G.onKnob=i=>{hud.wantKnob(false);if(i===0){if(S.run)finish(true)}else if(!S.run&&(S.phase==='rule'||S.phase==='trial'))start()};
  function start(){
    const trial=S.phase==='trial';
    const s=trial?new Sched({tasks:BATON_TASKS(),watch:'BUTTON',wdt:WDT,inherit:S.inherit}):new Sched({tasks:HAND_TASKS(IDS.map(id=>W.tasks[id].prio))});
    S.sim=s;S.jobs=new Map();S.last=null;S.acc=0;S.run={sim:s,N:1000,hand:false,rescue:false,inherit:S.inherit};audio.sfx('click');
  }
  function advance(dt){
    const r=S.run,s=r.sim;S.acc+=dt*G.rate();let n=Math.min(80,Math.floor(S.acc));S.acc-=n;if(S.acc>80)S.acc=0;const quiet=n>2;G.stageSpeed=quiet?22:7;
    S.frac=G.rate()<=10?S.acc:null;
    while(n-->0){
      const h=held();let choice;                                // a held task overrides the rule for that tick
      if(h){s.release();if(s.eligible().includes(s.by[h])){choice=h;r.hand=true;if(s.holder&&s.holder.id===h&&s.tasks.some(k=>s.waitingOnBaton(k)))r.rescue=true}}
      const e=s.step(choice);if(!e)break;if(choice)e.hand=true;mark(s,e);show(s,e,quiet);if(!quiet)audio.sfx('tick');
      if(S.demo&&e.late.includes('BUTTON'))return finish(false);
      if(s.bite||s.t>=r.N||(r.rescue&&s.t>=20&&!S.rescued&&S.phase==='trial'))return finish(false);
    }
    if(quiet&&G.frames%4===0)audio.sfx('tick');
    S.head=`tick ${s.t} · late ${s.total()}`+(r.hand?' · with your hand in it':'');
  }
  function finish(stopped){
    const r=S.run,s=r.sim,m=s.misses(),tot=s.total();S.run=null;S.demo=false;G.stageSpeed=7;S.frac=null;
    S.last={bite:s.bite,total:tot,misses:m,full:s.t>=r.N,stopped,hand:r.hand,rescue:r.rescue&&!s.bite&&s.t>=20,inherit:r.inherit,ticks:s.t};
    if(s.bite){S.bites++;st.resets++;save.store();audio.sfx('bite');hud.jolt();rig.shake=.7;W.dogLevel=0}else if(!stopped)audio.sfx(tot?'wrong':'ok');
    S.head=`${s.t} ticks · `+(s.bite?'watchdog reset':tot?IDS.filter(id=>m[id]).map(id=>`${id} late ${m[id]}`).join(' · '):'nobody late');
    for(const id of IDS){W.tasks[id].st='ready';place(id);label(id,null)}W.batonHolder=null;
    if(G.knob.i!==0){G.knob.i=0;audio.warp(Math.log10(CLOCK[0].warp));hud.refresh()}
  }
  const ranks=()=>{G.act.setPrio('BUTTON',3);G.act.setPrio('RADIO',2);G.act.setPrio('LOGGER',1)};
  await hud.talk(['from here on the core moves by itself. it needs a rule for which lane to stand in.','start with the fairest rule there is: nobody is more important than anybody else, so the jobs take turns. watch what that does to the button.']);
  S.demo=true;G.setKnob(2);
  S.last=null;await flow.until(()=>S.last);hud.tag('why',()=>new THREE.Vector3(W.tasks.BUTTON.x,.3,NOWZ-.7),'late','red');
  await hud.talk(['there. a red bar in the button’s lane: a lamp that lit late.','the core was not idle. it was in another lane, taking its fair turn, at the one moment the button needed it.',
    'look at the bars. the radio’s and the log’s have long pale tails: they can wait several ticks. the button’s has none. it cannot wait at all.','so fairness is the wrong rule. the job that can wait least has to come first.',
    'the steps at the back are an order of importance. the core always goes to the job standing highest, and drops whatever it was doing. jobs on the same step still take turns.',
    'all three stand on the same step now. drag BUTTON to the top step. then turn the knob to run the lanes again.']);
  hud.untag('why');for(const id of IDS)label(id,null);
  hud.setHint({text:['press on BUTTON at the back, and drag it up to the top step. then turn the knob on the instrument{, or press E|}.','BUTTON cannot wait, so it must stand highest. the other two can share a step.'],target:()=>W.tasks.BUTTON.mesh.position,auto:()=>{ranks();G.setKnob(3)}});
  for(;;){
    S.last=null;await flow.until(()=>S.last);const L=S.last;
    if(L.full&&!L.total&&!L.hand)break;
    if(L.total){const worst=IDS.reduce((a,b)=>L.misses[a]>=L.misses[b]?a:b);hud.say(`${worst} was late ${L.misses[worst]} times in ${L.ticks} ticks. it cannot wait that long. stand it higher.`,9)}
    else if(L.hand&&L.full)hud.say('nobody late, but your hand was in it. let go and run it again.',8);
    else hud.say('nobody late so far. a pass is the full thousand ticks: turn the knob all the way up.',8);
    hud.wantKnob(true);
  }
  hud.done('rule');hud.note('rule');hud.setHint(null);
  await hud.talk(['a thousand ticks, nobody late, and you touched nothing.','that standing order is called priority. the part of the chip that applies it, every tick, is called the scheduler.']);

  /* ===== 3 · the baton ===== */
  S.phase='trial';S.sim=null;S.head='stopped · turn the knob to run';
  W.tasks.BUTTON.prio=3;W.tasks.RADIO.prio=2;W.tasks.LOGGER.prio=1;for(const id of IDS){place(id);label(id,null)}
  W.baton.visible=true;W.dog.visible=true;W.dogLevel=1;W.socket.visible=true;audio.sfx('unlock');
  hud.tag('baton',()=>W.baton.position,'the baton<small>only its holder may use the wire</small>','amber');hud.tag('dog',()=>W.dog.position,'watchdog<small>'+'▮'.repeat(WDT)+'</small>','red bare',-44);
  await hud.talk(['one more thing real programs do: share.','the button job and the log both send text down the same wire. two at once would garble it.','so there is a baton. only the job holding it may use the wire, and it keeps the baton until it has finished.','the ring with eyes is a watchdog: a timer that restarts the chip if a job is stuck too long. run the clock.']);
  hud.wantKnob(true);hud.setHint({text:['turn the knob to run the clock.'],auto:()=>G.setKnob(3)});
  const rescueHint={text:['run it at 1 tick / s and watch the lanes. the button’s bar reaches the line, but it cannot be served: the log is holding the baton.','when the core jumps to the radio lane, reach in: press and hold on the LOGGER lane, so the log can finish and let go of the baton.'],target:()=>W.tasks.LOGGER.mesh.position,
    auto:()=>{G.setKnob(1);S.over='LOGGER';tween(5.2,()=>{}).then(()=>{S.over=null})}};
  for(let first=true;;first=false){
    S.last=null;await flow.until(()=>S.last);const L=S.last;
    if(L.rescue)break;
    if(L.bite){hud.note('wdt');
      hud.say(first?'the chip restarted. a watchdog timer does that when a job is stuck too long, and the button job waited eight ticks. your order is right, and it still starved. slow the clock and watch who it waits for.'
        :'starved again. the button job waits for the baton. the log holds the baton but cannot finish, because the radio job outranks it and keeps the core. you can still hold a job yourself.',11)}
    else hud.say('no reset this time, but you stopped early. BUTTON has to get through the whole cycle.',7);
    hud.setHint(rescueHint);hud.wantKnob(true);
  }
  S.rescued=true;hud.done('inv');hud.note('inv');hud.setHint(null);
  W.chip.visible=true;audio.sfx('unlock');tween(.8,k=>{W.chip.position.y=W.chipHome.y+2*(1-k)},ease.out);
  hud.tag('chip',()=>W.chip.position,'lend priority<small>what you just did, as a rule</small>','');
  await hud.talk(['that worked. you let the log finish first, so it could pass the baton on.','as a rule: while an important job waits for the baton, whoever holds the baton borrows that importance.','engineers call it priority inheritance. here it is as a chip you can fit.']);
  G.act.fit=async()=>{if(S.chip||S.run)return;S.chip=true;S.inherit=true;audio.sfx('cap');const a=W.chip.position.clone();await tween(.5,k=>W.chip.position.lerpVectors(a,W.chipIn,k),ease.io);rig.shake=.15;hud.tag('chip',()=>W.chip.position,'lend priority<small>fitted</small>','');hud.wantKnob(true)};
  G.thing(W.chip,{on:()=>!S.chip&&!S.run,click:()=>G.act.fit()});
  hud.setHint({text:['click the green chip to fit it into the socket by the baton.','then run the clock at full speed, hands off.'],target:()=>W.chip.position,auto:async()=>{await G.act.fit();G.setKnob(3)}});
  for(;;){
    S.last=null;await flow.until(()=>S.last);const L=S.last;
    if(L.inherit&&L.full&&!L.bite&&!L.total&&!L.hand)break;
    hud.say(!L.inherit?'the chip is not fitted yet. click it.':L.bite?'still bitten.':L.hand?'it holds with your hand in it. let go and run again.':'it holds so far. run the full thousand ticks.',7);hud.wantKnob(true);
  }

  /* ===== station alive ===== */
  S.phase='done';hud.done('inh');hud.note('inh');hud.setHint(null);hud.wantKnob(false);save.data.done[5]=true;save.store();hud.refresh();audio.music.grow();audio.sfx('fanfare');
  for(const id of IDS)W.tasks[id].st='run',W.tasks[id].target=W.home(W.tasks[id],W.tasks[id].prio);
  G.bloom.strength=1.5;tween(2,k=>{W.wave.scale.setScalar(.5+k*13);W.wave.material.opacity=1-k;G.bloom.strength=.7+.9*(1-k)},ease.out);
  await flow.sleep(2.6);
  await hud.page(`<h2>station 05 · one core</h2>
    <p>highest ready priority runs. equals take turns. a held baton lends its holder the rank of whoever is waiting for it.</p>
    <h3>your shift</h3><div class="nums"><div><b>${st.handMisses}</b>jobs late, by hand</div><div><b>0</b>late in 1000 ticks, by rule</div><div><b>${S.bites}</b>watchdog resets</div></div>
    <h3>now in your notebook</h3><ul>${['tick','rule','wdt','inv','inh'].map(i=>`<li>${NOTES[i].t}</li>`).join('')}</ul>
    <button class="sign">back to the bench &rarr;</button>`);
  await G.dive(async()=>{G.showBench();hud.clearTags();hud.scope(null);G.rig.jump(G.VIEW.board)});
  if(0)await hud.page(`<h2>end of the slice</h2>
    <p>three stations of thirteen are built. the button lights a light, the board can shout across the room, and the chip can keep three jobs on time. next: something at the lamp to listen.</p>
    <h3>so far</h3><div class="nums"><div><b>${st.resets}</b>resets you caused</div><div><b>${save.data.notes.length}</b>notebook pages</div><div><b>03 / 13</b>stations built</div></div>
    <button class="sign">back to the bench &rarr;</button>`);
  G.go('roam');
}
