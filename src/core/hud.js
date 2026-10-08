import * as THREE from 'three';
import {save,tween} from './util.js';
import {audio} from './audio.js';

const $=id=>document.getElementById(id);
/* Text is written for a mouse. {a|b} picks a for mouse and b for touch; on touch, stray "click" and "the cursor" are also reworded. */
export const touch=()=>matchMedia('(pointer:coarse)').matches||innerWidth<=720;
export const T=s=>{const t=touch();s=String(s).replace(/\{([^|{}]*)\|([^{}]*)\}/g,(m,a,b)=>t?b:a);return t?s.replace(/\bclick/g,'tap').replace(/the cursor/g,'your finger'):s};
export const STATIONS=['wake it','a voice','the air','a listener','clean presses','one core','two cores','buses','wi-fi','bluetooth','sleep','the fuse','one press'];
const PLAYABLE=[0,1,2,3,4,5,6,7,8,9,10,11,12];

/* Every fact the player can earn. src is shown as written; "verify" means not yet checked against the datasheet. */
export const NOTES={
  pin:{t:'Pins are how the chip touches the world',p:'Each gold dot along the edges is a wire into the chip. The chip can listen on a pin, as it does for the button, or drive it, as it does for the light.',src:'ESP32 datasheet, GPIO'},
  prog:{t:'A chip does only what it is told',p:'Powered and awake, it still does nothing until it has instructions. Your first one: when the button is down, switch the light on.',src:''},
  radio:{t:'Radio is electricity shaken in an antenna',p:'The chip pushes current back and forth along a strip of copper about 2.4 billion times a second. That spreads through the room as a wave another antenna can feel. A louder shout reaches further and costs more power.',src:'ESP32 datasheet, RF · verify transmit current'},
  scope:{t:'An oscilloscope draws voltage over time',p:'Left is earlier, right is later, higher is more volts. It lets you see things that happen too fast to notice.',src:''},
  vbus:{t:'USB brings 5 volts',p:'The cable\'s VBUS line carries 5 V. The chip cannot take that directly.',src:'USB 2.0 specification'},
  reg:{t:'The regulator steps 5 V down to 3.3 V',p:'A linear regulator burns the difference off as heat. Everything on the board runs from this one rail.',src:'Espressif DevKitC schematic · verify part number'},
  en:{t:'EN is the chip\'s on switch',p:'Held low, the chip is off. A resistor and a capacitor let it rise slowly at power-up, so the rail is steady before the chip starts.',src:'ESP32 hardware design guidelines · verify values'},
  feed:{t:'Voltage moves when feed and draw differ',p:'The rail is a small tank. Feed more current than the chip draws and it rises; feed less and it falls. How fast depends on the size of the tank: its capacitance.',src:'dV/dt = (I in − I out) / C'},
  brown:{t:'A radio burst can starve the rail',p:'Transmitting draws a short, large pulse of current. If the rail sags below the brown-out threshold, the chip resets itself rather than run on bad power.',src:'ESP32 datasheet, brown-out detector · verify currents and threshold'},
  cap:{t:'A capacitor buys time',p:'The regulator needs time to react. A capacitor beside the load supplies the charge in the meantime. Too small a capacitor empties before the regulator catches up.',src:'Model in this game is simplified and tuned to show the effect'},
  loop:{t:'Gain is a trade',p:'A regulator corrects in proportion to the error. Low gain lets the rail sag. High gain overcorrects and rings. More capacitance lets you use more gain.',src:'Proportional control with a lag · simplified model'},
  bits:{t:'A message is a pattern of ones and zeros',p:'The chip sends a message as a row of bits, each lasting a fixed slice of time. Here a bit is a shout or a silence; real radios shift the pitch or timing of the wave instead, but the idea is the same.',src:'Simplified from IEEE 802.11 / 802.15.1 modulation'},
  check:{t:'A check catches garbage',p:'The sender adds a little extra computed from the message. If what arrives does not add up, the listener throws it away and the sender tries again.',src:'Parity here; real frames carry a 32-bit CRC'},
  chan:{t:'The air is divided into channels',p:'A talker and a listener must be tuned to the same channel, as two radios must be on the same station.',src:'2.4 GHz band plan · verify channel count per region'},
  mac:{t:'Every board has its own address',p:'A number built into the chip at the factory. A listener that knows your address can ignore everyone else.',src:'ESP-NOW peer list, ESP-IDF documentation'},
  ack:{t:'A receipt comes back',p:'The listener answers each message with a short "got it". No receipt, and the sender knows to try again.',src:'ESP-NOW send callback, ESP-IDF documentation'},
  bounce:{t:'One press is many presses',p:'The metal contacts in a button bounce for a few thousandths of a second. To a chip checking a million times a second, each bounce is a press.',src:'Typical tactile switch bounce · verify duration'},
  debounce:{t:'Debouncing is choosing how long to look away',p:'After the first edge, ignore the pin for a while. Too short and bounces get through. Too long and quick presses are missed.',src:''},
  cores:{t:'Two cores do two things at the same instant',p:'The ESP32 has two. Jobs can be pinned to one core or the other, so a busy job does not hold up an urgent one.',src:'ESP32 datasheet; xTaskCreatePinnedToCore, ESP-IDF'},
  race:{t:'Two writers, one number',p:'When both cores read a number, add one, and write it back at the same moment, one of the additions is lost. A lock makes them take turns for just that step.',src:'Data race; FreeRTOS mutex'},
  baud:{t:'Both ends must agree on the speed',p:'On a serial wire the receiver reads each bit by its own clock. If the two clocks disagree, it reads at the wrong moments and gets garbage.',src:'UART'},
  i2c:{t:'Many devices can share two wires',p:'Each device on the bus has an address. The chip calls an address, the device answers, and only then do they talk.',src:'I²C bus specification'},
  csma:{t:'Listen before you talk',p:'Wi-Fi devices share a channel. Each waits for silence, then waits a little longer, a random amount, so two of them do not start at the same instant.',src:'IEEE 802.11 CSMA/CA'},
  router:{t:'Wi-Fi goes through a router',p:'Every message goes to the router first, and the router passes it on. That reaches phones and the internet, at the cost of a longer path than board to board.',src:''},
  hop:{t:'Bluetooth never stays on one channel',p:'It jumps between dozens of narrow channels many times a second, in an order both ends know.',src:'Bluetooth frequency hopping · Lamarr and Antheil, 1942 patent'},
  afh:{t:'Bad channels are skipped',p:'Channels that keep losing packets, usually because Wi-Fi is using them, are struck from the hop list.',src:'Adaptive frequency hopping, Bluetooth 1.2'},
  sleep:{t:'A chip that waits should sleep',p:'Awake, the chip draws tens of milliamps. In deep sleep nearly everything is switched off and it draws about a thousandth of that.',src:'ESP32 datasheet, power modes · verify currents'},
  wake:{t:'Something small stays awake',p:'A tiny low-power clock and a few pins stay on. A press on the right pin wakes the rest, at the cost of a moment to start up.',src:'ESP32 RTC and ext0/ext1 wake-up · verify wake time'},
  dump:{t:'Memory can be read out',p:'Anyone holding the board can copy what is stored in it, including passwords, unless it is scrambled.',src:'ESP32 flash encryption, ESP-IDF security guide'},
  efuse:{t:'Fuses are written once',p:'Tiny links inside the chip that can be burned through and never mended. They hold the key that scrambles memory and the rule that only your program may run.',src:'ESP32 eFuse, secure boot · published attacks exist, verify'},
  tick:{t:'One core runs one task at a time',p:'The scheduler decides who runs at every tick. Tasks only appear to run together because the switching is fast.',src:'FreeRTOS kernel documentation · tick rate differs by framework, verify'},
  rule:{t:'Highest ready priority runs. Equals take turns.',p:'That is the whole rule. A task that must answer fast gets a high priority and a short job.',src:'FreeRTOS kernel documentation'},
  wdt:{t:'The watchdog',p:'A timer that resets the chip if a task goes too long without running. A reset is better than a silent hang.',src:'ESP-IDF task watchdog · verify default timeout'},
  inv:{t:'Priority inversion',p:'A high task waits for a baton held by a low task, while a medium task keeps the low one from finishing. The high task starves behind a task that has nothing to do with it.',src:'Mars Pathfinder, 1997 · account by Glenn Reeves, JPL'},
  inh:{t:'Priority inheritance',p:'While a high task waits for the baton, its holder borrows that high priority, finishes, and hands the baton over.',src:'FreeRTOS mutexes'},
};

const v=new THREE.Vector3();
export const hud={
  G:null,tags:new Map(),hint:null,idle:0,stage:0,goals:[],sayText:'',sayShown:0,sayHold:0,
  init(G){
    this.G=G;
    $('chain').innerHTML=STATIONS.map((n,i)=>`<i title="${i} · ${n}" class="${PLAYABLE.includes(i)?'open':''}">${String(i).padStart(2,'0')}</i>`).join('');
    $('hintBtn').onclick=()=>this.nextHint();$('say').onclick=()=>this.advance();
    $('doIt').onclick=()=>{const h=this.hint;if(h&&h.auto){$('doIt').classList.add('off');h.auto()}};
    $('noteBtn').onclick=()=>this.book(true);
    $('menuBtn').onclick=()=>G.menu(true);
    document.querySelector('#book [data-close]').onclick=()=>this.book(false);
    const k=$('knob');
    k.onclick=e=>{const r=k.getBoundingClientRect();G.setKnob(G.knob.i+(e.clientX<r.left+r.width/2?-1:1))};
    k.addEventListener('wheel',e=>{e.preventDefault();G.setKnob(G.knob.i+(e.deltaY>0?-1:1))},{passive:false});
    $('fade').innerHTML=Array.from({length:12},(_,i)=>`<i style="--i:${i}"></i>`).join('');
    this.cv=$('scopeCv');this.ctx=this.cv.getContext('2d');
    this.refresh();
  },
  refresh(){
    const d=save.data,G=this.G,K=G.knob;
    [...$('chain').children].forEach((e,i)=>{e.classList.toggle('lit',!!d.done[i]);e.classList.toggle('here',G.station===i)});
    $('noteCount').textContent=d.notes.length;
    const n=K.stops.length;$('knob').style.transform=`rotate(${n>1?-120+240*K.i/(n-1):0}deg)`;$('knob').classList.toggle('locked',!!K.locked);
    $('knobLbl').textContent=K.label||K.stops[K.i].label;
  },
  show(on=true){$('hud').classList.toggle('off',!on)},

  /* the slip: a short list of goals in the player's own notes */
  slip(head,goals){this.goals=goals.map(g=>({...g,done:false}));if(goals.length)audio.music.step(0);$('slipHead').textContent=head;this.renderGoals();this.pencil('');this.setHint(null)},
  renderGoals(){let seen=false;$('goals').innerHTML=this.goals.map(g=>{const c=g.done?'done':seen?'later':'now';if(!g.done)seen=true;return`<li class="${c}">${T(g.text)}</li>`}).join('')},
  done(id){const g=this.goals.find(g=>g.id===id);if(!g||g.done)return;g.done=true;this.renderGoals();audio.sfx('ok');audio.music.step(this.goals.filter(g=>g.done).length/this.goals.length)},
  pencil(text){$('pencil').textContent=T(text)},
  /* hints escalate with idle time: a pencilled note, a second one with a marker, then an offer to do the step */
  setHint(h){this.hint=h;this.idle=0;this.stage=0;this.pencil('');$('doIt').classList.add('off');this.untag('here')},
  nextHint(){
    const h=this.hint;if(!h)return;this.stage=Math.min(3,this.stage+1);this.idle=[0,20,45,90][this.stage];
    const t=h.text||[];if(this.stage>=1)this.pencil(t[Math.min(this.stage,t.length)-1]||'');
    if(this.stage>=2&&h.target)this.tag('here',h.target,'here','amber');
    if(this.stage>=3&&h.auto)$('doIt').classList.remove('off');
  },
  /* The game's one voice. talk() is story: it waits for the player on every line. say() is a remark about something
     that just happened: it stays until dismissed or replaced, and never holds the game up. */
  talk(lines){
    if(!Array.isArray(lines))lines=[lines];
    if(this.G.autoTalk)return Promise.resolve();
    return new Promise(res=>{this.dlg={lines,i:0,res};this.line(lines[0],false)});
  },
  say(text){if(this.dlg)return;if(!text){this.line('');return}this.line(text,true)},
  line(text,note){text=T(text);this.sayText=text;this.sayShown=0;$('say').classList.toggle('off',!text);$('say').classList.toggle('note',!!note);$('say').classList.remove('ready');$('sayText').textContent=''},
  /* Z, Enter, Space, or a tap on the strip */
  advance(){
    if(!this.sayText)return false;
    if(this.sayShown<this.sayText.length){this.sayShown=this.sayText.length;return true}
    audio.sfx('step');const d=this.dlg;
    if(!d){this.line('');return true}
    if(++d.i<d.lines.length)this.line(d.lines[d.i],false);else{this.dlg=null;this.line('');d.res()}
    return true;
  },
  hush(){this.dlg=null;this.line('')},
  note(id){if(save.data.notes.includes(id)||!NOTES[id])return;save.data.notes.push(id);save.store();this.refresh();const b=$('noteBtn');b.animate([{color:'#07080a',background:'#fcee0a'},{color:'#fcee0a',background:'transparent'},{color:'#7f8a99'}],{duration:2400})},
  book(on){
    if(on)$('noteList').innerHTML=save.data.notes.length?'<ul>'+save.data.notes.map(id=>{const n=NOTES[id];return`<li><b>${n.t}.</b> ${n.p} <i>${n.src}</i></li>`}).join('')+'</ul>':'<p>nothing yet.</p>';
    $('book').classList.toggle('off',!on);this.G.paused=on;
  },

  /* a drafting callout pinned to a world position; pos is a Vector3 or a function returning one */
  tag(id,pos,html,cls='',dy=0){
    let t=this.tags.get(id);if(!t){t={el:document.createElement('div'),n:this.tagN=(this.tagN||0)+1};$('tags').appendChild(t.el);this.tags.set(id,t)}
    t.pos=pos;t.dy=dy;if(t.html!==html){t.el.innerHTML='<span class="tx">'+T(html)+'</span>';t.html=html;t.w=0}const c='tag '+cls;if(t.cls!==c){t.cls=c;t.el.className=c;t.w=0}t.bare=cls.includes('bare');return t;
  },
  untag(id){const t=this.tags.get(id);if(t){t.el.remove();this.tags.delete(id)}},
  clearTags(){for(const id of [...this.tags.keys()])this.untag(id)},

  scope(label){$('scope').classList.toggle('off',!label);if(label)$('scopeLbl').textContent=label},
  wantKnob(on){$('knob').classList.toggle('want',on)},
  /* a full paper page; resolves when the player signs it off */
  page(html){
    return new Promise(res=>{const c=$('page');c.innerHTML=`<article>${html}</article>`;c.classList.remove('off');this.G.paused=true;
      const close=val=>{c.classList.add('off');this.G.paused=false;this.pageClose=null;res(val)};this.pageClose=close;
      c.querySelectorAll('button').forEach(b=>b.onclick=()=>close(b.dataset.v||'ok'))});
  },
  jolt(a=.3){const e=$('view');e.classList.remove('jolt');void e.offsetWidth;e.classList.add('jolt');this.G.glitch=1;const f=$('flash');f.style.transition='none';f.style.opacity=a;void f.offsetWidth;f.style.transition='opacity .6s ease';f.style.opacity=0},
  fade(on){$('fade').classList.toggle('on',on);this.G.glitch=Math.max(this.G.glitch,on?.9:.7);return tween(.52,()=>{})},
  /* the card that names a station on arrival */
  card(n,name){const c=$('card');c.firstElementChild.textContent=String(n).padStart(2,'0');c.lastElementChild.innerHTML='<small>station</small>'+name;c.classList.remove('go');void c.offsetWidth;c.classList.add('go')},

  /* Lay the callouts out so none sits on another or on the HUD: each is pushed along its leader until it is clear. */
  layout(){
    const G=this.G,w=innerWidth,h=innerHeight,taken=[];
    for(const id of['slip','say','scope','chain']){const e=$(id);if(e.classList.contains('off'))continue;const r=e.getBoundingClientRect();if(r.width)taken.push([r.left-6,r.top-6,r.right+6,r.bottom+6])}
    const hit=(a)=>{for(const b of taken)if(a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1])return b;return null};
    const list=[...this.tags.values()].sort((a,b)=>(a.bare-b.bare)||(a.n-b.n));
    for(const t of list){
      const p=typeof t.pos==='function'?t.pos():t.pos;if(!p){t.el.style.display='none';continue}
      v.copy(p).project(G.camera);if(!(v.z<1&&Math.abs(v.x)<1.1&&Math.abs(v.y)<1.1)){t.el.style.display='none';continue}
      t.el.style.display='';if(!t.w){t.el.style.setProperty('--lead','24px');t.w=t.el.offsetWidth;t.h=t.el.offsetHeight-(t.bare?0:30)}
      const ax=(v.x+1)/2*w,ay=(1-v.y)/2*h+t.dy,x=Math.min(w-t.w/2-8,Math.max(t.w/2+8,ax));
      /* dir -1 puts the label above its anchor, +1 below; each try slides it along the leader until it is clear */
      const fit=dir=>{let shift=0;for(let k=0;k<14;k++){const top=t.bare?(dir<0?ay-t.h-shift:ay+shift):(dir<0?ay-30-t.h-shift:ay+30+shift),box=[x-t.w/2,top,x+t.w/2,top+t.h];
        if(box[1]<6||box[3]>h-6||shift>220)return null;const b=hit(box);if(!b)return{box,shift,dir};shift+=dir<0?(box[3]-b[1])+4:(b[3]-box[1])+4}return null};
      const r=t.bare?(fit(1)||fit(-1)):(fit(-1)||fit(1));
      if(!r){t.el.style.opacity=0;continue}
      taken.push([r.box[0]-3,r.box[1]-2,r.box[2]+3,r.box[3]+2]);t.el.style.opacity='';
      if(t.bare)t.el.style.transform=`translate(${r.box[0].toFixed(1)}px,${r.box[1].toFixed(1)}px)`;
      else{t.el.classList.toggle('down',r.dir>0);t.el.style.setProperty('--lead',(24+r.shift)+'px');t.el.style.setProperty('--ax',(ax-x+t.w/2).toFixed(1)+'px');
        t.el.style.transform=`translate(${r.box[0].toFixed(1)}px,${(r.dir<0?r.box[1]:ay).toFixed(1)}px)`}
    }
  },
  update(dt){
    const G=this.G;this.layout();
    if(this.sayText&&this.sayShown<this.sayText.length){const was=Math.floor(this.sayShown);this.sayShown=Math.min(this.sayText.length,this.sayShown+dt*70);const now=Math.floor(this.sayShown);$('sayText').textContent=this.sayText.slice(0,now);
      /* a key click for every third letter; spaces are silent */
      if(now>was&&(now/3|0)>(was/3|0)&&this.sayText[now-1]!==' ')audio.sfx('type')}
    else if(this.sayText){if($('sayText').textContent!==this.sayText)$('sayText').textContent=this.sayText;$('say').classList.add('ready')}
    if(this.hint&&!G.paused&&!this.dlg){this.idle+=dt;const want=this.idle>=90?3:this.idle>=45?2:this.idle>=20?1:0;if(want>this.stage){this.stage=want-1;this.nextHint()}}
  },
};
