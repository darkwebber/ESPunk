/* Development check, not a game mode: plays each station through the same actions the player has, with the game
   stepped by hand. It fails on a soft-lock and reports HUD pieces that overlap.   await game.bot.all()   (erases the save) */
import {RAIL} from './sim/rail.js';
export function makeBot(G){
  const $=id=>document.getElementById(id),issues=[];
  const yieldTask=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0)});
  const st=async s=>{await G.step(s);await yieldTask()};
  function check(where){
    const r=['slip','scope','say','chain','menuBtn'].map(id=>[id,$(id)]).filter(([,e])=>!e.classList.contains('off')&&e.getClientRects().length&&e.textContent.trim()!==''||e.id==='scope'&&!e.classList.contains('off')).map(([id,e])=>[id,e.getBoundingClientRect()]);
    for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){const a=r[i][1],b=r[j][1],ox=Math.min(a.right,b.right)-Math.max(a.left,b.left),oy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
      if(ox>4&&oy>4){const m=`${where}: ${r[i][0]} overlaps ${r[j][0]}`;if(!issues.includes(m))issues.push(m)}}
  }
  async function until(cond,why,max=90){let t=0;while(!cond()){if(t>max)throw new Error(`stuck waiting for ${why} · goals: ${[...$('goals').children].map(e=>e.className[0]+':'+e.textContent).join(' | ')} · say: "${G.hud.sayText}"`);await st(.25);t+=.25}check(why)}
  async function page(){await until(()=>G.hud.pageClose,'page',60);G.hud.pageClose('ok');await yieldTask()}

  /* play the regulator with a human's delay: feed follows draw 0.32 s late */
  async function regulate(){const S=G.state,q=[];while(S.mode==='hand'){q.push(S.draw);G.act.feed(q.length>10?q.shift():RAIL.I_IDLE);await G.step(.032)}await yieldTask()}
  async function ch0(){
    G.go('ch0');const S=G.state;await until(()=>S.mode==='tour','the tour');check('tour');
    for(const id of['chip','btn','led','usb','ant']){await G.act.look(id);await st(.3)}
    await until(()=>S.mode==='plug','the cable');G.act.plug();
    await until(()=>S.mode==='try','a live board');check('powered');G.act.try();
    await until(()=>S.mode==='wire','the wiring');G.act.wire();
    await until(()=>S.mode==='press','the press');G.act.press(true);await st(1.2);G.act.press(false);
    await page();await until(()=>G.chapter==='roam','the bench');await st(1);check('bench');
  }
  async function ch1(){
    G.go('ch1');const S=G.state;await until(()=>S.mode==='loud','the knob');check('loud');
    for(let i=1;i<=5;i++){G.setKnob(i);await st(.6)}
    await until(()=>S.mode==='ready','the regulator',120);check('ready');
    await G.act.take();await regulate();if(S.mode==='won')throw new Error('the bare rail was survivable by hand; it should not be');
    await until(()=>S.tray&&!S.rebooting,'the tray');
    G.act.cap('c100n');await G.act.take();await regulate();if(S.mode==='won')throw new Error('100 nF should not be enough');
    await until(()=>!S.rebooting,'reboot');G.act.cap('c22u');await G.act.take();await regulate();
    await until(()=>S.mode==='fit','the loop');check('fit');
    G.act.gain(.3);G.act.fire();await until(()=>S.verdict,'first shot');if(S.verdict.ok)throw new Error('gain 0.3 should sag');
    await until(()=>!S.rebooting,'reboot');G.act.gain(2);G.act.fire();await until(()=>S.mode==='done','a clean shot');
    await page();await until(()=>G.chapter==='roam','the bench');await st(1);check('bench');
  }
  async function ch3(){
    G.go('ch3');const S=G.state;
    for(let n=0;S.phase==='hand';n++){if(n>9000)throw new Error('stuck in the hand shift');if(S.sim){S.sim.release();const p=S.round<3||S.sim.t<14?S.sim.pick():null;G.act.hold(p?p.id:null)}await st(.05)}   // plays well, then lets the clock win
    G.act.hold(null);await until(()=>S.phase==='rule','the riser');check('rule');
    G.setKnob(3);await until(()=>!S.run&&/late \d/.test(S.head),'a failing run');
    G.act.setPrio('BUTTON',3);G.act.setPrio('RADIO',2);G.act.setPrio('LOGGER',1);await st(.3);G.setKnob(3);await until(()=>S.phase==='trial','the baton');
    G.setKnob(3);await until(()=>S.bites>=1&&!S.run,'the watchdog');await st(.5);
    G.setKnob(1);G.act.hold('LOGGER');await until(()=>S.sim.t>=5||!S.run,'the rescue');G.act.hold(null);await until(()=>S.rescued,'recognition');
    await G.act.fit();await st(.5);G.setKnob(3);await page();
    await until(()=>G.chapter==='roam','the bench');await st(1);check('bench');
  }
  const home=async()=>{await until(()=>G.chapter==='roam','the bench');await st(.6);check('bench')};
  const mode=(S,m,max)=>until(()=>S.mode===m,'mode '+m,max);
  async function s02(){G.go('s02');const S=G.state;await mode(S,'hand');for(let n=0;!S.handOK;n++){if(n>4000)throw new Error('could not key the bits');G.act.hold(S.want);await G.step(.03)}G.act.hold(0);
    await mode(S,'autofit');check('02');G.act.fit(0);await mode(S,'checkfit',120);G.act.fit(1);await page();await home()}
  async function s03(){G.go('s03');const S=G.state;await mode(S,'power');G.act.power();await mode(S,'tune');check('03');G.setKnob(2);await mode(S,'press');
    while(S.mode==='press'){G.act.press();await st(.5)}await mode(S,'pair',120);G.act.pair();await mode(S,'final',120);while(!G.hud.pageClose){G.act.press();await st(.5)}await page();await home()}
  async function s04(){G.go('s04');const S=G.state;await mode(S,'count');for(let i=0;i<5;i++){G.act.press();await st(.1)}await mode(S,'fit');check('04');G.setKnob(3);
    await mode(S,'test');for(let i=0;i<5;i++){G.act.press();await st(.4)}await page();await home()}
  async function s06(){G.go('s06');const S=G.state;await mode(S,'split');check('06');G.act.move(2);G.setKnob(3);await mode(S,'count',120);G.setKnob(3);await mode(S,'lock',120);G.act.fit();G.setKnob(3);await page();await home()}
  async function s07(){G.go('s07');const S=G.state;await mode(S,'baud');check('07');G.setKnob(3);await mode(S,'call');G.act.call('display');G.act.call('sensor');G.act.call('display');await page();await home()}
  async function s08(){G.go('s08');const S=G.state;await mode(S,'hand');check('08');while(S.mode==='hand'){if(S.clear())G.act.send();await st(.05)}
    await mode(S,'listenfit');G.act.fit(0);await mode(S,'rndfit',160);G.act.fit(1);await page();await home()}
  async function s09(){G.go('s09');const S=G.state;await mode(S,'hand');check('09');while(S.hits<8){G.act.lane(S.next());await G.step(.04)}
    await mode(S,'autofit',160);G.act.fit();await mode(S,'map',200);for(const i of[2,3,4])G.act.lane(i);await page();await home()}
  async function s10(){G.go('s10');const S=G.state;await mode(S,'hand');check('10');G.act.chip();await st(.5);G.act.press();await st(.5);G.act.chip();await st(.3);G.act.press();
    await mode(S,'fit');G.setKnob(3);G.act.press();await mode(S,'test');check('10 fit');await st(4);G.act.press();await page();await home()}
  async function s11(){G.go('s11');const S=G.state;await mode(S,'dump');G.act.read();await mode(S,'burn1');check('11');S.botHold=true;await mode(S,'dump2');S.botHold=false;G.act.read();
    await mode(S,'evil');G.act.read();await mode(S,'burn2');S.botHold=true;await mode(S,'evil2');S.botHold=false;G.act.read();await page();await home()}
  async function s12(){G.go('s12');const S=G.state;await mode(S,'ready');G.act.press();await mode(S,'real',120);check('12');G.act.press();await page();await home()}
  const ALL={ch0,ch1,s02,s03,s04,ch3,s06,s07,s08,s09,s10,s11,s12};
  return{...ALL,issues,
    async all(only){issues.length=0;if(!only)G.save.wipe();G.hud.refresh();$('title').classList.add('off');G.hud.show(true);G.paused=false;G.autoTalk=true;const t0=performance.now();let at='';
      try{for(const id of only||G.ORDER){at=id;await ALL[id]()}}catch(e){G.autoTalk=false;return{ok:false,at,error:String(e.message||e),issues}}
      G.autoTalk=false;return{ok:!issues.length,issues,done:Object.keys(G.save.data.done).length,notes:G.save.data.notes.length,stats:G.save.data.stats,music:G.audio.music.playing,ms:Math.round(performance.now()-t0)}}};
}
