import * as THREE from 'three';
import {tween,ease,clamp,save} from '../core/util.js';
import {TOP} from '../world/bench.js';
import {dress} from '../chapters/ch0.js';
import {enterDeck,clock,restart,signOff} from './kit.js';

const F='"Paper Mono",ui-monospace,monospace',PAPER='#e8e1cf',DIM='#8a877f',AMBER='#ffb347',RED='#ff5a4d',GREEN='#9be7a8',MAG='#ff5fd2';

/* ================= station 02 · the air =================
   A shout is not a message. You key eight bits by hand, in time, then far too fast; the chip takes over;
   then noise garbles a frame and nothing notices, until you add a check bit. */
const MSG=[1,0,1,1,0,0,1,1],FR=11;                                   // five ones, so the check bit is 1
const noiseAt=(frame,i)=>frame%2===0&&i===[1,4,5][(frame/2|0)%3];   // every other frame, one stray burst on a silent bit
function bitScreen(G,S){
  const g=G.hud.ctx,w=1040,h=440;g.clearRect(0,0,w,h);g.textBaseline='middle';
  const row=(y,label,bits,ref,n)=>{g.font=`600 19px ${F}`;g.fillStyle=DIM;g.textAlign='left';g.fillText(label,30,y);
    for(let i=0;i<n;i++){const x=250+i*78,b=bits[i];g.strokeStyle='rgba(232,225,207,.25)';g.lineWidth=1.5;g.strokeRect(x,y-30,62,60);if(b==null)continue;
      const bad=ref&&i<ref.length&&ref[i]!=null&&b!==ref[i];g.fillStyle=bad?RED:b?MAG:'rgba(232,225,207,.1)';if(b||bad){g.shadowColor=g.fillStyle;g.shadowBlur=12;g.fillRect(x+5,y-25,52,50);g.shadowBlur=0}
      g.fillStyle=b||bad?'#07090a':DIM;g.font=`700 24px ${F}`;g.textAlign='center';g.fillText(b,x+31,y+1)}};
  const n=S.check?9:8,want=S.check?[...MSG,1]:MSG;
  row(90,'the message',want,null,n);row(190,S.auto?'the chip sent':'you sent',S.cur.sent,S.mode==='hand'||S.mode==='fast'?want:null,n);row(290,'the lamp heard',S.cur.heard,want,n);
  if(S.check){g.font=`500 15px ${F}`;g.fillStyle=DIM;g.textAlign='center';g.fillText('check',250+8*78+31,40)}
  g.font=`600 21px ${F}`;g.textAlign='left';g.fillStyle=S.verdictOK?GREEN:AMBER;g.fillText(S.verdict||'',30,385);
}
export async function s02(G,flow){
  const {hud,audio}=G,D=G.deck;
  const S=G.state={t:0,mode:'intro',rate:0,auto:false,check:false,noise:false,botDown:false,want:0,cur:{sent:[],heard:[]},verdict:'',verdictOK:false,handOK:false,tries:0,fast:0,okRun:0,bad:0,delivered:0};
  await enterDeck(G,[{name:'your shout',color:0xff5fd2},{name:'other noise',color:0xff5a4d}],7);
  hud.slip('station 02 · the air',[{id:'hand',text:'send eight bits by hand'},{id:'auto',text:'let the chip send them'},{id:'check',text:'make garbage get caught'}]);
  hud.scope('what the lamp hears');G.setKnobs([{label:'—',rate:1}],0,true);
  const target=t=>{const i=t%FR;return i<8?MSG[i]:i===8&&S.check?1:0};
  G.act.hold=on=>{S.botDown=!!on};
  G.act.fit=k=>{if(k===0&&S.mode==='autofit'&&!S.auto){S.auto=true;audio.sfx('cap');hud.tag('chip0',D.chips[0].position,'keying the bits','')}
    if(k===1&&S.mode==='checkfit'&&!S.check){S.check=true;audio.sfx('cap');hud.tag('chip1',D.chips[1].position,'check bit added','')}};
  D.chips.forEach((c,k)=>G.thing(c,{on:()=>c.visible,click:()=>G.act.fit(k)}));
  const frameEnd=fi=>{
    const n=S.check?9:8,h=S.cur.heard,same=MSG.every((b,i)=>h[i]===b),parityOdd=S.check&&h.slice(0,9).reduce((a,b)=>a+b,0)%2===1;S.tries++;
    if(S.mode==='hand'){S.verdictOK=same;S.verdict=same?'the lamp heard it right':'not the same pattern · again';if(same)S.handOK=true;else if(S.tries>=3)S.rate=Math.max(.55,S.rate*.85);audio.sfx(same?'ok':'wrong')}
    else if(S.mode==='fast'){S.fast++;S.verdictOK=same;S.verdict=same?'somehow right':'garbage'}
    else if(S.auto){
      if(same){S.okRun++;S.delivered++;S.verdictOK=true;S.verdict=S.check?`delivered · ${S.delivered} of 4`:'the lamp heard it right';audio.sfx('ok')}
      else if(parityOdd){S.verdictOK=true;S.verdict='does not add up · thrown away, sent again';audio.sfx('step')}
      else{S.bad++;S.verdictOK=false;S.verdict='wrong pattern, and the lamp cannot tell';audio.sfx('wrong')}
    }
  };
  G.update=dt=>{
    const down=S.botDown||G.pointer.down||G.keys.has(' ');S.want=target(S.t);
    clock(S,dt,S.rate,t=>{const i=t%FR,fi=t/FR|0,n=S.check?9:8;if(i===0)S.cur={sent:[],heard:[]};
      if(i<n){const snt=S.auto?target(t):down?1:0,nz=S.noise&&noiseAt(fi,i)?1:0;S.cur.sent[i]=snt;S.cur.heard[i]=snt|nz;if(snt)audio.sfx('tick')}
      if(i===n)frameEnd(fi)});
    const tn=S.t+S.frac,bars=[];
    for(let t=Math.floor(tn)-1;t<tn+8.5;t++){if(t<0)continue;if(target(t))bars.push({lane:0,t0:t-tn,t1:t+1-tn,color:0xff5fd2,solid:true});
      if(S.noise&&noiseAt(t/FR|0,t%FR))bars.push({lane:1,t0:t-tn,t1:t+1-tn,color:0xff5a4d,solid:true})}
    D.bars(bars);D.mark(0,S.rate>0&&(S.auto?target(S.t):down)?0:null);bitScreen(G,S);
  };
  await hud.talk(['the board can shout now. but a shout is only a noise: “something happened.”','to tell the lamp what to do, the shout has to carry a message. chips write messages as bits: ones and zeros.',
    'the simplest way to send a bit through the air: shout for a one, stay silent for a zero, each for exactly the same slice of time.','the message for “lamp on” is 1 0 1 1 0 0 1 1. the bars coming down the lane are its ones.',
    '{hold the mouse button, or the space bar,|press and hold on the screen} while a bar crosses the white line. let go in the gaps.']);
  S.mode='hand';S.rate=.9;hud.setHint({text:['{hold the mouse button|hold your finger down} exactly while each pink bar is on the white line.','the instrument shows what you sent under the message. they have to match.'],auto:()=>{S.handOK=true}});
  await flow.until(()=>S.handOK);hud.done('hand');hud.note('bits');hud.setHint(null);S.rate=0;
  await hud.talk(['eight bits, by hand, at about one a second.','a real radio sends a million bits every second. try keeping up with just a few.']);
  S.mode='fast';S.rate=7;S.t=Math.ceil(S.t/FR)*FR;await flow.until(()=>S.fast>=2);S.rate=0;
  await hud.talk(['garbage. no hand can key bits at that pace.','so this is a job for the chip. fit the green chip: it will switch the shout on and off itself, bit by bit.']);
  S.mode='autofit';D.chips[0].visible=true;hud.tag('chip0',D.chips[0].position,'let the chip key the bits','');
  hud.setHint({text:['click the green chip at the left of the table.'],target:()=>D.chips[0].position,auto:()=>G.act.fit(0)});
  await flow.until(()=>S.auto);hud.setHint(null);S.t=Math.ceil(S.t/FR)*FR;S.okRun=0;S.rate=6;await flow.until(()=>S.okRun>=2);hud.done('auto');S.rate=0;
  await hud.talk(['perfect, every time, and fast.','but your board is not the only thing shouting in this room. microwave ovens, phones and other people’s gadgets use the same air.','watch the second lane. a burst of somebody else’s noise during one of your silences sounds, to the lamp, exactly like a one.']);
  S.noise=true;S.bad=0;S.t=Math.ceil(S.t/FR)*FR;S.rate=5;await flow.until(()=>S.bad>=2);S.rate=0;
  await hud.talk(['there: the lamp heard a different pattern, and it has no way to know. it would act on garbage.','the fix is to send a little extra: one more bit, chosen so that the number of ones in the whole message is always even.',
    'if a burst flips a bit, the count comes out odd. the lamp knows the message is damaged, throws it away, and your board sends it again.','fit the amber chip to add that check bit.']);
  S.mode='checkfit';D.chips[1].visible=true;hud.tag('chip1',D.chips[1].position,'add a check bit','amber');
  hud.setHint({text:['click the amber chip at the left of the table.'],target:()=>D.chips[1].position,auto:()=>G.act.fit(1)});
  await flow.until(()=>S.check);hud.setHint(null);S.t=Math.ceil(S.t/FR)*FR;S.delivered=0;S.rate=6;await flow.until(()=>S.delivered>=4);S.rate=0;hud.done('check');
  await hud.talk(['damaged messages are caught and sent again. only clean ones get through.','real radios use a much stronger check than one bit, and they shift the pitch of the wave rather than its loudness. the idea is the same.']);
  await signOff(G,2,'the air','the shout now carries a message: bits keyed by the chip, with a check so that garbage is thrown away and sent again.',['bits','check']);
}

/* ================= station 03 · a listener =================
   A second board at the lamp. It needs power, the right channel, and your board's address so it obeys only you.
   This is where the lamp lights. */
const CH=[1,3,6,9,11];
export async function s03(G,flow){
  const {hud,audio,rig}=G,W=G.bench,P=W.power;
  const S=G.state={mode:'intro',powered:false,ch:1,paired:false,presses:0,lamp:false,t:0,shoutT:0,heard:0,stray:0,ignored:0,busy:false,botPress:false};
  dress(G,true);W.setLamp(false);W.farLed.material.emissiveIntensity=0;rig.zoom=true;rig.lim={dmin:3.4,dmax:90,phmin:.25,phmax:1.45};rig.jump(G.VIEW.room);
  hud.slip('station 03 · a listener',[{id:'power',text:'give the listener power'},{id:'tune',text:'tune it to your channel'},{id:'pair',text:'make it obey only you'},{id:'press',text:'press. light.'}]);
  const ring=(mesh,from,reach,dur=1.6)=>{mesh.position.copy(from);return tween(dur,k=>{mesh.scale.setScalar(.3+k*reach);mesh.material.opacity=.9*(1-k*k)},ease.lin)};
  const toggle=()=>{S.lamp=!S.lamp;W.setLamp(S.lamp);audio.sfx(S.lamp?'ok':'step')};
  /* one shout from your board; what the listener does with it depends on how far the station has got */
  const shout=async()=>{if(S.busy)return;S.busy=true;audio.sfx('zap');W.antMat.emissiveIntensity=4;await ring(W.ring,W.antPos,92,1.3);W.antMat.emissiveIntensity=0;
    if(S.powered&&S.ch===6){S.heard++;toggle();if(S.paired){hud.tag('ack',W.farPos,'got it','');await ring(W.ring2,W.farPos,92,1.1);hud.untag('ack')}}S.busy=false};
  const stray=async()=>{S.busy=true;audio.sfx('zap');await ring(W.ring2,new THREE.Vector3(-46,6,-58),80,1.5);
    if(S.paired){S.ignored++;hud.tag('ign',W.farPos,'not my board · ignored','red');await tween(1.6,()=>{});hud.untag('ign')}else{S.stray++;toggle()}S.busy=false};
  G.act.power=()=>{if(S.mode!=='power'||S.powered)return;S.powered=true;W.farLed.material.emissiveIntensity=3;audio.sfx('power')};
  G.act.press=()=>{if((S.mode==='press'||S.mode==='final')&&!S.busy){S.presses++;audio.sfx('click');shout()}};
  G.act.pair=()=>{if(S.mode!=='pair'||S.paired)return;S.paired=true;audio.sfx('cap')};
  G.thing(W.farHit,{on:()=>S.mode==='power'||S.mode==='pair',click:()=>S.mode==='power'?G.act.power():G.act.pair()});
  const boardHit=new THREE.Mesh(new THREE.BoxGeometry(9,4,6));boardHit.visible=false;boardHit.position.set(0,1,0);W.root.add(boardHit);flow.until(()=>false).catch(()=>W.root.remove(boardHit));
  G.thing(boardHit,{on:()=>S.mode==='press'||S.mode==='final',click:()=>G.act.press()});
  G.update=dt=>{
    S.t+=dt;if(S.mode==='tune'&&!S.busy&&S.t-S.shoutT>2.2){S.shoutT=S.t;shout()}
    const tgt=S.mode==='power'||S.mode==='pair'?W.farPos:S.mode==='press'||S.mode==='final'?new THREE.Vector3(0,TOP,0):null;
    if(tgt&&!(S.mode==='pair'&&S.paired))G.beacons[0].at(tgt.clone().setY(tgt.y-.3),S.mode==='press'||S.mode==='final'?3.4:4);else G.beacons[0].hide();
    hud.tag('you',new THREE.Vector3(0,TOP+.4,0),'your board<small>address 3C:90</small>','');
    hud.tag('far',W.farPos,'the listener<small>'+(!S.powered?'no power':S.mode==='tune'?'channel '+S.ch:S.paired?'obeys only 3C:90':'obeys anyone')+'</small>','');
    /* the instrument: what the listener hears on its channel */
    const g=hud.ctx,w=1040,h=440;g.clearRect(0,0,w,h);g.textBaseline='middle';const on=S.powered&&S.ch===6;
    g.strokeStyle=on?MAG:'rgba(232,225,207,.35)';g.lineWidth=3;g.beginPath();for(let x=30;x<w-30;x+=6){const burst=on&&((x+S.t*160)%420<150);g.lineTo(x,200+(Math.sin(x*12.9898+Math.floor(S.t*12))*43758.5453%1)*(burst?90:14))}g.stroke();
    g.font=`600 22px ${F}`;g.textAlign='left';g.fillStyle=on?GREEN:AMBER;g.fillText(!S.powered?'the listener has no power':on?'channel 6 · messages arriving':`channel ${S.ch} · only hiss`,30,50);
    g.font=`500 18px ${F}`;g.fillStyle=DIM;g.fillText('your board is shouting on channel 6',30,400);
  };
  await hud.talk(['your board shouts a clean message across the room. nothing there can hear it.','so the lamp gets a board of its own: the same kind of chip, wired to switch the lamp. it sits on the shelf beside it.','it is not plugged in yet. {click|tap} it.']);
  S.mode='power';hud.setHint({text:['the second board is on the shelf, next to the lamp.'],target:()=>W.farPos,auto:()=>G.act.power()});
  await flow.until(()=>S.powered);hud.done('power');hud.setHint(null);
  await hud.talk(['it has power. it is listening. and it hears nothing but hiss.','the air is divided into channels, like stations on a radio dial. your board is shouting on channel 6. the listener is tuned to channel 1.','the knob on the instrument is the listener’s dial. turn it until the messages come through.']);
  S.mode='tune';hud.scope('what the listener hears');G.setKnobs(CH.map(c=>({label:'channel '+c,rate:1})),0,false);G.onKnob=i=>{S.ch=CH[i];hud.wantKnob(false)};hud.wantKnob(true);
  hud.setHint({text:['turn the knob until it reads channel 6.'],auto:()=>G.setKnob(2)});
  await flow.until(()=>S.heard>=1&&!S.busy);hud.done('tune');hud.note('chan');hud.setHint(null);G.onKnob=null;G.knob.locked=true;hud.refresh();
  S.mode='press';await hud.talk(['the lamp is on.','that was your board’s message, heard and understood, with no wire. now do it yourself: {click|tap} your board to press its button.']);
  hud.setHint({text:['{click|tap} your board on the desk.'],target:()=>new THREE.Vector3(0,TOP,0),auto:()=>G.act.press()});
  const p0=S.presses;await flow.until(()=>S.presses>=p0+2&&!S.busy);hud.setHint(null);S.mode='wait';
  await hud.talk('press, and the lamp answers. that is the whole point of the game, working. but watch the lamp for a moment, and touch nothing.');
  await stray();await flow.sleep(.8);await stray();
  await hud.talk(['you did not press anything.','those messages came from somebody else’s board: a neighbour with the same remote, on the same channel. your listener obeys anyone who says “lamp”.','every one of these chips has an address of its own, set at the factory. yours ends 3C:90.','tell the listener that address, and it will obey your board and nobody else. {click|tap} the listener.']);
  S.mode='pair';hud.setHint({text:['{click|tap} the board on the shelf to give it your address.'],target:()=>W.farPos,auto:()=>G.act.pair()});
  await flow.until(()=>S.paired);hud.setHint(null);hud.note('mac');S.mode='wait';await stray();
  hud.done('pair');S.mode='final';if(S.lamp)toggle();
  await hud.talk(['the neighbour’s message arrived, and the listener ignored it.','one more thing changed. now that it knows you, the listener sends a short answer back after every message: “got it.”','if that receipt does not come, your board knows the message was lost, and sends it again. press.']);
  hud.setHint({text:['{click|tap} your board on the desk.'],target:()=>new THREE.Vector3(0,TOP,0),auto:()=>G.act.press()});
  const p1=S.presses;await flow.until(()=>S.presses>p1&&!S.busy&&S.lamp);hud.done('press');hud.note('ack');
  await hud.talk(['one press here. the lamp, there. no wire.','it works. everything from here on is about making it work every time, for a long time, in a world that is not as tidy as this desk.']);
  hud.untag('you');hud.untag('far');
  await signOff(G,3,'a listener','a second board at the lamp, tuned to your channel, that obeys only your board’s address and sends a receipt for every message. the lamp lights.',['chan','mac','ack']);
}

/* ================= station 04 · clean presses =================
   One press counts as several, because the contacts bounce. You see the bounce on the oscilloscope, then choose
   how long the chip looks away after the first edge: too short lets bounces through, too long misses quick presses. */
const EDGES=[[0,1.1,3.0],[0],[0,.8,2.2,6.5],[0,4.1],[0,1.6,5.9]],WAIT=[0,1,5,20,80,300];
const counted=(edges,w)=>{let n=0,last=-1e9;for(const e of edges)if(e-last>w){n++;last=e}return n};
const total=w=>EDGES.reduce((a,e)=>a+counted(e,w),0),doubleTap=w=>counted([0,2.3,120,121.4],w);
export async function s04(G,flow){
  const {hud,audio,rig}=G,W=G.bench,P=W.power;
  const S=G.state={mode:'intro',presses:0,count:0,w:0,view:'count',flick:0,replay:0,lastT:-1e9,clockT:0};
  dress(G,true);rig.zoom=true;rig.lim={dmin:3.4,dmax:80,phmin:.25,phmax:1.45};rig.fly({...G.VIEW.board,rate:2});
  hud.slip('station 04 · clean presses',[{id:'count',text:'press five times'},{id:'see',text:'see what the chip saw'},{id:'fit',text:'make five mean five'}]);
  hud.scope('the chip’s count');G.setKnobs([{label:'—',rate:1}],0,true);
  G.act.press=()=>{
    if(S.mode!=='count'&&S.mode!=='test')return;const k=S.presses%5,now=S.clockT*1000;S.presses++;audio.sfx('click');rig.shake=.05;
    /* while the chip is looking away, even a real new press is missed */
    const add=S.mode==='count'?EDGES[k].length:(now-S.lastT>S.w?counted(EDGES[k],S.w):0);if(add)S.lastT=now;S.count+=add;S.flick=add*.12;hud.idle=0;
  };
  G.thing(W.btnHit,{name:'the button',at:W.btnPos,on:()=>S.mode==='count'||S.mode==='test',click:()=>G.act.press()});
  G.update=dt=>{
    S.clockT+=dt;if(S.flick>0){S.flick-=dt;W.ledBlue.material.emissiveIntensity=(S.flick/.12%1)>.5?5:0}else W.ledBlue.material.emissiveIntensity=0;
    if(S.mode==='count'||S.mode==='test')G.beacons[0].at(W.btnPos.clone().setY(TOP+.05),.4);else G.beacons[0].hide();
    const g=hud.ctx,w=1040,h=440;g.clearRect(0,0,w,h);g.textBaseline='middle';
    if(S.view==='count'){
      g.textAlign='left';g.font=`500 20px ${F}`;g.fillStyle=DIM;g.fillText('you pressed',80,110);g.fillText('the chip counted',560,110);
      g.font=`200 150px ${F}`;g.fillStyle=PAPER;g.fillText(S.presses,80,250);g.fillStyle=S.count===S.presses?GREEN:RED;g.fillText(S.count,560,250);
      if(S.mode==='test'){g.font=`500 20px ${F}`;g.fillStyle=DIM;g.fillText(`looking away for ${S.w} ms after each press`,80,390)}
    }else{
      /* one press on the wire, stretched out: the bounces, and the stretch of time the chip ignores */
      const L=70,R=w-40,T=110,B=300,X=t=>L+(R-L)*(t+1)/9,e=EDGES[2],hi=t=>{for(let i=e.length-1;i>=0;i--)if(t>=e[i])return t<e[i]+(i===e.length-1?99:.45)||i===e.length-1;return false};
      S.replay=Math.min(1,S.replay+dt/4);const upto=S.view==='trace'?-1+9*S.replay:8;
      if(S.view==='fit'&&S.w>0){g.fillStyle='rgba(95,227,255,.14)';g.fillRect(X(0),T-30,Math.min(R,X(S.w))-X(0),B-T+60);g.fillStyle='#5fe3ff';g.font=`500 17px ${F}`;g.textAlign='left';g.fillText('looking away',X(0)+6,T-44)}
      g.strokeStyle=AMBER;g.shadowColor=AMBER;g.shadowBlur=12;g.lineWidth=3.5;g.beginPath();let prev=null;for(let t=-1;t<=upto;t+=.02){const y=hi(t)?T:B;if(prev==null)g.moveTo(X(t),y);else{if(y!==prev)g.lineTo(X(t),prev);g.lineTo(X(t),y)}prev=y}g.stroke();g.shadowBlur=0;
      g.fillStyle=DIM;g.font=`500 17px ${F}`;g.textAlign='left';g.fillText('pressed',8,T);g.fillText('released',8,B+26);g.textAlign='right';g.fillText('8 thousandths of a second',R,B+60);g.textAlign='left';g.fillText('one press, slowed down',L,B+60);
      if(S.view==='fit'){const n=total(S.w),d=doubleTap(S.w);g.font=`600 21px ${F}`;g.fillStyle=n===5?GREEN:RED;g.fillText(`five presses would count as ${n}`,L,36);g.fillStyle=d===2?GREEN:RED;g.textAlign='right';g.fillText(`a quick double press counts as ${d}`,R,36)}
    }
  };
  await hud.talk(['the lamp obeys. now make the button do something slightly smarter: each press should flip the lamp. press once for on, again for off.','for that, the chip has to count presses. the instrument shows its count. press the button five times.']);
  S.mode='count';hud.setHint({text:['the button is at the corner of the board, with a ring around it.'],target:()=>W.btnPos,auto:()=>{for(let i=0;i<5;i++)G.act.press()}});
  await flow.until(()=>S.presses>=5);hud.done('count');hud.setHint(null);S.mode='wait';await flow.sleep(.8);
  await hud.talk(['you pressed five times. the chip counted thirteen.','a lamp that flips thirteen times ends up on when you wanted it off. to see why, look at one press the way the chip sees it: on the oscilloscope, slowed right down.']);
  S.view='trace';S.replay=0;hud.scope('the button’s wire · one press');await flow.until(()=>S.replay>=1);hud.note('bounce');
  await hud.talk(['inside the button, two pieces of metal slam together. and bounce. and touch again, and bounce again, for a few thousandths of a second before they settle.','you felt one press. the chip checks that wire a million times a second, and to it each bounce is a new press. that one was four.',
    'the cure is simple. after the first touch, the chip looks away from the button for a short while, and ignores whatever happens in that time.','how long it looks away is the knob. the blue band on the screen shows it. the two lines above say what your choice would do.']);
  hud.done('see');S.view='fit';S.mode='fit';G.setKnobs(WAIT.map(w=>({label:w?`looks away ${w} ms`:'never looks away',rate:1})),0,false);G.onKnob=i=>{S.w=WAIT[i];hud.wantKnob(false)};hud.wantKnob(true);
  hud.setHint({text:['turn the knob until both lines at the top of the screen are green.','too short and bounces still get counted. too long and a quick second press is missed.'],auto:()=>G.setKnob(3)});
  await flow.until(()=>total(S.w)===5&&doubleTap(S.w)===2);hud.setHint(null);hud.note('debounce');
  await hud.talk(['long enough to outlast the bounces, short enough that a fast finger is not ignored.','try it for real. press the button five times.']);
  S.view='count';S.mode='test';S.presses=0;S.count=0;S.lastT=-1e9;hud.scope('the chip’s count');
  hud.setHint({text:['press the button five times, at any pace.'],target:()=>W.btnPos,auto:async()=>{for(let i=0;i<5;i++){G.act.press();await tween(.5,()=>{})}}});
  for(;;){await flow.until(()=>S.presses>=5);await flow.sleep(.5);if(S.count===5&&total(S.w)===5&&doubleTap(S.w)===2)break;
    hud.say(total(S.w)!==5?'still miscounting: it is not looking away long enough. turn the knob up and try again.':'it missed one: it was still looking away when you pressed. turn the knob down and try again.');S.presses=0;S.count=0;S.lastT=-1e9}
  hud.done('fit');G.onKnob=null;
  await hud.talk(['five presses, counted as five.','this trick is called debouncing, and every device with a button does it.']);
  await signOff(G,4,'clean presses','the chip now looks away for a moment after each press, so one press counts once.',['bounce','debounce'],`<div><b>${S.w} ms</b>the chip looks away</div>`);
}
