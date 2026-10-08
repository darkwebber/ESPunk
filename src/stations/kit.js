import * as THREE from 'three';
import {save,tween,ease} from '../core/util.js';
import {NOTES} from '../core/hud.js';

/* Shared scaffolding for stations: entering the lane table, a tick clock, choosing a lane, restarts, and the sign-off. */
export const DECKVIEW={t:new THREE.Vector3(0,0,.6),d:36,th:0,ph:.72,stage:true};

export async function enterDeck(G,lanes,width){
  await G.dive(async()=>{G.showDeck();G.deck.setup(lanes,width);G.rig.zoom=true;G.rig.lim={dmin:16,dmax:46,phmin:.4,phmax:1.3};G.rig.jump(DECKVIEW)});
  lanes.forEach((l,i)=>{if(l.name)G.hud.tag('lane'+i,G.deck.head(i),l.name,'')});
}
/* advance S.t by whole ticks at `rate` ticks per second; S.frac is how far into the current tick we are */
export function clock(S,dt,rate,onTick){S.acc=(S.acc||0)+dt*rate;let n=0;while(S.acc>=1&&n++<80){S.acc-=1;onTick(S.t);S.t++}if(S.acc>80)S.acc=0;S.frac=rate>12?0:S.acc}
/* lanes the player can choose by click, tap, number key or arrow key; choice lands in S.lane */
export function lanePick(G,S,on=()=>true,onPick){
  const D=G.deck,set=i=>{if(i<0||i>=D.n||!on(i))return;S.lane=i;if(onPick)onPick(i);G.hud.idle=0};
  D.hit.forEach((m,i)=>G.thing(m,{hold:true,lane:i,on:()=>on(i),click:()=>set(i)}));
  return{set,key:k=>{const n='123456789'.indexOf(k);if(n>=0)set(n);else if(k==='arrowleft'||k==='a')set((S.lane??0)-1);else if(k==='arrowright'||k==='d')set((S.lane??-1)+1)},
    held:()=>{if(G.held&&G.held.lane!=null)set(G.held.lane)}};
}
/* the chip restarted: tear the picture and count it */
export function restart(G,strong=.6){save.data.stats.resets++;save.store();G.audio.sfx('reset');G.hud.jolt();G.rig.shake=strong}
export function mark(G,n){save.data.done[n]=true;save.store();G.hud.refresh();G.audio.music.grow()}
export async function signOff(G,n,title,blurb,notes,nums=''){
  mark(G,n);G.hud.setHint(null);G.hud.wantKnob(false);G.hud.hush();G.audio.sfx('fanfare');
  const w=G.deck.root.visible?G.deck.wave:G.bench.wave;G.bloom.strength=1.4;tween(1.8,k=>{w.scale.setScalar(.4+k*11);w.material.opacity=1-k;G.bloom.strength=.7+.8*(1-k)},ease.out);
  await tween(1.8,()=>{});
  for(const id of notes)G.hud.note(id);
  await G.hud.page(`<h2>station ${String(n).padStart(2,'0')} · ${title}</h2><p>${blurb}</p>${nums?`<h3>your build</h3><div class="nums">${nums}</div>`:''}
    <h3>now in your notebook</h3><ul>${notes.map(i=>`<li>${NOTES[i].t}</li>`).join('')}</ul><button class="sign">sign off &rarr;</button>`);
  if(!G.bench.root.visible)await G.dive(async()=>{G.showBench();G.hud.clearTags();G.hud.scope(null);G.rig.jump(G.VIEW.board)});
  G.go('roam');
}
