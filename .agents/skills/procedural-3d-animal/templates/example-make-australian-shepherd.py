import re
s=open('/home/claude/leopard/index.html').read()
bear=open('/home/claude/bear/index.html').read()
def rep(a_mark,b_mark,new):
    global s
    a=s.index(a_mark); b=s.index(b_mark,a); s=s[:a]+new+s[b:]
def sub(old,new):
    global s
    assert old in s, old[:70]; s=s.replace(old,new)
# ---------------- SDF ----------------
rep("// ===== SNOW LEOPARD SCULPT =====","function grad(",r'''// ===== AUSTRALIAN SHEPHERD SCULPT =====
const EAR_C=[0.088,0.915,0.55], EAR_M=M4.inv(M4.trs(EAR_C,null,[0.1,0.15,-0.4],[1,1,1]));
function earLocal(x,y,z){return M4.pt(EAR_M,[x,y,z])}
function sdEar(ax,y,z){const q=earLocal(ax,y,z);const fold=Math.max(0,q[1]-0.012);const taper=1+1.3*Math.max(0,q[1])/0.07;
  return sdEll(q[0]*taper,q[1],q[2]-fold*fold*9+q[0]*q[0]*2,0,0,0,0.046,0.072,0.016)}
function sdLegF(ax,y,z){const d=sdCone(ax,y,z,0.09,0.5,0.3,0.09,0.07,0.33,0.056,0.04);return smin(d,sdEll(ax,y,z,0.09,0.035,0.36,0.046,0.035,0.062),0.04)}
function sdLegB(ax,y,z){let d=sdEll(ax,y,z,0.1,0.47,-0.3,0.078,0.15,0.12);d=smin(d,sdCone(ax,y,z,0.1,0.35,-0.38,0.1,0.07,-0.33,0.046,0.036),0.05);return smin(d,sdEll(ax,y,z,0.1,0.035,-0.3,0.043,0.035,0.056),0.04)}
function sdSnout(x,y,z){return sdCone(x,y,z,0,0.775,0.63,0,0.748,0.8,0.076,0.05)}
const TAILP=[[0,0.6,-0.46],[0,0.6,-0.57],[0,0.575,-0.67],[0,0.535,-0.76],[0,0.5,-0.83],[0,0.48,-0.89]],TAILR=[0.052,0.048,0.044,0.04,0.034,0.026];
function sdTail(x,y,z){let d=9;for(let i=0;i<5;i++)d=smin(d,sdCone(x,y,z,...TAILP[i],...TAILP[i+1],TAILR[i],TAILR[i+1]),0.03);return d}
function pigSDF(x,y,z){const ax=Math.abs(x);
  let d=sdEll(x,y,z,0,0.55,0,0.15,0.17,0.38);
  d=smin(d,sdEll(x,y,z,0,0.56,-0.3,0.16,0.18,0.22),0.1);
  d=smin(d,sdEll(x,y,z,0,0.55,0.24,0.17,0.21,0.24),0.1);
  d=smin(d,sdCone(x,y,z,0,0.62,0.36,0,0.75,0.52,0.125,0.1),0.07);
  d=smin(d,sdEll(x,y,z,0,0.8,0.57,0.118,0.11,0.12),0.06);
  d=smin(d,sdSnout(x,y,z),0.05);
  d=smin(d,sdEll(x,y,z,0,0.73,0.66,0.06,0.035,0.08),0.04);
  d=smin(d,sdEar(ax,y,z),0.02);
  d=smin(d,sdLegF(ax,y,z),0.06);
  d=smin(d,sdLegB(ax,y,z),0.06);
  d=smin(d,sdTail(x,y,z),0.05);
  return Math.max(d,-(y-0.004));
}
''')
rep("// ---------- rig ----------","const COL={",r'''// ---------- rig ----------
const BN=['root','hips','spine','chest','neck','head','earL','earR','flU','flL','frU','frL','blU','blL','brU','brL','t0','t1','t2','t3','t4'];
const REST={root:[0,0,0],hips:[0,0.56,-0.25],spine:[0,0.56,0],chest:[0,0.57,0.25],neck:[0,0.65,0.42],head:[0,0.78,0.56],
  earL:[0.085,0.88,0.55],earR:[-0.085,0.88,0.55],flU:[0.09,0.5,0.3],flL:[0.09,0.27,0.32],frU:[-0.09,0.5,0.3],frL:[-0.09,0.27,0.32],
  blU:[0.1,0.5,-0.3],blL:[0.1,0.3,-0.37],brU:[-0.1,0.5,-0.3],brL:[-0.1,0.3,-0.37],t0:TAILP[0],t1:TAILP[1],t2:TAILP[2],t3:TAILP[3],t4:TAILP[4]};
const PARENT={hips:'root',spine:'hips',chest:'spine',neck:'chest',head:'neck',earL:'head',earR:'head',flU:'chest',flL:'flU',frU:'chest',frL:'frU',
  blU:'hips',blL:'blU',brU:'hips',brL:'brU',t0:'hips',t1:'t0',t2:'t1',t3:'t2',t4:'t3'};
const SEG={hips:[[0,0.56,-0.5],[0,0.56,0]],spine:[REST.spine,REST.chest],chest:[REST.chest,[0,0.62,0.42]],neck:[REST.neck,REST.head],head:[REST.head,[0,0.74,0.84]],
  earL:[REST.earL,[0.11,1.0,0.57]],earR:[REST.earR,[-0.11,1.0,0.57]],flU:[REST.flU,REST.flL],flL:[REST.flL,[0.09,0.02,0.36]],frU:[REST.frU,REST.frL],frL:[REST.frL,[-0.09,0.02,0.36]],
  blU:[REST.blU,REST.blL],blL:[REST.blL,[0.1,0.02,-0.3]],brU:[REST.brU,REST.brL],brL:[REST.brL,[-0.1,0.02,-0.3]]};
for(let i=0;i<5;i++)SEG['t'+i]=[TAILP[i],TAILP[i+1]];
function segDist(p,a,b){const ab=vsub(b,a),t=clamp(vdot(vsub(p,a),ab)/vdot(ab,ab),0,1);return vlen(vsub(p,vadd(a,vsc(ab,t))))}
function pigWeights(p){const ax=Math.abs(p[0]),side=p[0]>=0?'L':'R',fs=p[0]>=0?'fl':'fr',bs=p[0]>=0?'bl':'br';const W=[];
  const push=(name,d,pw=4)=>W.push([BN.indexOf(name),1/Math.pow(d+0.012,pw)]);
  for(const n of ['hips','spine','chest'])push(n,segDist(p,...SEG[n])+0.05,6);for(const n of ['neck','head'])push(n,segDist(p,...SEG[n]));
  if(sdEar(ax,p[1],p[2])<0.018){const e='ear'+side;push(e,segDist(p,...SEG[e])*0.5)}
  if(sdTail(p[0],p[1],p[2])<0.03&&p[2]<-0.4)for(let i=0;i<5;i++)push('t'+i,segDist(p,...SEG['t'+i])+0.005,5);
  const lf=sdLegF(ax,p[1],p[2]);if(lf<0.035&&p[1]<0.5){const k=1+Math.max(0,p[1]-0.38)*8;push(fs+'U',segDist(p,...SEG[fs+'U'])*k);push(fs+'L',segDist(p,...SEG[fs+'L'])*k)}
  const lb=sdLegB(ax,p[1],p[2]);if(lb<0.035&&p[1]<0.52){const k=1+Math.max(0,p[1]-0.4)*8;push(bs+'U',segDist(p,...SEG[bs+'U'])*k);push(bs+'L',segDist(p,...SEG[bs+'L'])*k)}
  W.sort((a,b)=>b[1]-a[1]);const top=W.slice(0,4);while(top.length<4)top.push([0,0]);const s=top.reduce((a,b)=>a+b[1],0);
  return [top.map(w=>w[0]),top.map(w=>w[1]/s)]}

''')
rep("const COL={","/* =====================================================================\n   Scene",r'''const COL={skin:0x7a838c,white:0xf3f1ec,tan:0xa3602e,nose:0x161616};
function mixc(a,b,t){return a.map((v,i)=>lerp(v,b[i],t))}
function pigVertex(p){const [x,y,z]=p,ax=Math.abs(x);let c=hex(COL.skin);
  // copper-tan points: cheeks, eyebrow dots, legs, under the tail
  const cheek=sstep(0.6,0.66,z)*sstep(0.8,0.76,y)*sstep(0.71,0.74,y)*sstep(0.05,0.08,ax)*sstep(0.8,0.7,z);
  const brow=sstep(0.022,0.01,Math.hypot(ax-0.052,y-0.862,z-0.655));
  const legT=sstep(0.3,0.25,y)*sstep(0.15,0.2,y)*0.85;
  const tailT=sstep(-0.4,-0.48,z)*sstep(0.54,0.5,y)*sstep(0.06,0,sdTail(x,y,z));
  c=mixc(c,hex(COL.tan),clamp(cheek+brow+legT+tailT,0,1));
  // white collar, chest, belly, blaze, muzzle, socks
  const na=[0,0.62,0.36],nb=[0,0.75,0.52],nd=vsub(nb,na),nt=vdot(vsub(p,na),nd)/vdot(nd,nd);
  const collar=sstep(0.15,0.3,nt)*sstep(0.75,0.6,nt)*sstep(0.62,0.55,y+Math.max(0,0.05-0)*0)+sstep(0.2,0.3,nt)*sstep(0.75,0.62,nt)*0.85;
  const chest=sstep(0.18,0.3,z)*sstep(0.66,0.52,y)*sstep(0.14,0.06,ax*0.9-(0.66-y)*0.2);
  const belly=sstep(0.44,0.38,y)*sstep(0.1,0.04,ax);
  const blaze=sstep(0.6,0.66,z)*sstep(0.026+Math.max(0,z-0.62)*0.25,0.012,ax)*sstep(0.74,0.78,y);
  const muzzle=sstep(0.015,-0.01,sdSnout(x,y,z))*sstep(0.66,0.7,z)*(sstep(0.77,0.74,y)+sstep(0.75,0.78,y)*sstep(0.03,0.01,ax));
  const sock=sstep(0.2,0.14,y);
  c=mixc(c,hex(COL.white),clamp(collar+chest+belly+blaze+muzzle+sock,0,1));
  const face=sstep(0.6,0.7,z)*sstep(0.66,0.72,y),mz=sstep(0.02,0,sdSnout(x,y,z));const ear=sstep(0.02,0,sdEar(ax,y,z));
  const mane=sstep(0.15,0.4,nt)*sstep(0.9,0.6,nt);
  const back=sstep(0.62,0.7,y)*sstep(0.5,0.38,z);
  const crown=sstep(0.83,0.88,y)*sstep(0.42,0.5,z)*sstep(0.66,0.6,z);
  const ruff=sstep(0.44,0.5,z)*sstep(0.6,0.55,z)*sstep(0.06,0.1,ax)*sstep(0.62,0.7,y);
  const hair=clamp(0.85+mane*0.45+back*0.45+crown*0.35+ruff*0.5+sstep(-0.45,-0.55,z)*0.3-face*0.45-mz*0.3-ear*0.3-sstep(0.3,0.1,y)*0.3,0.2,1.5);
  return [c,hair]}
function buildPig(){
  const f=pigSDF;const sn=surfaceNets(f,[-0.21,-0.02,-0.96],[0.21,1.03,0.88],0.02);
  relax(f,sn.pos,sn.idx,3);orient(f,sn.pos,sn.idx);
  const pos=sn.pos,idx=sn.idx,N=pos.length/3,nor=[],col=[],si=[],sw=[],hair=[];
  for(let i=0;i<N;i++){const p=[pos[i*3],pos[i*3+1],pos[i*3+2]];nor.push(...vnorm(grad(f,...p)));
    const [c,hr]=pigVertex(p);col.push(...c);hair.push(hr);const [I,W]=pigWeights(p);si.push(...I);sw.push(...W)}
  const g=new Geo();g.pos=pos;g.nor=nor;g.col=col;g.idx=idx;
  const wg=new Geo();wg.pos=pos;wg.nor=nor;wg.col=col;for(let t=0;t<idx.length;t+=3)wg.idx.push(idx[t],idx[t+1],idx[t+1],idx[t+2],idx[t+2],idx[t]);
  return {geo:upload(g,{si,sw,m1:pos,hair}),wire:upload(wg,{si,sw,m1:pos,hair}),tris:idx.length/3}}
let scaleItem;

''')
rep("function buildFace(){","function eH(p)",r'''function buildFace(){
  const H=B.head,rE=0.033;const skC=hex(COL.skin);
  const gEye=upload(sphere(rE,28,20)),gIris=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.004,32,10,0,TAU,0,1.0),M4.euler(PI/2,0,0));return g})());
  const gPup=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.03,28,8,0,TAU,0,0.44),M4.euler(PI/2,0,0));return g})());
  const gRing=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.012,32,4,0,TAU,0.92,0.08),M4.euler(PI/2,0,0));return g})());
  const gHi=upload(sphere(rE*.2,12,8)),gHi2=upload(sphere(rE*.09,10,6));
  const gLidU=upload(sphere(rE*1.14,32,12,0,TAU,0,PI/2)),gLidL=upload(sphere(rE*1.12,32,12,0,TAU,PI/2,PI/2));
  const gLash=upload(torus(rE*1.14,rE*.1,6,40)),gLashL=upload(torus(rE*1.12,rE*.07,6,40));
  const gBrow=upload(tube([[-rE*.7,-rE*.1,0],[-rE*.22,rE*.07,0],[rE*.22,rE*.07,0],[rE*.7,-rE*.1,0]],14,u=>0.006+0.006*Math.sin(u*PI),7));
  FACE.eyes=[];
  for(const s of [1,-1]){ // heterochromia: one blue eye, one brown eye
    const dir=vnorm([0.42*s,0.28,0.86]);const S=marchOut([0,0.8,0.6],dir);const c=vsub(S,vsc(dir,rE*0.36));
    const eg=H.add(new Node(headLocal(c)));eg.rm=M4.basis(vnorm([0.16*s,0.03,1]));
    addItem(gEye,eg,{color:hex(0xf4f1ea),flat:0,rough:.12,spec:1.3,rim:.05,cast:false});
    const ig=eg.add(new Node());addItem(gIris,ig,{color:hex(s>0?0x5f9fd6:0x6e4322),flat:0,rough:.15,spec:1.2,cast:false});
    addItem(gRing,ig,{color:hex(s>0?0x24496e:0x2e1a0c),flat:0,rough:.3,cast:false});
    const pg=ig.add(new Node());addItem(gPup,pg,{color:hex(0x050505),flat:0,rough:.15,spec:1,cast:false});
    const h1=eg.add(new Node(vsc(vnorm([-0.36,0.40,0.84]),rE*.95)));addItem(gHi,h1,{color:[0,0,0],emis:[1.5,1.5,1.5],flat:0,cast:false});
    const h2=eg.add(new Node(vsc(vnorm([0.30,-0.28,0.91]),rE*1.0)));addItem(gHi2,h2,{color:[0,0,0],emis:[1,1,1],flat:0,cast:false});
    const lu=eg.add(new Node());addItem(gLidU,lu,{color:skC.map(v=>v*.8),flat:0,rough:.8,cast:false,rim:.25,skinD:1});
    addItem(gLash,lu,{color:hex(0x151515),flat:0,rough:.6,cast:false});
    const ll=eg.add(new Node());addItem(gLidL,ll,{color:skC.map(v=>v*.8),flat:0,rough:.8,cast:false,skinD:1});addItem(gLashL,ll,{color:hex(0x1c1c1c),flat:0,rough:.6,cast:false});
    const bg=eg.add(new Node([0,rE*1.3,rE*0.62]));addItem(gBrow,bg,{color:hex(0xa8642e),flat:0,rough:.7,cast:false});
    FACE.eyes.push({s,eg,ig,pg,lu,ll,bg})}
  FACE.rE=rE;
  const gNos=upload(sphere(1,18,12));
  const np=marchIn([0,0.765,1.2],[0,0,-1]);
  {const n=nrm(np);const nn=H.add(new Node(headLocal(vadd(np,vsc(n,-0.012)))));nn.rm=M4.basis(n);nn.base=[0.036,0.026,0.024];nn.s=[...nn.base];
    addItem(gNos,nn,{color:hex(COL.nose),flat:0,rough:.15,spec:1.5,cast:false});FACE.nos=[nn]}
  const q1=marchIn([0,0.735,1.2],[0,0,-1]),q2=marchIn([0,0.718,1.2],[0,0,-1]);
  const phN=H.add(new Node(vsc(REST.head,-1)));addItem(upload(tube([vadd(np,[0,-0.02,-0.004]),vadd(q1,vsc(nrm(q1),0.003)),vadd(q2,vsc(nrm(q2),0.003))],10,0.0035,6)),phN,{color:hex(0x2a2222),flat:0,rough:.6,cast:false});
  const mouthPts=k=>{const xs=[-0.06,-0.045,-0.022,0,0.022,0.045,0.06];return xs.map(x0=>{const u=Math.abs(x0)/0.06,x=k==='f'?x0*.85:x0;
    const y=k==='n'?0.712+u*u*0.012:k==='s'?0.706+u*u*0.03:0.718-u*u*0.016;
    const p=marchIn([x,y,1.2],[0,0,-1]);return vadd(p,vsc(nrm(p),0.003))})};
  const [mn,ms,mf]=['n','s','f'].map(k=>tube(mouthPts(k),22,u=>0.0045*(0.55+0.45*Math.sin(u*PI)),6,true));
  const mNode=H.add(new Node(vsc(REST.head,-1)));
  FACE.mouth=addItem(upload(mn,{m1:ms.pos,m2:mf.pos}),mNode,{color:hex(0x2c2222),flat:0,rough:.5,cast:false});
  const mc=marchIn([0,0.71,1.2],[0,0,-1]);const mo=H.add(new Node(headLocal(vadd(mc,[0,-0.01,-0.024]))));mo.rm=M4.basis(nrm(mc));mo.s=[0.042,0.001,0.02];
  FACE.open=mo;FACE.openS=[0.042,0.034,0.02];addItem(gNos,mo,{color:hex(0x3a1016),flat:0,rough:.6,cast:false});
  const tgi=mo.add(new Node([0,-0.4,0.35]));tgi.s=[0.7,0.5,0.6];addItem(gNos,tgi,{color:hex(0xe0707e),flat:0,rough:.4,cast:false});
  const gFang=upload(cyl(0,0.007,0.022,6));FACE.fangs=[];
  for(const s of [1,-1])for(const yv of [0.75,-0.7]){const fn=mo.add(new Node([0.55*s,yv,0.55]));fn.r=[yv>0?PI:0,0,0];fn.s=[1/0.042,0.9/0.034,1/0.02];FACE.fangs.push(fn);addItem(gFang,fn,{color:hex(0xf3ecdc),flat:0,rough:.3,spec:.8,cast:false})}
  // panting tongue that hangs out of the mouth
  const tn=H.add(new Node(headLocal(vadd(mc,[0,-0.004,-0.022]))));
  const tP=[[0,0,-0.012],[0,-0.002,0.012],[0,-0.008,0.03],[0,-0.022,0.044],[0,-0.045,0.05],[0,-0.068,0.046],[0,-0.082,0.038]];
  const tF=catmull(tP),tg=new Geo(),NS=26,NR=14;
  for(let i=0;i<=NS;i++){const u=i/NS,C=tF(u),T=vnorm(vsub(tF(Math.min(1,u+.02)),tF(Math.max(0,u-.02)))),X=[1,0,0],Nn=vnorm(vcross(T,X));
    const w=0.022*(u<.8?1:Math.sqrt(Math.max(0,1-(u-.8)/.2)))*(0.85+0.15*Math.sin(u*PI)),th=0.0055*(u<.85?1:Math.max(.25,1-(u-.85)/.15));
    for(let j=0;j<=NR;j++){const a=j/NR*TAU,ca=Math.cos(a),sa=Math.sin(a);const groove=sa>0?Math.exp(-ca*ca*30)*0.004:0;
      tg.pos.push(...vadd(C,vadd(vsc(X,ca*w),vsc(Nn,sa*th-groove))));tg.nor.push(...vnorm(vadd(vsc(X,ca*th),vsc(Nn,sa*w))));
      const c=hex(0xe5687a).map(v=>v*(1-.25*Math.exp(-ca*ca*30)*(sa>0?1:0))*(0.9+0.1*u));tg.col.push(...c)}}
  for(let i=0;i<NS;i++)for(let j=0;j<NR;j++){const a=i*(NR+1)+j,b=a+NR+1;tg.idx.push(a,b,a+1,b,b+1,a+1)}
  addItem(upload(tg),tn,{color:[1,1,1],flat:0,rough:.22,spec:1.3,rim:.2,cast:false});tn.s=[0.001,0.001,0.001];tn.visible=false;FACE.tongue=tn;
  FACE.blush=[];
}
''')
rep("const LL=0.5;","const EXPR={",r'''const LL=0.46;
function crouchB(P,d,fk=1,bk=1){const a=Math.acos(clamp(1-d/LL,-1,1));legs(P,[-a*fk,2*a*fk],[-a*bk,2*a*bk]);P[RY]-=d}
const TB=['t0','t1','t2','t3','t4'];
function tailSway(P,t,sp,amp,lift=0){TB.forEach((n,i)=>S(P,n,lift,Math.sin(t*sp-i*.6)*amp*(.6+i*.2),0))}
function wag(P,t,sp,amp,lift=-.15){TB.forEach((n,i)=>S(P,n,lift*(i<2?1:.3),Math.sin(t*sp-i*.45)*amp*(.7+i*.15),0))}
let BALL_DY=0,BALL_C=[0,0.3,0],BALL_R=0.3;
function sitPose(P,t,L){S(P,'hips',-.34,0,0);P[RY]=-.24;S(P,'blU',-1.25,0,0);S(P,'brU',-1.25,0,0);S(P,'blL',2.15,0,0);S(P,'brL',2.15,0,0);
  S(P,'flU',.3,0,0);S(P,'frU',.3,0,0);S(P,'flL',.05,0,0);S(P,'frL',.05,0,0);S(P,'neck',-.1,L.yaw*.3,0);S(P,'head',-.05,L.yaw*.4,0)}
const POSES={
  idle(t,L){const P=P0(),pant=Math.sin(t*10);S(P,'chest',pant*.012,0,0);
    S(P,'neck',-.04,L.yaw*.3,0);S(P,'head',Math.sin(t*.6)*.04,L.yaw*.5+Math.sin(t*.33)*.08,Math.pow(Math.max(0,Math.sin(t*.4)),6)*.35);
    earBob(P,twitch(t,0)*.3,twitch(t,2)*.25);wag(P,t,7,.32);P[RY]=pant*.002;return P},
  walk(t,L,ph){const P=P0();const leg=(n,q,back)=>{S(P,n+'U',-Math.sin(q)*.45,0,0);S(P,n+'L',Math.max(0,Math.cos(q))*(back?.6:.8)-(back?0:.04),0,0)};
    leg('bl',ph,1);leg('fl',ph+PI*.5);leg('br',ph+PI,1);leg('fr',ph+PI*1.5);
    S(P,'hips',0,Math.sin(ph)*.05,Math.sin(ph)*.04);S(P,'chest',0,-Math.sin(ph+.5)*.05,-Math.sin(ph+.5)*.05);
    S(P,'neck',.05,0,0);S(P,'head',-.03+Math.cos(2*ph)*.03,L.yaw*.2,0);earBob(P,Math.cos(2*ph)*.1,0);wag(P,t,6,.25);P[RY]=-Math.cos(2*ph)*.012;return P},
  run(t,L,ph){const P=P0();const leg=(n,q,back)=>{S(P,n+'U',-Math.sin(q)*.9,0,0);S(P,n+'L',Math.max(0,Math.cos(q))*(back?1.0:1.15)+.05,0,0)};
    leg('fl',ph);leg('fr',ph+.35);leg('bl',ph+PI,1);leg('br',ph+PI+.35,1);
    S(P,'hips',Math.sin(ph)*.16,0,0);S(P,'chest',-Math.sin(ph+.3)*.18,0,0);S(P,'neck',.12,0,0);S(P,'head',.04+Math.sin(ph+1)*.06,0,0);
    earBob(P,-.6+Math.sin(ph*2)*.15,-.2);TB.forEach((n,i)=>S(P,n,.05*i,Math.sin(ph-i*.5)*.08,0));P[RY]=.03+.06*Math.max(0,Math.sin(ph-.6));return P},
  eat(t,L){const P=P0();S(P,'hips',.1,0,0);S(P,'neck',.5,Math.sin(t*.7)*.1,0);S(P,'head',.35+Math.abs(Math.sin(t*6))*.06,Math.sin(t*.7)*.15,0);
    crouchB(P,.06,1.5,.4);for(const n of ['flU','frU','blU','brU'])S(P,n,-.1,0,0);earBob(P,.2,.05);wag(P,t,5,.2);return P},
  bend(t,L){const P=P0(),a=.85+.15*Math.sin(t*2);S(P,'hips',.4*a,0,0);
    S(P,'flU',-.4*a-1.05*a,0,0);S(P,'flL',.1*a,0,0);S(P,'frU',-.4*a-1.05*a,0,0);S(P,'frL',.1*a,0,0);
    S(P,'blU',-.4*a,0,0);S(P,'brU',-.4*a,0,0);S(P,'neck',-.4*a,0,0);S(P,'head',-.15*a,L.yaw*.3,Math.sin(t*1.5)*.25);
    earBob(P,.2,-.05);wag(P,t,15,.5,-.35);P[RY]=-.04*a;return P},
  happy(t,L){const P=P0(),j=Math.abs(Math.sin(t*6));P[RY]=j*.07;legs(P,[-.25*j,.5*j],[.2*j,.3*j]);
    S(P,'hips',0,Math.sin(t*12)*.25,0);S(P,'chest',0,-Math.sin(t*12)*.1,0);S(P,'head',-.1,L.yaw*.3,Math.sin(t*3)*.22);earBob(P,-.2*j,.1);wag(P,t,20,.55,-.25);return P},
  sit(t,L){const P=P0();sitPose(P,t,L);S(P,'head',0,0,Math.pow(Math.max(0,Math.sin(t*.7)),4)*.35);S(P,'chest',Math.sin(t*10)*.01,0,0);
    TB.forEach((n,i)=>S(P,n,i===0?.5:.05,Math.sin(t*5-i*.4)*.3,0));return P},
  sleep(t,L){const P=P0(),br=Math.sin(t*1.0);P[RY]=-.38+br*.005;S(P,'hips',0,0,1.45);S(P,'spine',br*.02,0,0);S(P,'chest',-br*.015,0,0);
    S(P,'neck',.15,0,-.15);S(P,'head',.25,.25,-.2);legs(P,[-.45,.55],[.35,.35]);S(P,'flU',0,0,.1);S(P,'blU',0,0,.15);earBob(P,.3,.1);
    TB.forEach((n,i)=>S(P,n,0,.35,0));return P},
};
const BEATS=[.35,.72,1.1];const barkPulse=t=>BEATS.reduce((a,b)=>a+Math.exp(-Math.pow((t-b)/.07,2)),0);
const ACTIONS={
  attack:{dur:1.7,pose(t,L){const P=P0();const k=sstep(0,.2,t)*(1-sstep(1.4,1.7,t)),b=barkPulse(t);
    crouchB(P,.03*k,1,1);S(P,'flU',-.15*k,0,0);S(P,'frU',-.15*k,0,0);S(P,'chest',-.05*k+b*.05,0,0);S(P,'neck',-.12*k-b*.12,0,0);S(P,'head',.04*k-b*.18,0,0);
    earBob(P,.35*k-b*.2,-.1*k);TB.forEach((n,i)=>S(P,n,-.3*k,Math.sin(t*12-i*.4)*.15*k,0));return P},
    speed:()=>0,face:()=>'angry',mouth:t=>.15+.85*Math.min(1,barkPulse(t)),
    fx(at,fw){const c=BEATS.findIndex(b=>at>b-.02&&at<b+.1);if(c>=0&&st.fx.bk!==c){st.fx.bk=c;st.shake=.06;const p=worldOf(FACE.open);for(let i=0;i<4;i++)spawn('puff',p,vadd(vsc(fw,rr(.6,1.1)),[rr(-.2,.2),rr(0,.2),rr(-.2,.2)]),.025,.5,0xffffff)}}},
  roll:{dur:3.4,pose(t,L){const P=P0();const down=sstep(0,.55,t)*(1-sstep(2.75,3.4,t)),r=sstep(.55,1.15,t)*(1-sstep(2.1,2.75,t));
    P[RY]=-.36*down+.03*r;S(P,'hips',0,0,.25*down*(1-r)+PI*.97*r);legs(P,[-.6*down,1.0*down],[.5*down,.6*down]);
    for(const [n,o] of [['flU',0],['frU',1],['blU',2],['brU',3]])S(P,n,Math.sin(t*9+o*1.6)*.35*r,0,0);
    S(P,'neck',.1*down,0,-.2*r);S(P,'head',.12*down,0,-.35*r);wag(P,t,14,.4*r+.2);return P},speed:()=>0,face:t=>t<.55?'excited':'happy'},
  jump:{dur:1.5,pose(t,L){const P=P0();
    if(t<.35){const c=sstep(0,.35,t);crouchB(P,.14*c);S(P,'head',.1*c,0,0);earBob(P,-.2*c,0)}
    else if(t<1.0){const u=(t-.35)/.65;P[RY]=4*.6*u*(1-u);const tk=Math.sin(u*PI);legs(P,[-1.0*tk,1.2*tk],[.85*tk,.5*tk]);S(P,'hips',-.3*(1-u)+.25*u,0,0);earBob(P,-.6*tk,.25*tk);wag(P,t,10,.3)}
    else{const v=(t-1.0)/.5;crouchB(P,.11*Math.sin(v*PI)*(1-.3*v));S(P,'head',.12*Math.sin(v*PI),0,0)}
    return P},speed:t=>t>.35&&t<1.0?2.2:0,face:t=>t<.4?'surprised':'pant'},
  shake:{dur:1.6,pose(t,L){const P=P0(),e=Math.pow(Math.sin(PI*t/1.6),.6),w=t*26;
    S(P,'head',0,Math.sin(w)*.55*e,Math.sin(w)*.15*e);S(P,'neck',0,Math.sin(w-.6)*.35*e,0);S(P,'chest',0,0,Math.sin(w-1.1)*.22*e);S(P,'hips',0,0,Math.sin(w-1.6)*.2*e);
    earBob(P,Math.sin(w-2)*.4*e,Math.sin(w-2.2)*.9*e);tailSway(P,w,1,.4*e);return P},speed:()=>0,face:()=>'squint'},
};
''')
sub("const EXPR={","const EXPR={\n  smile:{up:.1,low:.18,ba:-.08,by:.006,pup:1.05,smile:.85,open:0,blush:0,ear:.05},\n  pant:{up:.08,low:.22,ba:-.12,by:.008,pup:1.1,smile:.9,open:.5,blush:0,ear:.15},")
# merle coat: black marbled patches + silver mottling, only on the grey areas (white & tan stay clean)
a=s.index("   base*=.92+.16*m2;\n   float zH=");b=s.index("base=mix(base,vec3(.055,.05,.045),clamp(pat*.88,0.,1.));",a)+len("base=mix(base,vec3(.055,.05,.045),clamp(pat*.88,0.,1.));")
s=s[:a]+"""   float mxc=max(base.r,max(base.g,base.b)),mnc=min(base.r,min(base.g,base.b));
   float greyM=smoothstep(.55,.42,mxc)*smoothstep(.1,.04,mxc-mnc)*smoothstep(.05,.1,mxc);
   base*=1.-greyM*(.18-.36*fbm(vR*13.+2.));                                               // silver-blue mottling
   float nM=fbm(vR*4.6+vec3(3.,1.,7.))+.1*smoothstep(.6,.72,vR.y)-.04*smoothstep(.62,.5,vR.y);
   float mpatch=smoothstep(.5,.56,nM);                                                       // big black merle patches
   float speck=smoothstep(.19,.12,worley(vR*17.+4.))*smoothstep(.42,.52,fbm(vR*3.+5.));    // small black flecks
   base=mix(base,vec3(.018,.018,.02),clamp(mpatch+speck*.85,0.,1.)*greyM);"""+s[b:]
# meadow (ranch) habitat back instead of mountains
a=s.index("function noise2(x,z)");b=s.index("// particles",a)
ba=bear.index("function noise2(x,z)");bb=bear.index("// particles",ba)
s=s[:a]+bear[ba:bb]+"function initSnow(){}\nfunction updSnow(){}\n"+s[b:]
sub("vec3 top=vec3(.14,.36,.74),hor=vec3(.84,.88,.92);","vec3 top=vec3(.18,.42,.78),hor=vec3(.86,.80,.70);")
sub("GND=hex(0xa09c90).map(v=>v*.32),FOG=hex(0xd3dbe2);","GND=hex(0x9aa86a).map(v=>v*.3),FOG=hex(0xd8d2c4);")
sub("gl.uniform1f(U.uFogN,26);gl.uniform1f(U.uFogF,100);","gl.uniform1f(U.uFogN,22);gl.uniform1f(U.uFogF,62);")
s=s.replace("background:#dfe6ec","background:#d9e4ea")
# dog-specific behaviour hooks
s=re.sub(r"  if\(FACE\.tongue\)\{const ext=[^\n]*\n","  if(FACE.tongue){const pt=clamp((E.open-.2)/.25,0,1)*(st.act==='attack'?0:1);st.tg=lerp(st.tg||0,pt,1-Math.exp(-dt*7));const e=Math.max(.001,st.tg),bob=Math.sin(t*10)*.05*st.tg;FACE.tongue.s=[e,e*(1+bob),e];FACE.tongue.r=[.08+Math.sin(t*10)*.06*st.tg,Math.sin(t*2.3)*.08*st.tg,0];FACE.tongue.visible=st.tg>.04}\n",s)
sub("const T=EXPR[fk];const k=1-Math.exp(-dt*9);for(const key in T)E[key]=lerp(E[key],T[key],k);","st.pT=(st.pT||0)-dt;if(st.pT<0){st.pantOn=!st.pantOn;st.pT=st.pantOn?rr(3.5,7):rr(2.5,5)}\n  if(fk==='pant'&&!st.pantOn&&st.loop!=='run')fk='smile';\n  const T=EXPR[fk];const k=1-Math.exp(-dt*6);for(const key in T)E[key]=lerp(E[key],T[key],k);if(fk==='pant')E.open=lerp(E.open,.44+.1*Math.sin(t*10),k);if(A&&aw>.4&&A.mouth)E.open=A.mouth(st.actT);")
sub("f.visible=E.open>.3","f.visible=E.open>.72")
sub("w:{idle:1,walk:0,run:0,eat:0,bend:0,happy:0,sleep:0}","w:{idle:1,walk:0,run:0,eat:0,bend:0,happy:0,sit:0,sleep:0}")
sub("spawn('drop',vadd(p,[Math.cos(a)*.4,rr(-.1,.3),Math.sin(a)*.4]),[Math.cos(a)*rr(1.5,3),rr(1,2.5),Math.sin(a)*rr(1.5,3)],rr(.018,.03),1.2,0x7a5434)","spawn('drop',vadd(p,[Math.cos(a)*.25,rr(-.05,.2),Math.sin(a)*.25]),[Math.cos(a)*rr(1.5,3),rr(1,2.5),Math.sin(a)*rr(1.5,3)],rr(.01,.018),1.2,0xa9d8f2)")
s=re.sub(r"const ACTS=\[[^;]*\];","const ACTS=[['idle','Idle'],['walk','Walk'],['run','Run'],['attack','Bark'],['sit','Sit'],['jump','Jump'],['bend','Play bow'],['roll','Roll over'],['happy','Happy'],['eat','Eat'],['shake','Shake'],['sleep','Sleep']];",s)
sub("const LOOP_FACE={idle:'neutral',walk:'neutral',run:'excited',eat:'content',bend:'squint',happy:'content',sleep:'asleep'};","const LOOP_FACE={idle:'pant',walk:'pant',run:'pant',eat:'content',bend:'excited',happy:'excited',sit:'pant',sleep:'asleep'};")
sub("const SHELLS=16,HAIR_LEN=0.042;","const SHELLS=18,HAIR_LEN=0.056;")
sub("one furry skin · rosette coat · 21 bones · drag to orbit","one furry skin · blue merle coat · 21 bones · drag to orbit")
sub("const tgtSpd=(st.loop==='walk'?.7:st.loop==='run'?3.0:0)*(1-aw);","const tgtSpd=(st.loop==='walk'?.75:st.loop==='run'?3.2:0)*(1-aw);")
sub("<title>Low-Poly Menagerie · 04 Snow Leopard</title>","<title>Low-Poly Menagerie · 06 Australian Shepherd</title>")
sub("04 / 20 · LOW-POLY MENAGERIE</span><h1>Snow Leopard</h1>","06 / 20 · LOW-POLY MENAGERIE</span><h1>Australian Shepherd</h1>")
sub("Climbing the mountain…","Fluffing the coat…")
open('index.html','w').write(s)
print('ok')
s=open('index.html').read();o="P.it.op=.75*(1-t)*sstep(0,.08,t)";assert o in s;s=s.replace(o,"P.it.op=.42*(1-t)*sstep(0,.08,t)");open('index.html','w').write(s)
