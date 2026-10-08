import * as THREE from 'three';
import {tween,ease,clamp,save} from '../core/util.js';
import {Rail,RAIL,CAPS,CAP_LABEL,SCRIPT,drawAt,capture} from '../sim/rail.js';
import {TOP} from '../world/bench.js';
import {NOTES,T as words} from '../core/hud.js';
import {dress,cascade} from './ch0.js';

/* Station 1 · a voice. The lamp is out of reach of any wire, so the chip must shout by radio. You turn the shout up
   yourself, and at the loudness that would reach the lamp the board blacks out. The oscilloscope shows why; you take
   the regulator's place to feel why; a capacitor buys time; then you tune the regulator until it copes alone. */
const TANK={c100n:'tiny tank',c10u:'small tank',c22u:'medium tank',c100u:'large tank'};
const HAND_RATE=25e-6,AMAX=.6,F='"Paper Mono",ui-monospace,monospace';
const LOUD=[{label:'silent',rate:1},{label:'whisper',rate:1},{label:'quiet',rate:1},{label:'talking',rate:1},{label:'loud',rate:1},{label:'shout',rate:1}];
const REACH=[0,6,15,32,55,96],USE=[80,105,140,200,290,450];
const GAINS=[.3,.5,.7,1,1.4,2,3,4,6,8],HOW=g=>g<.7?'very gently':g<1.4?'gently':g<3?'firmly':g<6?'hard':'very hard';
/* how long a tank keeps the chip above the red line through a shout if nobody pours more, in the slow motion of the hand game */
const react=id=>((RAIL.C0+(id?CAPS[id]:0))*(RAIL.VSET-RAIL.VBO)/(RAIL.I_TX-RAIL.I_IDLE)/HAND_RATE);
/* read a captured trace the way an engineer would */
const judge=c=>c.fault==='brownout'?{short:'falls under the red line',say:'the line fell under the red and the chip restarted. make the regulator react harder, or fit a bigger tank.'}:
  c.fault?{short:'shoots over 3.9 V',say:'it overreacted and shot past what the chip survives. make it react more gently, or fit a bigger tank.'}:
  c.max>RAIL.HI?{short:`wobbles up to ${c.max.toFixed(2)} V · too rough`,say:'the chip stays up, but the line wobbles above the green band. react more gently, or fit a bigger tank to calm it.'}:
  c.min<RAIL.LO?{short:`dips to ${c.min.toFixed(2)} V · too close`,say:'the chip stays up, but the line dips below the green band. reacting harder would pull it back sooner.'}:
  {ok:true,short:`clean · lowest ${c.min.toFixed(2)} V`,say:''};
const plane=new THREE.Plane(),hitP=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0);

/* ---------- the instrument's screen ---------- */
function drawScope(G,S){
  const g=G.hud.ctx,w=1040,h=440,L=S.view==='shot'?70:250,R=w-22,T=26,B=h-40,Y=v=>B-(B-T)*(clamp(v,2.1,4.05)-2.1)/(4.05-2.1);
  g.clearRect(0,0,w,h);g.textBaseline='middle';g.lineJoin='round';
  if(S.view==='loud'){
    const mA=USE[S.loud],x0=60,x1=w-60,y0=150,bw=(x1-x0)*mA/500;
    g.font=`500 19px ${F}`;g.fillStyle='#8a877f';g.textAlign='left';g.fillText('power the chip is using',x0,y0-64);
    g.strokeStyle='rgba(232,225,207,.2)';g.lineWidth=1.5;g.strokeRect(x0,y0-30,x1-x0,60);g.fillStyle='#ff5fd2';g.shadowColor='#ff5fd2';g.shadowBlur=14;g.fillRect(x0+4,y0-26,Math.max(2,bw-8),52);g.shadowBlur=0;
    g.font=`300 46px ${F}`;g.fillStyle='#ffb347';g.fillText(S.blown&&S.rebooting?'— restarted —':mA+' mA',x0,y0+86);
    g.font=`500 19px ${F}`;g.fillStyle='#8a877f';g.fillText('thinking',x0,y0+48);g.textAlign='right';g.fillText('shouting',x1,y0+48);
    g.textAlign='left';g.font=`600 22px ${F}`;g.fillStyle='#e8e1cf';g.fillText(S.loud?`the ripples fade after ${(REACH[S.loud]*.04).toFixed(1)} m · the lamp is 3 m away`:'silent · turn the knob to shout',x0,y0+170);
    return;
  }
  const lineAt=(v,col,dash,txt)=>{g.setLineDash(dash);g.strokeStyle=col;g.lineWidth=1.5;g.beginPath();g.moveTo(L,Y(v));g.lineTo(R,Y(v));g.stroke();g.setLineDash([]);if(txt){g.fillStyle=col;g.font=`500 17px ${F}`;g.textAlign='right';g.fillText(txt,R-4,Y(v)-12)}};
  g.fillStyle='rgba(155,231,168,.07)';g.fillRect(L,Y(RAIL.HI),R-L,Y(RAIL.LO)-Y(RAIL.HI));
  lineAt(RAIL.VMAX,'#ff5a4d',[10,8],'3.9 V  too much');lineAt(RAIL.VBO,'#ff5a4d',[10,8],'2.43 V  chip restarts');lineAt(RAIL.VSET,'rgba(232,225,207,.25)',[2,8]);
  g.fillStyle='#8a877f';g.font=`500 17px ${F}`;g.textAlign='right';for(const v of[2.5,3.3,3.6])g.fillText(v.toFixed(1),L-10,Y(v));
  const glow=(col,fn)=>{g.strokeStyle=col;g.shadowColor=col;g.shadowBlur=14;g.lineWidth=3.5;g.beginPath();fn();g.stroke();g.shadowBlur=0};
  if(S.view==='shot'){
    const c=S.shot?S.shot.cap:S.lastShot,p=S.shot?S.shot.p:1,sc=c?c.s:SCRIPT.loop,TT=sc.T,X=t=>L+(R-L)*t/TT;
    g.fillStyle='rgba(255,95,210,.1)';for(const e of sc.ev)g.fillRect(X(e[0]),T,X(e[1])-X(e[0]),B-T);
    g.fillStyle='#8a877f';g.textAlign='left';g.fillText('0',L,h-16);g.textAlign='right';g.fillText(TT*1000+' ms',R,h-16);g.textAlign='center';g.fillStyle='rgba(255,95,210,.8)';g.fillText('radio speaking',X((sc.ev[0][0]+sc.ev[0][1])/2),h-16);
    if(S.mode==='fit'&&!S.shot&&S.preview){const q=S.preview;g.setLineDash([7,7]);g.strokeStyle='rgba(255,179,71,.75)';g.lineWidth=3;g.beginPath();for(let i=0;i<q.t.length;i++){const x=X(q.t[i]),y=Y(q.V[i]);i?g.lineTo(x,y):g.moveTo(x,y)}g.stroke();g.setLineDash([]);
      const j=judge(q);g.textAlign='left';g.font=`600 20px ${F}`;g.fillStyle=j.ok?'#9be7a8':'#ffb347';g.fillText('with this setting: '+j.short,L+8,T+16);return}
    if(c)glow('#ffb347',()=>{let on=false;for(let i=0;i<c.t.length&&c.t[i]<=p*TT;i++){const x=X(c.t[i]),y=Y(c.V[i]);on?g.lineTo(x,y):g.moveTo(x,y);on=true}});
    else glow('#ffb347',()=>{g.moveTo(L,Y(3.3));g.lineTo(R,Y(3.3))});
    g.textAlign='left';g.font=`600 20px ${F}`;g.fillStyle=S.verdict&&S.verdict.ok?'#9be7a8':'#ffb347';g.fillText(S.shot?(S.shot.replay?'replay · slowed down':'capturing'):S.verdict?S.verdict.short:'',L+8,T+16);
    return;
  }
  /* by hand: two bars to match, and the rail scrolling past */
  const bar=(x,val,col,name)=>{const bh=(B-T)*clamp(val/AMAX);g.strokeStyle='rgba(232,225,207,.2)';g.lineWidth=1.5;g.strokeRect(x,T,52,B-T);g.fillStyle=col;g.shadowColor=col;g.shadowBlur=12;g.fillRect(x+4,B-bh,44,bh);g.shadowBlur=0;
    g.fillStyle=col;g.font=`600 17px ${F}`;g.textAlign='center';g.fillText(name,x+26,h-16);g.fillText(Math.round(val*1000),x+26,T-12)};
  bar(26,S.draw??RAIL.I_IDLE,'#ff5fd2','draw');bar(104,S.feed??0,'#ffb347','feed');
  g.fillStyle='#8a877f';g.font=`500 15px ${F}`;g.textAlign='center';g.fillText('mA',91,T-12);
  const n=S.hist.length,N=360;glow('#ffb347',()=>{if(!n){g.moveTo(L,Y(3.3));g.lineTo(R,Y(3.3));return}for(let i=0;i<n;i++){const x=R-(R-L)*(n-1-i)/N,y=Y(S.hist[i]);i?g.lineTo(x,y):g.moveTo(x,y)}});
  const v=S.rail.v;g.textAlign='left';g.font=`300 44px ${F}`;g.fillStyle=v<RAIL.LO||v>RAIL.HI?'#ff5a4d':'#ffb347';g.fillText(v.toFixed(2)+' V',L+10,T+26);
  if(S.mode==='hand'&&S.grace>0){g.font=`600 20px ${F}`;g.fillStyle='#e8e1cf';g.fillText('waiting · match the two bars',L+10,B-18)}
  if(S.mode==='brief'){g.font=`600 20px ${F}`;g.fillStyle='#e8e1cf';g.fillText('waiting for you',L+10,B-18)}
  if(S.mode==='ready'){g.font=`600 20px ${F}`;g.fillStyle='#e8e1cf';g.fillText(words('the regulator is feeding · click it to take over'),L+10,B-18)}
}

export async function ch1(G,flow){
  const {hud,audio,rig}=G,W=G.bench,P=W.power,st=save.data.stats;
  const S=G.state={view:'loud',loud:0,ringT:0,blown:false,mode:'intro',rail:new Rail(0),cap:null,K:1,feed:RAIL.I_IDLE,feedOver:null,draw:RAIL.I_IDLE,hist:[],acc:0,tSim:0,grace:0,assist:1,fails:0,early:0,
    handOK:false,tray:false,shot:null,lastShot:null,verdict:null,shots:0,blink:0,rebooting:false,dragging:false};
  const capC=()=>S.cap?CAPS[S.cap]:0;
  dress(G,true,false);rig.lim={dmin:3.4,dmax:80,phmin:.25,phmax:1.45};rig.zoom=true;rig.jump(G.VIEW.room);
  const [b0,b1,,bm]=G.beacons,TRAYVIEW=()=>rig.portrait()?{t:new THREE.Vector3(2.5,.3,0),d:10.5,th:0,ph:.55}:{t:new THREE.Vector3(.2,.3,1.3),d:10.5,th:.12,ph:.7};W.trayAt(rig.portrait());
  hud.slip('station 01 · a voice',[{id:'loud',text:'turn the shout up'},{id:'hand',text:'feed the chip by hand'},{id:'burst',text:'get it through one shout'},{id:'loop',text:'make the regulator cope alone'},{id:'reach',text:'reach the lamp'}]);

  /* Taking over never starts the clock. The briefing waits for the player, and then the chip stays calm until they
     have actually matched the two bars. Only then does its appetite start to change. */
  G.act.take=async()=>{
    if(S.mode!=='ready'||S.rebooting)return;S.mode='brief';rig.locked=true;audio.sfx('click');hud.setHint(null);
    S.rail=new Rail(capC());S.tSim=0;S.hist=[];S.feedOver=null;S.match=0;rig.fly({t:new THREE.Vector3(.2,.4,-.1),d:7,th:.1,ph:.74});
    if(!S.briefed){S.briefed=true;await hud.talk(['you are the regulator now. two bars on the instrument matter.','the pink bar is how much the chip is drinking. the amber bar is how much you are pouring.',
      '{move the cursor|slide your finger} up the screen to pour more, down to pour less.',
      'pour less than it drinks and the line falls. pour more and it rises. keep the two bars level and the line stays flat.','nothing will happen until you have the bars matched. take your time.'])}
    if(S.mode!=='brief')return;S.mode='hand';S.grace=1;hud.say('match the amber bar to the pink bar to begin.');
  };
  G.act.feed=a=>{S.feedOver=a};
  G.act.cap=id=>{
    if(!S.tray||S.mode==='hand'||S.shot||!W.caps[id])return;
    if(S.cap&&S.cap!==id){const o=W.caps[S.cap];o.mesh.position.copy(o.home)}
    const c=W.caps[id];c.mesh.position.set(W.capPos.x,TOP+c.h/2,W.capPos.z);S.cap=id;S.verdict=null;S.preview=capture(capC(),S.K);audio.sfx('cap');rig.shake=.12;hud.idle=0;
  };
  G.act.gain=k=>{S.K=clamp(k,.2,8);W.pot.rotation.y=-Math.log2(S.K/.2)/Math.log2(40)*4.4;S.verdict=null;S.preview=capture(capC(),S.K);hud.idle=0};
  G.act.fire=()=>{if(S.mode!=='fit'||S.shot||S.rebooting)return;S.shots++;S.verdict=null;S.shot={cap:capture(capC(),S.K),p:0,K:S.K,id:S.cap};audio.sfx('zap');hud.idle=0};
  G.act.key=k=>{if(S.mode==='fit'){if(k==='[')G.act.gain(S.K/1.25);if(k===']')G.act.gain(S.K*1.25);if(k===' ')G.act.fire()}else if(k===' ')G.act.take()};

  G.act.shout=()=>{
    if(S.blown)return;S.blown=true;S.rebooting=true;audio.sfx('zap');
    tween(.45,()=>{}).then(()=>{st.resets++;save.store();audio.sfx('reset');hud.jolt();rig.shake=.6;W.ledRed.material.emissiveIntensity=0;P.level=.05;P.flow=0;S.loud=0;G.knob.i=0;hud.refresh();
      tween(1.4,()=>{}).then(()=>{P.level=1;P.flow=1;W.ledRed.material.emissiveIntensity=3;S.blink=.8;audio.sfx('boot');S.rebooting=false})});
  };

  /* ----- why radio at all ----- */
  await hud.talk(['your button lights the little light on the board. the lamp is over there, across the room.','you could run a wire to it. the whole point is not to.','the chip has another way to reach it: radio.']);
  rig.fly({t:new THREE.Vector3(2.2,.5,0),d:5.2,th:.55,ph:.8,rate:1.6});
  await hud.talk(['this gold zigzag is the antenna. it is nothing but a strip of copper.','the chip pushes electricity back and forth along it, more than two billion times a second.','that shaking does not stay in the copper. it spreads out through the room as a wave, the way ripples spread from a stone dropped in water.','another antenna, over by the lamp, can feel those ripples arrive. that is all radio is. Wi-Fi and Bluetooth work the same way.']);
  hud.note('radio');

  /* ----- per-frame work for the rest of the station ----- */
  const fail=kind=>{
    const inBurst=S.tSim>=SCRIPT.hand.ev[2][0];S.fails++;if(!inBurst&&kind==='brownout')S.early++;if(S.early>=2)S.assist=.65;
    S.mode='ready';S.rebooting=true;rig.locked=false;st.resets++;save.store();audio.sfx('reset');hud.jolt();rig.shake=.6;
    W.antMat.emissiveIntensity=0;W.regMat.emissiveIntensity=0;W.ledRed.material.emissiveIntensity=0;P.level=.05;P.flow=0;
    if(kind==='overvoltage')hud.say('too much. you poured more than it drank and the pressure climbed past what the chip survives. again.',8);
    else if(!inBurst)hud.say('it restarted: you poured less than it drank, and the line fell under the red. pour more when the pink bar jumps.',8);
    else{hud.note('brown');if(!S.tray){S.tray=true;W.tray.visible=true;for(const id in W.caps)W.caps[id].mesh.visible=true;audio.sfx('unlock')}
      hud.say(S.cap?'still too fast. that tank is too small: it emptied before you could react. try a bigger one.':'that was the shout, and the power was gone before your hand moved. what would help: a small tank of charge right beside the chip, to cover the gulp while you catch up. that part exists. it is called a capacitor. four sizes are in the tray: a bigger tank drains more slowly, and the number on each is how long it would give you to react. right now, with no tank, you get '+react(null).toFixed(1)+' seconds.',13)}
    tween(1,()=>{}).then(()=>{P.level=1;P.flow=1;W.ledRed.material.emissiveIntensity=3;S.blink=.8;audio.sfx('boot');S.rebooting=false;S.rail=new Rail(capC());S.hist=[]});
  };
  const shotEnd=(c,reset)=>{
    S.lastShot=c;S.shot=null;
    const v=S.verdict=judge(c);
    if(reset){S.rebooting=true;st.resets++;save.store();audio.sfx('reset');hud.jolt();rig.shake=.5;W.ledRed.material.emissiveIntensity=0;P.level=.05;P.flow=0;
      tween(1,()=>{}).then(()=>{P.level=1;P.flow=1;W.ledRed.material.emissiveIntensity=3;S.blink=.8;audio.sfx('boot');S.rebooting=false})}
    else{P.level=1;audio.sfx(v.ok?'ok':'wrong')}
    W.antMat.emissiveIntensity=0;if(v.say)hud.say(v.say,9);
  };
  G.update=dt=>{
    if(S.blink>0){S.blink-=dt;W.ledBlue.material.emissiveIntensity=(S.blink*5%1)>.5&&S.blink>0?4:0}
    if(S.mode==='hand'){
      if(G.keys.has('arrowup')||G.keys.has('w'))S.feedOver=clamp((S.feedOver??S.feed)+dt*.35,0,AMAX);
      if(G.keys.has('arrowdown')||G.keys.has('s'))S.feedOver=clamp((S.feedOver??S.feed)-dt*.35,0,AMAX);
      S.feed=S.feedOver??clamp((.86-G.pointer.y)/.7)*AMAX;
      if(S.grace>0){S.draw=RAIL.I_IDLE;S.rail.v=clamp(S.rail.v+(S.feed-S.draw)*dt*2.5+(RAIL.VSET-S.rail.v)*dt*2,2.9,3.7);
        S.match=Math.abs(S.feed-S.draw)<.04?S.match+dt:0;if(S.match>1.5){S.grace=0;audio.sfx('ok');hud.say('good. now keep them matched as the chip gets busy.')}}
      else{const ds=dt*HAND_RATE*S.assist;S.draw=drawAt(SCRIPT.hand,S.tSim);S.rail.step(ds,S.draw,S.feed);S.tSim+=ds}
      P.level=clamp((S.rail.v-2.2)/1.1,.05,1.4);P.feed=S.feed/.25;W.regMat.emissiveIntensity=S.feed*4;W.antMat.emissiveIntensity=S.draw>=RAIL.I_TX?4:0;
      if(!S.handOK&&S.tSim>265e-6){S.handOK=true;hud.done('hand');hud.note('feed')}
      if(S.rail.fault)fail(S.rail.fault);
      else if(S.tSim>=SCRIPT.hand.T){S.mode='won';rig.locked=false;P.level=1;P.feed=1;W.regMat.emissiveIntensity=0;W.antMat.emissiveIntensity=0}
    }else if(S.mode==='brief'){S.draw=RAIL.I_IDLE;S.feed=clamp((.86-G.pointer.y)/.7)*AMAX}   // the bar already follows you while you read
    else{S.feed=S.draw=RAIL.I_IDLE}
    S.acc+=dt;while(S.acc>1/60){S.acc-=1/60;if(S.mode==='hand'||S.mode==='ready'||S.mode==='brief'){S.hist.push(S.mode==='hand'?S.rail.v:RAIL.VSET);if(S.hist.length>360)S.hist.shift()}}
    const B=S.shot;
    if(B){B.p+=dt/(B.replay?9:2.8);const c=B.cap,tt=B.p*c.s.T,i=Math.min(c.V.length-1,Math.floor(B.p*1500));
      P.level=clamp((c.V[Math.min(i,c.V.length-1)]-2.2)/1.1,.05,1.4);W.antMat.emissiveIntensity=drawAt(c.s,tt)>=RAIL.I_TX?4:0;
      if(B.replay){if((c.fault&&tt>=c.at)||B.p>=1){S.lastShot=c;S.shot=null;S.verdict={short:'here the chip restarted'};W.antMat.emissiveIntensity=0;P.level=1}}
      else if(c.fault&&tt>=c.at)shotEnd(c,true);else if(B.p>=1)shotEnd(c,false)}
    if(S.mode==='ready'&&!S.rebooting&&!S.shot&&!(S.tray&&!S.cap))b0.at(W.reg.position.clone().setY(TOP+.2),.6);else b0.hide();
    if(S.tray&&!S.cap&&!S.dragging&&S.mode!=='hand')b1.at(W.capPos.clone().setY(TOP+.03),.4);else b1.hide();
    if(S.mode==='fit'&&!S.shot&&!S.rebooting)bm.at(W.antPos,.55);else bm.hide();
    if(S.tray)for(const id in W.caps){const c=W.caps[id];hud.tag('cap_'+id,c.mesh.position,TANK[id]+'<small>'+(S.mode==='fit'?CAP_LABEL[id]:react(id).toFixed(1)+' s to react')+'</small>',S.cap===id?'amber':'',-8)}
    if(S.mode==='fit')hud.tag('pot',W.potPos,'the trimmer','cyan');
    if(S.mode==='loud'){S.ringT+=dt;const ph=(S.ringT%1.5)/1.5;W.ring.position.copy(W.antPos);W.ring.scale.setScalar(.2+ph*REACH[S.loud]);W.ring.material.opacity=S.loud&&!S.rebooting?.85*(1-ph):0;W.antMat.emissiveIntensity=S.loud&&!S.rebooting?1+S.loud*.7:0;
      if(S.loud)hud.tag('reach',W.antPos,LOUD[S.loud].label,'mag');else hud.untag('reach')}
    drawScope(G,S);
  };


  /* ----- turn it up yourself ----- */
  S.mode='loud';hud.scope('power in use');G.setKnobs(LOUD,0,false);rig.fly({t:new THREE.Vector3(7,3,-26),d:52,th:.42,ph:1.25,rate:1.6,room:true});
  G.onKnob=i=>{hud.wantKnob(false);S.loud=i;S.ringT=0;if(i===5)G.act.shout()};
  await hud.talk(['a louder shout makes ripples that travel further. it also costs more power.','the box in the corner is an instrument. for now it shows one number: how much power the chip is using.','its knob sets how loud the chip shouts. {click the right side of the knob, or press E,|tap the right side of the knob} to turn it up. keep going until the ripples reach the lamp.']);
  hud.wantKnob(true);hud.setHint({text:['the knob is the round dial on the instrument{, bottom right|}.','click its right half five times.'],auto:()=>G.setKnob(5)});
  await flow.until(()=>S.blown&&!S.rebooting);hud.setHint(null);hud.done('loud');hud.untag('reach');G.onKnob=null;G.setKnobs([{label:'—',rate:1}],0,true);
  await hud.talk(['it went dark and started over. the shout never left.','look at what the number did on the way up. a shout that can cross a room takes about five times the power the chip uses just to think.','and the antenna takes it all at once: a gulp. something on the board could not keep up.','to see what, we have to watch electricity move, and it moves far too fast to see. that is what the instrument is really for.']);
  rig.fly({...G.VIEW.board,rate:1.8});S.mode='watch';S.view='shot';hud.scope('volts reaching the chip');
  await hud.talk(['it is called an oscilloscope. it draws one thing: the pressure of the electricity reaching the chip, in volts, as time passes.','left is earlier. right is later. higher is more volts.','right now the line is flat at 3.3 volts. that is a calm, healthy chip.','here is that last shout again, slowed down forty thousand times.']);
  hud.note('scope');G.knob.label='replay';hud.refresh();S.shot={cap:capture(0,1,SCRIPT.one),p:0,replay:true};
  await flow.until(()=>!S.shot);
  await hud.talk(['the pink band is the antenna shouting. the line falls: the chip is being drained faster than it is being refilled.','when the line goes under the red one, the chip cannot think straight any more. so it restarts itself on purpose, rather than make mistakes. engineers call that a brown-out.','the part that should have refilled it is the regulator: the black part that turns the cable’s 5 volts into 3.3.','it was too slow. to feel why, do its job yourself, with time slowed right down.']);
  hud.note('brown');S.view='hand';S.lastShot=null;S.verdict=null;
  hud.scope('volts reaching the chip');G.setKnobs([{label:'time slowed 40,000 ×',rate:HAND_RATE,warp:1e-3}],0,true);S.mode='ready';
  G.thing(W.regHit,{on:()=>S.mode==='ready'&&!S.rebooting,click:()=>G.act.take()});
  for(const id in W.caps){const c=W.caps[id];
    G.thing(c.mesh,{on:()=>S.tray&&S.mode!=='hand'&&!S.shot,click:()=>G.act.cap(id),drag:{
      start(){S.dragging=true;if(S.cap===id)S.cap=null},
      move(r){plane.set(UP,-(TOP+.5));if(r.ray.intersectPlane(plane,hitP)){hitP.x=clamp(hitP.x,-6,7);hitP.z=clamp(hitP.z,-4,7);c.mesh.position.copy(hitP)}},
      end(){S.dragging=false;const d=Math.hypot(c.mesh.position.x-W.capPos.x,c.mesh.position.z-W.capPos.z);if(d<1.1)G.act.cap(id);else{c.mesh.position.copy(c.home);audio.sfx('wrong')}}}});
  }
  const takeHint={text:['click the regulator: the black part with a ring around it.','once you take over, move the cursor up to pour more power, down to pour less.'],target:()=>W.reg.position,auto:()=>G.act.take()};hud.say('click the regulator: the black part with the ring around it.');
  for(;;){
    if(S.tray&&!S.cap){
      rig.fly(TRAYVIEW());
      hud.setHint({text:['drag a capacitor from the tray onto the empty pads marked C1, next to the chip.','a bigger tank empties more slowly. try the medium one.'],target:()=>W.capPos,auto:()=>G.act.cap('c22u')});
      await flow.until(()=>S.cap||S.mode==='hand');
    }
    hud.setHint(takeHint);await flow.until(()=>S.mode!=='ready');
    hud.setHint(null);await flow.until(()=>S.mode!=='hand'&&S.mode!=='brief');
    if(S.mode==='won')break;
    await flow.until(()=>!S.rebooting);
  }
  hud.done('hand');hud.done('burst');hud.note('cap');audio.sfx('unlock');
  await hud.talk(['you got it through a shout.','but you needed a tank beside the chip, and time slowed forty thousand times.','the real regulator gets no slow motion. it has to cope alone, at full speed.']);

  /* ----- fit the loop: the knob is the trimmer, and the screen shows at once what each setting would do ----- */
  hud.untag('reg');hud.say('');S.mode='fit';S.view='shot';if(!S.tray){S.tray=true;W.tray.visible=true;for(const id in W.caps)W.caps[id].mesh.visible=true}
  hud.scope('volts reaching the chip · full speed');rig.fly(TRAYVIEW());
  G.setKnobs(GAINS.map(g=>({label:'reacts '+HOW(g),rate:1})),3,true);G.act.gain(GAINS[3]);
  G.thing(W.antHit,{on:()=>S.mode==='fit'&&!S.shot&&!S.rebooting,click:()=>G.act.fire()});
  await hud.talk(['the regulator works by watching the line. the further it has fallen, the harder it pours.','how hard is set by a small trimmer on the board: the blue part. the knob on the instrument now turns that trimmer for you.',
    'the dashed line on the screen is a prediction: what three shouts would do to the chip with the trimmer and tank as they are now.','turn the knob and watch the dashed line. react too gently and it sags under the red. react too hard and it overshoots and wobbles.',
    'the tank matters here as well. with a small tank the line moves fast, so a hard reaction overshoots. a big tank slows the line down, and makes hard reactions safe. swap tanks and watch.',
    'when the dashed line stays inside the green band, click the antenna to try it for real.']);
  G.knob.locked=false;hud.refresh();hud.wantKnob(true);G.onKnob=i=>{hud.wantKnob(false);G.act.gain(GAINS[i])};
  hud.setHint({text:['turn the knob on the instrument and watch the dashed line change.','try the medium or large tank, and a firm or hard reaction. then click the antenna.'],target:()=>W.antPos,auto:()=>{G.act.cap('c22u');G.setKnob(5);G.act.gain(2);G.act.fire()}});
  for(;;){const n=S.shots;await flow.until(()=>S.shots>n&&!S.shot&&!S.rebooting);if(S.verdict&&S.verdict.ok)break;hud.idle=Math.max(hud.idle,12)}
  G.onKnob=null;

  /* ----- it holds: the shout crosses the room ----- */
  S.mode='done';hud.done('loop');hud.note('loop');hud.setHint(null);hud.untag('pot');hud.hush();
  st.power={cap:S.cap,K:+S.K.toFixed(2),min:+S.lastShot.min.toFixed(2)};save.data.done[1]=true;save.store();hud.refresh();
  for(const id in W.caps){hud.untag('cap_'+id);if(id!==S.cap)W.caps[id].mesh.visible=false}W.tray.visible=false;hud.scope(null);
  await hud.talk(['three shouts, and the chip never blinked.','now nothing stops its voice getting out. watch.']);
  W.ring.position.copy(W.antPos);tween(4.4,k=>{W.ring.scale.setScalar(.2+k*95);W.ring.material.opacity=.95*(1-k*k)},ease.lin);audio.sfx('zap');
  rig.fly({...G.VIEW.room,rate:2.2});
  await flow.sleep(3.6);audio.sfx('probe');hud.tag('lamp',W.lampPos,'the shout arrives','mag');hud.done('reach');
  await hud.talk(['the ripples reach the lamp.','and nothing happens. there is no antenna over there to feel them, and no chip to understand what they mean.','that is the next station: a listener.']);
  hud.untag('lamp');audio.music.grow();audio.sfx('fanfare');rig.fly({...G.VIEW.bench,rate:1.6});cascade(G,1);
  await flow.sleep(1.6);
  await hud.page(`<h2>station 01 · a voice</h2>
    <p>the board can shout across the room without knocking itself out: a tank of charge beside the chip for each gulp, and a regulator tuned to refill it.</p>
    <h3>your build</h3><div class="nums"><div><b>${CAP_LABEL[S.cap]}</b>capacitor on C1</div><div><b>${S.K.toFixed(1)}</b>how hard the regulator reacts</div><div><b>${Math.round((S.lastShot.min-RAIL.VBO)*1000)} mV</b>clear of a restart, at worst</div><div><b>${st.resets}</b>restarts on the way</div></div>
    <h3>now in your notebook</h3><ul>${['radio','scope','brown','feed','cap','loop'].filter(i=>save.data.notes.includes(i)).map(i=>`<li>${NOTES[i].t}</li>`).join('')}</ul>
    <button class="sign">sign off &rarr;</button>`);
  G.go('roam');
}
