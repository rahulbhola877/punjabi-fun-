s=open('/home/claude/pangolin/index.html').read()
def rep(a_mark,b_mark,new):
    global s
    a=s.index(a_mark); b=s.index(b_mark,a); s=s[:a]+new+s[b:]
def sub(old,new):
    global s
    assert old in s, old[:70]; s=s.replace(old,new)
rep("// ===== PANGOLIN SCULPT =====","function grad(",r'''// ===== SNOW LEOPARD SCULPT =====
const EAR_C=[0.095,0.915,0.715], EAR_M=M4.inv(M4.trs(EAR_C,null,[0.2,0.25,-0.45],[1,1,1]));
function earLocal(x,y,z){return M4.pt(EAR_M,[x,y,z])}
function sdEar(ax,y,z){const q=earLocal(ax,y,z);return sdEll(q[0],q[1],q[2]+(q[0]*q[0]+q[1]*q[1])*3,0,0,0,0.05,0.048,0.018)}
function sdLegF(ax,y,z){const d=sdCone(ax,y,z,0.12,0.56,0.36,0.12,0.08,0.42,0.088,0.056);return smin(d,sdEll(ax,y,z,0.12,0.037,0.465,0.066,0.04,0.08),0.045)}
function sdLegB(ax,y,z){let d=sdEll(ax,y,z,0.13,0.5,-0.37,0.1,0.18,0.14);d=smin(d,sdCone(ax,y,z,0.13,0.38,-0.46,0.13,0.08,-0.42,0.066,0.05),0.06);return smin(d,sdEll(ax,y,z,0.13,0.037,-0.38,0.06,0.04,0.075),0.045)}
function sdSnout(x,y,z){return sdEll(x,y,z,0,0.765,0.865,0.105,0.075,0.085)}
const TAILP=[[0,0.66,-0.52],[0,0.57,-0.76],[0,0.42,-0.96],[0,0.31,-1.16],[0,0.29,-1.37],[0,0.35,-1.54]],TAILR=[0.075,0.066,0.063,0.061,0.06,0.052];
function sdTail(x,y,z){let d=9;for(let i=0;i<5;i++)d=smin(d,sdCone(x,y,z,...TAILP[i],...TAILP[i+1],TAILR[i],TAILR[i+1]),0.03);return d}
function pigSDF(x,y,z){const ax=Math.abs(x);
  let d=sdEll(x,y,z,0,0.6,0,0.205,0.23,0.44);
  d=smin(d,sdEll(x,y,z,0,0.62,-0.33,0.21,0.235,0.27),0.1);
  d=smin(d,sdEll(x,y,z,0,0.62,0.3,0.21,0.245,0.3),0.1);
  d=smin(d,sdCone(x,y,z,0,0.66,0.46,0,0.77,0.66,0.155,0.125),0.07);
  d=smin(d,smin(sdEll(x,y,z,0,0.8,0.74,0.135,0.12,0.13),sdEll(x,y,z,0,0.765,0.78,0.14,0.085,0.1),0.06),0.06);
  d=smin(d,sdSnout(x,y,z),0.05);
  d=smin(d,sdCone(x,y,z,0,0.82,0.8,0,0.792,0.9,0.055,0.04),0.04);
  d=smin(d,sdEar(ax,y,z),0.025);
  d=smin(d,sdLegF(ax,y,z),0.07);
  d=smin(d,sdLegB(ax,y,z),0.07);
  d=smin(d,sdTail(x,y,z),0.06);
  return Math.max(d,-(y-0.004));
}
''')
rep("// ---------- rig ----------","const COL={",r'''// ---------- rig ----------
const BN=['root','hips','spine','chest','neck','head','earL','earR','flU','flL','frU','frL','blU','blL','brU','brL','t0','t1','t2','t3','t4'];
const REST={root:[0,0,0],hips:[0,0.62,-0.3],spine:[0,0.62,0],chest:[0,0.63,0.3],neck:[0,0.68,0.5],head:[0,0.78,0.7],
  earL:[0.09,0.88,0.72],earR:[-0.09,0.88,0.72],flU:[0.12,0.52,0.38],flL:[0.12,0.28,0.4],frU:[-0.12,0.52,0.38],frL:[-0.12,0.28,0.4],
  blU:[0.13,0.52,-0.36],blL:[0.13,0.3,-0.44],brU:[-0.13,0.52,-0.36],brL:[-0.13,0.3,-0.44],t0:TAILP[0],t1:TAILP[1],t2:TAILP[2],t3:TAILP[3],t4:TAILP[4]};
const PARENT={hips:'root',spine:'hips',chest:'spine',neck:'chest',head:'neck',earL:'head',earR:'head',flU:'chest',flL:'flU',frU:'chest',frL:'frU',
  blU:'hips',blL:'blU',brU:'hips',brL:'brU',t0:'hips',t1:'t0',t2:'t1',t3:'t2',t4:'t3'};
const SEG={hips:[[0,0.62,-0.55],[0,0.62,0]],spine:[REST.spine,REST.chest],chest:[REST.chest,[0,0.66,0.5]],neck:[REST.neck,REST.head],head:[REST.head,[0,0.76,0.98]],
  earL:[REST.earL,[0.12,0.97,0.71]],earR:[REST.earR,[-0.12,0.97,0.71]],flU:[REST.flU,REST.flL],flL:[REST.flL,[0.12,0.02,0.46]],frU:[REST.frU,REST.frL],frL:[REST.frL,[-0.12,0.02,0.46]],
  blU:[REST.blU,REST.blL],blL:[REST.blL,[0.13,0.02,-0.36]],brU:[REST.brU,REST.brL],brL:[REST.brL,[-0.13,0.02,-0.36]]};
for(let i=0;i<5;i++)SEG['t'+i]=[TAILP[i],TAILP[i+1]];
function segDist(p,a,b){const ab=vsub(b,a),t=clamp(vdot(vsub(p,a),ab)/vdot(ab,ab),0,1);return vlen(vsub(p,vadd(a,vsc(ab,t))))}
function pigWeights(p){const ax=Math.abs(p[0]),side=p[0]>=0?'L':'R',fs=p[0]>=0?'fl':'fr',bs=p[0]>=0?'bl':'br';const W=[];
  const push=(name,d,pw=4)=>W.push([BN.indexOf(name),1/Math.pow(d+0.012,pw)]);
  for(const n of ['hips','spine','chest'])push(n,segDist(p,...SEG[n])+0.06,6);for(const n of ['neck','head'])push(n,segDist(p,...SEG[n]));
  if(sdEar(ax,p[1],p[2])<0.02){const e='ear'+side;push(e,segDist(p,...SEG[e])*0.55)}
  if(sdTail(p[0],p[1],p[2])<0.03&&p[2]<-0.45)for(let i=0;i<5;i++)push('t'+i,segDist(p,...SEG['t'+i])+0.005,5);
  const lf=sdLegF(ax,p[1],p[2]);if(lf<0.04&&p[1]<0.56){const k=1+Math.max(0,p[1]-0.42)*8;push(fs+'U',segDist(p,...SEG[fs+'U'])*k);push(fs+'L',segDist(p,...SEG[fs+'L'])*k)}
  const lb=sdLegB(ax,p[1],p[2]);if(lb<0.04&&p[1]<0.58){const k=1+Math.max(0,p[1]-0.44)*8;push(bs+'U',segDist(p,...SEG[bs+'U'])*k);push(bs+'L',segDist(p,...SEG[bs+'L'])*k)}
  W.sort((a,b)=>b[1]-a[1]);const top=W.slice(0,4);while(top.length<4)top.push([0,0]);const s=top.reduce((a,b)=>a+b[1],0);
  return [top.map(w=>w[0]),top.map(w=>w[1]/s)]}

''')
rep("const COL={","/* =====================================================================\n   Scene",r'''const COL={skin:0xcdc4b2,back:0xb3a996,belly:0xf4f1ea,muzzle:0xf2eee6,earBack:0x3a3632,earIn:0xe9dcd4,tip:0x2a2725};
function mixc(a,b,t){return a.map((v,i)=>lerp(v,b[i],t))}
function pigVertex(p){const [x,y,z]=p,ax=Math.abs(x);let c=hex(COL.skin);
  c=mixc(c,hex(COL.back),sstep(0.72,0.82,y)*sstep(0.62,0.5,z)*sstep(-0.6,-0.45,z));
  const belly=sstep(0.5,0.42,y)*sstep(0.15,0.07,ax)*sstep(-0.55,-0.4,z);c=mixc(c,hex(COL.belly),belly);
  const mz=sstep(0.02,-0.01,sdSnout(x,y,z))*sstep(0.8,0.86,z)+sstep(0.74,0.7,y)*sstep(0.66,0.74,z)*sstep(0.12,0.06,ax);c=mixc(c,hex(COL.muzzle),clamp(mz,0,1));
  const ed=sstep(0.02,0,sdEar(ax,y,z)),el=earLocal(ax,y,z);c=mixc(c,hex(COL.earBack),ed*sstep(0.002,-0.01,el[2]));c=mixc(c,hex(COL.earIn),ed*sstep(0.0,0.012,el[2])*.7);
  c=mixc(c,hex(COL.tip),sstep(-1.38,-1.5,z)*sstep(0.1,0.0,sdTail(x,y,z)));
  const tail=z<-0.5?sstep(0.05,0,sdTail(x,y,z)):0;
  return [c,clamp(0.85+tail*0.15-sstep(0.86,0.95,z)*.4-ed*.45,0,1)]}
function buildPig(){
  const f=pigSDF;const sn=surfaceNets(f,[-0.29,-0.02,-1.66],[0.29,1.0,1.0],0.025);
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
  const H=B.head,rE=0.044;const skC=hex(COL.skin);
  const gEye=upload(sphere(rE,28,20)),gIris=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.004,32,10,0,TAU,0,0.98),M4.euler(PI/2,0,0));return g})());
  const gPup=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.03,28,8,0,TAU,0,0.42),M4.euler(PI/2,0,0));return g})());
  const gRing=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.012,32,4,0,TAU,0.9,0.08),M4.euler(PI/2,0,0));return g})());
  const gHi=upload(sphere(rE*.18,12,8)),gHi2=upload(sphere(rE*.08,10,6));
  const gLidU=upload(sphere(rE*1.14,32,12,0,TAU,0,PI/2)),gLidL=upload(sphere(rE*1.12,32,12,0,TAU,PI/2,PI/2));
  const gLash=upload(torus(rE*1.14,rE*.1,6,40)),gLashL=upload(torus(rE*1.12,rE*.07,6,40));
  const gBrow=upload(tube([[-rE*.7,-rE*.1,0],[-rE*.22,rE*.07,0],[rE*.22,rE*.07,0],[rE*.7,-rE*.1,0]],14,u=>0.007+0.006*Math.sin(u*PI),7));
  FACE.eyes=[];
  for(const s of [1,-1]){
    const dir=vnorm([0.44*s,0.3,0.85]);const S=marchOut([0,0.8,0.76],dir);const c=vsub(S,vsc(dir,rE*0.36));
    const eg=H.add(new Node(headLocal(c)));eg.rm=M4.basis(vnorm([0.12*s,0.03,1]));
    addItem(gEye,eg,{color:hex(0xf4f2ea),flat:0,rough:.12,spec:1.3,rim:.05,cast:false});
    const ig=eg.add(new Node());addItem(gIris,ig,{color:hex(0xa7b48c),flat:0,rough:.15,spec:1.1,cast:false});
    addItem(gRing,ig,{color:hex(0x4c5a3a),flat:0,rough:.3,cast:false});
    const pg=ig.add(new Node());addItem(gPup,pg,{color:hex(0x050505),flat:0,rough:.15,spec:1,cast:false});
    const h1=eg.add(new Node(vsc(vnorm([-0.36,0.40,0.84]),rE*.95)));addItem(gHi,h1,{color:[0,0,0],emis:[1.5,1.5,1.5],flat:0,cast:false});
    const h2=eg.add(new Node(vsc(vnorm([0.30,-0.28,0.91]),rE*1.0)));addItem(gHi2,h2,{color:[0,0,0],emis:[1,1,1],flat:0,cast:false});
    const lu=eg.add(new Node());addItem(gLidU,lu,{color:skC,flat:0,rough:.8,cast:false,rim:.25,skinD:1});
    addItem(gLash,lu,{color:hex(0x1a1714),flat:0,rough:.6,cast:false});
    const ll=eg.add(new Node());addItem(gLidL,ll,{color:skC.map(v=>v*.97),flat:0,rough:.8,cast:false,skinD:1});addItem(gLashL,ll,{color:hex(0x24201c),flat:0,rough:.6,cast:false});
    const bg=eg.add(new Node([0,rE*1.3,rE*0.62]));addItem(gBrow,bg,{color:hex(0x5a544c),flat:0,rough:.7,cast:false});
    FACE.eyes.push({s,eg,ig,pg,lu,ll,bg})}
  FACE.rE=rE;
  const gNos=upload(sphere(1,18,12));
  const np=marchIn([0,0.796,1.3],[0,0,-1]);
  {const n=nrm(np);const nn=H.add(new Node(headLocal(vadd(np,vsc(n,-0.006)))));nn.rm=M4.basis(n);nn.base=[0.027,0.017,0.016];nn.s=[...nn.base];
    addItem(gNos,nn,{color:hex(0xcf8e8b),flat:0,rough:.25,spec:1.1,cast:false});FACE.nos=[nn]}
  const q1=marchIn([0,0.765,1.3],[0,0,-1]),q2=marchIn([0,0.742,1.3],[0,0,-1]);
  const phN=H.add(new Node(vsc(REST.head,-1)));addItem(upload(tube([vadd(np,[0,-0.014,-0.004]),vadd(q1,vsc(nrm(q1),0.004)),vadd(q2,vsc(nrm(q2),0.004))],10,0.0035,6)),phN,{color:hex(0x4a3d3a),flat:0,rough:.6,cast:false});
  const mouthPts=k=>{const xs=[-0.05,-0.035,-0.018,0,0.018,0.035,0.05];return xs.map(x0=>{const u=Math.abs(x0)/0.05,x=k==='f'?x0*.85:x0;
    const y=k==='n'?0.738+u*u*0.008:k==='s'?0.733+u*u*0.024:0.743-u*u*0.015;
    const p=marchIn([x,y,1.3],[0,0,-1]);return vadd(p,vsc(nrm(p),0.004))})};
  const [mn,ms,mf]=['n','s','f'].map(k=>tube(mouthPts(k),22,u=>0.0045*(0.55+0.45*Math.sin(u*PI)),6,true));
  const mNode=H.add(new Node(vsc(REST.head,-1)));
  FACE.mouth=addItem(upload(mn,{m1:ms.pos,m2:mf.pos}),mNode,{color:hex(0x3a2c28),flat:0,rough:.5,cast:false});
  const mc=marchIn([0,0.734,1.3],[0,0,-1]);const mo=H.add(new Node(headLocal(vadd(mc,[0,-0.008,-0.012]))));mo.rm=M4.basis(nrm(mc));mo.s=[0.04,0.001,0.02];
  FACE.open=mo;FACE.openS=[0.042,0.04,0.022];addItem(gNos,mo,{color:hex(0x3a1016),flat:0,rough:.6,cast:false});
  const tg=mo.add(new Node([0,-0.4,0.35]));tg.s=[0.7,0.5,0.6];addItem(gNos,tg,{color:hex(0xd06a76),flat:0,rough:.4,cast:false});
  const gFang=upload(cyl(0,0.008,0.028,6));FACE.fangs=[];
  for(const s of [1,-1])for(const yv of [0.75,-0.7]){const fn=mo.add(new Node([0.55*s,yv,0.55]));fn.r=[yv>0?PI:0,0,0];fn.s=[1/0.042,0.9/0.04,1/0.022];FACE.fangs.push(fn);addItem(gFang,fn,{color:hex(0xf3ecdc),flat:0,rough:.3,spec:.8,cast:false})}
  // whiskers
  const wk=new Geo();
  for(const s of [1,-1])for(let k=0;k<4;k++){const p=marchOut([0,0.77-k*0.008,0.86],vnorm([0.9*s,-0.12+k*0.03,0.42]));
    const a=vadd(p,[-0.004*s,0,0]),b=vadd(p,[0.1*s,0.012-k*0.016,0.02-k*0.012]),c=vadd(p,[0.2*s,-0.004-k*0.03,-0.03-k*0.02]);wk.merge(tube([a,b,c],10,u=>lerp(0.0028,0.0006,u),5,false))}
  const wN=H.add(new Node(vsc(REST.head,-1)));addItem(upload(wk),wN,{color:hex(0xf4f2ee),emis:[.15,.15,.15],flat:0,rough:.3,spec:.6,cast:false});
  FACE.blush=[];
  // retractable claws (only show on the pounce)
  const gClaw=upload(tube([[0,0,0],[0,0.003,0.02],[0,-0.01,0.035]],8,u=>lerp(0.007,0.0012,u),5,true));FACE.claws=[];
  for(const bn of ['flL','frL']){const sx=REST[bn][0];for(let k=0;k<4;k++){const o=k-1.5;const nd=B[bn].add(new Node(vsub([sx+o*0.024,0.03,0.52-Math.abs(o)*0.008],REST[bn])));nd.r=[0,o*0.12,0];nd.visible=false;FACE.claws.push(nd);
    addItem(gClaw,nd,{color:hex(0xe9e2d4),flat:0,rough:.35,spec:.7,cast:false})}}
}
''')
rep("const LL=0.36;","const EXPR={",r'''const LL=0.5;
function crouchB(P,d,fk=1,bk=1){const a=Math.acos(clamp(1-d/LL,-1,1));legs(P,[-a*fk,2*a*fk],[-a*bk,2*a*bk]);P[RY]-=d}
const TB=['t0','t1','t2','t3','t4'];
function tailSway(P,t,sp,amp,lift=0){TB.forEach((n,i)=>S(P,n,lift,Math.sin(t*sp-i*.6)*amp*(.6+i*.2),0))}
let BALL_DY=0,BALL_C=[0,0.4,0],BALL_R=0.4;
const POSES={
  idle(t,L){const P=P0(),br=Math.sin(t*1.6);S(P,'spine',br*.012,0,0);S(P,'chest',-br*.01,0,0);
    S(P,'neck',-.05,L.yaw*.3,0);S(P,'head',Math.sin(t*.6)*.04,L.yaw*.5+Math.sin(t*.33)*.08,Math.sin(t*.27)*.06);
    earBob(P,twitch(t,0)*.3,twitch(t,2)*.25);TB.forEach((n,i)=>S(P,n,i>2?-.12*(i-2):0,Math.sin(t*1.1-i*.55)*.1*(.5+i*.3),0));P[RY]=br*.004;return P},
  walk(t,L,ph){const P=P0();const leg=(n,q,back)=>{S(P,n+'U',-Math.sin(q)*.42,0,0);S(P,n+'L',Math.max(0,Math.cos(q))*(back?.6:.75)-(back?0:.04),0,0)};
    leg('bl',ph,1);leg('fl',ph+PI*.5);leg('br',ph+PI,1);leg('fr',ph+PI*1.5);
    S(P,'hips',0,Math.sin(ph)*.05,Math.sin(ph)*.04);S(P,'chest',0,-Math.sin(ph+.5)*.06,-Math.sin(ph+.5)*.06);
    S(P,'neck',.08,0,0);S(P,'head',-.04,Math.sin(ph+.5)*.05+L.yaw*.2,Math.sin(ph)*.04);earBob(P,Math.cos(2*ph)*.05,0);
    TB.forEach((n,i)=>S(P,n,-.04,Math.sin(ph-i*.6)*.12,0));P[RY]=-Math.cos(2*ph)*.01;return P},
  run(t,L,ph){const P=P0();const leg=(n,q,back)=>{S(P,n+'U',-Math.sin(q)*.95,0,0);S(P,n+'L',Math.max(0,Math.cos(q))*(back?1.0:1.2)+.05,0,0)};
    leg('fl',ph);leg('fr',ph+.35);leg('bl',ph+PI,1);leg('br',ph+PI+.35,1);
    S(P,'hips',Math.sin(ph)*.22,0,0);S(P,'chest',-Math.sin(ph+.3)*.26,0,0);S(P,'neck',.1,0,0);S(P,'head',.06+Math.sin(ph+1)*.06,0,0);
    earBob(P,-.45,-.15);[-.18,.06,.08,.08,.05].forEach((v,i)=>S(P,TB[i],v+Math.sin(ph*2-i*.6)*.04,Math.sin(ph-i*.5)*.05,0));P[RY]=.03+.07*Math.max(0,Math.sin(ph-.6));return P},
  eat(t,L){const P=P0();S(P,'hips',.1,0,0);S(P,'neck',.45,Math.sin(t*.7)*.1,0);S(P,'head',.35+Math.sin(t*9)*.03,Math.sin(t*.7)*.18,Math.sin(t*1.1)*.08);
    crouchB(P,.08,1.5,.4);for(const n of ['flU','frU','blU','brU'])S(P,n,-.1,0,0);earBob(P,.15,.05);tailSway(P,t,2.2,.15);return P},
  bend(t,L){const P=P0(),a=.82+.18*Math.sin(t*1.3);S(P,'hips',.42*a,Math.sin(t*3)*.06,0);
    S(P,'flU',-.42*a-1.05*a,0,0);S(P,'flL',.1*a,0,0);S(P,'frU',-.42*a-1.05*a,0,0);S(P,'frL',.1*a,0,0);
    S(P,'blU',-.42*a,0,0);S(P,'brU',-.42*a,0,0);S(P,'spine',.12*a,0,0);S(P,'neck',-.4*a,0,0);S(P,'head',-.15*a,L.yaw*.3,Math.sin(t*1.1)*.2);
    earBob(P,.1,-.05);TB.forEach((n,i)=>S(P,n,-.25*a+(i>2?.1:0),Math.sin(t*2-i*.6)*.15,0));P[RY]=-.04*a;return P},
  happy(t,L){const P=P0(); // sits down and purrs
    S(P,'hips',-.32,0,0);P[RY]=-.27;S(P,'blU',-1.25,0,0);S(P,'brU',-1.25,0,0);S(P,'blL',2.1,0,0);S(P,'brL',2.1,0,0);
    S(P,'flU',.28,0,0);S(P,'frU',.28,0,0);S(P,'flL',.06,0,0);S(P,'frL',.06,0,0);
    S(P,'neck',-.12,L.yaw*.3,0);S(P,'head',-.1+Math.sin(t*1.4)*.04,L.yaw*.4,Math.sin(t*1.2)*.22);earBob(P,.15,0);
    TB.forEach((n,i)=>S(P,n,i===0?.55:.05,.35+Math.sin(t*1.5-i*.5)*.06,0));return P},
  sleep(t,L){const P=P0(),br=Math.sin(t*1.0);P[RY]=-.4+br*.005;S(P,'hips',0,0,1.45);S(P,'spine',br*.02,0,0);S(P,'chest',-br*.015,0,0);
    S(P,'neck',.15,0,-.15);S(P,'head',.25,.25,-.2);legs(P,[-.45,.55],[.35,.35]);S(P,'flU',0,0,.1);S(P,'blU',0,0,.15);earBob(P,.2,.1);
    TB.forEach((n,i)=>S(P,n,0,.4,0));return P},
};
const ACTIONS={
  attack:{dur:2.7,pose(t,L){const P=P0();
    if(t<1.1){const k=sstep(0,.35,t);crouchB(P,.17*k,1.1,1.0);S(P,'neck',-.1*k,0,0);S(P,'head',.12*k,0,0);
      S(P,'hips',-.05*k,Math.sin(t*16)*.12*sstep(.55,.8,t),0);earBob(P,.25*k,-.1*k);TB.forEach((n,i)=>S(P,n,.12*k,i>2?Math.sin(t*12)*.2*k:0,0))}
    else if(t<1.55){const u=(t-1.1)/.45,e=Math.sin(u*PI);P[RY]=4*.42*u*(1-u)-.17*(1-sstep(0,.3,u));legs(P,[-1.25*e,.1],[1.0*e,.25]);
      S(P,'hips',-.15*(1-u)+.15*u,0,0);S(P,'neck',-.05,0,0);earBob(P,-.6,-.2);TB.forEach((n,i)=>S(P,n,-.12,0,0))}
    else{const v=(t-1.55)/1.15,k=1-sstep(.4,1,v);crouchB(P,.1*Math.sin(Math.min(1,v*3)*PI)*k);const sw=Math.max(0,Math.sin(v*14))*sstep(.1,.2,v)*(1-sstep(.45,.6,v));
      S(P,'flU',-1.1*sw,0,-.25*sw);S(P,'flL',-.2*sw,0,0);S(P,'head',.15*k,Math.sin(v*10)*.1*k,0);earBob(P,-.5*k,-.2*k)}
    return P},speed:t=>t>.3&&t<1.0?.22:t>=1.1&&t<1.55?4.6*Math.sin((t-1.1)/.45*PI)+.4:0,face:t=>t<1.05?'angry':t<1.9?'roar':'angry',
    fx(at,fw){for(const c of FACE.claws)c.visible=at>1.0&&at<2.4;
      if(at>1.55&&!st.fx.land){st.fx.land=1;st.shake=.15;const p=vadd(st.pos,vsc(fw,.4));for(let i=0;i<14;i++){const a=rnd()*TAU;spawn('puff',[p[0],.04,p[2]],[Math.cos(a)*rr(.6,1.6),rr(.2,.7),Math.sin(a)*rr(.6,1.6)],rr(.05,.09),rr(.6,1),0xe6dcc4)}}}},
  roar:{dur:2.3,pose(t,L){const P=P0();const k=sstep(0,.3,t)*(1-sstep(1.9,2.3,t));const r=sstep(.35,.6,t)*(1-sstep(1.5,1.9,t));
    S(P,'neck',-.25*k+.15*r,0,0);S(P,'head',-.3*k+.25*r+Math.sin(t*30)*.025*r,Math.sin(t*3)*.15*r,0);S(P,'chest',-.08*k,0,0);crouchB(P,.04*k,1.2,.6);
    earBob(P,-.8*k,-.3*k);TB.forEach((n,i)=>S(P,n,-.1*k,Math.sin(t*6-i*.6)*.2*k,0));return P},speed:()=>0,face:t=>t<.3?'angry':'roar',
    fx(at,fw){if(at>.6&&!st.fx.r){st.fx.r=1;st.shake=.22;const p=worldOf(FACE.nos[0]);for(let i=0;i<5;i++)spawn('puff',p,vadd(vsc(fw,rr(.5,.9)),[rr(-.15,.15),rr(0,.15),rr(-.15,.15)]),.03,.7,0xffffff)}}},
  jump:{dur:1.5,pose(t,L){const P=P0();
    if(t<.35){const c=sstep(0,.35,t);crouchB(P,.15*c);S(P,'head',.1*c,0,0);earBob(P,-.2*c,0)}
    else if(t<1.0){const u=(t-.35)/.65;P[RY]=4*.7*u*(1-u);const tk=Math.sin(u*PI);legs(P,[-1.1*tk,1.2*tk],[.9*tk,.5*tk]);S(P,'hips',-.3*(1-u)+.25*u,0,0);earBob(P,-.4*tk,.2*tk);TB.forEach((n,i)=>S(P,n,-.2*tk,0,0))}
    else{const v=(t-1.0)/.5;crouchB(P,.12*Math.sin(v*PI)*(1-.3*v));S(P,'head',.12*Math.sin(v*PI),0,0)}
    return P},speed:t=>t>.35&&t<1.0?2.4:0,face:t=>t<.4?'surprised':t<1.0?'excited':'happy'},
  shake:{dur:1.6,pose(t,L){const P=P0(),e=Math.pow(Math.sin(PI*t/1.6),.6),w=t*24;
    S(P,'head',0,Math.sin(w)*.5*e,Math.sin(w)*.12*e);S(P,'neck',0,Math.sin(w-.6)*.3*e,0);S(P,'chest',0,0,Math.sin(w-1.1)*.18*e);S(P,'hips',0,0,Math.sin(w-1.6)*.14*e);
    earBob(P,Math.sin(w-2)*.3*e,Math.sin(w-2.2)*.5*e);tailSway(P,w,1,.3*e);return P},speed:()=>0,face:()=>'squint'},
};
''')
# rosette coat, shared by skin and every fur shell
sub("""   float dots=0.;base*=.85+.3*m2;          // freckle dots
   float fine=0.;
   base=mix(base,base*vec3(.7,.5,.53),clamp(dots*.85+fine*.6,0.,1.));""",
"""   base*=.92+.16*m2;
   float zH=smoothstep(.6,.7,vR.z),lg=smoothstep(.36,.24,vR.y)*step(-.5,vR.z),tl=smoothstep(-.5,-.65,vR.z);
   float fq=mix(mix(14.,22.,max(zH,lg)),8.,tl);
   vec3 pp=vR*fq+vec3(fbm(vR*5.)*.7,fbm(vR*5.+3.)*.7,0.);
   float dd=worley(pp);
   float ring=smoothstep(.5,.38,dd)*smoothstep(.12,.22,dd)*smoothstep(.3,.45,vn(pp*2.4+3.1));      // broken rosettes
   float sm=smoothstep(.2,.12,worley(pp*1.8+7.))*.8;
   float solid=smoothstep(.34,.22,dd);
   float pat=mix(max(ring+solid*.15,sm*(1.-tl)),max(solid,sm*.6),max(max(zH,lg),tl*.85));
   pat*=1.-smoothstep(.47,.4,vR.y)*smoothstep(.14,.06,abs(vR.x))*(1.-lg);                 // pale belly
   pat*=1.-smoothstep(.84,.9,vR.z);                                                         // clean muzzle
   pat*=step(vR.z,.0)+step(0.,vR.z)*(1.-smoothstep(.25,.16,abs(vR.x))*smoothstep(.83,.9,vR.y)*zH*0.);
   base=mix(base,vec3(.055,.05,.045),clamp(pat*.88,0.,1.));""")
sub("const pig=buildPig();pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.6,rim:.3,spec:.3,skinD:1});const sc=buildScales();scaleItem=addItem(sc.geo,null,{skin:true,flat:0,rough:.3,rim:.3,spec:1.1});window.__scales=sc.count;",
    "const pig=buildPig();pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.6,rim:.35,spec:.25,skinD:1});")
sub("scaleItem.visible=!wireItem.visible;","if(scaleItem)scaleItem.visible=!wireItem.visible;")
sub("const SHELLS=0,HAIR_LEN=0.02;","const SHELLS=16,HAIR_LEN=0.042;")
sub("one skin · ${window.__scales} scales · 21 bones · drag to orbit","one furry skin · rosette coat · 21 bones · drag to orbit")
sub("0.42+pose[RY]*.4","0.56+pose[RY]*.4");sub("target:[0,0.42,0]","target:[0,0.56,0]");sub("cam={th:0.62,ph:1.22,d:3.5","cam={th:0.62,ph:1.24,d:3.7");sub("cam.d=Math.max(cam.d,4.1)","cam.d=Math.max(cam.d,4.4)")
sub("const tgtSpd=(st.loop==='walk'?.42:st.loop==='run'?1.25:0)*(1-aw);","const tgtSpd=(st.loop==='walk'?.7:st.loop==='run'?3.0:0)*(1-aw);")
sub("st.walkPh+=dt*st.speed/0.42*TAU*1.1;st.runPh+=dt*Math.max(st.speed,.4)/1.25*TAU*2.3;","st.walkPh+=dt*st.speed/0.7*TAU*1.0;st.runPh+=dt*Math.max(st.speed,.5)/3.0*TAU*2.1;")
sub("if(st.w.run>.5&&st.speed>.9)","if(st.w.run>.5&&st.speed>1.5)")
sub("['attack','Attack'],['curl','Curl'],","['attack','Pounce'],['roar','Roar'],")
sub("const LOOP_FACE={idle:'neutral',walk:'neutral',run:'excited',eat:'content',bend:'happy',happy:'happy',sleep:'asleep'};","const LOOP_FACE={idle:'neutral',walk:'neutral',run:'excited',eat:'content',bend:'squint',happy:'content',sleep:'asleep'};")
# rocky outcrops instead of termite mounds
a=s.index("  for(const [mx,mz,ms] of [[-6.8");b=s.index("  env.merge(trees);",a)
s=s[:a]+r'''  for(const [mx,mz,ms] of [[-7.2,-4.2,1.3],[7.6,3,1],[-7.8,5.4,1.6],[3.4,8.6,.9],[8.4,-5,1.2]]){
    for(let k=0;k<4;k++){const sc=ms*rr(.45,.9);trees.merge(flatten(jitter(icosa(sc,1),sc*.18),()=>hex(rnd()<.5?0xa9a59c:0x9a958b).map(v=>v*rr(.9,1.06))),M4.trs([mx+rr(-.8,.8)*ms,sc*.45,mz+rr(-.8,.8)*ms],null,[rnd(),rnd()*3,rnd()],[1,.75,1]))}}
'''+s[b:]
sub("<title>Low-Poly Menagerie · 03 Pangolin</title>","<title>Low-Poly Menagerie · 04 Snow Leopard</title>")
sub("03 / 20 · LOW-POLY MENAGERIE</span><h1>Pangolin</h1>","04 / 20 · LOW-POLY MENAGERIE</span><h1>Snow Leopard</h1>")
sub("Growing the scales…","Painting the rosettes…")
open('index.html','w').write(s)
print('ok')
# ================= MOUNTAIN HABITAT (snow leopard) =================
s=open('index.html').read()
a=s.index("function noise2(x,z)");b=s.index("// particles",a)
s=s[:a]+r'''function noise2(x,z){const h=(i,j)=>{const s=Math.sin(i*127.1+j*311.7)*43758.5453;return s-Math.floor(s)};const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return lerp(lerp(h(i,j),h(i+1,j),u),lerp(h(i,j+1),h(i+1,j+1),u),v)}
function ridge(x,z){let s=0,a=1,f=1;for(let i=0;i<4;i++){const n=1-Math.abs(noise2(x*f,z*f)*2-1);s+=n*n*a;a*=.5;f*=2.03}return s}
function terrainH(x,z){const r=Math.hypot(x,z);return (noise2(x*.35,z*.35)-.5)*0.06+sstep(8,24,r)*(ridge(x*.07+5,z*.07)*6.5+noise2(x*.25,z*.25)*1.4)+sstep(22,42,r)*ridge(x*.035,z*.035)*12}
const SNOWC=[0xeef2f6,0xe6ecf2,0xf6f8fa],ROCKC=[0x8a857c,0x7b776f,0x948f85,0x6f6b64];
function buildEnv(){
  const g=new Geo();const N=84,S=110;
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){let x=(i/N-.5)*S,z=(j/N-.5)*S;if(i%N&&j%N){x+=rr(-.4,.4);z+=rr(-.4,.4)}g.pos.push(x,terrainH(x,z),z);g.nor.push(0,1,0);g.col.push(1,1,1)}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;g.idx.push(a,c,b,b,c,d)}
  const ground=flatten(g,c=>{const r=Math.hypot(c[0],c[2]);const e=.6,sl=Math.hypot(terrainH(c[0]+e,c[2])-terrainH(c[0]-e,c[2]),terrainH(c[0],c[2]+e)-terrainH(c[0],c[2]-e))/(2*e);
    const n=noise2(c[0]*.4+9,c[2]*.4);let h;
    if(r<9){h=n>.66?SNOWC[Math.floor(rnd()*3)]:n<.3?0x9b9f6a:[0x9c927f,0xa59b87,0x8f8676][Math.floor(rnd()*3)]}
    else if(sl>1.1)h=ROCKC[Math.floor(rnd()*4)];
    else if(c[1]>2.2+n*3)h=SNOWC[Math.floor(rnd()*3)];
    else h=sl>.6?ROCKC[Math.floor(rnd()*4)]:(n>.55?0xa2a07a:0x9b927f);
    return hex(h).map(v=>v*(1+(rnd()-.5)*.07))});
  const env=new Geo();env.merge(ground);const props=new Geo();
  const place=(rmin,rmax)=>{const a=rnd()*TAU,r=rr(rmin,rmax);const x=Math.cos(a)*r,z=Math.sin(a)*r;return [x,terrainH(x,z),z]};
  // distant snow-capped peaks
  for(let i=0;i<13;i++){const a=i/13*TAU+rr(-.2,.2),r=rr(46,58),hgt=rr(16,30),w=rr(9,15);const x=Math.cos(a)*r,z=Math.sin(a)*r;
    const cone=jitter(cyl(0,w,hgt,9,false),1.2);props.merge(flatten(cone,c=>{const t=(c[1]+hgt/2)/hgt;return hex(t>.55+rnd()*.12?SNOWC[Math.floor(rnd()*3)]:ROCKC[Math.floor(rnd()*4)]).map(v=>v*rr(.92,1.05))}),M4.trs([x,hgt/2-2,z],null,[0,rnd()*3,0],[1,1,rr(.8,1.2)]))}
  // snow-dusted pines
  for(let i=0;i<26;i++){const [x,y,z]=place(9,28),s=rr(.8,1.5);
    props.merge(flatten(jitter(cyl(.09*s,.14*s,1.0*s,6),.02),()=>hex(0x5e4330)),M4.trs([x,y+.5*s,z],null,[0,rnd()*3,0],[1,1,1]));
    for(let k=0;k<4;k++){const cs=s*(1.05-k*.22);props.merge(flatten(jitter(cyl(0,.75*cs,1.05*cs,7,true),.05*s),c=>hex(c[1]>0.15*cs&&rnd()<.55?0xf1f4f7:(rnd()<.5?0x355d43:0x2f513b))),M4.trs([x,y+s*(1.2+k*.5),z],null,[0,rnd()*3,0],[1,1,1]))}}
  // boulders and rocky outcrops (snow on top)
  const rock=(x,z,sc)=>{const y=terrainH(x,z);props.merge(flatten(jitter(icosa(sc,1),sc*.2),c=>hex(c[1]>sc*.35&&rnd()<.7?SNOWC[Math.floor(rnd()*3)]:ROCKC[Math.floor(rnd()*4)]).map(v=>v*rr(.92,1.06))),M4.trs([x,y+sc*.35,z],null,[rnd(),rnd()*3,0],[1,rr(.6,.85),1]))};
  for(const [mx,mz,ms] of [[-7.4,-4.4,1.4],[7.8,3,1.1],[-8,5.6,1.7],[3.6,8.8,1],[8.6,-5.2,1.3],[-2,-9,1.2]])for(let k=0;k<5;k++)rock(mx+rr(-1,1)*ms,mz+rr(-1,1)*ms,ms*rr(.4,.95));
  for(let i=0;i<30;i++){const [x,,z]=place(7.5,30);rock(x,z,rr(.15,.7))}
  // sparse alpine grass + edelweiss
  for(let i=0;i<260;i++){const [x,y,z]=place(1.2,16);const s=rr(.5,1.1);
    for(let k=0;k<3;k++)props.merge(flatten(cyl(0,.03*s,.2*s,3,false),()=>hex(rnd()<.5?0xa3a65f:0x8f9752)),M4.trs([x+rr(-.07,.07),y+.08*s,z+rr(-.07,.07)],null,[rr(-.35,.35),rnd()*3,rr(-.35,.35)],[1,1,1]));
    if(i%6===0){const fx=x+rr(-.3,.3),fz=z+rr(-.3,.3);props.merge(flatten(icosa(.04,0),()=>hex(0xf3f1e6)),M4.trs([fx,y+.05,fz],null,[rnd(),rnd(),0],[1,.4,1]));props.merge(flatten(icosa(.014,0),()=>hex(0xe7d36a)),M4.trs([fx,y+.07,fz],null,[0,0,0],[1,1,1]))}}
  env.merge(props);
  const envN=sceneRoot.add(new Node());addItem(upload(env,{flat:true}),envN,{rough:.9,rim:.08,spec:.12});
  const cl=new Geo();for(let i=0;i<9;i++){const a=i/9*TAU+rnd(),r=rr(26,40),y=rr(14,20);for(let k=0;k<5;k++){const s=rr(1.4,2.8);cl.merge(flatten(jitter(icosa(s,1),.15),()=>hex(0xffffff)),M4.trs([Math.cos(a)*r+rr(-2.5,2.5),y+rr(-.5,.6),Math.sin(a)*r+rr(-1.5,1.5)],null,[rnd(),rnd(),0],[1.3,.6,1]))}}
  const clN=sceneRoot.add(new Node());addItem(upload(cl,{flat:true}),clN,{emis:hex(0xdde6ee).map(v=>v*.45),rough:1,rim:.4,cast:false,spec:0});
  initSnow();
  return {clN}
}
// gentle snowfall around the camera target (one buffer, updated each frame)
const SNOWN=320,snowF=[];let snowIt,snowArr;
function initSnow(){const g=new Geo();const O=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],F=[[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];
  for(let i=0;i<SNOWN;i++){snowF.push([rr(-7,7),rr(0,7),rr(-7,7),rr(.35,.8),rnd()*TAU,rr(.008,.016)]);for(const v of O){g.pos.push(0,0,0);g.nor.push(...v)}for(const f of F)g.idx.push(...f.map(k=>k+i*6))}
  snowArr=new Float32Array(SNOWN*18);snowIt=addItem(upload(g),sceneRoot.add(new Node()),{color:[0,0,0],emis:[.9,.93,.97],flat:0,cast:false,rough:1,spec:0,rim:0})}
function updSnow(dt,t){if(!snowIt)return;const O=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];const c=cam.target;
  for(let i=0;i<SNOWN;i++){const f=snowF[i];f[1]-=dt*f[3];f[0]+=Math.sin(t*.7+f[4])*dt*.15+dt*.08;if(f[1]<-0.6){f[1]+=7;f[0]=rr(-7,7);f[2]=rr(-7,7)}
    const wx=c[0]+((f[0]+7)%14+14)%14-7,wz=c[2]+f[2],wy=f[1];for(let k=0;k<6;k++){const o=(i*6+k)*3;snowArr[o]=wx+O[k][0]*f[5];snowArr[o+1]=wy+O[k][1]*f[5];snowArr[o+2]=wz+O[k][2]*f[5]}}
  gl.bindBuffer(gl.ARRAY_BUFFER,snowIt.gl.bufs[0]);gl.bufferSubData(gl.ARRAY_BUFFER,0,snowArr)}
'''+s[b:]
def sub2(o,n):
    global s
    assert o in s,o[:60];s=s.replace(o,n)
sub2("const att=(loc,data,size)=>{const b=gl.createBuffer();","const bufs={};const att=(loc,data,size)=>{const b=gl.createBuffer();bufs[loc]=b;")
sub2("gl.bindVertexArray(null);return {vao,count,indexed}}","gl.bindVertexArray(null);return {vao,count,indexed,bufs}}")
sub2("  updParticles(dt);st.shake=","  updSnow(dt,t);updParticles(dt);st.shake=")
sub2("vec3 top=vec3(.18,.42,.78),hor=vec3(.86,.80,.70);","vec3 top=vec3(.14,.36,.74),hor=vec3(.84,.88,.92);")
sub2("GND=hex(0x9aa86a).map(v=>v*.3),FOG=hex(0xd8d2c4);","GND=hex(0xa09c90).map(v=>v*.32),FOG=hex(0xd3dbe2);")
sub2("gl.uniform1f(U.uFogN,22);gl.uniform1f(U.uFogF,62);","gl.uniform1f(U.uFogN,26);gl.uniform1f(U.uFogF,100);")
sub2("background:#d9e4ea","background:#dfe6ec")
sub2("Painting the rosettes…","Climbing the mountain…")
open('index.html','w').write(s)
print('mountain ok')
