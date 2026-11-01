s=open('/home/claude/bear/index.html').read()
def rep(a_mark,b_mark,new):
    global s
    a=s.index(a_mark); b=s.index(b_mark,a)
    s=s[:a]+new+s[b:]
def sub(old,new,cnt=1):
    global s
    assert s.count(old)>=1, old[:60]
    s=s.replace(old,new)
# ---------------- SDF ----------------
rep("// ===== BEAR SCULPT =====","function grad(",r'''// ===== PANGOLIN SCULPT =====
const EAR_C=[0.125,0.505,0.75], EAR_M=M4.inv(M4.trs(EAR_C,null,[0,0.3,-0.3],[1,1,1]));
function earLocal(x,y,z){return M4.pt(EAR_M,[x,y,z])}
function sdEar(ax,y,z){const q=earLocal(ax,y,z);return sdEll(q[0],q[1],q[2],0,0,0,0.034,0.03,0.018)}
function sdLegF(ax,y,z){let d=sdCone(ax,y,z,0.165,0.4,0.43,0.185,0.07,0.5,0.085,0.058);return smin(d,sdEll(ax,y,z,0.19,0.04,0.54,0.068,0.04,0.095),0.05)}
function sdLegB(ax,y,z){let d=sdEll(ax,y,z,0.2,0.36,-0.38,0.12,0.17,0.15);d=smin(d,sdCone(ax,y,z,0.2,0.28,-0.42,0.21,0.07,-0.36,0.085,0.062),0.07);return smin(d,sdEll(ax,y,z,0.21,0.04,-0.3,0.075,0.04,0.11),0.05)}
function sdSnout(x,y,z){return sdCone(x,y,z,0,0.41,0.93,0,0.355,1.2,0.095,0.034)}
const TAILP=[[0,0.5,-0.62],[0,0.45,-0.92],[0,0.37,-1.18],[0,0.28,-1.42],[0,0.2,-1.6],[0,0.15,-1.77]],TAILR=[0.25,0.19,0.135,0.09,0.055,0.028];
function sdTail(x,y,z){let d=9;for(let i=0;i<5;i++)d=smin(d,sdCone(x,y,z,...TAILP[i],...TAILP[i+1],TAILR[i],TAILR[i+1]),0.03);return d}
function pigSDF(x,y,z){const ax=Math.abs(x);
  let d=sdEll(x,y,z,0,0.48,0,0.29,0.29,0.52);
  d=smin(d,sdEll(x,y,z,0,0.5,-0.33,0.31,0.31,0.4),0.12);
  d=smin(d,sdEll(x,y,z,0,0.46,0.33,0.25,0.25,0.33),0.12);
  d=smin(d,sdCone(x,y,z,0,0.46,0.55,0,0.43,0.78,0.2,0.14),0.08);
  d=smin(d,sdEll(x,y,z,0,0.43,0.82,0.145,0.135,0.19),0.08);
  d=smin(d,sdSnout(x,y,z),0.07);
  d=smin(d,sdEar(ax,y,z),0.03);
  d=smin(d,sdLegF(ax,y,z),0.1);
  d=smin(d,sdLegB(ax,y,z),0.1);
  d=smin(d,sdTail(x,y,z),0.1);
  return Math.max(d,-(y-0.004));
}
''')
# ---------------- rig ----------------
rep("// ---------- rig ----------","const COL={",r'''// ---------- rig ----------
const BN=['root','hips','spine','chest','neck','head','earL','earR','flU','flL','frU','frL','blU','blL','brU','brL','t0','t1','t2','t3','t4'];
const REST={root:[0,0,0],hips:[0,0.5,-0.33],spine:[0,0.49,0],chest:[0,0.47,0.3],neck:[0,0.45,0.56],head:[0,0.43,0.78],
  earL:[0.12,0.5,0.75],earR:[-0.12,0.5,0.75],flU:[0.165,0.38,0.44],flL:[0.178,0.2,0.47],frU:[-0.165,0.38,0.44],frL:[-0.178,0.2,0.47],
  blU:[0.2,0.37,-0.38],blL:[0.205,0.2,-0.39],brU:[-0.2,0.37,-0.38],brL:[-0.205,0.2,-0.39],t0:TAILP[0],t1:TAILP[1],t2:TAILP[2],t3:TAILP[3],t4:TAILP[4]};
const PARENT={hips:'root',spine:'hips',chest:'spine',neck:'chest',head:'neck',earL:'head',earR:'head',flU:'chest',flL:'flU',frU:'chest',frL:'frU',
  blU:'hips',blL:'blU',brU:'hips',brL:'brU',t0:'hips',t1:'t0',t2:'t1',t3:'t2',t4:'t3'};
const SEG={hips:[[0,0.5,-0.6],[0,0.49,0]],spine:[REST.spine,REST.chest],chest:[REST.chest,[0,0.46,0.56]],neck:[REST.neck,REST.head],head:[REST.head,[0,0.36,1.22]],
  earL:[REST.earL,[0.15,0.53,0.74]],earR:[REST.earR,[-0.15,0.53,0.74]],flU:[REST.flU,REST.flL],flL:[REST.flL,[0.19,0.02,0.53]],frU:[REST.frU,REST.frL],frL:[REST.frL,[-0.19,0.02,0.53]],
  blU:[REST.blU,REST.blL],blL:[REST.blL,[0.21,0.02,-0.3]],brU:[REST.brU,REST.brL],brL:[REST.brL,[-0.21,0.02,-0.3]]};
for(let i=0;i<5;i++)SEG['t'+i]=[TAILP[i],TAILP[i+1]];
function segDist(p,a,b){const ab=vsub(b,a),t=clamp(vdot(vsub(p,a),ab)/vdot(ab,ab),0,1);return vlen(vsub(p,vadd(a,vsc(ab,t))))}
function pigWeights(p){const ax=Math.abs(p[0]),side=p[0]>=0?'L':'R',fs=p[0]>=0?'fl':'fr',bs=p[0]>=0?'bl':'br';const W=[];
  const push=(name,d,pw=4)=>W.push([BN.indexOf(name),1/Math.pow(d+0.015,pw)]);
  for(const n of ['hips','spine','chest'])push(n,segDist(p,...SEG[n])+0.08,6);for(const n of ['neck','head'])push(n,segDist(p,...SEG[n]));
  if(sdEar(ax,p[1],p[2])<0.02){const e='ear'+side;push(e,segDist(p,...SEG[e])*0.55)}
  if(sdTail(p[0],p[1],p[2])<0.05&&p[2]<-0.5)for(let i=0;i<5;i++)push('t'+i,segDist(p,...SEG['t'+i])+0.01,5);
  const lf=sdLegF(ax,p[1],p[2]);if(lf<0.05&&p[1]<0.42){const k=1+Math.max(0,p[1]-0.3)*8;push(fs+'U',segDist(p,...SEG[fs+'U'])*k);push(fs+'L',segDist(p,...SEG[fs+'L'])*k)}
  const lb=sdLegB(ax,p[1],p[2]);if(lb<0.05&&p[1]<0.42){const k=1+Math.max(0,p[1]-0.3)*8;push(bs+'U',segDist(p,...SEG[bs+'U'])*k);push(bs+'L',segDist(p,...SEG[bs+'L'])*k)}
  W.sort((a,b)=>b[1]-a[1]);const top=W.slice(0,4);while(top.length<4)top.push([0,0]);const s=top.reduce((a,b)=>a+b[1],0);
  return [top.map(w=>w[0]),top.map(w=>w[1]/s)]}

''')
# ---------------- colours, skin, scales ----------------
rep("const COL={","/* =====================================================================\n   Scene",r'''const COL={skin:0x947465,belly:0xb8998a,face:0xa98272,paw:0x6c584c,ear:0x8a6a5c,nose:0x3a2a25};
function mixc(a,b,t){return a.map((v,i)=>lerp(v,b[i],t))}
function pigVertex(p){const [x,y,z]=p,ax=Math.abs(x);let c=hex(COL.skin);
  c=mixc(c,hex(COL.belly),sstep(0.34,0.22,y)*sstep(0.85,0.5,z)*sstep(-0.75,-0.5,z));
  c=mixc(c,hex(COL.face),sstep(0.75,0.95,z));
  c=mixc(c,hex(COL.ear),sstep(0.02,0,sdEar(ax,y,z)));
  const paw=sstep(0.08,0.03,y);c=mixc(c,hex(COL.paw),paw);
  return [c,clamp(1-paw,0,1)*.6]}
function buildPig(){
  const f=pigSDF;const sn=surfaceNets(f,[-0.37,-0.02,-1.86],[0.37,0.84,1.28],0.03);
  relax(f,sn.pos,sn.idx,3);orient(f,sn.pos,sn.idx);
  const pos=sn.pos,idx=sn.idx,N=pos.length/3,nor=[],col=[],si=[],sw=[],hair=[];
  for(let i=0;i<N;i++){const p=[pos[i*3],pos[i*3+1],pos[i*3+2]];nor.push(...vnorm(grad(f,...p)));
    const [c,hr]=pigVertex(p);col.push(...c);hair.push(hr);const [I,W]=pigWeights(p);si.push(...I);sw.push(...W)}
  const g=new Geo();g.pos=pos;g.nor=nor;g.col=col;g.idx=idx;
  const wg=new Geo();wg.pos=pos;wg.nor=nor;wg.col=col;for(let t=0;t<idx.length;t+=3)wg.idx.push(idx[t],idx[t+1],idx[t+1],idx[t+2],idx[t+2],idx[t]);
  return {geo:upload(g,{si,sw,m1:pos,hair}),wire:upload(wg,{si,sw,m1:pos,hair}),tris:idx.length/3}}
// ---------- overlapping keratin scales: each one a cupped, keeled plate, skinned rigidly to its anchor ----------
function addScale(o,q,N,F,L,W){const tilt=0.2;const Z=vnorm(vadd(vsc(F,Math.cos(tilt)),vsc(N,Math.sin(tilt))));const Y=vnorm(vsub(N,vsc(Z,vdot(N,Z))));const X=vcross(Y,Z);
  const root=vadd(vadd(q,vsc(N,0.004)),vsc(F,-L*0.3));const NU=5,NV=6,base=o.pos.length/3;
  const sh=hex([0x6e5232,0x5e4329,0x7a5a36,0x66502f][Math.floor(rnd()*4)]).map(v=>v*rr(.85,1.15)),edge=hex(0xc9a571);const [SI,SW]=pigWeights(q);
  for(let i=0;i<=NU;i++){const u=i/NU;const w=W*Math.pow(Math.max(0,Math.sin(PI*(0.14+0.86*u))),0.65)+0.0006;
    for(let j=0;j<=NV;j++){const v=j/NV*2-1;const x=v*w,y=(1-v*v)*W*0.3+W*0.07*(1-Math.abs(v))-u*u*L*0.12,z=u*L;
      o.pos.push(...vadd(vadd(vadd(root,vsc(X,x)),vsc(Y,y)),vsc(Z,z)));o.nor.push(...vnorm(vadd(Y,vsc(X,v*0.55))));
      const e=Math.max(Math.abs(v),u*u*u);const ridge=sstep(.25,0,Math.abs(v))*.12;
      o.col.push(...mixc(sh,edge,sstep(.55,1,e)*.45+ridge*.6).map(c=>c*(0.78+0.22*u)));o.si.push(...SI);o.sw.push(...SW);o.lift.push(u*L)}}
  for(let i=0;i<NU;i++)for(let j=0;j<NV;j++){const a=base+i*(NV+1)+j,b=a+NV+1;o.idx.push(a,b,a+1,b,b+1,a+1)}}
function buildScales(){
  const AX=[[0,.42,.92],[0,.43,.8],[0,.45,.6],[0,.47,.3],[0,.49,0],[0,.5,-.33],[0,.5,-.62],[0,.45,-.92],[0,.37,-1.18],[0,.28,-1.42],[0,.2,-1.6],[0,.15,-1.74]];
  const F=catmull(AX),NS=800,pts=[],cum=[0];for(let i=0;i<=NS;i++)pts.push(F(i/NS));for(let i=1;i<=NS;i++)cum.push(cum[i-1]+vlen(vsub(pts[i],pts[i-1])));
  const total=cum[NS];const at=d=>{let i=0;while(i<NS&&cum[i]<d)i++;return [pts[i],vnorm(vsub(pts[Math.min(i+1,NS)],pts[Math.max(i-1,0)]))]};
  const o={pos:[],nor:[],col:[],idx:[],si:[],sw:[],lift:[]};let d=0.03,row=0,count=0;
  while(d<total-0.015){const [p,T]=at(d);const up=vnorm(vsub([0,1,0],vsc(T,T[1]))),X=vnorm(vcross(up,T));const z=p[2];
    const full=z<-0.8,thMax=full?PI:z>0.62?0.78:z>0.5?1.4:2.0;
    const rTop=vlen(vsub(marchOut(p,up),p));const step=clamp(0.028+0.2*rTop,0.034,0.088);
    const K=72,ring=[],rc=[0];for(let k=0;k<=K;k++){const th=-thMax+2*thMax*k/K;ring.push(marchOut(p,vadd(vsc(up,Math.cos(th)),vsc(X,Math.sin(th)))));if(k)rc.push(rc[k-1]+vlen(vsub(ring[k],ring[k-1])))}
    const arc=step*1.02,len=rc[K],n=Math.max(1,Math.round(len/arc)),off=(row%2)*0.5;
    for(let j=0;j<(full?n:n+1);j++){let a=(j+off)/n*len;if(a>len){if(full)a-=len;else continue}
      let k=1;while(k<K&&rc[k]<a)k++;const t=(a-rc[k-1])/Math.max(1e-6,rc[k]-rc[k-1]);const q=vadd(ring[k-1],vsc(vsub(ring[k],ring[k-1]),t));
      const N=nrm(q);let Fd=vnorm(vsub(T,vsc(N,vdot(T,N))));const sz=rr(.92,1.08);addScale(o,q,N,Fd,step*1.95*sz,arc*0.64*sz);count++}
    d+=step;row++}
  const g=new Geo();g.pos=o.pos;g.nor=o.nor;g.col=o.col;g.idx=o.idx;
  return {geo:upload(g,{si:o.si,sw:o.sw,m1:o.pos,hair:o.lift}),count}}
let scaleItem;

''')
# ---------------- face ----------------
rep("function buildFace(){","function eH(p)",r'''function buildFace(){
  const H=B.head,rE=0.046;const skC=hex(COL.face);
  const gEye=upload(sphere(rE,28,20)),gIris=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.004,32,10,0,TAU,0,0.86),M4.euler(PI/2,0,0));return g})());
  const gPup=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.03,28,8,0,TAU,0,0.48),M4.euler(PI/2,0,0));return g})());
  const gRing=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.012,32,4,0,TAU,0.78,0.08),M4.euler(PI/2,0,0));return g})());
  const gHi=upload(sphere(rE*.19,12,8)),gHi2=upload(sphere(rE*.085,10,6));
  const gLidU=upload(sphere(rE*1.14,32,12,0,TAU,0,PI/2)),gLidL=upload(sphere(rE*1.12,32,12,0,TAU,PI/2,PI/2));
  const gLash=upload(torus(rE*1.14,rE*.085,6,40));
  const gBrow=upload(tube([[-rE*.7,-rE*.1,0],[-rE*.22,rE*.07,0],[rE*.22,rE*.07,0],[rE*.7,-rE*.1,0]],14,u=>0.008+0.006*Math.sin(u*PI),7));
  FACE.eyes=[];
  for(const s of [1,-1]){
    const dir=vnorm([0.66*s,0.36,0.66]);const S=marchOut([0,0.43,0.84],dir);const c=vsub(S,vsc(dir,rE*0.38));
    const eg=H.add(new Node(headLocal(c)));eg.rm=M4.basis(vnorm([0.4*s,0.08,1]));
    addItem(gEye,eg,{color:hex(0xf2ede4),flat:0,rough:.15,spec:1.2,rim:.05,cast:false});
    const ig=eg.add(new Node());addItem(gIris,ig,{color:hex(0x3a2214),flat:0,rough:.2,spec:1,cast:false});
    addItem(gRing,ig,{color:hex(0x160c07),flat:0,rough:.3,cast:false});
    const pg=ig.add(new Node());addItem(gPup,pg,{color:hex(0x050303),flat:0,rough:.2,spec:1,cast:false});
    const h1=eg.add(new Node(vsc(vnorm([-0.36,0.40,0.84]),rE*.95)));addItem(gHi,h1,{color:[0,0,0],emis:[1.4,1.4,1.4],flat:0,cast:false});
    const h2=eg.add(new Node(vsc(vnorm([0.30,-0.28,0.91]),rE*1.0)));addItem(gHi2,h2,{color:[0,0,0],emis:[1,1,1],flat:0,cast:false});
    const lu=eg.add(new Node());addItem(gLidU,lu,{color:skC,flat:0,rough:.75,cast:false,rim:.25,skinD:1});
    addItem(gLash,lu,{color:hex(0x2a1c16),flat:0,rough:.6,cast:false});
    const ll=eg.add(new Node());addItem(gLidL,ll,{color:skC.map(v=>v*.95),flat:0,rough:.75,cast:false,skinD:1});
    const bg=eg.add(new Node([0,rE*1.3,rE*0.62]));addItem(gBrow,bg,{color:hex(0x6a4a3c),flat:0,rough:.7,cast:false});
    FACE.eyes.push({s,eg,ig,pg,lu,ll,bg})}
  FACE.rE=rE;
  const gNos=upload(sphere(1,18,12));
  {const p=marchIn([0,0.365,1.6],[0,0,-1]);const n=nrm(p);const nn=H.add(new Node(headLocal(vadd(p,vsc(n,-0.01)))));nn.rm=M4.basis(n);nn.base=[0.03,0.024,0.02];nn.s=[...nn.base];
    addItem(gNos,nn,{color:hex(COL.nose),flat:0,rough:.2,spec:1.2,cast:false});FACE.nos=[nn]}
  const mouthPts=k=>{const xs=[-0.042,-0.03,-0.015,0,0.015,0.03,0.042];return xs.map(x0=>{const u=Math.abs(x0)/0.042,x=k==='f'?x0*.85:x0;
    const y=k==='n'?0.334+u*u*0.006:k==='s'?0.329+u*u*0.02:0.338-u*u*0.012;
    const p=marchIn([x,y,1.6],[0,0,-1]);return vadd(p,vsc(nrm(p),0.004))})};
  const [mn,ms,mf]=['n','s','f'].map(k=>tube(mouthPts(k),20,u=>0.0052*(0.55+0.45*Math.sin(u*PI)),6,true));
  const mNode=H.add(new Node(vsc(REST.head,-1)));
  FACE.mouth=addItem(upload(mn,{m1:ms.pos,m2:mf.pos}),mNode,{color:hex(0x3a1c1c),flat:0,rough:.5,cast:false});
  const mc=marchIn([0,0.332,1.6],[0,0,-1]);const mo=H.add(new Node(headLocal(vadd(mc,[0,-0.004,-0.008]))));mo.rm=M4.basis(nrm(mc));mo.s=[0.025,0.001,0.015];
  FACE.open=mo;FACE.openS=[0.026,0.022,0.015];addItem(gNos,mo,{color:hex(0x3a1016),flat:0,rough:.6,cast:false});
  // long sticky tongue (extends from the mouth when eating)
  const tn=H.add(new Node(headLocal(vadd(mc,[0,-0.002,-0.01]))));
  addItem(upload(tube([[0,0,0],[0,-0.004,0.1],[0,-0.012,0.2],[0,-0.026,0.3],[0,-0.045,0.38]],30,u=>lerp(0.008,0.0035,u),7,true)),tn,{color:hex(0xe37a8a),flat:0,rough:.25,spec:1.2,cast:false});
  tn.s=[1,1,0.001];tn.visible=false;FACE.tongue=tn;
  const gB=upload(disc(0.03,20));FACE.blush=[];
  for(const s of [1,-1]){const d=vnorm([0.85*s,-0.25,0.45]);const p=marchOut([0,0.41,0.86],d);const n=nrm(p);
    const bn=H.add(new Node(headLocal(vadd(p,vsc(n,0.003)))));bn.rm=M4.basis(n);bn.s=[1,0.7,1];
    FACE.blush.push(addItem(gB,bn,{color:[0,0,0],emis:hex(0xff7d8c).map(v=>v*.8),flat:0,op:0,trans:true,cast:false}))}
  // big curved digging claws in front, shorter ones behind
  const gClawF=upload(tube([[0,0,0],[0,0.005,0.05],[0,-0.012,0.095],[0,-0.035,0.12]],12,u=>lerp(0.014,0.002,u),6,true));
  const gClawB=upload(tube([[0,0,0],[0,0,0.03],[0,-0.012,0.05]],8,u=>lerp(0.011,0.002,u),6,true));
  for(const [bn,cz,n,g] of [['flL',0.6,3,gClawF],['frL',0.6,3,gClawF],['blL',-0.21,4,gClawB],['brL',-0.21,4,gClawB]]){const sx=REST[bn][0];
    for(let k=0;k<n;k++){const o=k-(n-1)/2;const wp=[sx+o*0.034,0.045,cz-Math.abs(o)*0.01];const nd=B[bn].add(new Node(vsub(wp,REST[bn])));nd.r=[0,o*0.12,0];
      addItem(g,nd,{color:hex(0xcbb796),flat:0,rough:.35,spec:.7,cast:true})}}
}
''')
# ---------------- poses ----------------
rep("const LL=0.8;","const EXPR={",r'''const LL=0.36;
function crouchB(P,d,fk=1,bk=1){const a=Math.acos(clamp(1-d/LL,-1,1));legs(P,[-a*fk,2*a*fk],[-a*bk,2*a*bk]);P[RY]-=d}
const TB=['t0','t1','t2','t3','t4'];
function tailSway(P,t,sp,amp,lift=0){TB.forEach((n,i)=>S(P,n,lift,Math.sin(t*sp-i*.6)*amp,0))}
function ballPose(P,k){S(P,'hips',-0.55*k,0,0);S(P,'spine',0.85*k,0,0);S(P,'chest',0.95*k,0,0);S(P,'neck',1.0*k,0,0);S(P,'head',1.05*k,0,0);
  TB.forEach((n,i)=>S(P,n,-(0.72+i*0.06)*k,0,0.04*k));legs(P,[-1.3*k,2.0*k],[-1.5*k,1.8*k]);P[RY]+=BALL_DY*k}
let BALL_DY=0.0,BALL_C=[0,0.38,0.0],BALL_R=0.38;
function standPose(P,k){S(P,'hips',-0.62*k,0,0);for(const n of ['blU','brU'])S(P,n,0.62*k,0,0);for(const n of ['flU','frU'])S(P,n,-0.5*k,0,0);for(const n of ['flL','frL'])S(P,n,1.6*k,0,0);
  S(P,'neck',.35*k,0,0);S(P,'head',.22*k,0,0);S(P,'t0',.55*k,0,0);S(P,'t1',.15*k,0,0);S(P,'t2',.05*k,0,0)}
const POSES={
  idle(t,L){const P=P0(),br=Math.sin(t*1.8);S(P,'spine',br*.012,0,0);S(P,'chest',-br*.01,0,0);
    const sniff=Math.pow(Math.max(0,Math.sin(t*.5)),8);
    S(P,'neck',.05+sniff*.1,L.yaw*.3,0);S(P,'head',Math.sin(t*.6)*.04+sniff*.12+Math.sin(t*20)*.02*sniff,L.yaw*.45+Math.sin(t*.33)*.1,Math.sin(t*.27)*.06);
    tailSway(P,t,.8,.04);P[RY]=br*.004;return P},
  walk(t,L,ph){const P=P0();const leg=(n,q,back)=>{S(P,n+'U',-Math.sin(q)*.4,0,0);S(P,n+'L',Math.max(0,Math.cos(q))*.6,0,0)};
    leg('bl',ph,1);leg('fl',ph+PI*.5);leg('br',ph+PI,1);leg('fr',ph+PI*1.5);
    S(P,'spine',-.06,Math.sin(ph)*.05,0);S(P,'hips',0,Math.sin(ph)*.06,Math.sin(ph)*.04);S(P,'chest',0,-Math.sin(ph+.5)*.07,-Math.sin(ph+.5)*.05);
    S(P,'neck',.1,0,0);S(P,'head',.08+Math.cos(2*ph)*.03,-Math.sin(ph+1)*.12+L.yaw*.2,0);tailSway(P,ph,1,.1);P[RY]=-Math.cos(2*ph)*.008;return P},
  run(t,L,ph){const P=P0(); // ground pangolins run on their hind legs: low, crouched, leaning forward
    S(P,'hips',-0.34,0,0);for(const n of ['flU','frU'])S(P,n,-0.35,0,0);for(const n of ['flL','frL'])S(P,n,1.5,0,0);
    S(P,'neck',.2,0,0);S(P,'head',.12,0,0);S(P,'t0',.32,0,0);S(P,'t1',.1,0,0);
    for(const [n,o] of [['bl',0],['br',PI]]){const q=ph+o;S(P,n+'U',0.34-0.42-Math.sin(q)*.5,0,0);S(P,n+'L',0.84+Math.max(0,Math.cos(q))*.75,0,0)}
    S(P,'chest',0,0,Math.sin(ph)*.07);S(P,'head',Math.sin(2*ph)*.05,-Math.sin(ph)*.06,0);tailSway(P,ph,1,.1);P[RY]=-.035+Math.abs(Math.sin(ph))*.025;return P},
  eat(t,L){const P=P0();const dig=Math.sin(t*8);S(P,'hips',.04,0,0);S(P,'neck',.12,Math.sin(t*.7)*.15,0);S(P,'head',.2+Math.sin(t*10)*.03,Math.sin(t*.7)*.2,0);
    crouchB(P,.04,1.5,.3);for(const n of ['flU','frU','blU','brU'])S(P,n,-.1,0,0);
    const side=Math.sin(t*1.1)>0;S(P,side?'flU':'frU',-.3-Math.max(0,dig)*.55,0,0);S(P,side?'flL':'frL',.4+Math.max(0,-dig)*.8,0,0);tailSway(P,t,2,.08);return P},
  bend(t,L){const P=P0(),a=.82+.18*Math.sin(t*1.5);S(P,'hips',.3*a,Math.sin(t*4)*.1,0);
    S(P,'flU',-.3*a-1.0*a,0,0);S(P,'flL',.15*a,0,0);S(P,'frU',-.3*a-1.0*a,0,0);S(P,'frL',.15*a,0,0);
    S(P,'blU',-.3*a,0,0);S(P,'brU',-.3*a,0,0);S(P,'neck',-.35*a,0,0);S(P,'head',-.2*a,L.yaw*.3,Math.sin(t*1.2)*.25);
    TB.forEach((n,i)=>S(P,n,.22*a,Math.sin(t*6-i*.7)*.2,0));P[RY]=-.03*a;return P},
  happy(t,L){const P=P0(),j=Math.abs(Math.sin(t*5));standPose(P,1);P[RY]=j*.07;
    for(const n of ['flU','frU'])S(P,n,Math.sin(t*10)*.3,0,0);S(P,'chest',0,Math.sin(t*5)*.15,Math.sin(t*5)*.1);S(P,'head',0,L.yaw*.3,Math.sin(t*5)*.2);
    tailSway(P,t,10,.22);return P},
  sleep(t,L){const P=P0(),br=Math.sin(t*1.1);ballPose(P,1);S(P,'spine',br*.03,0,0);return P},
};
const ACTIONS={
  attack:{dur:2.5,pose(t,L){const P=P0();const k=sstep(0,.3,t)*(1-sstep(2.1,2.5,t));
    S(P,'spine',.18*k,0,0);S(P,'chest',.12*k,0,0);S(P,'neck',.25*k,0,0);S(P,'head',.18*k+Math.sin(t*26)*.02*k,0,0);crouchB(P,.03*k,1,1);
    const e=sstep(.45,.6,t)*(1-sstep(1.7,1.95,t)),w=(t-.45)*9;
    S(P,'hips',0,-Math.sin(w)*.4*e,0);S(P,'spine',0,Math.sin(w)*.18*e,0);S(P,'chest',0,Math.sin(w)*.12*e,0);
    TB.forEach((n,i)=>S(P,n,.1*k,Math.sin(w-i*.75)*.45*e,0));return P},
    speed:()=>0,face:t=>t<.4?'angry':t<1.95?'roar':'angry',flare:t=>sstep(0,.3,t)*(1-sstep(2.1,2.5,t)),
    fx(at,fw){const e=sstep(.45,.6,at)*(1-sstep(1.7,1.95,at));if(e>.5){const c=Math.floor(at/.11);if(c!==st.fx.c){st.fx.c=c;const p=worldOf(B.t4,[0,-0.1,-0.15]);spawn('puff',[p[0],.03,p[2]],[rr(-.5,.5),.35,rr(-.5,.5)],.05,.6,0xd8c49c);if(c%4===0)st.shake=.06}}
      if(at>.25&&at<.5&&!st.fx.h){st.fx.h=1;const p=worldOf(FACE.nos[0]);spawn('puff',p,vadd(vsc(fw,.6),[0,.05,0]),.03,.5,0xffffff)}}},
  curl:{dur:4.8,pose(t,L){const P=P0();const k=sstep(0,.65,t)*(1-sstep(3.9,4.8,t));ballPose(P,k);
    const r=clamp((t-.8)/2.8,0,1);S(P,'root',(sstep(0,1,r)*TAU*2)%TAU,0,0);return P},
    speed:t=>{const r=(t-.8)/2.8;if(r<0||r>1)return 0;return TAU*2*6*r*(1-r)/2.8*BALL_R},face:t=>t<.35?'surprised':'asleep',flare:t=>.4*sstep(0,.65,t)*(1-sstep(3.9,4.8,t)),
    fx(at){const r=(at-.8)/2.8;if(r>0&&r<1){const c=Math.floor(at/.12);if(c!==st.fx.c){st.fx.c=c;spawn('puff',vadd(st.pos,[rr(-.15,.15),.03,0]),[rr(-.3,.3),.3,rr(-.3,.3)],.05,.7,0xd8c49c)}}}},
  jump:{dur:1.25,pose(t,L){const P=P0();
    if(t<.3){const c=sstep(0,.3,t);crouchB(P,.07*c);S(P,'head',.1*c,0,0)}
    else if(t<.85){const u=(t-.3)/.55;P[RY]=4*.32*u*(1-u);const tk=Math.sin(u*PI);legs(P,[-.8*tk,1.1*tk],[.7*tk,.5*tk]);S(P,'hips',-.2*(1-u)+.15*u,0,0);TB.forEach((n,i)=>S(P,n,.25*tk,0,0))}
    else{const v=(t-.85)/.4;crouchB(P,.06*Math.sin(v*PI)*(1-.3*v))}
    return P},speed:t=>t>.3&&t<.85?1.1:0,face:t=>t<.4?'surprised':t<.85?'excited':'happy'},
  shake:{dur:1.6,pose(t,L){const P=P0(),e=Math.pow(Math.sin(PI*t/1.6),.6),w=t*24;
    S(P,'head',0,Math.sin(w)*.5*e,Math.sin(w)*.12*e);S(P,'neck',0,Math.sin(w-.6)*.3*e,0);S(P,'chest',0,0,Math.sin(w-1.1)*.18*e);S(P,'hips',0,0,Math.sin(w-1.6)*.14*e);
    tailSway(P,w,1,.3*e);return P},speed:()=>0,face:()=>'squint',flare:t=>.6*Math.sin(PI*t/1.6)},
};
''')
# ---------------- engine tweaks ----------------
sub("uniform mat4 uBones[20];","uniform mat4 uBones[24];")
sub("const boneMats=new Float32Array(20*16);","const boneMats=new Float32Array(24*16);")
sub("uniform float uShell,uShellL;uniform vec3 uComb;","uniform float uShell,uShellL,uFlare;uniform vec3 uComb;")
sub(" if(uShell>0.){"," if(uFlare>0.)w.xyz+=normalize(n)*aHair*uFlare;\n if(uShell>0.){")
sub("    gl.uniform2fv(U.uMW,it.mw);\n","    gl.uniform2fv(U.uMW,it.mw);gl.uniform1f(U.uFlare,it.flare||0);\n")
sub("  B.root.p=[0,pose[RY],0];","  B.root.p=[0,pose[RY],0];{const rx=B.root.r[0];if(rx){const cy=BALL_C[1],cz=BALL_C[2];B.root.p=[0,pose[RY]+cy-(cy*Math.cos(rx)-cz*Math.sin(rx)),cz-(cy*Math.sin(rx)+cz*Math.cos(rx))]}}\n  {const ft=A&&aw>0&&A.flare?A.flare(st.actT)*aw:0.25*st.w.sleep;st.flare=lerp(st.flare||0,ft,1-Math.exp(-dt*8));if(scaleItem)scaleItem.flare=st.flare*0.55}")
sub("FACE.open.s=[0.06*(1-E.open*.2),Math.max(.001,0.055*E.open),0.03];","FACE.open.s=[FACE.openS[0]*(1-E.open*.2),Math.max(.001,FACE.openS[1]*E.open),FACE.openS[2]];\n  if(FACE.tongue){const ext=A?0:st.loop==='eat'?Math.pow(Math.max(0,Math.sin(t*3.2)),2):st.loop==='idle'?Math.pow(Math.max(0,Math.sin(t*1.3)),30)*.8:0;st.tg=lerp(st.tg||0,ext,1-Math.exp(-dt*14));FACE.tongue.s=[1,1,Math.max(.001,st.tg)];FACE.tongue.r=[(st.loop==='eat'?-.12:.08)+Math.sin(t*9)*.1*st.tg,Math.sin(t*7)*.3*st.tg,0];FACE.tongue.visible=st.tg>.02}")
sub("  if(st.act==='attack'){const at=st.actT;","  if(A&&A.fx)A.fx(st.actT,fw);\n  if(st.act==='attack'&&!A.fx){const at=st.actT;")
sub("const tgtSpd=(st.loop==='walk'?.85:st.loop==='run'?3.1:0)*(1-aw);","const tgtSpd=(st.loop==='walk'?.42:st.loop==='run'?1.25:0)*(1-aw);")
sub("st.walkPh+=dt*st.speed/0.85*TAU*1.05;st.runPh+=dt*Math.max(st.speed,.5)/3.1*TAU*2.4;","st.walkPh+=dt*st.speed/0.42*TAU*1.1;st.runPh+=dt*Math.max(st.speed,.4)/1.25*TAU*2.3;")
sub("if(st.w.run>.5&&st.speed>1.5)","if(st.w.run>.5&&st.speed>.9)")
sub("['attack','Attack'],","['attack','Attack'],['curl','Curl'],")
sub("const pig=buildPig();pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.55,rim:.3,spec:.3,skinD:1});","const pig=buildPig();pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.6,rim:.3,spec:.3,skinD:1});const sc=buildScales();scaleItem=addItem(sc.geo,null,{skin:true,flat:0,rough:.3,rim:.3,spec:1.1});window.__scales=sc.count;")
sub("document.getElementById('wire').onclick=e=>{wireItem.visible=!wireItem.visible;","document.getElementById('wire').onclick=e=>{wireItem.visible=!wireItem.visible;scaleItem.visible=!wireItem.visible;")
sub("const SHELLS=18,HAIR_LEN=0.055;","const SHELLS=0,HAIR_LEN=0.02;")
sub("one furry skin · ${pig.tris.toLocaleString()} tris · 18 bones · drag to orbit","one skin · ${window.__scales} scales · 21 bones · drag to orbit")
sub("0.82+pose[RY]*.4","0.42+pose[RY]*.4");sub("target:[0,0.82,0]","target:[0,0.42,0]");sub("cam={th:0.62,ph:1.24,d:5.2","cam={th:0.62,ph:1.22,d:3.5");sub("cam.d=Math.max(cam.d,5.8)","cam.d=Math.max(cam.d,4.1)")
# termite mounds in the meadow
sub("  env.merge(trees);",r'''  for(const [mx,mz,ms] of [[-6.8,-4.6,1],[7.4,3.2,.8],[-7.6,5.2,1.2],[3,8.4,.7]]){
    trees.merge(flatten(jitter(cyl(.06*ms,.55*ms,1.5*ms,9),.06*ms),()=>hex(rnd()<.5?0xb9794a:0xa96a3f).map(v=>v*rr(.9,1.06))),M4.trs([mx,.75*ms,mz],null,[0,rnd()*3,0],[1,1,1]));
    for(let k=0;k<4;k++){const a=rnd()*TAU;trees.merge(flatten(jitter(cyl(.03*ms,.22*ms,.6*ms,7),.03),()=>hex(0xb27248)),M4.trs([mx+Math.cos(a)*.4*ms,.3*ms,mz+Math.sin(a)*.4*ms],null,[rr(-.2,.2),0,rr(-.2,.2)],[1,1,1]))}}
  env.merge(trees);''')
sub("<title>Low-Poly Menagerie · 02 Bear</title>","<title>Low-Poly Menagerie · 03 Pangolin</title>")
sub("02 / 20 · LOW-POLY MENAGERIE</span><h1>Bear</h1>","03 / 20 · LOW-POLY MENAGERIE</span><h1>Pangolin</h1>")
sub("Sculpting the bear…","Growing the scales…")
open('index.html','w').write(s)
print("ok")
s=open('index.html').read();s=s.replace("const [x,y,z]=place(5,26),s=rr(.15,.6)","const [x,y,z]=place(7.5,26),s=rr(.15,.6)");open('index.html','w').write(s)
s=open('index.html').read();s=s.replace("cam.target=vadd(cam.target,vsc(vsub(tgt,cam.target),1-Math.exp(-dt*4)));","if(window.__camT)cam.target=window.__camT;else cam.target=vadd(cam.target,vsc(vsub(tgt,cam.target),1-Math.exp(-dt*4)));");open('index.html','w').write(s)
