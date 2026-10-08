/* The 3.3 V rail as a plant you can drive: a capacitor fed by the regulator and drained by the chip.
   dV/dt = (feed - draw) / C.  The regulator is either your hand (feed given) or its own loop: a proportional
   correction of gain K that takes TAU to act. A toy model, tuned to show the effects; the notebook says so. */
export const RAIL={VSET:3.3,VBO:2.43,VMAX:3.9,LO:2.7,HI:3.6,I_IDLE:.08,I_CPU:.16,I_TX:.45,IMAX:.8,C0:3e-6,TAU:30e-6};
export const CAPS={c100n:100e-9,c10u:10e-6,c22u:22e-6,c100u:100e-6};
export const CAP_LABEL={c100n:'100 nF',c10u:'10 µF',c22u:'22 µF',c100u:'100 µF'};

export class Rail{
  constructor(extraC=0){this.C=RAIL.C0+extraC;this.reset()}
  reset(){this.v=RAIL.VSET;this.i=RAIL.I_IDLE;this.t=0;this.min=this.max=RAIL.VSET;this.fault=null}
  /* advance by dt seconds. feed: amps supplied by hand, or null to let the loop (gain K) decide */
  step(dt,draw,feed,K=1){
    const R=RAIL;let left=dt;
    while(left>1e-12&&!this.fault){
      const h=Math.min(left,2e-6);left-=h;
      if(feed==null){const want=Math.min(R.IMAX,Math.max(0,R.I_IDLE+K*(R.VSET-this.v)));this.i+=(want-this.i)*h/R.TAU}else this.i=feed;
      this.v=Math.max(0,this.v+(this.i-draw)*h/this.C);this.t+=h;
      if(this.v<this.min)this.min=this.v;if(this.v>this.max)this.max=this.v;
      if(this.v<R.VBO)this.fault='brownout';else if(this.v>R.VMAX)this.fault='overvoltage';
    }
    return this;
  }
}
/* load scripts: [from, to, amps] in seconds of chip time; idle current otherwise */
export const SCRIPT={
  hand:{T:500e-6,ev:[[75e-6,150e-6,RAIL.I_CPU],[200e-6,250e-6,.22],[325e-6,425e-6,RAIL.I_TX]]},
  one:{T:.3e-3,ev:[[.06e-3,.3e-3,RAIL.I_TX]]},
  loop:{T:6e-3,ev:[[.5e-3,1.5e-3,RAIL.I_TX],[2.5e-3,3.5e-3,RAIL.I_TX],[4.5e-3,5.5e-3,RAIL.I_TX]]},
};
export const drawAt=(s,t)=>{for(const e of s.ev)if(t>=e[0]&&t<e[1])return e[2];return RAIL.I_IDLE};
/* run the loop script hands-off and report what the scope would capture */
export function capture(extraC,K,s=SCRIPT.loop,dt=s.T/1500){
  const r=new Rail(extraC),t=[],V=[];
  for(let x=0;x<s.T&&!r.fault;x+=dt){r.step(dt,drawAt(s,x),null,K);t.push(r.t);V.push(r.v)}
  return{s,t,V,min:r.min,max:r.max,fault:r.fault,at:r.t,ok:!r.fault&&r.min>=RAIL.LO&&r.max<=RAIL.HI};
}
