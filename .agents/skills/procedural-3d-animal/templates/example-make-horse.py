import re,sys;sys.path.insert(0,'/home/claude/young')
from ground import add_ground
s=open('/home/claude/aussie/index.html').read()
def rep(a_mark,b_mark,new):
    global s
    a=s.index(a_mark); b=s.index(b_mark,a); s=s[:a]+new+s[b:]
def sub(old,new):
    global s
    assert old in s, old[:70]; s=s.replace(old,new)
rep("// ===== AUSTRALIAN SHEPHERD SCULPT =====","function grad(",r'''// ===== HORSE SCULPT =====
const EAR_C=[0.075,2.12,0.99], EAR_M=M4.inv(M4.trs(EAR_C,null,[0.15,0.2,-0.25],[1,1,1]));
function earLocal(x,y,z){return M4.pt(EAR_M,[x,y,z])}
function sdEar(ax,y,z){const q=earLocal(ax,y,z);const tp=1+1.6*Math.max(0,q[1]+0.02)/0.1;return sdEll(q[0]*tp,q[1],q[2]+q[0]*q[0]*5,0,0,0,0.04,0.1,0.025)}
function legChain(ax,y,z,P,R){let d=9;for(let i=0;i<P.length-1;i++)d=smin(d,sdCone(ax,y,z,...P[i],...P[i+1],R[i],R[i+1]),0.03);return d}
const FL=[[0.17,1.12,0.55],[0.17,0.57,0.6],[0.17,0.16,0.6],[0.17,0.07,0.66],[0.17,0.0,0.69]],FR_=[0.1,0.065,0.05,0.055,0.08];
const BLp=[[0.18,1.0,-0.62],[0.18,0.58,-0.77],[0.18,0.16,-0.7],[0.18,0.07,-0.65],[0.18,0.0,-0.63]],BR_=[0.11,0.06,0.05,0.055,0.078];
function sdLegF(ax,y,z){let d=legChain(ax,y,z,FL,FR_);d=smin(d,sdEll(ax,y,z,0.17,0.57,0.6,0.07,0.075,0.07),0.03);return Math.max(d,-y)}
function sdLegB(ax,y,z){let d=sdEll(ax,y,z,0.18,1.12,-0.58,0.13,0.27,0.21);d=smin(d,legChain(ax,y,z,BLp,BR_),0.06);return Math.max(d,-y)}
function sdSnout(x,y,z){return sdEll(x,y,z,0,1.62,1.47,0.1,0.1,0.11)}
const TAILP=[[0,1.42,-0.88],[0,1.3,-0.99],[0,1.1,-1.04],[0,0.9,-1.06],[0,0.72,-1.06],[0,0.56,-1.05]],TAILR=[0.06,0.045,0.03,0.02,0.015,0.01];
function sdTail(x,y,z){return sdCone(x,y,z,...TAILP[0],...TAILP[1],0.065,0.045)}
function pigSDF(x,y,z){const ax=Math.abs(x);
  let d=sdEll(x,y,z,0,1.25,0,0.3,0.33,0.62);
  d=smin(d,sdEll(x,y,z,0,1.22,0.45,0.3,0.36,0.32),0.12);
  d=smin(d,sdEll(x,y,z,0,1.3,-0.5,0.31,0.33,0.37),0.12);
  d=smin(d,sdEll(x,y,z,0,1.47,0.38,0.1,0.1,0.22),0.1);
  d=smin(d,sdCone(x*1.3,y,z,0,1.35,0.62,0,1.92,1.0,0.3,0.15)/1.3,0.1);
  d=smin(d,smin(sdCone(x,y,z,0,2.0,1.05,0,1.66,1.42,0.12,0.095),sdEll(x,y,z,0,1.86,1.08,0.115,0.14,0.15),0.06),0.06);
  d=smin(d,sdSnout(x,y,z),0.05);
  d=smin(d,sdEar(ax,y,z),0.025);
  d=smin(d,sdLegF(ax,y,z),0.09);
  d=smin(d,sdLegB(ax,y,z),0.1);
  d=smin(d,sdTail(x,y,z),0.05);
  return Math.max(d,-(y-0.004));
}
''')
rep("// ---------- rig ----------","const COL={",r'''// ---------- rig ----------
const BN=['root','hips','spine','chest','neck','head','earL','earR','flU','flL','frU','frL','blU','blL','brU','brL','t0','t1','t2','t3','t4'];
const REST={root:[0,0,0],hips:[0,1.3,-0.5],spine:[0,1.28,0],chest:[0,1.28,0.42],neck:[0,1.42,0.66],head:[0,1.98,1.03],
  earL:[0.07,2.07,0.99],earR:[-0.07,2.07,0.99],flU:[0.17,1.12,0.55],flL:[0.17,0.57,0.6],frU:[-0.17,1.12,0.55],frL:[-0.17,0.57,0.6],
  blU:[0.18,1.0,-0.62],blL:[0.18,0.58,-0.77],brU:[-0.18,1.0,-0.62],brL:[-0.18,0.58,-0.77],t0:TAILP[0],t1:TAILP[1],t2:TAILP[2],t3:TAILP[3],t4:TAILP[4]};
const PARENT={hips:'root',spine:'hips',chest:'spine',neck:'chest',head:'neck',earL:'head',earR:'head',flU:'chest',flL:'flU',frU:'chest',frL:'frU',
  blU:'hips',blL:'blU',brU:'hips',brL:'brU',t0:'hips',t1:'t0',t2:'t1',t3:'t2',t4:'t3'};
const SEG={hips:[[0,1.3,-0.95],[0,1.28,0]],spine:[REST.spine,REST.chest],chest:[REST.chest,[0,1.4,0.66]],neck:[REST.neck,REST.head],head:[REST.head,[0,1.6,1.52]],
  earL:[REST.earL,[0.1,2.24,0.97]],earR:[REST.earR,[-0.1,2.24,0.97]],flU:[REST.flU,REST.flL],flL:[REST.flL,[0.17,0.0,0.68]],frU:[REST.frU,REST.frL],frL:[REST.frL,[-0.17,0,0.68]],
  blU:[REST.blU,REST.blL],blL:[REST.blL,[0.18,0.0,-0.64]],brU:[REST.brU,REST.brL],brL:[REST.brL,[-0.18,0,-0.64]]};
for(let i=0;i<5;i++)SEG['t'+i]=[TAILP[i],TAILP[i+1]];
function segDist(p,a,b){const ab=vsub(b,a),t=clamp(vdot(vsub(p,a),ab)/vdot(ab,ab),0,1);return vlen(vsub(p,vadd(a,vsc(ab,t))))}
function topW(W){W.sort((a,b)=>b[1]-a[1]);const top=W.slice(0,4);while(top.length<4)top.push([0,0]);const s=top.reduce((a,b)=>a+b[1],0);return [top.map(w=>w[0]),top.map(w=>w[1]/s)]}
function pigWeights(p){const ax=Math.abs(p[0]),side=p[0]>=0?'L':'R',fs=p[0]>=0?'fl':'fr',bs=p[0]>=0?'bl':'br';const W=[];
  const push=(name,d,pw=4)=>W.push([BN.indexOf(name),1/Math.pow(d+0.02,pw)]);
  for(const n of ['hips','spine','chest'])push(n,segDist(p,...SEG[n])+0.12,6);for(const n of ['neck','head'])push(n,segDist(p,...SEG[n]));
  if(sdEar(ax,p[1],p[2])<0.03){const e='ear'+side;push(e,segDist(p,...SEG[e])*0.5)}
  if(sdTail(p[0],p[1],p[2])<0.04&&p[2]<-0.85)push('t0',segDist(p,...SEG.t0)*0.6);
  const lf=sdLegF(ax,p[1],p[2]);if(lf<0.05&&p[1]<1.12){const k=1+Math.max(0,p[1]-0.92)*8;push(fs+'U',segDist(p,...SEG[fs+'U'])*k);push(fs+'L',segDist(p,...SEG[fs+'L'])*k)}
  const lb=sdLegB(ax,p[1],p[2]);if(lb<0.05&&p[1]<1.12){const k=1+Math.max(0,p[1]-0.88)*8;push(bs+'U',segDist(p,...SEG[bs+'U'])*k);push(bs+'L',segDist(p,...SEG[bs+'L'])*k)}
  return topW(W)}
function tailW(p){const W=[];for(let i=0;i<5;i++)W.push([BN.indexOf('t'+i),1/Math.pow(segDist(p,...SEG['t'+i])+0.03,5)]);return topW(W)}

''')
rep("const COL={","/* =====================================================================\n   Scene",r'''const COL={skin:0xffffff,nose:0x1a1414};
function mixc(a,b,t){return a.map((v,i)=>lerp(v,b[i],t))}
// vertex colour = [shade, pointsMask, whiteMask] — the coat colours themselves come from shader uniforms
function pigVertex(p){const [x,y,z]=p,ax=Math.abs(x);
  const legs=sdLegF(ax,y,z)<0.02||sdLegB(ax,y,z)<0.02;const pts=legs?sstep(0.8,0.55,y):0;
  const hoof=sstep(0.085,0.06,y);const muz=sstep(0.03,-0.01,sdSnout(x,y,z))*sstep(1.5,1.56,z)*0.5;
  const blaze=sstep(0.03,0.015,ax)*sstep(1.1,1.2,z)*sstep(1.6,1.7,y)+sstep(0.026,0.012,Math.hypot(ax,y-1.95,z-1.15))*0;
  const sock=(sstep(0.3,0.2,y)*(x>0&&z>0||z<0?1:0))*(legs?1:0);
  const shade=(1-hoof*0.78)*(1-muz*0.4);
  return [[shade,clamp(pts+hoof,0,1),clamp(blaze+sock,0,1)*(1-hoof)],clamp(0.85-hoof-sstep(1.45,1.55,z)*0.4,0,1)]}
function buildPig(){
  const f=pigSDF;const sn=surfaceNets(f,[-0.42,-0.02,-1.12],[0.42,2.3,1.62],0.026);
  relax(f,sn.pos,sn.idx,3);orient(f,sn.pos,sn.idx);
  const pos=sn.pos,idx=sn.idx,N=pos.length/3,nor=[],col=[],si=[],sw=[],hair=[];
  for(let i=0;i<N;i++){const p=[pos[i*3],pos[i*3+1],pos[i*3+2]];nor.push(...vnorm(grad(f,...p)));
    const [c,hr]=pigVertex(p);col.push(...c);hair.push(hr);const [I,W]=pigWeights(p);si.push(...I);sw.push(...W)}
  const g=new Geo();g.pos=pos;g.nor=nor;g.col=col;g.idx=idx;
  const wg=new Geo();wg.pos=pos;wg.nor=nor;wg.col=col;for(let t=0;t<idx.length;t+=3)wg.idx.push(idx[t],idx[t+1],idx[t+1],idx[t+2],idx[t+2],idx[t]);
  return {geo:upload(g,{si,sw,m1:pos,hair}),wire:upload(wg,{si,sw,m1:pos,hair}),tris:idx.length/3}}
let scaleItem,maneItem;
// mane, forelock and tail: hair strands skinned to neck/head and the 5 tail bones
function buildManeTail(){const A={pos:[],nor:[],col:[],idx:[],si:[],sw:[]};
  const put=(g,wf,sh)=>{const b=A.pos.length/3;for(let i=0;i<g.n;i++){const p=[g.pos[i*3],g.pos[i*3+1],g.pos[i*3+2]];A.pos.push(...p);A.nor.push(g.nor[i*3],g.nor[i*3+1],g.nor[i*3+2]);A.col.push(sh,sh,sh);const [I,W]=wf(p);A.si.push(...I);A.sw.push(...W)}for(const k of g.idx)A.idx.push(k+b)};
  const neckW=p=>{const W=[];for(const n of ['chest','neck','head'])W.push([BN.indexOf(n),1/Math.pow(segDist(p,...SEG[n])+0.05,4)]);return topW(W)};
  const ax=[0,0.85,0.52],perp=vnorm([0,0.52,-0.85]);
  for(let i=0;i<160;i++){const t=i/159;const c=vadd([0,1.4,0.62],vsc([0,0.6,0.37],t*0.95));const r=vadd(marchOut(c,perp),vsc(perp,-0.012));const L=rr(0.18,0.3)*(1-0.35*t);const side=rnd()<0.85?1:-0.6;
    const P=[r,vadd(r,[0.03*side,0.035,-0.02]),vadd(r,[0.09*side,-0.04,-0.05]),vadd(r,[0.13*side,-L*0.6,-0.06]),vadd(r,[0.15*side,-L,-0.05])];
    put(tube(P,8,u=>lerp(0.03,0.004,u),5,false),p=>neckW(r),rr(0.85,1.1))}
  for(let i=0;i<14;i++){const r=vadd([rr(-0.03,0.03),2.08,1.04+rr(-0.02,0.02)],[0,0,0]);const P=[r,vadd(r,[rr(-.02,.02),0.02,0.05]),vadd(r,[rr(-.04,.04),-0.06,0.1]),vadd(r,[rr(-.05,.05),-0.14,0.12])];
    put(tube(P,6,u=>lerp(0.016,0.003,u),5,false),()=>[[BN.indexOf('head'),0,0,0],[1,0,0,0]],rr(0.85,1.1))}
  const TF=catmull(TAILP);for(let i=0;i<70;i++){const a=rnd()*TAU,rad=Math.sqrt(rnd());const P=[];const len=rr(0.85,1);
    for(let j=0;j<=7;j++){const t=j/7*len;const c=TF(t);const spread=0.015+t*0.09;P.push(vadd(c,[Math.cos(a)*rad*spread,0,Math.sin(a)*rad*spread*0.7]))}
    put(tube(P,10,u=>lerp(0.016,0.004,u),5,false),tailW,rr(0.85,1.1))}
  const g=new Geo();g.pos=A.pos;g.nor=A.nor;g.col=A.col;g.idx=A.idx;
  maneItem=addItem(upload(g,{si:A.si,sw:A.sw,m1:A.pos}),null,{skin:true,flat:0,rough:.45,spec:.7,rim:.3})}

''')
rep("function buildFace(){","function eH(p)",r'''function buildFace(){
  const H=B.head,rE=0.05;const skC=[0.35,0.2,0.12];
  const gEye=upload(sphere(rE,28,20)),gIris=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.004,32,10,0,TAU,0,1.1),M4.euler(PI/2,0,0));return g})());
  const gPup=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.03,28,8,0,TAU,0,0.5),M4.euler(PI/2,0,0));return g})());
  const gRing=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.012,32,4,0,TAU,1.02,0.08),M4.euler(PI/2,0,0));return g})());
  const gHi=upload(sphere(rE*.2,12,8)),gHi2=upload(sphere(rE*.09,10,6));
  const gLidU=upload(sphere(rE*1.14,32,12,0,TAU,0,PI/2)),gLidL=upload(sphere(rE*1.12,32,12,0,TAU,PI/2,PI/2));
  const gLash=upload(torus(rE*1.14,rE*.08,6,40));
  const gBrow=upload(tube([[-rE*.7,-rE*.1,0],[-rE*.22,rE*.07,0],[rE*.22,rE*.07,0],[rE*.7,-rE*.1,0]],14,u=>0.007+0.007*Math.sin(u*PI),7));
  FACE.eyes=[];
  for(const s of [1,-1]){
    const dir=vnorm([0.92*s,0.25,0.3]);const S=marchOut([0,1.93,1.1],dir);const c=vsub(S,vsc(dir,rE*0.36));
    const eg=H.add(new Node(headLocal(c)));eg.rm=M4.basis(vnorm([0.7*s,0.05,0.7]));
    addItem(gEye,eg,{color:hex(0xf2ece2),flat:0,rough:.12,spec:1.3,rim:.05,cast:false});
    const ig=eg.add(new Node());addItem(gIris,ig,{color:hex(0x4a2814),flat:0,rough:.12,spec:1.3,cast:false});
    addItem(gRing,ig,{color:hex(0x1e0e06),flat:0,rough:.3,cast:false});
    const pg=ig.add(new Node());addItem(gPup,pg,{color:hex(0x050505),flat:0,rough:.15,spec:1,cast:false});
    const h1=eg.add(new Node(vsc(vnorm([-0.36,0.40,0.84]),rE*.95)));addItem(gHi,h1,{color:[0,0,0],emis:[1.5,1.5,1.5],flat:0,cast:false});
    const h2=eg.add(new Node(vsc(vnorm([0.30,-0.28,0.91]),rE*1.0)));addItem(gHi2,h2,{color:[0,0,0],emis:[1,1,1],flat:0,cast:false});
    const lu=eg.add(new Node());FACE.lidItems=(FACE.lidItems||[]);FACE.lidItems.push(addItem(gLidU,lu,{color:skC,flat:0,rough:.7,cast:false,rim:.25}));
    addItem(gLash,lu,{color:hex(0x151010),flat:0,rough:.6,cast:false});
    const ll=eg.add(new Node());FACE.lidItems.push(addItem(gLidL,ll,{color:skC,flat:0,rough:.7,cast:false}));
    const bg=eg.add(new Node([0,rE*1.3,rE*0.62]));addItem(gBrow,bg,{color:hex(0x241812),flat:0,rough:.7,cast:false});
    FACE.eyes.push({s,eg,ig,pg,lu,ll,bg})}
  FACE.rE=rE;
  const gNos=upload(sphere(1,18,12));FACE.nos=[];
  for(const s of [1,-1]){const p=marchIn([0.052*s,1.635,2.5],[0,0,-1]);const n=nrm(p);const nn=H.add(new Node(headLocal(vadd(p,vsc(n,-0.006)))));nn.rm=M4.basis(n);nn.r=[0,0,0.4*s];nn.base=[0.02,0.032,0.014];nn.s=[...nn.base];
    addItem(gNos,nn,{color:hex(0x140e0c),flat:0,rough:.3,spec:.8,cast:false});FACE.nos.push(nn)}
  const mouthPts=k=>{const xs=[-0.07,-0.05,-0.025,0,0.025,0.05,0.07];return xs.map(x0=>{const u=Math.abs(x0)/0.07,x=k==='f'?x0*.88:x0;
    const y=k==='n'?1.56+u*u*0.012:k==='s'?1.554+u*u*0.03:1.566-u*u*0.016;
    const p=marchIn([x,y,2.5],[0,0,-1]);return vadd(p,vsc(nrm(p),0.004))})};
  const [mn,ms,mf]=['n','s','f'].map(k=>tube(mouthPts(k),22,u=>0.0055*(0.55+0.45*Math.sin(u*PI)),6,true));
  const mNode=H.add(new Node(vsc(REST.head,-1)));
  FACE.mouth=addItem(upload(mn,{m1:ms.pos,m2:mf.pos}),mNode,{color:hex(0x221614),flat:0,rough:.5,cast:false});
  const mc=marchIn([0,1.556,2.5],[0,0,-1]);const mo=H.add(new Node(headLocal(vadd(mc,[0,-0.012,-0.03]))));mo.rm=M4.basis(nrm(mc));mo.s=[0.05,0.001,0.024];
  FACE.open=mo;FACE.openS=[0.05,0.04,0.024];addItem(gNos,mo,{color:hex(0x3a1016),flat:0,rough:.6,cast:false});
  const tt=mo.add(new Node([0,0.6,0.55]));tt.s=[1.4,0.3,0.5];addItem(upload(box(1,1,1)),tt,{color:hex(0xf0e8d6),flat:0,rough:.3,spec:.8,cast:false});FACE.teeth=[tt];
  FACE.fangs=[];FACE.blush=[];
}
''')
rep("const LL=0.46;","const EXPR={",r'''const LL=1.0;
function crouchB(P,d,fk=1,bk=1){const a=Math.acos(clamp(1-d/LL,-1,1));legs(P,[-a*fk,2*a*fk],[-a*bk,2*a*bk]);P[RY]-=d}
const TB=['t0','t1','t2','t3','t4'];
function swish(P,t,sp,amp,lift=0){TB.forEach((n,i)=>S(P,n,lift*(i<2?1:.3),Math.sin(t*sp-i*.5)*amp*(.6+i*.2),Math.sin(t*sp*0.7-i*.5)*amp*0.4))}
function tailSway(P,t,sp,amp){swish(P,t,sp,amp)}function wag(P,t,sp,amp,l){swish(P,t,sp,amp,l)}
let BALL_DY=0,BALL_C=[0,0.6,0],BALL_R=0.6;
function gaitLeg(P,n,q,amp,lift,back){S(P,n+'U',-Math.sin(q)*amp,0,0);S(P,n+'L',Math.pow(Math.max(0,Math.cos(q)),1.3)*lift*(back?0.8:1),0,0)}
const POSES={
  idle(t,L){const P=P0(),br=Math.sin(t*1.1);S(P,'chest',br*.01,0,0);
    S(P,'neck',.05,L.yaw*.25,0);S(P,'head',Math.sin(t*.5)*.05,L.yaw*.45+Math.sin(t*.3)*.1,Math.sin(t*.23)*.05);
    S(P,'brU',.08,0,0);S(P,'brL',.35,0,0);S(P,'hips',0,0,-.03);   // resting a hind leg
    earBob(P,twitch(t,0)*.4,twitch(t,2)*.3);swish(P,t,1.2,.18);P[RY]=br*.005;return P},
  walk(t,L,ph){const P=P0();gaitLeg(P,'bl',ph,.32,.75,1);gaitLeg(P,'fl',ph+PI*.5,.34,.95);gaitLeg(P,'br',ph+PI,.32,.75,1);gaitLeg(P,'fr',ph+PI*1.5,.34,.95);
    S(P,'neck',.06+Math.sin(2*ph)*.06,0,0);S(P,'head',-.04-Math.sin(2*ph)*.05,L.yaw*.15,0);S(P,'hips',0,Math.sin(ph)*.03,Math.sin(ph)*.03);
    earBob(P,.05,0);swish(P,t,2,.12);P[RY]=-Math.abs(Math.cos(ph))*.012;return P},
  bend(t,L,ph){const P=P0();const q=t*7;gaitLeg(P,'fl',q,.42,1.15);gaitLeg(P,'br',q,.38,.95,1);gaitLeg(P,'fr',q+PI,.42,1.15);gaitLeg(P,'bl',q+PI,.38,.95,1);
    S(P,'neck',.12,0,0);S(P,'head',.05,0,0);P[RY]=.03+Math.abs(Math.sin(q))*.045;swish(P,t,3,.15,-.1);earBob(P,-.1,0);return P},
  run(t,L,ph){const P=P0();gaitLeg(P,'fl',ph,.75,1.35);gaitLeg(P,'fr',ph+.4,.75,1.35);gaitLeg(P,'bl',ph+PI,.7,1.1,1);gaitLeg(P,'br',ph+PI+.4,.7,1.1,1);
    S(P,'hips',Math.sin(ph)*.07,0,0);S(P,'chest',-Math.sin(ph+.4)*.06,0,0);S(P,'neck',.2+Math.sin(ph+1)*.12,0,0);S(P,'head',.05-Math.sin(ph+1)*.08,0,0);
    earBob(P,-.5,-.1);TB.forEach((n,i)=>S(P,n,-.35-i*.05,Math.sin(ph-i*.5)*.06,0));P[RY]=.05+.08*Math.max(0,Math.sin(ph-.6));return P},
  eat(t,L){const P=P0();S(P,'chest',.3,0,0);S(P,'flU',-.3,0,0);S(P,'frU',.0,0,0);S(P,'frL',.2,0,0);S(P,'neck',1.75,Math.sin(t*.4)*.12,0);S(P,'head',-.75+Math.sin(t*6)*.04*Math.max(0,Math.sin(t*1.3)),Math.sin(t*.4)*.12,0);
    S(P,'flU',-.2,0,0);S(P,'frU',.12,0,0);S(P,'frL',.15,0,0);earBob(P,.2,.1);swish(P,t,1.5,.2);return P},
  happy(t,L){const P=P0();const q=t*4.5;gaitLeg(P,'fl',q,.25,1.7);gaitLeg(P,'br',q,.2,1.2,1);gaitLeg(P,'fr',q+PI,.25,1.7);gaitLeg(P,'bl',q+PI,.2,1.2,1);
    S(P,'neck',-.25,0,0);S(P,'head',.45,0,Math.sin(t*2)*.08);P[RY]=Math.abs(Math.sin(q))*.05;swish(P,t,4,.2,-.3);earBob(P,-.1,0);return P},
  sit(t,L){const P=P0(),br=Math.sin(t*1.0);P[RY]=-.78+br*.006;S(P,'flU',-1.3,0,.05);S(P,'flL',2.5,0,0);S(P,'frU',-1.0,0,-.05);S(P,'frL',2.4,0,0);
    S(P,'blU',-1.1,0,.25);S(P,'blL',2.0,0,0);S(P,'brU',-1.1,0,-.25);S(P,'brL',2.0,0,0);S(P,'hips',0,0,.08);
    S(P,'neck',-.05,L.yaw*.3,0);S(P,'head',.1,L.yaw*.4,0);swish(P,t,1,.08);return P},
  sleep(t,L){const P=P0(),br=Math.sin(t*0.9);S(P,'chest',br*.012,0,0);S(P,'neck',.55,0,0);S(P,'head',.25,0,.05);
    S(P,'brU',.1,0,0);S(P,'brL',.45,0,0);S(P,'hips',0,0,-.04);earBob(P,.5,.4);swish(P,t,.6,.06);return P},
};
const ACTIONS={
  attack:{dur:2.8,pose(t,L){const P=P0();const k=sstep(.1,.7,t)*(1-sstep(2.0,2.6,t));
    S(P,'hips',-1.0*k,0,0);S(P,'blU',.9*k,0,0);S(P,'brU',.9*k,0,0);S(P,'blL',.25*k,0,0);S(P,'brL',.25*k,0,0);
    const pw=sstep(.6,.8,t)*(1-sstep(1.8,2.1,t));S(P,'flU',(-.9+Math.sin(t*11)*.45*pw)*k,0,0);S(P,'flL',(1.3+Math.max(0,Math.sin(t*11))*.5)*k,0,0);
    S(P,'frU',(-.9-Math.sin(t*11)*.45*pw)*k,0,0);S(P,'frL',(1.3+Math.max(0,-Math.sin(t*11))*.5)*k,0,0);
    S(P,'neck',-.35*k,0,0);S(P,'head',-.1*k+Math.sin(t*18)*.04*pw,Math.sin(t*3)*.15*k,0);earBob(P,-.6*k,-.2*k);swish(P,t,6,.3*k);return P},
    speed:()=>0,face:t=>t<.6?'angry':t<2.0?'roar':'neutral',mouth:t=>t>.7&&t<1.9?.7+.3*Math.sin(t*20):0,
    fx(at,fw){if(at>2.2&&!st.fx.land){st.fx.land=1;st.shake=.15;const p=vadd(st.pos,vsc(fw,.7));for(let i=0;i<16;i++){const a=rnd()*TAU;spawn('puff',[p[0]+Math.cos(a)*.2,.05,p[2]+Math.sin(a)*.2],[Math.cos(a)*rr(.8,1.8),rr(.2,.6),Math.sin(a)*rr(.8,1.8)],rr(.12,.22),rr(.7,1.1),0xd8c49c)}}}},
  roll:{dur:1.8,pose(t,L){const P=P0();const k=sstep(.1,.45,t)*(1-sstep(1.2,1.7,t));const kk=Math.exp(-Math.pow((t-.7)/.12,2));
    S(P,'hips',.32*k,0,0);S(P,'flU',-.25*k,0,0);S(P,'frU',-.25*k,0,0);S(P,'blU',(-.3+1.6*kk)*k,0,0);S(P,'brU',(-.3+1.6*kk)*k,0,0);S(P,'blL',(.6-.6*kk)*k,0,0);S(P,'brL',(.6-.6*kk)*k,0,0);
    S(P,'neck',.35*k,0,0);earBob(P,-.6*k,-.2*k);swish(P,t,8,.3*k,-.4*k);return P},speed:()=>0,face:t=>t<1.2?'angry':'neutral',
    fx(at,fw){if(at>.68&&!st.fx.k){st.fx.k=1;st.shake=.1;const p=vadd(st.pos,vsc(fw,-1.6));for(let i=0;i<14;i++)spawn('puff',[p[0]+rr(-.2,.2),.3+rr(0,.4),p[2]+rr(-.2,.2)],[rr(-1,1),rr(0,.6),rr(-1,1)],rr(.1,.18),rr(.6,1),0xd8c49c)}}},
  jump:{dur:1.7,pose(t,L){const P=P0();
    if(t<.4){const c=sstep(0,.4,t);crouchB(P,.18*c);S(P,'neck',-.1*c,0,0);S(P,'hips',-.1*c,0,0)}
    else if(t<1.15){const u=(t-.4)/.75;P[RY]=4*.85*u*(1-u);const tk=Math.sin(u*PI);legs(P,[-1.1*tk,2.0*tk],[.9*tk,.9*tk]);S(P,'hips',-.25*(1-u)+.25*u,0,0);S(P,'neck',.15*tk,0,0);TB.forEach((n,i)=>S(P,n,-.4*tk,0,0))}
    else{const v=(t-1.15)/.55;crouchB(P,.14*Math.sin(v*PI)*(1-.3*v))}
    return P},speed:t=>t>.4&&t<1.15?4.2:0,face:t=>t<.4?'surprised':'excited'},
  shake:{dur:1.6,pose(t,L){const P=P0(),e=Math.pow(Math.sin(PI*t/1.6),.6),w=t*22;
    S(P,'head',0,Math.sin(w)*.3*e,Math.sin(w)*.15*e);S(P,'neck',0,Math.sin(w-.6)*.2*e,Math.sin(w-.6)*.1*e);S(P,'chest',0,0,Math.sin(w-1.1)*.12*e);S(P,'hips',0,0,Math.sin(w-1.6)*.1*e);
    earBob(P,Math.sin(w-2)*.4*e,Math.sin(w-2.2)*.6*e);swish(P,w,1,.4*e);return P},speed:()=>0,face:()=>'squint'},
};
''')
# coat shader (replaces the merle block)
a=s.index("   float mxc=max(base.r");E_="base=mix(base,vec3(.018,.018,.02),clamp(mpatch+speck*.85,0.,1.)*greyM);";b=s.index(E_,a)+len(E_)
s=s[:a]+"""   if(uCoatK>-.5){vec3 cc=mix(uCoatA,uCoatB,vC.g);
     if(uCoatK>.5&&uCoatK<1.5){float dd=worley(vR*6.5);cc=mix(cc,cc*1.6+.04,smoothstep(.36,.16,dd)*(1.-vC.g));}
     if(uCoatK>1.5){float pp=smoothstep(.5,.54,fbm(vR*1.8+vec3(4.,1.,2.)));cc=mix(cc,vec3(.9,.88,.85),pp*(1.-vC.g*.4)*smoothstep(1.7,1.5,vR.y));}
     cc=mix(cc,vec3(.9,.88,.84),vC.b*uSocks);base=cc*vC.r*(.94+.12*m2);}"""+s[b:]
sub("uniform float uOp,uFlat,","uniform vec3 uCoatA,uCoatB;uniform float uCoatK,uSocks;uniform float uOp,uFlat,")
sub("gl.uniform1f(U.uFogN,22);gl.uniform1f(U.uFogF,62);","gl.uniform1f(U.uFogN,26);gl.uniform1f(U.uFogF,70);gl.uniform3fv(U.uCoatA,COAT.A);gl.uniform3fv(U.uCoatB,COAT.B);gl.uniform1f(U.uCoatK,COAT.K);gl.uniform1f(U.uSocks,COAT.S);")
sub("function wrapA(a)","let COAT={A:hex(0x74391a),B:hex(0x1a1412),K:0,S:0};\nfunction wrapA(a)")
sub("const pig=buildPig();pigItem=addItem(pig.geo,null,{","const pig=buildPig();buildManeTail();pigItem=addItem(pig.geo,null,{")
s=re.sub(r"  if\(FACE\.tongue\)\{[^\n]*\n","",s)
sub("if(FACE.fangs)for(const f of FACE.fangs)f.visible=E.open>.72;","if(FACE.fangs)for(const f of FACE.fangs)f.visible=E.open>.72;if(FACE.teeth)for(const tt of FACE.teeth)tt.visible=E.open>.15;")
# coat chips
sub('<div class="row face" id="faces"><span class="lbl">Face</span></div>','<div class="row face" id="faces"><span class="lbl">Face</span></div>\n  <div class="row face" id="coats"><span class="lbl">Coat</span></div>')
sub("window.__pig={",r"""{const CO=[['Bay',0x74391a,0x1a1412,0x141010,0,0],['Chestnut',0xa4521f,0x8a4019,0x7a3414,0,1],['Black',0x24201e,0x161313,0x0e0c0c,0,0],['Dapple grey',0x8e8e92,0x3e3e42,0xdcdcdc,1,0],['Palomino',0xd9a54a,0xc8923c,0xf4ead2,0,1],['Pinto',0x6a3c1e,0x2a1c14,0x2a1c14,2,1],['White',0xe6e2da,0xbdb8b0,0xf2efe8,0,0]];
  const row=document.getElementById('coats');const set=c=>{COAT={A:hex(c[1]),B:hex(c[2]),K:c[4],S:c[5]};if(maneItem)maneItem.color=hex(c[3]);for(const it of FACE.lidItems||[])it.color=hex(c[1]).map(v=>v*.85)};
  CO.forEach((c,i)=>{const b=document.createElement('button');b.innerHTML=`<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#${c[1].toString(16).padStart(6,'0')};border:2px solid #${c[3].toString(16).padStart(6,'0')};margin-right:6px;vertical-align:-2px"></span>${c[0]}`;
    b.onclick=()=>{set(c);for(const x of row.querySelectorAll('button'))x.classList.toggle('on',x===b)};if(!i)b.classList.add('on');row.appendChild(b)});window.__coat=()=>set(CO[0])}
window.__pig={""")
sub("refreshUI();const L=document.getElementById('load')","window.__coat&&window.__coat();refreshUI();const L=document.getElementById('load')")
s=re.sub(r"const ACTS=\[[^;]*\];","const ACTS=[['idle','Idle'],['walk','Walk'],['bend','Trot'],['run','Gallop'],['attack','Rear'],['roll','Kick'],['jump','Jump'],['eat','Graze'],['happy','Prance'],['sit','Lie down'],['shake','Shake'],['sleep','Doze']];",s)
s=re.sub(r"const LOOP_FACE=\{[^}]*\};","const LOOP_FACE={idle:'neutral',walk:'neutral',run:'excited',eat:'content',bend:'happy',happy:'excited',sit:'content',sleep:'asleep'};",s)
sub("const SHELLS=18,HAIR_LEN=0.056;","const SHELLS=8,HAIR_LEN=0.014;")
sub("one furry skin · blue merle coat · 21 bones · drag to orbit","one sleek skin · flowing mane & tail · 21 bones · drag to orbit")
sub("const tgtSpd=(st.loop==='walk'?.75:st.loop==='run'?3.2:0)*(1-aw);","const tgtSpd=(st.loop==='walk'?1.5:st.loop==='bend'?3.0:st.loop==='run'?6.5:0)*(1-aw);")
sub("st.walkPh+=dt*st.speed/0.7*TAU*1.0;st.runPh+=dt*Math.max(st.speed,.5)/3.0*TAU*2.1;","st.walkPh+=dt*st.speed/1.5*TAU*.85;st.runPh+=dt*Math.max(st.speed,1)/6.5*TAU*2.1;")
sub("if(dist>4.2){","if(dist>5.5){")
s=s.replace("sstep(4.2,6.5,dist)","sstep(5.5,7.5,dist)")
sub("0.56+pose[RY]*.4","1.2+pose[RY]*.5");sub("target:[0,0.56,0]","target:[0,1.2,0]");sub("cam={th:0.62,ph:1.24,d:3.7","cam={th:0.7,ph:1.3,d:7");sub("cam.d=Math.max(cam.d,4.4)","cam.d=Math.max(cam.d,8.5)")
s=s.replace("cam.d=clamp(cam.d*pinch0/d,2.2,12)","cam.d=clamp(cam.d*pinch0/d,2.2,20)").replace("cam.d=clamp(cam.d*Math.exp(e.deltaY*.001),2.2,12)","cam.d=clamp(cam.d*Math.exp(e.deltaY*.001),2.2,20)")
sub("<title>Low-Poly Menagerie · 06 Australian Shepherd</title>","<title>Low-Poly Menagerie · 11 Horse</title>")
sub("06 / 20 · LOW-POLY MENAGERIE</span><h1>Australian Shepherd</h1>","11 / 20 · LOW-POLY MENAGERIE</span><h1>Horse</h1>")
sub("Fluffing the coat…","Saddling up…")
s=add_ground(s,extra="[['chest',[0,-0.4,0]],['hips',[0,-0.36,0]]]",skip="['happy']",skipAct="['jump']")
open('index.html','w').write(s);print('ok')
