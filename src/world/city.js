import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {mat,box} from '../core/util.js';

/* What is outside the bench: a wet neon city seen from a high floor, and what is inside the chip: a dark grid of blocks.
   Neither is to scale; both are there so every place in the game has somewhere it is. */
const CY=0x39f0ff,MG=0xff3bd4,YL=0xfcee0a,RD=0xff4a5e;
const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.random()*a.length|0];
function tex(w,h,draw,repeat){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  if(repeat)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t}

/* one tile of tower face: mostly dark, a scatter of lit windows, sometimes a whole lit floor */
const windows=()=>tex(256,512,(g,w,h)=>{g.fillStyle='#04050a';g.fillRect(0,0,w,h);const cw=w/8,ch=h/32;
  for(let r=0;r<32;r++){const floor=Math.random()<.07,hue=pick(['#9defff','#ffd9a0','#ff8ae6','#cfe6ff']);
    for(let c=0;c<8;c++){const lit=floor?Math.random()<.85:Math.random()<.16;if(!lit){if(Math.random()<.3){g.fillStyle='rgba(120,150,200,.05)';g.fillRect(c*cw+4,r*ch+4,cw-8,ch-8)}continue}
      g.globalAlpha=rnd(.35,1);g.fillStyle=floor?hue:pick(['#9defff','#ffd9a0','#ffd9a0','#ff8ae6','#e8f4ff']);g.fillRect(c*cw+4,r*ch+4,cw-8,ch-8);g.globalAlpha=1}}},true);

function sign(text,color,vertical){
  const chars=[...text],w=vertical?128:64+chars.length*58,h=vertical?40+chars.length*104:128;
  const t=tex(w,h,(g)=>{g.clearRect(0,0,w,h);g.strokeStyle=color;g.lineWidth=5;g.strokeRect(6,6,w-12,h-12);g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';
    g.shadowColor=color;g.shadowBlur=14;g.font=`800 ${vertical?88:76}px "Paper Mono","Kohinoor Telugu","Noto Sans Telugu","Telugu Sangam MN",sans-serif`;
    if(vertical)chars.forEach((c,i)=>g.fillText(c,w/2,72+i*104));else g.fillText(text,w/2,h/2+4)});
  const k=vertical?.1:.06,m=new THREE.Mesh(new THREE.PlaneGeometry(w*k,h*k),new THREE.MeshBasicMaterial({map:t,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
  m.material.color.multiplyScalar(1.2);return m;
}

export function buildCity(){
  const g=new THREE.Group(),W={root:g};
  /* the sky is a glow on the horizon and nothing above it */
  const sky=new THREE.Mesh(new THREE.CylinderGeometry(460,460,520,48,1,true),new THREE.MeshBasicMaterial({side:THREE.BackSide,fog:false,depthWrite:false,
    map:tex(8,512,(c,w,h)=>{const gr=c.createLinearGradient(0,h,0,0);gr.addColorStop(0,'#07040f');gr.addColorStop(.2,'#3a0f4d');gr.addColorStop(.27,'#7a1c6e');gr.addColorStop(.33,'#2a1250');gr.addColorStop(.5,'#0c0a22');gr.addColorStop(1,'#04050a');c.fillStyle=gr;c.fillRect(0,0,w,h)})}));
  sky.position.y=110;sky.renderOrder=-10;g.add(sky);

  /* towers all the way round, merged into one mesh; uv repeats with size so windows stay one size */
  const geos=[],tops=[],col=new THREE.Color();
  for(let i=0;i<230;i++){
    const a=rnd(0,Math.PI*2),r=rnd(150,340),w=rnd(16,44),d=rnd(16,44),h=rnd(70,150)+Math.pow(Math.random(),3)*190,x=Math.sin(a)*r,z=-Math.cos(a)*r;
    if(Math.abs(x)<60&&z<0&&z>-190)continue;                               // keep a canyon open straight ahead
    const b=new THREE.BoxGeometry(w,h,d),uv=b.attributes.uv;for(let k=0;k<uv.count;k++)uv.setXY(k,uv.getX(k)*Math.round(w/14)+i*.37,uv.getY(k)*Math.round(h/56*8)/8+i*.13);
    b.rotateY(rnd(0,1.5));b.translate(x,h/2-95,z);
    const tint=rnd(.45,1);col.setRGB(tint*rnd(.8,1),tint,tint*rnd(.9,1.15));const ca=new Float32Array(b.attributes.position.count*3);for(let k=0;k<ca.length;k+=3){ca[k]=col.r;ca[k+1]=col.g;ca[k+2]=col.b}
    b.setAttribute('color',new THREE.BufferAttribute(ca,3));geos.push(b);tops.push([x,h-95,z,r]);
  }
  g.add(new THREE.Mesh(mergeGeometries(geos),new THREE.MeshBasicMaterial({map:windows(),vertexColors:true})));
  /* aircraft warning lights */
  const bp=new Float32Array(tops.length*3);tops.forEach((t,i)=>bp.set([t[0],t[1]+2,t[2]],i*3));const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(bp,3));
  W.beacons=new THREE.Points(bg,new THREE.PointsMaterial({color:new THREE.Color(RD).multiplyScalar(2),size:3.2,transparent:true,depthWrite:false}));g.add(W.beacons);

  /* signs hung on the nearer towers, facing in. Some read EEGA, in Latin and in Telugu, after the film the player's fly comes from. */
  W.signs=[];const near=tops.filter(t=>t[3]<235&&t[1]>20).sort((a,b)=>a[3]-b[3]).slice(0,40);
  const words=[['EEGA',MG,1],['EEGA',CY,1],['ఈగ',YL,1],['RADIO',CY,0],['2.4 GHz',MG,0],['OPEN 24H',YL,0],['NODE',RD,0],['EEGA',CY,0],['ఈగ',MG,1],['ESP',MG,0],['EEGA',YL,1],['RADIO',RD,0],['ఈగ',CY,1],['NODE',YL,0]];
  words.forEach(([t,c,v],i)=>{const tw=near[(i*3)%near.length];if(!tw)return;const s=sign(t,'#'+new THREE.Color(c).getHexString(),v),k=(tw[3]-26)/tw[3];
    s.position.set(tw[0]*k,rnd(-6,Math.min(70,tw[1]-18)),tw[2]*k);s.lookAt(0,s.position.y,0);s.scale.setScalar(rnd(.9,1.5));g.add(s);W.signs.push({m:s,f:Math.random()<.4,t:rnd(0,9)})});

  /* traffic: lights that drift round the block at different heights */
  const NT=70,tp=new Float32Array(NT*3),tc=new Float32Array(NT*3),cars=[];
  for(let i=0;i<NT;i++){cars.push({a:rnd(0,6.28),r:rnd(105,300),y:rnd(-50,90),s:rnd(.02,.07)*(Math.random()<.5?-1:1)});col.set(pick([0xffffff,RD,0xffd9a0,CY])).multiplyScalar(1.6);tc.set([col.r,col.g,col.b],i*3)}
  const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.BufferAttribute(tp,3));tg.setAttribute('color',new THREE.BufferAttribute(tc,3));
  W.traffic=new THREE.Points(tg,new THREE.PointsMaterial({size:2.2,vertexColors:true,transparent:true,depthWrite:false}));W.traffic.frustumCulled=false;g.add(W.traffic);

  /* rain, falling outside only; each drop is a short line moved in the vertex shader */
  const NR=2600,rp=new Float32Array(NR*6),ra=new Float32Array(NR*2),rs=new Float32Array(NR*2);
  for(let i=0;i<NR;i++){const a=rnd(0,6.28),r=rnd(96,250),x=Math.sin(a)*r,z=-Math.cos(a)*r,y=rnd(0,300),sp=rnd(150,260);rp.set([x,y,z,x,y,z],i*6);ra.set([0,1],i*2);rs.set([sp,sp],i*2)}
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(rp,3));rg.setAttribute('end',new THREE.BufferAttribute(ra,1));rg.setAttribute('speed',new THREE.BufferAttribute(rs,1));
  W.rain=new THREE.LineSegments(rg,new THREE.ShaderMaterial({uniforms:{time:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'attribute float end,speed;uniform float time;varying float a;void main(){vec3 p=position;p.y=mod(p.y-time*speed,300.)-100.+end*speed*.03;p.x+=end*1.2;a=1.-end*.8;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader:'varying float a;void main(){gl_FragColor=vec4(.55,.7,1.,.2*a);}'}));W.rain.frustumCulled=false;g.add(W.rain);

  let time=0;const pa=tg.attributes.position;
  W.update=dt=>{time+=dt;W.rain.material.uniforms.time.value=time;
    for(let i=0;i<NT;i++){const c=cars[i];c.a+=c.s*dt;pa.setXYZ(i,Math.sin(c.a)*c.r,c.y,-Math.cos(c.a)*c.r)}pa.needsUpdate=true;
    W.beacons.material.opacity=.35+.65*Math.max(0,Math.sin(time*2.2));
    for(const s of W.signs)if(s.f){const k=Math.sin(time*13+s.t)*Math.sin(time*2.3+s.t*2);s.m.material.opacity=k>.72?.25:1}
  };
  return W;
}

/* The room the bench is in: glazing along the back, two tubes of neon overhead, a floor a long way down. */
export function buildRoom(){
  const g=new THREE.Group(),frame=mat(0x0a0b10,{roughness:.5,metalness:.6});
  g.add(box(420,70,2,mat(0x08090d,{roughness:.9}),0,-32,-84));                         // wall under the sill
  for(let x=-200;x<=200;x+=50)g.add(box(1.8,130,1.8,frame,x,68,-84));                 // mullions
  for(const y of[3.6,46,92])g.add(box(420,1.6,2.2,frame,0,y,-84));
  g.add(box(420,.35,.5,new THREE.MeshBasicMaterial({color:new THREE.Color(CY).multiplyScalar(1.3)}),0,4.7,-82.8));   // a line of light along the sill
  const floor=box(520,1,420,mat(0x07080c,{roughness:.35,metalness:.7}),0,-67,-20);g.add(floor);
  for(const[x,c]of[[-62,MG],[58,CY]]){const tube=box(.9,.9,90,new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(1.7)}),x,52,-30);g.add(tube,box(3,1.2,96,frame,x,53.2,-30));
    const l=new THREE.PointLight(c,2600,0,2);l.position.set(x*.8,40,-22);g.add(l)}
  return g;
}

/* Inside the chip: a grid that runs to the horizon and low blocks standing on it, around whichever table is in use. */
export function buildVoid(){
  const g=new THREE.Group(),W={root:g};
  W.grid=new THREE.Mesh(new THREE.PlaneGeometry(700,700),new THREE.ShaderMaterial({uniforms:{time:{value:0}},transparent:true,depthWrite:false,
    vertexShader:'varying vec3 w;void main(){vec4 p=modelMatrix*vec4(position,1.);w=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
    fragmentShader:`varying vec3 w;uniform float time;
      float ln(vec2 p,float s){vec2 q=abs(fract(p/s-.5)-.5)/fwidth(p/s);return 1.-min(min(q.x,q.y),1.);}
      void main(){float r=length(w.xz),a=ln(w.xz,3.)*.22+ln(w.xz,15.)*.6;
        float pulse=smoothstep(3.,0.,abs(r-mod(time*14.,160.)))*.9;
        vec3 c=mix(vec3(.22,.94,1.),vec3(1.,.23,.83),smoothstep(20.,110.,r));
        float fade=exp(-r*.016)*smoothstep(11.5,15.,r);
        gl_FragColor=vec4(c*(a+pulse*(.25+a)),(a+pulse*.3)*fade);}`}));
  W.grid.rotation.x=-Math.PI/2;W.grid.position.y=-.64;W.grid.renderOrder=-2;g.add(W.grid);
  const N=150,body=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat(0x0b0d14,{roughness:.45,metalness:.6}),N),cap=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial(),N);
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),c=new THREE.Color();
  for(let i=0;i<N;i++){const a=rnd(0,6.28),r=rnd(17,95),w=Math.round(rnd(1,3))*1.5,d=Math.round(rnd(1,3))*1.5,h=.6+Math.pow((r-17)/78,1.6)*rnd(4,34)+rnd(0,1.6);
    const x=Math.round(Math.sin(a)*r/3)*3,z=Math.round(Math.cos(a)*r/3)*3;
    m.compose(new THREE.Vector3(x,h/2-.64,z),q,new THREE.Vector3(w,h,d));body.setMatrixAt(i,m);
    m.compose(new THREE.Vector3(x,h-.6,z),q,new THREE.Vector3(w+.04,.07,d+.04));cap.setMatrixAt(i,m);cap.setColorAt(i,c.set(pick([CY,CY,MG,YL])).multiplyScalar(rnd(.06,.22)))}
  g.add(body,cap);
  const NP=220,pp=new Float32Array(NP*3);for(let i=0;i<NP;i++)pp.set([rnd(-40,40),rnd(0,26),rnd(-40,40)],i*3);const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pp,3));
  W.motes=new THREE.Points(pg,new THREE.PointsMaterial({color:new THREE.Color(CY).multiplyScalar(1.4),size:.09,transparent:true,opacity:.5,depthWrite:false}));g.add(W.motes);
  let time=0;const pa=pg.attributes.position;
  W.update=dt=>{time+=dt;W.grid.material.uniforms.time.value=time;for(let i=0;i<NP;i++){let y=pa.getY(i)+dt*.5;if(y>26)y=0;pa.setY(i,y)}pa.needsUpdate=true};
  return W;
}
