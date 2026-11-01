import re
s=open('/home/claude/koi/index.html').read()
def rep(a_mark,b_mark,new):
    global s
    a=s.index(a_mark); b=s.index(b_mark,a); s=s[:a]+new+s[b:]
def sub(old,new):
    global s
    assert old in s, old[:70]; s=s.replace(old,new)
rep("// ===== KOI SCULPT =====","function grad(",r'''// ===== OCTOPUS SCULPT =====
const KY=0.0;
function earLocal(){return [9,9,9]}function sdEar(){return 9}
function sdLegF(){return 9}function sdLegB(){return 9}
const ARMN=8,ARMS=[];
for(let k=0;k<ARMN;k++){const a=(k+0.5)/ARMN*TAU;const dx=Math.sin(a),dz=Math.cos(a);const pts=[];
  for(let j=0;j<=6;j++){const t=j/6;const r=0.09+t*0.46,y=0.13-0.12*Math.sin(Math.min(1,t*1.8)*PI*0.5)+0.06*t*t;pts.push([dx*r+Math.cos(a)*0.03*Math.sin(t*4),Math.max(0.025*(1-t)+0.012,y),dz*r-Math.sin(a)*0.03*Math.sin(t*4)])}
  ARMS.push({a,pts,F:catmull(pts)})}
const armR=t=>lerp(0.052,0.009,Math.pow(t,0.8));
function sdArmK(k,x,y,z){const A=ARMS[k];let d=9;for(let j=0;j<6;j++)d=Math.min(d,sdCone(x,y,z,...A.pts[j],...A.pts[j+1],armR(j/6),armR((j+1)/6)));return d}
function sdSnout(){return 9}
const TAILP=[[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]];function sdTail(){return 9}
function sdMantle(x,y,z){let d=sdEll(x,y,z,0,0.42,-0.07,0.16,0.21,0.18);d=smin(d,sdEll(x,y,z,0,0.24,0.0,0.15,0.11,0.14),0.08);return d}
function sdHeadO(x,y,z){return sdEll(x,y,z,0,0.2,0.06,0.13,0.1,0.12)}
function pigSDF(x,y,z){let d=smin(sdMantle(x,y,z),sdHeadO(x,y,z),0.07);
  d=smin(d,sdEll(x,y,z,0,0.12,0.0,0.12,0.06,0.12),0.06);
  for(let k=0;k<ARMN;k++)d=smin(d,sdArmK(k,x,y,z),0.035);
  return Math.max(d,-(y-0.004))}
''')
rep("// ---------- rig ----------","const COL={",r'''// ---------- rig ----------
const BN=['root','hips','spine','chest','neck','head','earL','earR'];for(let k=0;k<ARMN;k++)for(let j=0;j<3;j++)BN.push('a'+k+j);
const REST={root:[0,0,0],hips:[0,0.14,0],spine:[0,0.22,0],chest:[0,0.32,-0.04],neck:[0,0.42,-0.07],head:[0,0.52,-0.08],earL:[0.1,0.2,0.1],earR:[-0.1,0.2,0.1]};
const PARENT={hips:'root',spine:'hips',chest:'spine',neck:'chest',head:'neck',earL:'spine',earR:'spine'};
const SEG={hips:[[0,0.08,0],[0,0.2,0]],spine:[[0,0.2,0],[0,0.3,0]],chest:[[0,0.3,-0.04],[0,0.42,-0.07]],neck:[[0,0.42,-0.07],[0,0.52,-0.08]],head:[[0,0.52,-0.08],[0,0.63,-0.08]]};
for(let k=0;k<ARMN;k++){const F=ARMS[k].F;const ts=[0.08,0.38,0.68,1.0];for(let j=0;j<3;j++){const n='a'+k+j;REST[n]=F(ts[j]);PARENT[n]=j?'a'+k+(j-1):'hips';SEG[n]=[F(ts[j]),F(ts[j+1])]}}
function segDist(p,a,b){const ab=vsub(b,a),l=vdot(ab,ab)||1e-9,t=clamp(vdot(vsub(p,a),ab)/l,0,1);return vlen(vsub(p,vadd(a,vsc(ab,t))))}
function pigWeights(p){const W=[];const push=(name,d,pw=4)=>W.push([BN.indexOf(name),1/Math.pow(d+0.008,pw)]);
  for(const n of ['hips','spine','chest','neck','head'])push(n,segDist(p,...SEG[n])+0.03,5);
  let best=-1,bd=9;for(let k=0;k<ARMN;k++){const d=sdArmK(k,...p);if(d<bd){bd=d;best=k}}
  const rh=Math.hypot(p[0],p[2]);
  if(bd<0.03&&rh>0.09)for(let j=0;j<3;j++)push('a'+best+j,segDist(p,...SEG['a'+best+j])+0.003,5);
  W.sort((a,b)=>b[1]-a[1]);const top=W.slice(0,4);while(top.length<4)top.push([0,0]);const s=top.reduce((a,b)=>a+b[1],0);
  return [top.map(w=>w[0]),top.map(w=>w[1]/s)]}

''')
rep("const COL={","/* =====================================================================\n   Scene",r'''const COL={skin:0xc8553d,top:0xa83e2f,under:0xf1c2a8,sucker:0xf6d8c6};
function mixc(a,b,t){return a.map((v,i)=>lerp(v,b[i],t))}
function pigVertex(p){const [x,y,z]=p;let c=hex(COL.skin);c=mixc(c,hex(COL.top),sstep(0.3,0.55,y));
  let bd=9,k0=0;for(let k=0;k<ARMN;k++){const d=sdArmK(k,x,y,z);if(d<bd){bd=d;k0=k}}
  const under=bd<0.02?sstep(0.0,-0.6,grad(pigSDF,x,y,z)[1]*10)*0+sstep(-0.2,-0.8,vnorm(grad(pigSDF,x,y,z))[1]):0;
  c=mixc(c,hex(COL.under),under*0.85);return [c,0.1]}
function buildPig(){
  const f=pigSDF;const sn=surfaceNets(f,[-0.64,-0.02,-0.64],[0.64,0.66,0.64],0.012);
  relax(f,sn.pos,sn.idx,3);orient(f,sn.pos,sn.idx);
  const pos=sn.pos,idx=sn.idx,N=pos.length/3,nor=[],col=[],si=[],sw=[],hair=[];
  for(let i=0;i<N;i++){const p=[pos[i*3],pos[i*3+1],pos[i*3+2]];nor.push(...vnorm(grad(f,...p)));
    const [c,hr]=pigVertex(p);col.push(...c);hair.push(hr);const [I,W]=pigWeights(p);si.push(...I);sw.push(...W)}
  const g=new Geo();g.pos=pos;g.nor=nor;g.col=col;g.idx=idx;
  const wg=new Geo();wg.pos=pos;wg.nor=nor;wg.col=col;for(let t=0;t<idx.length;t+=3)wg.idx.push(idx[t],idx[t+1],idx[t+1],idx[t+2],idx[t+2],idx[t]);
  return {geo:upload(g,{si,sw,m1:pos,hair}),wire:upload(wg,{si,sw,m1:pos,hair}),tris:idx.length/3}}
let scaleItem;
class Acc2{constructor(){this.pos=[];this.nor=[];this.col=[];this.si=[];this.sw=[];this.idx=[]}
  v(p,n,c,w){this.pos.push(...p);this.nor.push(...n);this.col.push(...c);this.si.push(...w[0]);this.sw.push(...w[1]);return this.pos.length/3-1}}
// suckers: two rows of little cups under every arm, skinned to the arm
function buildFins(){const A=new Acc2();const cup=sphere(1,8,5,0,TAU,0,PI*0.62);
  for(let k=0;k<ARMN;k++){const F=ARMS[k].F;for(let i=0;i<16;i++){const t=0.12+i/16*0.84;const p=F(t);const r=armR(t);
    for(const row of [-1,1]){const T=vnorm(vsub(F(Math.min(1,t+.01)),F(t-.01)));const side=vnorm(vcross(T,[0,1,0]));
      const c=vadd(vadd(p,vsc(side,row*r*0.42)),[0,-r*0.82,0]);const sz=r*0.34;const m=M4.trs(c,M4.basis([0,-1,0.0001]),[0,0,0],[sz,sz*0.55,sz]);
      const W=pigWeights(p);const b=A.pos.length/3;
      for(let q=0;q<cup.n;q++){A.v(M4.pt(m,[cup.pos[q*3],cup.pos[q*3+1],cup.pos[q*3+2]]),vnorm(M4.dir(m,[cup.nor[q*3],cup.nor[q*3+1],cup.nor[q*3+2]])),hex(COL.sucker),W)}
      for(const q of cup.idx)A.idx.push(q+b)}}}
  const g=new Geo();g.pos=A.pos;g.nor=A.nor;g.col=A.col;g.idx=A.idx;
  addItem(upload(g,{si:A.si,sw:A.sw,m1:A.pos}),null,{skin:true,flat:0,rough:.3,spec:.8,rim:.3,cast:false,sss:.7})}

''')
rep("function buildFace(){","function eH(p)",r'''function buildFace(){
  const H=B.spine,rE=0.042;const skC=hex(COL.skin);const HR=REST.spine;const hl=p=>vsub(p,HR);
  const gEye=upload(sphere(rE,28,20)),gIris=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.004,30,10,0,TAU,0,0.95),M4.euler(PI/2,0,0));return g})());
  const gPup=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.03,28,8,0,TAU,0,0.5),M4.euler(PI/2,0,0));return g})());
  const gRing=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.012,30,4,0,TAU,0.9,0.08),M4.euler(PI/2,0,0));return g})());
  const gHi=upload(sphere(rE*.2,10,8)),gHi2=upload(sphere(rE*.09,8,6));
  const gLidU=upload(sphere(rE*1.14,28,10,0,TAU,0,PI/2)),gLidL=upload(sphere(rE*1.12,28,10,0,TAU,PI/2,PI/2));
  const gBrow=upload(tube([[-rE*.7,-rE*.1,0],[-rE*.22,rE*.07,0],[rE*.22,rE*.07,0],[rE*.7,-rE*.1,0]],12,u=>0.006+0.005*Math.sin(u*PI),6));
  FACE.eyes=[];
  for(const s of [1,-1]){
    const dir=vnorm([0.6*s,0.35,0.72]);const S=marchOut([0,0.24,0.04],dir);const c=vsub(S,vsc(dir,rE*0.3));
    const eg=H.add(new Node(hl(c)));eg.rm=M4.basis(vnorm([0.35*s,0.1,1]));
    addItem(gEye,eg,{color:hex(0xf6efe2),flat:0,rough:.1,spec:1.4,rim:.05,cast:false});
    const ig=eg.add(new Node());addItem(gIris,ig,{color:hex(0xe0a832),flat:0,rough:.1,spec:1.4,cast:false});
    addItem(gRing,ig,{color:hex(0x5a3410),flat:0,rough:.3,cast:false});
    const pg=ig.add(new Node());addItem(gPup,pg,{color:hex(0x030203),flat:0,rough:.1,spec:1.2,cast:false});
    const h1=eg.add(new Node(vsc(vnorm([-0.36,0.40,0.84]),rE*.95)));addItem(gHi,h1,{color:[0,0,0],emis:[1.6,1.6,1.6],flat:0,cast:false});
    const h2=eg.add(new Node(vsc(vnorm([0.30,-0.28,0.91]),rE*1.0)));addItem(gHi2,h2,{color:[0,0,0],emis:[1.1,1.1,1.1],flat:0,cast:false});
    const lu=eg.add(new Node());addItem(gLidU,lu,{color:skC,flat:0,rough:.3,spec:1,cast:false,rim:.3,sss:.6});
    const ll=eg.add(new Node());addItem(gLidL,ll,{color:skC.map(v=>v*.97),flat:0,rough:.3,spec:1,cast:false,sss:.6});
    const bg=eg.add(new Node([0,rE*1.3,rE*0.62]));addItem(gBrow,bg,{color:hex(0x8a2c20),flat:0,rough:.5,cast:false});
    FACE.eyes.push({s,eg,ig,pg,lu,ll,bg})}
  FACE.rE=rE;FACE.nos=[];
  // little siphon on the side + cute mouth on the front of the head
  const gNos=upload(sphere(1,14,10));
  const mouthPts=k=>{const xs=[-0.04,-0.028,-0.014,0,0.014,0.028,0.04];return xs.map(x0=>{const u=Math.abs(x0)/0.04,x=k==='f'?x0*.9:x0;
    const y=k==='n'?0.17+u*u*0.008:k==='s'?0.165+u*u*0.022:0.175-u*u*0.012;const p=marchIn([x,y,0.8],[0,0,-1]);return vadd(p,vsc(nrm(p),0.003))})};
  const [mn,ms,mf]=['n','s','f'].map(k=>tube(mouthPts(k),18,u=>0.0042*(0.55+0.45*Math.sin(u*PI)),6,true));
  const mNode=H.add(new Node(vsc(HR,-1)));FACE.mouth=addItem(upload(mn,{m1:ms.pos,m2:mf.pos}),mNode,{color:hex(0x5a1a14),flat:0,rough:.4,cast:false});
  const mc=marchIn([0,0.167,0.8],[0,0,-1]);const mo=H.add(new Node(hl(vadd(mc,[0,-0.004,-0.01]))));mo.rm=M4.basis(nrm(mc));mo.s=[0.03,0.001,0.016];
  FACE.open=mo;FACE.openS=[0.028,0.026,0.016];addItem(gNos,mo,{color:hex(0x3a0c10),flat:0,rough:.6,cast:false});
  {const sp=marchOut([0,0.24,-0.02],vnorm([1,0.1,-0.2]));const sn=H.add(new Node(hl(vadd(sp,[-0.008,0,0]))));sn.r=[0,0,-PI/2+0.3];addItem(upload(cyl(0.012,0.018,0.03,10)),sn,{color:hex(COL.skin),flat:0,rough:.35,spec:.8,cast:false,sss:.6});FACE.siphon=sn}
  FACE.fangs=[];FACE.gills=[];
  const gB=upload(disc(0.03,20));FACE.blush=[];
  for(const s of [1,-1]){const d=vnorm([0.8*s,-0.15,0.58]);const p=marchOut([0,0.2,0.05],d);const n=nrm(p);
    const bn=H.add(new Node(hl(vadd(p,vsc(n,0.003)))));bn.rm=M4.basis(n);bn.s=[1,0.7,1];
    FACE.blush.push(addItem(gB,bn,{color:[0,0,0],emis:hex(0xff5c86).map(v=>v*.8),flat:0,op:0,trans:true,cast:false}))}
}
''')
rep("const LL=0.12;","const EXPR={",r'''const LL=0.12;
function crouchB(P,d){P[RY]-=d}
const TB=[],SP=['hips','spine','chest','neck','head'];
function tailSway(){}function wag(){}function wave(){}
let BALL_DY=0,BALL_C=[0,0.2,0],BALL_R=0.2;
// arm k, segment j: x = curl down/up (+ curls under), y = sideways sweep
function arm(P,k,curl,sweep){for(let j=0;j<3;j++)S(P,'a'+k+j,0,0,0);const a=ARMS[k].a;const cx=Math.cos(a),cz=-Math.sin(a);
  for(let j=0;j<3;j++){const c=curl[j]||0;S(P,'a'+k+j,c*cx,sweep*(j+1)*0.15,c*cz)}}
const POSES={
  idle(t,L){const P=P0();for(let k=0;k<ARMN;k++){const p=t*1.3+k*0.8;arm(P,k,[Math.sin(p)*0.12,Math.sin(p-0.7)*0.22,Math.sin(p-1.4)*0.35],Math.sin(p*0.7)*0.4)}
    S(P,'chest',Math.sin(t*1.2)*0.06,0,Math.sin(t*0.8)*0.05);S(P,'neck',Math.sin(t*1.2-0.5)*0.08,0,0);S(P,'spine',0,L.yaw*0.5,0);P[RY]=Math.sin(t*1.3)*0.015;return P},
  walk(t,L,ph){const P=P0();for(let k=0;k<ARMN;k++){const p=ph+(k%2)*PI+k*0.3;arm(P,k,[Math.max(0,Math.sin(p))*0.3-0.1,Math.sin(p-0.6)*0.4,Math.sin(p-1.2)*0.5],Math.cos(p)*0.5)}
    S(P,'chest',0.12,0,0);S(P,'neck',0.1,0,0);P[RY]=Math.abs(Math.sin(ph))*0.02;return P},
  run(t,L,ph){const P=P0();const pulse=Math.sin(ph);const c=0.25+0.55*Math.max(0,pulse); // jet propulsion: arms trail and pulse
    for(let k=0;k<ARMN;k++){const a=ARMS[k].a;const front=Math.cos(a);arm(P,k,[-0.5*front-0.2+c*0.3,-0.35*front+c*0.5,c*0.4],0)}
    S(P,'hips',-1.3,0,0);S(P,'chest',0.3+0.15*pulse,0,0);S(P,'neck',0.25,0,0);P[RY]=0.25;return P},
  eat(t,L){const P=P0();for(let k=0;k<ARMN;k++){const front=Math.cos(ARMS[k].a)>0.3;const p=t*3+k;
      arm(P,k,front?[-0.4,-0.6+Math.sin(p)*0.2,-0.8+Math.sin(p-0.5)*0.4]:[Math.sin(p*0.4)*0.1,0.1,0.15],front?Math.sin(p)*0.4:0)}
    S(P,'chest',-0.1,0,0);return P},
  bend(t,L){const P=P0();const a=0.8+0.2*Math.sin(t*1.5);for(let k=0;k<ARMN;k++)arm(P,k,[-0.6*a,-0.8*a,-1.1*a],0);P[RY]=0.18*a;S(P,'chest',0,0,Math.sin(t)*0.1);return P},
  happy(t,L){const P=P0();const j=Math.abs(Math.sin(t*4));P[RY]=0.06+j*0.12;for(let k=0;k<ARMN;k++){const p=t*8+k*0.8;arm(P,k,[-0.3*j,Math.sin(p)*0.5-0.3,Math.sin(p-1)*0.7],Math.sin(p)*0.6)}
    S(P,'chest',0,0,Math.sin(t*4)*0.15);S(P,'neck',0,0,Math.sin(t*4-0.5)*0.15);return P},
  sleep(t,L){const P=P0();const br=Math.sin(t*0.8);for(let k=0;k<ARMN;k++)arm(P,k,[0.2,0.5,0.9+Math.sin(t*0.5+k)*0.05],0.3);
    S(P,'chest',0.35+br*0.03,0,0.1);S(P,'neck',0.3,0,0);P[RY]=-0.04;return P},
};
const ACTIONS={
  attack:{dur:2.4,pose(t,L){const P=P0();const k1=sstep(0,.4,t)*(1-sstep(1.9,2.4,t));// puff up, arms spread wide, then ink burst
    for(let k=0;k<ARMN;k++)arm(P,k,[-1.0*k1,-0.6*k1,-0.4*k1+Math.sin(t*12+k)*0.15*k1],0);P[RY]=0.18*k1;S(P,'chest',-0.15*k1,0,0);
    return P},speed:t=>t>1.0&&t<1.6?-1.6*Math.sin((t-1)/.6*PI):0,face:t=>t<1?'angry':t<1.6?'roar':'content',flare:t=>0.012*sstep(0,.4,t)*(1-sstep(1.9,2.4,t)),
    fx(at,fw){if(at>1.0&&!st.fx.ink){st.fx.ink=1;st.shake=.1;const p=worldOf(FACE.siphon);for(let i=0;i<26;i++)spawn('puff',vadd(p,[rr(-.05,.05),rr(-.05,.05),rr(-.05,.05)]),[rr(-.5,.5),rr(-.1,.4),rr(-.5,.5)],rr(.05,.11),rr(1.5,2.6),0x14101c)}}},
  jump:{dur:2.4,pose(t,L){const P=P0();const u=sstep(0,2.4,t);const pulse=Math.max(0,Math.sin(t*6));P[RY]=Math.sin(u*PI)*1.3;
    for(let k=0;k<ARMN;k++)arm(P,k,[0.3-0.6*pulse,0.2,0.3],0);S(P,'chest',0.2*pulse,0,0);return P},speed:()=>0,face:t=>t<.3?'surprised':'excited',
    fx(at){st.fx.land=1;const c=Math.floor(at/.5);if(c!==st.fx.c){st.fx.c=c;const p=worldOf(FACE.siphon);for(let i=0;i<3;i++)spawn('bubble',p,[rr(-.1,.1),rr(.2,.4),rr(-.1,.1)],rr(.006,.013),2.5,0xeefcff)}}},
  shake:{dur:1.6,pose(t,L){const P=P0(),e=Math.pow(Math.sin(PI*t/1.6),.6);for(let k=0;k<ARMN;k++){const p=t*22+k;arm(P,k,[Math.sin(p)*0.3*e,Math.sin(p-1)*0.5*e,Math.sin(p-2)*0.6*e],Math.sin(p)*0.4*e)}
    S(P,'chest',0,0,Math.sin(t*20)*0.15*e);return P},speed:()=>0,face:()=>'squint'},
};
''')
# colour-changing skin (camouflage chromatophores): mottled spots + texture bumps
sub(" if(uSkinD>1.5){base=uColor*vC;"," if(uSkinD>2.5){base=uColor*vC;float sp=smoothstep(.2,.1,worley(vR*24.));float mot=fbm(vR*9.);base*=.8+.35*mot;base=mix(base,base*vec3(.6,.3,.25),sp*.55*smoothstep(.15,.3,vR.y));\n   vec3 gg=vec3(vn(vR*80.),vn(vR*80.+7.),vn(vR*80.+13.))-.5;N=normalize(N+gg*.35*smoothstep(.2,.3,vR.y));}\n if(uSkinD>1.5&&uSkinD<2.5){base=uColor*vC;")
sub("pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.18,rim:.35,spec:1.6,skinD:2,sss:.18});buildFins();","pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.25,rim:.3,spec:1.1,skinD:3,sss:.75});buildFins();")
# expression-driven colour: angry -> deep red, happy -> warm pink, sleepy -> pale
sub("for(const b of FACE.blush)b.op=E.blush*.55;","for(const b of FACE.blush)b.op=E.blush*.55;{const tc=st.manual==='angry'||fk==='angry'||fk==='roar'?[1.05,0.55,0.5]:fk==='asleep'||fk==='sleepy'?[1.15,1.05,1.05]:fk==='happy'||fk==='excited'?[1.1,0.95,0.95]:[1,1,1];st.tc=st.tc||[1,1,1];st.tc=st.tc.map((v,i)=>lerp(v,tc[i],1-Math.exp(-dt*3)));pigItem.color=st.tc}")
sub("if(FACE.gills){","if(FACE.gills&&FACE.gills.length){")
# rig plumbing: more bones (5 core + 2 + 24 arm = 32)
sub("uniform mat4 uBones[24];","uniform mat4 uBones[36];");sub("new Float32Array(24*16)","new Float32Array(36*16)")
sub("B.earL.r[0]+=-E.ear*.25;B.earL.r[2]+=E.ear*.18-(E.ear<0?-E.ear*.25:0);B.earR.r[0]+=-E.ear*.25;B.earR.r[2]-=E.ear*.18-(E.ear<0?-E.ear*.25:0);","")
sub("const legs=(P,f,b)=>{for(const s of ['fl','fr']){S(P,s+'U',f[0],0,0);S(P,s+'L',f[1],0,0)}for(const s of ['bl','br']){S(P,s+'U',b[0],0,0);S(P,s+'L',b[1],0,0)}};","const legs=()=>{};")
s=re.sub(r"const ACTS=\[[^;]*\];","const ACTS=[['idle','Idle'],['walk','Crawl'],['run','Jet'],['attack','Ink'],['jump','Swim up'],['eat','Grab'],['bend','Hide'],['happy','Dance'],['shake','Wiggle'],['sleep','Sleep']];",s)
s=re.sub(r"const LOOP_FACE=\{[^}]*\};","const LOOP_FACE={idle:'happy',walk:'neutral',run:'excited',eat:'content',bend:'surprised',happy:'excited',sleep:'asleep'};",s)
sub("const tgtSpd=(st.loop==='walk'?.32:st.loop==='run'?1.1:st.loop==='idle'?0.04:0)*(1-aw);","const tgtSpd=(st.loop==='walk'?.22:st.loop==='run'?1.0:0)*(1-aw);")
sub("st.walkPh+=dt*Math.max(st.speed,.1)/0.32*TAU*.75;st.runPh+=dt*Math.max(st.speed,.4)/1.1*TAU*1.6;","st.walkPh+=dt*Math.max(st.speed,.1)/0.22*TAU*.5;st.runPh+=dt*1.4*TAU;")
sub("0.45+pose[RY]*.8","0.25+pose[RY]*.8");sub("target:[0,0.45,0]","target:[0,0.25,0]")
sub("one skin · kohaku scales · flowing fins · drag to orbit","one skin · eight arms · 256 suckers · drag to orbit")
sub("<title>Low-Poly Menagerie · 09 Koi</title>","<title>Low-Poly Menagerie · 10 Octopus</title>")
sub("09 / 20 · LOW-POLY MENAGERIE</span><h1>Koi</h1>","10 / 20 · LOW-POLY MENAGERIE</span><h1>Octopus</h1>")
sub("Filling the koi pond…","Unfurling eight arms…")
open('index.html','w').write(s);print('ok')
