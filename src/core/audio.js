/* Sound effects are synthesised here in WebAudio. The score is written in Strudel (strudel.cc, AGPL-3.0-or-later),
   loaded from a CDN; if it is not available the small built-in score below plays instead. All sound is synthesised. */
let ac=null,master,musicBus,sfxBus,lp,stems=[],warp=0,step=0,nextT=0,timer=null;
const ROOT=110,SCALE=[0,3,5,7,10,12,15,17];                       // A minor pentatonic
const hz=semi=>ROOT*Math.pow(2,semi/12)*Math.pow(2,warp*.25);

function env(g,t,a,d,peak){g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+d)}
function voice(freq,{type='sine',a=.005,d=.2,gain=.2,to=null,bus=sfxBus,t=ac.currentTime,det=0}={}){
  const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.detune.value=det;
  if(to)o.frequency.exponentialRampToValueAtTime(to,t+a+d);env(g,t,a,d,gain);o.connect(g).connect(bus);o.start(t);o.stop(t+a+d+.05);
}
function hiss(dur,{freq=2000,q=1,gain=.2,type='bandpass',t=ac.currentTime,bus=sfxBus,to=null}={}){
  const n=Math.ceil(ac.sampleRate*dur),b=ac.createBuffer(1,n,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();s.buffer=b;f.type=type;f.frequency.setValueAtTime(freq,t);f.Q.value=q;
  if(to)f.frequency.exponentialRampToValueAtTime(to,t+dur);env(g,t,.004,dur,gain);s.connect(f).connect(g).connect(bus);s.start(t);
}

const SFX={
  hover:()=>voice(1800,{d:.03,gain:.03}),
  click:()=>{voice(900,{type:'triangle',d:.05,gain:.12});hiss(.03,{freq:4000,gain:.06})},
  plug:()=>{hiss(.05,{freq:1800,gain:.3});voice(140,{type:'square',d:.08,gain:.12,to:70});voice(300,{d:.25,gain:.1,t:ac.currentTime+.06})},
  power:()=>{voice(55,{type:'sawtooth',a:.4,d:1.4,gain:.12,to:220});voice(220,{a:.6,d:1.2,gain:.08,to:440})},
  probe:()=>{voice(1320,{d:.07,gain:.1});voice(1980,{d:.12,gain:.08,t:ac.currentTime+.05})},
  boot:()=>[0,7,12].forEach((s,i)=>voice(hz(12+s),{type:'triangle',d:.22,gain:.12,t:ac.currentTime+i*.09})),
  unlock:()=>[0,4,7,12,16].forEach((s,i)=>voice(440*Math.pow(2,s/12),{type:'triangle',d:.5,gain:.1,t:ac.currentTime+i*.07})),
  zap:()=>{hiss(.5,{freq:6000,q:4,gain:.2,to:900});voice(2400,{type:'sawtooth',d:.3,gain:.05,to:300})},
  reset:()=>{voice(160,{type:'sawtooth',d:.5,gain:.3,to:30});hiss(.35,{freq:500,gain:.35,type:'lowpass'})},
  wrong:()=>{voice(200,{type:'square',d:.14,gain:.1});voice(150,{type:'square',d:.2,gain:.1,t:ac.currentTime+.12})},
  ok:()=>{voice(660,{type:'triangle',d:.12,gain:.12});voice(990,{type:'triangle',d:.25,gain:.12,t:ac.currentTime+.09})},
  cap:()=>{voice(260,{type:'triangle',d:.1,gain:.15});hiss(.04,{freq:3000,gain:.15})},
  dial:()=>voice(520*Math.pow(2,warp*.25),{type:'square',d:.04,gain:.07}),
  tick:()=>hiss(.02,{freq:5200,q:3,gain:.07}),
  type:()=>{const f=1500+Math.random()*700;voice(f,{type:'square',d:.018,gain:.022});hiss(.012,{freq:3800+Math.random()*1500,q:2,gain:.035})},
  take:(p=0)=>voice(hz(12+SCALE[p%SCALE.length]),{type:'triangle',d:.16,gain:.13}),
  miss:()=>voice(98,{type:'sawtooth',d:.25,gain:.14,to:70}),
  bite:()=>{voice(90,{type:'sawtooth',d:.7,gain:.3,to:40});hiss(.5,{freq:300,gain:.3,type:'lowpass'})},
  step:()=>voice(330,{type:'sine',d:.06,gain:.08}),
  whoosh:()=>hiss(.9,{freq:300,q:.7,gain:.25,to:3000}),
  fanfare:()=>[0,7,12,16,19,24].forEach((s,i)=>{voice(146.83*Math.pow(2,s/12),{type:'triangle',a:.01,d:1.2,gain:.1,t:ac.currentTime+i*.11});voice(73.42*Math.pow(2,s/12),{type:'sine',d:1.4,gain:.07,t:ac.currentTime+i*.11})}),
};

/* score: a drone, plus one pattern per stem, sequenced in 16th notes */
const PAT=[
  (s,t)=>{if(s%8===0)voice(hz(SCALE[[0,2,4,2][(s/8|0)%4]]+12),{type:'triangle',a:.02,d:.9,gain:.05,bus:musicBus,t})},            // 0 hub: slow bells
  (s,t)=>{if(s%2===0)voice(hz(SCALE[[0,2,3,5,3,2,4,1][(s/2|0)%8]]+24),{type:'sine',d:.18,gain:.035,bus:musicBus,t})},            // 1 power: arpeggio
  (s,t)=>{if(s%4===2)hiss(.03,{freq:7000,q:2,gain:.03,bus:musicBus,t});                                                           // 2 conductor: tick + bass
    if(s%16===0||s%16===10)voice(hz(SCALE[(s/16|0)%2?3:0]-12),{type:'sawtooth',d:.3,gain:.07,bus:musicBus,t})},
];
function sched(){
  if(!ac)return;const spb=(60/92/4)*Math.pow(1.22,-warp);
  if(nextT<ac.currentTime-.5)nextT=ac.currentTime;          // tab was asleep: do not replay the backlog
  while(nextT<ac.currentTime+.12){stems.forEach((on,i)=>{if(on)PAT[i](step,nextT)});step++;nextT+=spb}
}

/* The score, written in Strudel. One four-bar progression in D minor (Dm9, Bbmaj7, Fmaj7, C6/9) and one tune run through
   the whole game. Every station has its own scene: a few voices that play its idea (a byte keyed as a rhythm, two cores as two
   ears, a hopping line for Bluetooth), and more voices join as the goals on the work order are ticked off.
   The tune's first note is the press; the bell that answers it is the lamp, and it is not heard until the lamp has been lit.
   Synth voices only, no samples. Orbit 1 is drums, 2 is pad and bass (ducked by the kick), 3 is leads with echo, 4 is weather. */
const CH="<[f3,a3,c4,e4] [f3,a3,bb3,d4] [e3,g3,a3,c4] [e3,g3,a3,d4]>",UP="<[f4,a4,c5,e5] [f4,a4,bb4,d5] [e4,g4,a4,c5] [e4,g4,a4,d5]>",RT="<38 34 41 36>";
const HOOK="<[d5 ~ a4 ~ f5 e5 ~ d5] [c5 ~ a4 ~ ~ ~ g4 a4] [d5 ~ a4 ~ f5 g5 ~ a5] [g5 f5 e5 ~ d5 ~ ~ ~]>";
const lead=p=>p.orbit(3).delaytime(.45).delayfeedback(.42).roomsize(5);
const blip=(p,g=.16)=>p.decay(.1).sustain(0).gain(g);
const DRUMS=['kick','kick3','pulse','snare','hat','hat16'];
const L={
  rain:()=>s("pink*2").attack(.4).release(.8).lpf(perlin.range(1200,3200)).hpf(250).gain(.6).pan(perlin.range(.2,.8)).orbit(4),
  crackle:()=>s("crackle*2").density(.015).lpf(2500).gain(.06).orbit(4),
  sub:()=>note("d1").s("sine").attack(.6).release(1.2).gain(.42).orbit(2),
  press:()=>lead(note("<[d3 ~ ~ ~ ~ ~ ~ ~] ~ [a2 ~ ~ ~ ~ ~ ~ ~] ~ [f3 ~ ~ ~ ~ ~ ~ ~] ~ [c3 ~ ~ ~ ~ ~ ~ ~] ~>").s("triangle").lpf(900).decay(.3).sustain(0).gain(.2).delay(.2).room(.5)),
  answer:()=>lead(note("<[~ ~ ~ a5 ~ ~ ~ ~] ~>").s("sine").fm(3).fmh(3).fmdecay(.3).fmsustain(0).decay(.9).sustain(0).gain(.2).delay(.5).room(.6)),
  pad:()=>note(CH).s("sawtooth").attack(.5).decay(.4).sustain(.7).release(1.2).lpf(sine.range(520,1100).slow(8)).gain(.2).orbit(2).room(.5).roomsize(6),
  bass:()=>note("0 ~ 0 ~ ~ 12 ~ 0").add(note(RT)).s("sawtooth").lpf(420).lpq(5).lpenv(2.5).lpd(.14).decay(.25).sustain(.2).release(.06).gain(.36).orbit(2),
  kick:()=>note("d1*4").s("sine").penv(32).pdecay(.045).decay(.3).sustain(0).gain(.75).orbit(1).duckorbit(2).duckattack(.2).duckdepth(.55),
  kick3:()=>note("d1 ~ ~ d1 ~ ~ d1 ~").s("sine").penv(32).pdecay(.045).decay(.3).sustain(0).gain(.75).orbit(1).duckorbit(2).duckattack(.2).duckdepth(.55),
  pulse:()=>note("d1 ~ ~ [~ d1] ~ ~ ~ ~").s("sine").penv(24).pdecay(.06).decay(.35).sustain(0).gain(.32).orbit(1),
  snare:()=>s("white").struct("~ x ~ x").decay(.13).sustain(0).bpf(1900).bpq(.7).gain(.28).orbit(1).room(.2).roomsize(1.5),
  hat:()=>s("white*8").decay(.03).sustain(0).hpf(9000).gain("[.03 .07]*4").pan(.6).orbit(1),
  hat16:()=>s("white*16").decay("[.02 .02 .05 .02]*4").sustain(0).hpf(9500).gain(perlin.range(.03,.08)).pan(sine.range(.3,.7).fast(2)).orbit(1),
  arp:()=>lead(blip(note(UP).arp("0 1 2 3 2 1 2 3").s("triangle"),.15).delay(.3).room(.35)),
  hook:()=>lead(note(HOOK).s("sine").fm(2.5).fmh(2).fmdecay(.25).fmsustain(.1).decay(.35).sustain(.15).release(.3).gain(.19).delay(.35).room(.4)),
  /* 01 a voice: a carrier that wobbles, as the antenna shakes */
  carrier:()=>lead(note("<d4 a4 f4 c5>").s("sine").fm("<2 5 3 6>").fmh(2).vib("5:.3").attack(.25).release(.7).gain(.12).delay(.2).room(.5)),
  /* 02 the air: a byte keyed as a rhythm, a different byte each bar; then the check bit on the end */
  bits:()=>lead(blip(note("<d5 d5 c5 d5>").struct("<[1 0 1 1 0 0 1 0] [1 1 0 1 0 0 1 1] [1 0 0 1 0 1 1 0] [1 1 1 0 0 1 0 1]>").s("square").lpf(2400),.15).delay(.2).room(.2)),
  check:()=>lead(blip(note("~ ~ ~ ~ ~ ~ ~ [~ a5]").s("sine").fm(2).fmh(3),.2).delay(.4).room(.4)),
  /* 03 a listener: a call in the left ear, the same phrase answered in the right */
  call:()=>lead(blip(note("<[d4 f4 a4 ~ ~ ~ ~ ~] [c4 e4 g4 ~ ~ ~ ~ ~]>").s("triangle"),.22).pan(.12).delay(.15).room(.3)),
  resp:()=>lead(note("<[~ ~ ~ ~ d5 f5 a5 ~] [~ ~ ~ ~ c5 e5 g5 ~]>").s("sine").fm(3).fmh(3).fmdecay(.2).fmsustain(0).decay(.4).sustain(0).gain(.18).pan(.88).delay(.3).room(.5)),
  /* 04 clean presses: every note bounces */
  bounce:()=>lead(blip(note("<d4 a3 f4 c4>*2").ply("<5 3 4 6>*2").s("square").lpf(1600),.13).delay(.15).room(.25)),
  /* 05 one core: three voices, never two at once */
  hocket:()=>lead(blip(note("d4 ~ a4 f4 ~ d5 ~ a4").s("<square triangle sawtooth>*8").lpf(1800),.16).pan("<.2 .5 .8>*8").delay(.2).room(.3)),
  /* 06 two cores: one line in each ear, a sixteenth apart */
  twin:()=>blip(note(UP).arp("0 2 1 3 2 0 3 1").s("triangle"),.15).jux(x=>x.late(1/16).add(note(12))).orbit(3).delaytime(.45).delayfeedback(.42).roomsize(5).room(.3),
  /* 07 buses: a strict clock */
  clock:()=>lead(note("<d5 d5 c5 d5>").struct("x*16").s("square").lpf(3000).decay(.03).sustain(0).gain("[.1 .04 .06 .04]*4").room(.15)),
  /* 08 wi-fi: the line only speaks in the gaps, and sometimes waits */
  gaps:()=>lead(blip(note(UP).arp("0 1 2 3 2 1 2 3").mask("<[1 1 0 1 1 0 0 1] [1 0 1 1 0 1 1 0]>").degradeBy(.15).s("triangle"),.16).delay(.35).room(.35)),
  /* 09 bluetooth: never the same channel twice */
  hop:()=>lead(n(irand(10).segment(16)).scale("D4:minor:pentatonic").s("triangle").decay(.06).sustain(0).gain(.13).pan(rand).delay(.25).room(.3)),
  /* 10 sleep: the chord breathes */
  breath:()=>note(CH).s("sawtooth").lpf(600).attack(1).release(1.4).gain(.34).tremolosync(1).tremolodepth(.8).orbit(2).room(.7).roomsize(6),
  /* 11 the fuse: a semitone that should not be there, and a line with its bits knocked out */
  dark:()=>note("[d1,eb2]").s("sawtooth").lpf(220).attack(.4).release(1).gain(.26).orbit(2),
  grit:()=>note("0 0 ~ 0 ~ 1 0 ~").add(note(38)).s("square").lpf(600).crush(5).decay(.12).sustain(0).gain(.26).orbit(2),
  thief:()=>lead(note("<[d5 eb5 a4 d5] [c5 d5 g4 bb4]>*2").s("sawtooth").lpf(2200).coarse(6).decay(.08).sustain(0).gain(.09).delay(.3).room(.3)),
};
/* scene -> [level at which the voice joins, voice]. On the bench the level is how many stations are built; inside a station it
   is how far down the work order the player is, 0 to 3. */
const SCENES={
  bench:[[0,'rain'],[0,'sub'],[0,'pad'],[1,'press'],[2,'arp'],[4,'answer'],[5,'bass'],[7,'hat'],[9,'kick'],[10,'snare'],[11,'hook']],
  ch0:[[0,'rain'],[0,'pad'],[1,'sub'],[1,'press'],[2,'pulse'],[3,'arp']],
  ch1:[[0,'rain'],[0,'sub'],[0,'pad'],[1,'carrier'],[1,'hat'],[2,'bass'],[3,'kick'],[3,'arp']],
  s02:[[0,'pad'],[0,'bits'],[0,'hat'],[1,'bass'],[2,'kick'],[3,'check'],[3,'snare']],
  s03:[[0,'pad'],[0,'call'],[0,'sub'],[1,'bass'],[1,'hat'],[2,'resp'],[2,'kick'],[3,'answer'],[3,'snare']],
  s04:[[0,'bounce'],[0,'sub'],[1,'hat'],[2,'bass'],[2,'pad'],[3,'kick'],[3,'hook']],
  ch3:[[0,'hocket'],[0,'pad'],[1,'hat'],[1,'bass'],[2,'kick'],[3,'snare'],[3,'arp']],
  s06:[[0,'twin'],[0,'pad'],[1,'bass'],[2,'kick'],[2,'hat16'],[3,'snare'],[3,'hook']],
  s07:[[0,'clock'],[0,'sub'],[1,'bass'],[2,'kick'],[2,'pad'],[3,'snare'],[3,'hook']],
  s08:[[0,'pad'],[0,'gaps'],[1,'hat'],[1,'bass'],[2,'kick3'],[3,'snare'],[3,'answer']],
  s09:[[0,'hop'],[0,'sub'],[1,'hat16'],[2,'bass'],[2,'kick'],[3,'snare'],[3,'pad']],
  s10:[[0,'rain'],[0,'breath'],[0,'sub'],[1,'press'],[2,'answer'],[3,'arp']],
  s11:[[0,'dark'],[0,'grit'],[0,'crackle'],[1,'hat'],[1,'pulse'],[2,'thief'],[3,'kick'],[3,'pad']],
  s12:[[0,'pad'],[0,'bass'],[0,'press'],[0,'answer'],[1,'kick'],[1,'hat16'],[1,'arp'],[2,'snare'],[2,'hook'],[3,'hocket']],
};SCENES.roam=SCENES.bench;
const music={ready:false,failed:false,playing:0,name:'bench',lvl:0,slow:false,probe:false,voices:[],L,SCENES,
  start(){
    if(this.ready)return this.play();
    const go=()=>{try{window.initStrudel();this.ready=true;setTimeout(()=>this.play(),900)}catch(e){console.warn('strudel did not start',e);this.fail()}};
    if(window.initStrudel)go();else{let n=0;const t=setInterval(()=>{if(window.initStrudel){clearInterval(t);go()}else if(++n>32){clearInterval(t);this.fail()}},250)}
  },
  fail(){if(this.failed)return;this.failed=true;audio.fallback()},
  built(){let d=0;try{const v=JSON.parse(localStorage.getItem('one-press-save-v1'));d=v?Object.values(v.done||{}).filter(Boolean).length:0}catch(e){}return d},
  /* which voices should be sounding now */
  pick(){const sc=SCENES[this.name]||SCENES.bench,lv=sc===SCENES.bench?this.built():this.lvl;
    return sc.filter(([at,id])=>at<=lv&&!(this.slow&&DRUMS.includes(id))).map(v=>v[1])},
  scene(name){if(name===this.name)return;this.name=name;this.lvl=0;this.play()},
  /* k is how far through the work order the player is, 0 to 1 */
  step(k){const l=Math.round(Math.max(0,Math.min(1,k))*3);if(l===this.lvl)return;this.lvl=l;this.play()},
  /* slowed time takes the drums out */
  bend(w){const sl=w<-.5;if(sl===this.slow)return;this.slow=sl;this.play()},
  play(){clearTimeout(this.tm);this.tm=setTimeout(()=>this.now(),70)},
  now(){
    if(this.failed){stems[1]=this.built()>2;stems[2]=this.built()>4;return}
    if(!this.ready||!audio.on)return;
    try{const ids=this.pick(),ls=[];for(const id of ids){try{ls.push(L[id]())}catch(e){console.warn('voice '+id,e)}}
      this.voices=ids;this.playing=ls.length;if(!ls.length)return window.hush();
      let p=window.stack(...ls).cpm(25);if(this.probe)p=p.analyze(1);p.play()}catch(e){console.warn('strudel pattern failed',e);this.fail()}
  },
  grow(){this.play()},
  stop(){clearTimeout(this.tm);try{window.hush&&window.hush()}catch(e){}this.playing=0},
};
export const audio={music,
  on:true,
  init(){
    if(ac)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    ac=new AC();master=ac.createGain();master.gain.value=this.on?.9:0;master.connect(ac.destination);
    sfxBus=ac.createGain();sfxBus.connect(master);
    lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=5000;lp.connect(master);
    musicBus=ac.createGain();musicBus.gain.value=.9;musicBus.connect(lp);
    const dl=ac.createDelay(1),fb=ac.createGain();dl.delayTime.value=.33;fb.gain.value=.35;musicBus.connect(dl);dl.connect(fb).connect(dl);dl.connect(lp);
  },
  /* the built-in score, used only when Strudel cannot be loaded */
  fallback(){
    if(!ac||this.drone)return;stems[0]=true;
    this.drone=[0,7,12].map((s,i)=>{const o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();o.type='sawtooth';o.frequency.value=ROOT/2*Math.pow(2,s/12);o.detune.value=i*5-5;
      f.type='lowpass';f.frequency.value=260;g.gain.value=.035;o.connect(f).connect(g).connect(musicBus);o.start();return{o,base:ROOT/2*Math.pow(2,s/12)}});
    nextT=ac.currentTime+.1;timer=setInterval(sched,40);music.play();
  },
  resume(){if(ac&&ac.state==='suspended')ac.resume()},
  sfx(name,arg){if(!ac||!this.on)return;try{SFX[name]&&SFX[name](arg)}catch(e){}},
  stem(i,on=true){stems[i]=on},
  /* w = log10 of the time scale: 0 at real time, -3 at 1 s = 1 ms */
  warp(w){warp=w;music.bend(w);if(!ac||!this.drone)return;const t=ac.currentTime;this.drone.forEach(d=>d.o.frequency.setTargetAtTime(d.base*Math.pow(2,w*.25),t,.15));lp.frequency.setTargetAtTime(5000*Math.pow(2,w*.7),t,.15)},
  mute(m){this.on=!m;if(master)master.gain.setTargetAtTime(m?0:.9,ac.currentTime,.05);if(m)music.stop();else music.play()},
};
