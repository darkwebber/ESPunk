import * as THREE from 'three';
import {mat,glowMat,box,cyl,Trace} from '../core/util.js';
import {buildCity,buildRoom} from './city.js';

/* The hub: a night bench, one dev board, a USB cable, and a lamp across the room. 1 unit = 1 cm. */
export const TOP=.44;                                   // height of the board's top face above the desk
const AMBER=0xffb347,MAG=0xff5fd2;
const PINS_L=['EN','VP','VN','D34','D35','D32','D33','D25','D26','D27','D14','D12','D13','GND','VIN'];
const PINS_R=['D23','D22','TX0','RX0','D21','D19','D18','D5','TX2','RX2','D4','D2','D15','GND','3V3'];

function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t}

function pcbTexture(){
  return canvasTex(2048,1102,(g,w,h)=>{
    const X=x=>(x+2.6)/5.2*w,Z=z=>(z+1.4)/2.8*h,S=w/5.2;
    g.fillStyle='#0c0e11';g.fillRect(0,0,w,h);
    for(let i=0;i<5000;i++){g.fillStyle=`rgba(255,255,255,${Math.random()*.025})`;g.fillRect(Math.random()*w,Math.random()*h,2,2)}
    /* resting copper */
    g.strokeStyle='#2a2216';g.lineWidth=7;g.lineCap='round';g.lineJoin='round';
    const run=p=>{g.beginPath();p.forEach((q,i)=>i?g.lineTo(X(q[0]),Z(q[1])):g.moveTo(X(q[0]),Z(q[1])));g.stroke()};
    run([[-2.05,0],[-1.7,0],[-1.7,-.55],[-1.48,-.55]]);run([[-.82,-.55],[.15,-.55],[.15,-.2],[.62,-.2]]);run([[-.3,-.55],[-.3,.5],[.62,.5]]);run([[.15,-.55],[.15,-.95]]);
    g.lineWidth=3;for(let i=0;i<15;i++){const x=-2.1+i*.2543;run([[x,-1.27],[x,-1.05],[x+.12,-.9]]);run([[x,1.27],[x,1.05],[x+.12,.9]])}
    run([[-2.05,.12],[-1.5,.12],[-1.35,.4]]);run([[-.85,.4],[.1,.4],[.1,.2],[.62,.2]]);
    /* silk */
    g.strokeStyle='rgba(230,230,225,.75)';g.fillStyle='rgba(230,230,225,.8)';g.lineWidth=2.5;
    const out=(x,z,a,b)=>g.strokeRect(X(x-a/2),Z(z-b/2),a*S,b*S);
    out(-1.15,-.55,.74,.44);out(-1.1,.4,.6,.6);out(-2.1,-.95,.42,.42);out(-2.1,.95,.42,.42);out(.15,-.95,.5,.3);
    g.font='600 30px "Paper Mono",ui-monospace,Menlo,monospace';g.textAlign='center';g.textBaseline='middle';
    PINS_L.forEach((n,i)=>g.fillText(n,X(-2.1+i*.2543),Z(-1.02)));PINS_R.forEach((n,i)=>g.fillText(n,X(-2.1+i*.2543),Z(1.02)));
    g.font='600 26px "Paper Mono",ui-monospace,Menlo,monospace';g.fillText('EN',X(-2.1),Z(-.62));g.fillText('BOOT',X(-2.1),Z(.62));g.fillText('C1',X(.15),Z(-.7));g.fillText('3V3 REG',X(-1.15),Z(-.22));
    g.font='700 44px "Paper Mono",ui-monospace,Menlo,monospace';g.fillText('ESP32 DEVKIT',X(-1.1),Z(-.02));
    /* empty capacitor pads */
    g.fillStyle='#c9a24a';g.fillRect(X(.15-.2),Z(-.95-.1),.13*S,.2*S);g.fillRect(X(.15+.07),Z(-.95-.1),.13*S,.2*S);
  });
}
const gridTexture=()=>canvasTex(1024,1024,(g,w,h)=>{g.fillStyle='#0b1513';g.fillRect(0,0,w,h);g.strokeStyle='rgba(140,200,180,.08)';g.lineWidth=1;
  for(let i=0;i<=20;i++){const p=i*w/20;g.lineWidth=i%5?1:2.5;g.beginPath();g.moveTo(p,0);g.lineTo(p,h);g.moveTo(0,p);g.lineTo(w,p);g.stroke()}});
const textTexture=(lines,w=512,h=512,color='rgba(20,22,26,.85)',bg='#9a9da3')=>canvasTex(w,h,(g)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);
  for(let i=0;i<900;i++){g.fillStyle=`rgba(255,255,255,${Math.random()*.05})`;g.fillRect(Math.random()*w,Math.random()*h,3,1)}
  g.fillStyle=color;g.textAlign='center';lines.forEach(([t,y,f])=>{g.font=f;g.fillText(t,w/2,y)})});

export function buildBench(){
  const root=new THREE.Group(),W={root};
  const gold=mat(0xd4a94a,{metalness:1,roughness:.35}),steel=mat(0xb9bcc2,{metalness:1,roughness:.3}),black=mat(0x0b0b0d,{roughness:.5}),dark=mat(0x15171b,{roughness:.6});

  /* room */
  const desk=box(170,4,80,mat(0x0e0f14,{roughness:.55,metalness:.35}),0,-2,-8);desk.receiveShadow=true;root.add(desk);
  root.add(box(170,.3,.3,new THREE.MeshBasicMaterial({color:new THREE.Color(0xff3bd4).multiplyScalar(1.3)}),0,-.4,32.1));   // neon along the desk's front edge
  const matt=new THREE.Mesh(new THREE.PlaneGeometry(34,22),new THREE.MeshStandardMaterial({map:gridTexture(),roughness:.9}));matt.rotation.x=-Math.PI/2;matt.position.set(0,.01,.5);matt.receiveShadow=true;root.add(matt);
  W.city=buildCity();root.add(W.city.root,buildRoom());
  root.add(box(64,1.2,10,mat(0x191512,{roughness:.8}),12,3.4,-77));
  const lamp=new THREE.Group();lamp.position.set(18,4,-77);
  lamp.add(cyl(1.7,.5,dark,0,.25,0),cyl(.16,6.4,steel,0,3.6,0));
  const shade=new THREE.Mesh(new THREE.CylinderGeometry(1.5,3.1,2.9,32,1,true),new THREE.MeshStandardMaterial({color:0x2a2622,roughness:.8,side:THREE.DoubleSide}));shade.position.y=7.2;lamp.add(shade);
  W.bulb=new THREE.Mesh(new THREE.SphereGeometry(.85,20,14),new THREE.MeshStandardMaterial({color:0x3a3630,emissive:0xffd9a0,emissiveIntensity:0,roughness:.3}));W.bulb.position.y=6.5;lamp.add(W.bulb);
  root.add(lamp);W.lamp=lamp;W.lampPos=new THREE.Vector3(18,10.5,-77);
  const far=box(5.2,.3,2.8,mat(0x0c0e11),9,4.25,-76);far.rotation.y=.4;root.add(far);W.far=far;W.farPos=new THREE.Vector3(9,4.6,-76);
  W.farLed=box(.5,.2,.5,new THREE.MeshStandardMaterial({color:0x2a0000,emissive:0x660000,emissiveIntensity:0}),8,4.5,-75.4);root.add(W.farLed);
  W.farHit=new THREE.Mesh(new THREE.BoxGeometry(9,5,6));W.farHit.visible=false;W.farHit.position.set(9,5,-76);root.add(W.farHit);
  W.lampLight=new THREE.PointLight(0xffd9a0,0,0,2);W.lampLight.position.set(18,10,-76);root.add(W.lampLight);
  W.setLamp=on=>{W.bulb.material.emissiveIntensity=on?6:0;W.lampLight.intensity=on?900:0;W.lampIsOn=!!on};
  W.ring2=new THREE.Mesh(new THREE.TorusGeometry(1,.012,8,96),new THREE.MeshBasicMaterial({color:new THREE.Color(0x9be7a8).multiplyScalar(2.2),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));W.ring2.rotation.x=Math.PI/2;root.add(W.ring2);
  const rim=new THREE.PointLight(0x7f96ff,260,0,2);rim.position.set(13,13,-70);root.add(rim);

  /* light */
  root.add(new THREE.HemisphereLight(0x7a86ff,0x2a0a26,.4));
  const spot=new THREE.SpotLight(0xffe2b8,5.5,0,.5,.85,0);spot.position.set(-13,30,12);spot.target.position.set(0,0,0);spot.castShadow=true;spot.shadow.mapSize.set(2048,2048);spot.shadow.bias=-.0004;spot.shadow.radius=4;
  spot.shadow.camera.near=10;spot.shadow.camera.far=60;root.add(spot,spot.target);

  /* dust in the lamp light */
  const N=260,dp=new Float32Array(N*3);for(let i=0;i<N;i++){dp[i*3]=(Math.random()-.5)*36;dp[i*3+1]=Math.random()*16;dp[i*3+2]=(Math.random()-.5)*26}
  const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(dp,3));
  W.dust=new THREE.Points(dg,new THREE.PointsMaterial({color:0xffe6c2,size:.045,transparent:true,opacity:.16,depthWrite:false}));root.add(W.dust);

  /* board */
  const b=new THREE.Group();root.add(b);W.board=b;
  b.add(box(5.2,.16,2.8,mat(0x0c0e11,{roughness:.55}),0,TOP-.08,0));
  const top=new THREE.Mesh(new THREE.PlaneGeometry(5.2,2.8),new THREE.MeshStandardMaterial({map:pcbTexture(),roughness:.6}));top.rotation.x=-Math.PI/2;top.position.y=TOP+.002;top.receiveShadow=true;b.add(top);
  b.add(box(3.8,.26,.24,black,-.32,TOP-.29,-1.27),box(3.8,.26,.24,black,-.32,TOP-.29,1.27));
  const pin=new THREE.InstancedMesh(new THREE.CylinderGeometry(.055,.055,.06,10),gold,30),m4=new THREE.Matrix4();
  for(let i=0;i<30;i++){m4.setPosition(-2.1+(i%15)*.2543,TOP+.03,i<15?-1.27:1.27);pin.setMatrixAt(i,m4)}b.add(pin);
  /* USB socket, buttons, regulator, bridge chip */
  W.usb=box(.62,.27,.8,steel,-2.36,TOP+.135,0);b.add(W.usb,box(.1,.15,.62,black,-2.66,TOP+.135,0));
  for(const z of[-.95,.95]){b.add(box(.36,.14,.36,steel,-2.1,TOP+.07,z),cyl(.09,.08,black,-2.1,TOP+.17,z))}
  W.reg=box(.66,.17,.36,black,-1.15,TOP+.085,-.55);b.add(W.reg,box(.3,.04,.14,steel,-1.15,TOP+.02,-.8));
  for(const dx of[-.22,0,.22])b.add(box(.08,.03,.12,steel,-1.15+dx,TOP+.015,-.32));
  b.add(box(.52,.08,.52,black,-1.1,TOP+.04,.4));
  for(const[x,z]of[[-.75,.75],[.2,.75],[-1.75,.55],[-.05,-.85]])b.add(box(.16,.09,.09,mat(0x8a6a44),x,TOP+.045,z));
  W.regHit=new THREE.Mesh(new THREE.BoxGeometry(.9,.5,.7));W.regHit.visible=false;W.regHit.position.set(-1.15,TOP+.15,-.55);b.add(W.regHit);
  W.regMat=new THREE.MeshStandardMaterial({color:0x0b0b0d,roughness:.5,emissive:0xff6a2a,emissiveIntensity:0});W.reg.material=W.regMat;
  /* the regulator's gain trimmer, and the button the whole game is about */
  const pot=new THREE.Group();pot.position.set(-.62,TOP,.0);pot.add(box(.3,.15,.3,mat(0x2545a8,{roughness:.4}),0,.075,0));
  W.pot=new THREE.Group();W.pot.position.y=.16;W.pot.add(cyl(.09,.03,gold,0,0,0,20),box(.15,.012,.025,black,0,.018,0));pot.add(W.pot);b.add(pot);
  W.potHit=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5));W.potHit.visible=false;W.potHit.position.set(-.62,TOP+.15,0);b.add(W.potHit);W.potPos=new THREE.Vector3(-.62,TOP+.2,0);
  W.btnHit=new THREE.Mesh(new THREE.BoxGeometry(.5,.45,.5));W.btnHit.visible=false;W.btnHit.position.set(-2.1,TOP+.15,.95);b.add(W.btnHit);W.btnPos=new THREE.Vector3(-2.1,TOP+.22,.95);
  /* LEDs */
  W.ledRed=box(.22,.09,.14,new THREE.MeshStandardMaterial({color:0x2a0000,emissive:0x660000,emissiveIntensity:0}),-.55,TOP+.045,-.95);W.ledRedPos=new THREE.Vector3(-.55,TOP+.1,-.95);
  W.ledBlue=box(.22,.09,.14,new THREE.MeshStandardMaterial({color:0x00072a,emissive:0x001c77,emissiveIntensity:0}),-.55,TOP+.045,.95);b.add(W.ledRed,W.ledBlue);
  /* radio module: its own small board, a shield can, and the antenna hanging off the end */
  const mod=new THREE.Group();b.add(mod);W.module=mod;
  mod.add(box(2.55,.08,1.8,mat(0x0a0c0f),1.825,TOP+.04,0));
  W.shield=box(1.58,.26,1.6,mat(0xa9acb2,{metalness:1,roughness:.38}),1.42,TOP+.21,0);mod.add(W.shield);
  const lid=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.5),new THREE.MeshStandardMaterial({map:textTexture([['ESP32','200','700 96px "Paper Mono",ui-monospace,Menlo,monospace'],['WROOM-32','290','600 60px "Paper Mono",ui-monospace,Menlo,monospace'],['2.4 GHz  Wi-Fi + BT','400','500 34px "Paper Mono",ui-monospace,Menlo,monospace']].map(([t,y,f])=>[t,+y,f])),metalness:.8,roughness:.45}));
  lid.rotation.x=-Math.PI/2;lid.position.set(1.42,TOP+.342,0);mod.add(lid);
  W.antenna=new THREE.Group();mod.add(W.antenna);W.antMat=new THREE.MeshStandardMaterial({color:0xd4a94a,metalness:1,roughness:.35,emissive:MAG,emissiveIntensity:0});
  for(let i=0;i<5;i++){const z=-.72+i*.36;W.antenna.add(box(.5,.02,.06,W.antMat,2.72,TOP+.09,z));if(i<4)W.antenna.add(box(.06,.02,.36,W.antMat,i%2?2.5:2.94,TOP+.09,z+.18))}
  W.antPos=new THREE.Vector3(2.72,TOP+.1,0);
  /* power: the paths that light up */
  const y=TOP+.012;
  W.trA=new Trace([[-2.05,0],[-1.7,0],[-1.7,-.55],[-1.48,-.55]],.07,AMBER,y);
  W.trB=new Trace([[-.82,-.55],[.15,-.55],[.15,-.2],[.62,-.2]],.07,AMBER,y);
  W.trEN=new Trace([[-.3,-.55],[-.3,.5],[.62,.5]],.045,AMBER,y);
  W.trC=new Trace([[.15,-.55],[.15,-.9]],.07,AMBER,y);
  W.trBtn=new Trace([[-1.88,.95],[-1.4,.86],[.35,.86],[.35,.7],[.62,.7]],.04,0xdff4ff,y);
  W.trOut=new Trace([[.62,.46],[-.55,.46],[-.55,.9]],.04,0x5fe3ff,y);
  b.add(W.trA.group,W.trB.group,W.trEN.group,W.trC.group,W.trBtn.group,W.trOut.group);
  W.ledPos=new THREE.Vector3(-.55,TOP+.08,.95);W.ledHit=new THREE.Mesh(new THREE.BoxGeometry(.5,.4,.5));W.ledHit.visible=false;W.ledHit.position.copy(W.ledPos);b.add(W.ledHit);
  W.wire=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xdff4ff}));W.wire.visible=false;W.wire.frustumCulled=false;root.add(W.wire);
  W.dots=new THREE.InstancedMesh(new THREE.SphereGeometry(.035,8,6),new THREE.MeshBasicMaterial({color:new THREE.Color(AMBER).multiplyScalar(3)}),28);W.dots.count=0;b.add(W.dots);
  /* probe points */
  W.points={vbus:new THREE.Vector3(-1.7,TOP+.03,-.25),reg:new THREE.Vector3(-.5,TOP+.03,-.55),en:new THREE.Vector3(.2,TOP+.03,.5)};
  W.pads={};for(const k in W.points){const p=cyl(.07,.03,gold,0,0,0,16);p.position.copy(W.points[k]);b.add(p);const hit=new THREE.Mesh(new THREE.SphereGeometry(.24,8,6));hit.visible=false;hit.position.copy(W.points[k]);b.add(hit);W.pads[k]=hit}
  W.capPos=new THREE.Vector3(.15,TOP,-.95);
  W.antHit=new THREE.Mesh(new THREE.BoxGeometry(.9,.5,1.9));W.antHit.visible=false;W.antHit.position.set(2.72,TOP+.15,0);b.add(W.antHit);

  /* USB cable */
  const plug=new THREE.Group();const shell=mat(0x3a3d44,{roughness:.45});plug.add(box(.5,.14,.6,steel,.25,0,0),box(1,.34,.82,shell,-.5,0,0),box(.5,.26,.5,shell,-1.2,0,0),box(.5,.02,.3,glowMat(0xffb347,1.6),-.5,.18,0));
  W.plug=plug;W.plugHome=new THREE.Vector3(-8.5,.3,2.6);W.plugIn=new THREE.Vector3(-3.1,TOP+.135,0);plug.position.copy(W.plugHome);plug.rotation.y=-.45;root.add(plug);
  const cableMat=mat(0x26282d,{roughness:.6});let cable=null;
  W.updateCable=()=>{
    const p=plug.position,d=new THREE.Vector3(-1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),plug.rotation.y);
    const a=p.clone().addScaledVector(d,1.4),c=new THREE.CatmullRomCurve3([a,a.clone().addScaledVector(d,2.5).setY(.12),new THREE.Vector3((a.x-34)/2,.1,a.z+5),new THREE.Vector3(-34,.1,9),new THREE.Vector3(-60,.1,4)]);
    if(cable){cable.geometry.dispose();root.remove(cable)}
    cable=new THREE.Mesh(new THREE.TubeGeometry(c,40,.1,8),cableMat);cable.castShadow=true;root.add(cable);
  };W.updateCable();

  /* parts tray: four capacitors, one footprint */
  const tray=new THREE.Group();tray.position.set(-1.3,0,2.9);tray.add(box(4.6,.08,1.5,mat(0x1b1d22,{roughness:.7}),0,.04,0));root.add(tray);W.tray=tray;tray.visible=false;
  const tan=mat(0xb08a58,{roughness:.5}),can=mat(0x15234a,{roughness:.4});W.caps={};
  const mk=(id,mesh,x,h)=>{mesh.position.set(x,.08+h/2,2.9);mesh.visible=false;root.add(mesh);W.caps[id]={mesh,h,home:mesh.position.clone()}};
  mk('c100n',box(.2,.12,.12,tan),-3,.12);mk('c10u',box(.34,.2,.22,tan),-1.95,.2);
  const c22=new THREE.Group();c22.add(cyl(.17,.36,can),cyl(.171,.05,steel,0,.16,0));mk('c22u',c22,-.8,.36);
  const c100=new THREE.Group();c100.add(cyl(.27,.56,can),cyl(.271,.06,steel,0,.25,0));mk('c100u',c100,.4,.56);
  for(const id in W.caps)W.caps[id].mesh.traverse(o=>{if(o.isMesh)o.castShadow=true});
  const land={};for(const id in W.caps)land[id]=W.caps[id].home.clone();
  W.trayAt=portrait=>{tray.position.set(portrait?4.9:-1.3,0,portrait?0:2.9);tray.rotation.y=portrait?Math.PI/2:0;
    Object.keys(W.caps).forEach((id,i)=>{const c=W.caps[id];if(portrait)c.home.set(4.9,.08+c.h/2,-1.65+i*1.1);else c.home.copy(land[id]);c.mesh.position.copy(c.home)})};

  /* radio ring and the district glow */
  W.ring=new THREE.Mesh(new THREE.TorusGeometry(1,.012,8,96),new THREE.MeshBasicMaterial({color:new THREE.Color(MAG).multiplyScalar(2.5),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
  W.ring.rotation.x=Math.PI/2;W.ring.position.copy(W.antPos);root.add(W.ring);
  W.wave=new THREE.Mesh(new THREE.RingGeometry(.975,1,128),new THREE.MeshBasicMaterial({color:new THREE.Color(AMBER).multiplyScalar(2),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  W.wave.rotation.x=-Math.PI/2;W.wave.position.set(0,TOP+.02,0);root.add(W.wave);
  W.halo=new THREE.Mesh(new THREE.RingGeometry(1.25,1.33,64),new THREE.MeshBasicMaterial({color:new THREE.Color(0x5fe3ff).multiplyScalar(2),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  W.halo.rotation.x=-Math.PI/2;W.halo.position.set(1.42,TOP+.36,0);root.add(W.halo);
  W.modHit=new THREE.Mesh(new THREE.BoxGeometry(1.7,.6,1.7));W.modHit.visible=false;W.modHit.position.set(1.42,TOP+.25,0);b.add(W.modHit);

  b.traverse(o=>{if(o.isMesh&&o.visible){o.castShadow=true;o.receiveShadow=true}});plug.traverse(o=>{if(o.isMesh)o.castShadow=true});

  /* live state the chapters drive */
  W.power={a:0,b:0,en:0,level:1,flow:0,btn:0,out:0,feed:1};
  const tmp=new THREE.Vector3();let ft=0;
  W.update=(dt,scaleWarp)=>{
    const P=W.power;W.trA.set(P.a);W.trB.set(P.b);W.trEN.set(P.en);W.trC.set(P.b>=.45?1:0);W.trBtn.set(P.btn);W.trOut.set(P.out);
    const glow=2.4*P.level;W.trA.mat.emissiveIntensity=2.4;W.trB.mat.emissiveIntensity=W.trEN.mat.emissiveIntensity=W.trC.mat.emissiveIntensity=glow;
    ft+=dt*(.15+.55*P.feed)*.5;let n=0;
    for(const[tr,p]of[[W.trA,P.a],[W.trB,P.b]]){if(p<=0)continue;for(let i=0;i<10;i++){const u=((i/10+ft)%1);if(u>p)continue;tr.at(u,tmp);tmp.y+=.03;m4.setPosition(tmp);W.dots.setMatrixAt(n++,m4)}}
    W.dots.count=P.flow?n:0;W.dots.instanceMatrix.needsUpdate=true;
    const a=W.dust.geometry.attributes.position;for(let i=0;i<a.count;i++){let yy=a.getY(i)+dt*.12*scaleWarp;if(yy>16)yy=0;a.setY(i,yy)}a.needsUpdate=true;W.city.update(dt);
  };
  return W;
}
