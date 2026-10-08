/* A one-core, tick-based scheduler. The rule is the FreeRTOS one: the highest-priority ready task runs; equals take turns.
   Optional: one baton (mutex), priority inheritance, and a watchdog on one task. Pure logic, no rendering. */
export class Sched{
  constructor({tasks,inherit=false,watch=null,wdt=0}){this.defs=tasks;this.inherit=inherit;this.watch=watch;this.wdt=wdt;this.reset()}
  reset(){
    this.t=0;this.rel=-1;this.holder=null;this.bite=false;this.last=-1;this.log=[];
    this.tasks=this.defs.map(d=>({offset:0,deadline:d.period,baton:false,...d,st:'sleep',rem:0,due:Infinity,missed:false,misses:0,done:0,waited:0}));
    this.by=Object.fromEntries(this.tasks.map(k=>[k.id,k]));
  }
  setPrio(id,p){this.by[id].prio=p;this.defs.find(d=>d.id===id).prio=p}
  waitingOnBaton(k){return k.st==='ready'&&k.baton&&this.holder&&this.holder!==k}
  eligible(){return this.tasks.filter(k=>k.st==='ready'&&!this.waitingOnBaton(k))}
  eprio(k){
    if(this.inherit&&this.holder===k){let p=k.prio;for(const o of this.tasks)if(this.waitingOnBaton(o))p=Math.max(p,o.prio);return p}
    return k.prio;
  }
  release(){
    if(this.rel===this.t)return;this.rel=this.t;
    for(const k of this.tasks){
      if(this.t>=k.offset&&(this.t-k.offset)%k.period===0){
        if(k.st==='ready'&&!k.missed){k.misses++}          // previous job never finished
        if(this.holder===k)this.holder=null;
        k.st='ready';k.rem=k.work;k.due=this.t+k.deadline;k.missed=false;
      }
    }
  }
  /* true when a higher-priority task is about to push the baton holder aside while someone waits for the baton */
  inversionAhead(){
    this.release();
    if(this.inherit||!this.holder)return false;
    if(!this.tasks.some(k=>this.waitingOnBaton(k)))return false;
    return this.eligible().some(k=>k!==this.holder&&k.prio>this.holder.prio);
  }
  pick(){
    const el=this.eligible();if(!el.length)return null;
    const top=Math.max(...el.map(k=>this.eprio(k))),best=el.filter(k=>this.eprio(k)===top);
    const n=this.tasks.length;                              // take turns among equals, starting after whoever ran last
    for(let i=1;i<=n;i++){const k=this.tasks[(this.last+i+n)%n];if(best.includes(k))return k}
    return best[0];
  }
  /* choice: undefined = apply the rule; a task id = run that task if it can run; null = leave the core idle */
  step(choice){
    if(this.bite)return null;
    this.release();
    const ready=this.tasks.filter(k=>k.st==='ready').map(k=>k.id),blocked=this.tasks.filter(k=>this.waitingOnBaton(k)).map(k=>k.id);
    let run=choice===undefined?this.pick():(choice&&this.eligible().includes(this.by[choice])?this.by[choice]:null);
    const released=this.tasks.filter(k=>k.st==='ready'&&k.due-k.deadline===this.t).map(k=>k.id);
    if(run){
      if(run.baton&&!this.holder)this.holder=run;
      this.last=this.tasks.indexOf(run);run.rem--;
      if(run.rem===0){run.st='sleep';run.done++;run.waited=0;if(this.holder===run)this.holder=null}
    }
    const late=[];
    for(const k of this.tasks){
      if(k.st==='ready'){
        k.waited++;
        if(!k.missed&&this.t+1>=k.due){k.missed=true;k.misses++;late.push(k.id)}
      }
    }
    if(this.wdt&&this.watch&&this.by[this.watch].st==='ready'&&this.by[this.watch].waited>=this.wdt)this.bite=true;
    const e={t:this.t,run:run?run.id:null,ready,blocked,released,late,holder:this.holder?this.holder.id:null,bite:this.bite};
    this.log.push(e);this.t++;return e;
  }
  run(n){for(let i=0;i<n&&!this.bite;i++)this.step();return this}
  misses(){return Object.fromEntries(this.tasks.map(k=>[k.id,k.misses]))}
  total(){return this.tasks.reduce((a,k)=>a+k.misses,0)}
}

/* The two task sets of chapter 3. Times are in ticks. */
export const HAND_TASKS=p=>[
  {id:'BUTTON',prio:p[0],period:7,work:1,deadline:1,offset:3},
  {id:'RADIO', prio:p[1],period:5,work:2,deadline:5,offset:0},
  {id:'LOGGER',prio:p[2],period:4,work:1,deadline:4,offset:0},
];
export const BATON_TASKS=()=>[
  {id:'BUTTON',prio:3,period:20,work:2,deadline:6,offset:2,baton:true},
  {id:'RADIO', prio:2,period:20,work:10,deadline:20,offset:3},
  {id:'LOGGER',prio:1,period:20,work:4,deadline:20,offset:0,baton:true},
];
