import re
s=open('/home/claude/leopard/index.html').read()
def rep(a_mark,b_mark,new):
    global s
    a=s.index(a_mark); b=s.index(b_mark,a); s=s[:a]+new+s[b:]
def sub(old,new):
    global s
    assert old in s, old[:70]; s=s.replace(old,new)
# ---------------- SDF ----------------
rep("// ===== SNOW LEOPARD SCULPT =====","function grad(",r'''// ===== AXOLOTL SCULPT =====
function earLocal(x,y,z){return [9,9,9]}
function sdEar(ax,y,z){return 9}
const LEGF=[[0.1,0.14,0.2],[0.21,0.035,0.27]],LEGB=[[0.1,0.14,-0.17],[0.21,0.035,-0.24]];
function sdLegF(ax,y,z){return sdCone(ax,y,z,...LEGF[0],...LEGF[1],0.04,0.026)}
function sdLegB(ax,y,z){return sdCone(ax,y,z,...LEGB[0],...LEGB[1],0.042,0.028)}
function sdSnout(x,y,z){return sdEll(x,y,z,0,0.18,0.45,0.15,0.08,0.085)}
const TAILP=[[0,0.17,-0.22],[0,0.17,-0.44],[0,0.172,-0.64],[0,0.175,-0.83],[0,0.18,-1.0],[0,0.185,-1.13]],TAILR=[0.1,0.085,0.065,0.045,0.028,0.012];
function sdTail(x,y,z){let d=9;const xx=x*1.7;for(let i=0;i<5;i++)d=smin(d,sdCone(xx,y,z,...TAILP[i],...TAILP[i+1],TAILR[i],TAILR[i+1]),0.03);return d/1.4}
function pigSDF(x,y,z){const ax=Math.abs(x);
  let d=sdEll(x,y,z,0,0.16,0,0.13,0.105,0.3);
  d=smin(d,sdEll(x,y,z,0,0.165,0.22,0.125,0.1,0.12),0.06);
  d=smin(d,sdEll(x,y,z,0,0.19,0.36,0.17,0.1,0.15),0.07);
  d=smin(d,sdSnout(x,y,z),0.05);
  d=smin(d,sdLegF(ax,y,z),0.04);
  d=smin(d,sdLegB(ax,y,z),0.04);
  d=smin(d,sdTail(x,y,z),0.06);
  return Math.max(d,-(y-0.004));
}
''')
# ---------------- rig ----------------
rep("// ---------- rig ----------","const COL={",r'''// ---------- rig ----------
const BN=['root','hips','spine','chest','neck','head','earL','earR','flU','flL','frU','frL','blU','blL','brU','brL','t0','t1','t2','t3','t4'];
const REST={root:[0,0,0],hips:[0,0.17,-0.12],spine:[0,0.17,0.06],chest:[0,0.17,0.2],neck:[0,0.18,0.27],head:[0,0.19,0.34],
  earL:[0.14,0.22,0.3],earR:[-0.14,0.22,0.3],flU:[0.1,0.14,0.2],flL:[0.155,0.09,0.235],frU:[-0.1,0.14,0.2],frL:[-0.155,0.09,0.235],
  blU:[0.1,0.14,-0.17],blL:[0.155,0.09,-0.205],brU:[-0.1,0.14,-0.17],brL:[-0.155,0.09,-0.205],t0:TAILP[0],t1:TAILP[1],t2:TAILP[2],t3:TAILP[3],t4:TAILP[4]};
const PARENT={hips:'root',spine:'hips',chest:'spine',neck:'chest',head:'neck',earL:'head',earR:'head',flU:'chest',flL:'flU',frU:'chest',frL:'frU',
  blU:'hips',blL:'blU',brU:'hips',brL:'brU',t0:'hips',t1:'t0',t2:'t1',t3:'t2',t4:'t3'};
const SEG={hips:[[0,0.17,-0.22],[0,0.17,0.06]],spine:[REST.spine,REST.chest],chest:[REST.chest,[0,0.18,0.27]],neck:[REST.neck,REST.head],head:[REST.head,[0,0.18,0.56]],
  earL:[REST.earL,REST.earL],earR:[REST.earR,REST.earR],flU:[REST.flU,REST.flL],flL:[REST.flL,[0.21,0.035,0.27]],frU:[REST.frU,REST.frL],frL:[REST.frL,[-0.21,0.035,0.27]],
  blU:[REST.blU,REST.blL],blL:[REST.blL,[0.21,0.035,-0.24]],brU:[REST.brU,REST.brL],brL:[REST.brL,[-0.21,0.035,-0.24]]};
for(let i=0;i<5;i++)SEG['t'+i]=[TAILP[i],TAILP[i+1]];
function segDist(p,a,b){const ab=vsub(b,a),l=vdot(ab,ab)||1e-9,t=clamp(vdot(vsub(p,a),ab)/l,0,1);return vlen(vsub(p,vadd(a,vsc(ab,t))))}
function pigWeights(p){const ax=Math.abs(p[0]),fs=p[0]>=0?'fl':'fr',bs=p[0]>=0?'bl':'br';const W=[];
  const push=(name,d,pw=4)=>W.push([BN.indexOf(name),1/Math.pow(d+0.008,pw)]);
  for(const n of ['hips','spine','chest'])push(n,segDist(p,...SEG[n])+0.04,6);for(const n of ['neck','head'])push(n,segDist(p,...SEG[n]));
  if(sdTail(p[0],p[1],p[2])<0.02&&p[2]<-0.15)for(let i=0;i<5;i++)push('t'+i,segDist(p,...SEG['t'+i])+0.004,5);
  const lf=sdLegF(ax,p[1],p[2]);if(lf<0.025&&p[1]<0.16){const k=1+Math.max(0,p[1]-0.12)*12;push(fs+'U',segDist(p,...SEG[fs+'U'])*k);push(fs+'L',segDist(p,...SEG[fs+'L'])*k)}
  const lb=sdLegB(ax,p[1],p[2]);if(lb<0.025&&p[1]<0.16){const k=1+Math.max(0,p[1]-0.12)*12;push(bs+'U',segDist(p,...SEG[bs+'U'])*k);push(bs+'L',segDist(p,...SEG[bs+'L'])*k)}
  W.sort((a,b)=>b[1]-a[1]);const top=W.slice(0,4);while(top.length<4)top.push([0,0]);const s=top.reduce((a,b)=>a+b[1],0);
  return [top.map(w=>w[0]),top.map(w=>w[1]/s)]}

''')
# ---------------- colours + build + fins ----------------
rep("const COL={","/* =====================================================================\n   Scene",r'''const COL={skin:0xf2afbd,back:0xe99aab,belly:0xf9d6dc,foot:0xf7c9d1,fin:0xf9dbe1,gill:0xe0577a};
function mixc(a,b,t){return a.map((v,i)=>lerp(v,b[i],t))}
function pigVertex(p){const [x,y,z]=p;let c=hex(COL.skin);
  c=mixc(c,hex(COL.back),sstep(0.24,0.28,y));c=mixc(c,hex(COL.belly),sstep(0.11,0.06,y));
  c=mixc(c,hex(COL.foot),sstep(0.06,0.03,y)*sstep(0.14,0.18,Math.abs(x)));
  return [c,0.12]}
function buildPig(){
  const f=pigSDF;const sn=surfaceNets(f,[-0.27,-0.02,-1.18],[0.27,0.33,0.57],0.016);
  relax(f,sn.pos,sn.idx,3);orient(f,sn.pos,sn.idx);
  const pos=sn.pos,idx=sn.idx,N=pos.length/3,nor=[],col=[],si=[],sw=[],hair=[];
  for(let i=0;i<N;i++){const p=[pos[i*3],pos[i*3+1],pos[i*3+2]];nor.push(...vnorm(grad(f,...p)));
    const [c,hr]=pigVertex(p);col.push(...c);hair.push(hr);const [I,W]=pigWeights(p);si.push(...I);sw.push(...W)}
  const g=new Geo();g.pos=pos;g.nor=nor;g.col=col;g.idx=idx;
  const wg=new Geo();wg.pos=pos;wg.nor=nor;wg.col=col;for(let t=0;t<idx.length;t+=3)wg.idx.push(idx[t],idx[t+1],idx[t+1],idx[t+2],idx[t+2],idx[t]);
  return {geo:upload(g,{si,sw,m1:pos,hair}),wire:upload(wg,{si,sw,m1:pos,hair}),tris:idx.length/3}}
let scaleItem;
// dorsal + ventral tail fin: thin skinned membrane growing out of the same body line
function buildFins(){const o={pos:[],nor:[],col:[],idx:[],si:[],sw:[]};
  const AX=[[0,0.17,0.1],[0,0.17,-0.1],...TAILP];const F=catmull(AX);const n=90;
  const strip=(dir,hfn)=>{const base=o.pos.length/3;
    for(let i=0;i<=n;i++){const t=i/n;const c=F(t);const sp=marchOut(c,dir);const h=hfn(t)*(1+0.07*Math.sin(t*46));
      const p0=vsub(sp,vsc(dir,0.012)),p1=vadd(sp,vsc(dir,Math.max(0.0005,h)));const [SI,SW]=pigWeights(p0);
      for(const [p,e] of [[p0,0],[p1,1]]){o.pos.push(...p);o.nor.push(1,0,0);o.col.push(...mixc(hex(COL.skin),hex(COL.fin),e).map(v=>v*(i%6<3?1:.97)));o.si.push(...SI);o.sw.push(...SW)}}
    for(let i=0;i<n;i++){const a=base+i*2;o.idx.push(a,a+2,a+1,a+1,a+2,a+3)}};
  strip([0,1,0],t=>0.075*sstep(0,0.3,t)*(1-sstep(0.8,1,t))+0.012*sstep(0.85,1,t));
  strip([0,-1,0],t=>0.055*sstep(0.4,0.55,t)*(1-sstep(0.82,1,t))+0.01*sstep(0.85,1,t));
  const g=new Geo();g.pos=o.pos;g.nor=o.nor;g.col=o.col;g.idx=o.idx;
  addItem(upload(g,{si:o.si,sw:o.sw,m1:o.pos}),null,{skin:true,flat:1,rough:.3,spec:.9,rim:.6})}

''')
# ---------------- face ----------------
rep("function buildFace(){","function eH(p)",r'''function buildFace(){
  const H=B.head,rE=0.032;const skC=hex(COL.skin);
  const gEye=upload(sphere(rE,28,20)),gIris=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.004,32,10,0,TAU,0,1.25),M4.euler(PI/2,0,0));return g})());
  const gPup=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.03,28,8,0,TAU,0,0.75),M4.euler(PI/2,0,0));return g})());
  const gRing=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.012,32,4,0,TAU,1.12,0.1),M4.euler(PI/2,0,0));return g})());
  const gHi=upload(sphere(rE*.22,12,8)),gHi2=upload(sphere(rE*.1,10,6));
  const gLidU=upload(sphere(rE*1.14,32,12,0,TAU,0,PI/2)),gLidL=upload(sphere(rE*1.12,32,12,0,TAU,PI/2,PI/2));
  const gBrow=upload(tube([[-rE*.7,-rE*.1,0],[-rE*.22,rE*.07,0],[rE*.22,rE*.07,0],[rE*.7,-rE*.1,0]],14,u=>0.005+0.004*Math.sin(u*PI),7));
  FACE.eyes=[];
  for(const s of [1,-1]){
    const dir=vnorm([0.72*s,0.5,0.48]);const S=marchOut([0,0.19,0.38],dir);const c=vsub(S,vsc(dir,rE*0.3));
    const eg=H.add(new Node(headLocal(c)));eg.rm=M4.basis(vnorm([0.55*s,0.18,0.8]));
    addItem(gEye,eg,{color:hex(0xf4efe8),flat:0,rough:.1,spec:1.4,rim:.05,cast:false});
    const ig=eg.add(new Node());addItem(gIris,ig,{color:hex(0x1c1214),flat:0,rough:.1,spec:1.4,cast:false});
    addItem(gRing,ig,{color:hex(0xc9a24a),flat:0,rough:.3,spec:.8,cast:false});
    const pg=ig.add(new Node());addItem(gPup,pg,{color:hex(0x030203),flat:0,rough:.1,spec:1.2,cast:false});
    const h1=eg.add(new Node(vsc(vnorm([-0.36,0.40,0.84]),rE*.95)));addItem(gHi,h1,{color:[0,0,0],emis:[1.6,1.6,1.6],flat:0,cast:false});
    const h2=eg.add(new Node(vsc(vnorm([0.30,-0.28,0.91]),rE*1.0)));addItem(gHi2,h2,{color:[0,0,0],emis:[1.1,1.1,1.1],flat:0,cast:false});
    const lu=eg.add(new Node());addItem(gLidU,lu,{color:skC,flat:0,rough:.3,spec:1,cast:false,rim:.3});
    const ll=eg.add(new Node());addItem(gLidL,ll,{color:skC.map(v=>v*.97),flat:0,rough:.3,spec:1,cast:false});
    const bg=eg.add(new Node([0,rE*1.3,rE*0.62]));addItem(gBrow,bg,{color:hex(0xd47f92),flat:0,rough:.5,cast:false});
    FACE.eyes.push({s,eg,ig,pg,lu,ll,bg})}
  FACE.rE=rE;
  const gNos=upload(sphere(1,16,10));FACE.nos=[];
  for(const s of [1,-1]){const p=marchIn([0.045*s,0.205,0.8],[0,0,-1]);const n=nrm(p);const nn=H.add(new Node(headLocal(vadd(p,vsc(n,-0.002)))));nn.rm=M4.basis(n);nn.base=[0.008,0.006,0.004];nn.s=[...nn.base];
    addItem(gNos,nn,{color:hex(0xc0687c),flat:0,rough:.4,cast:false});FACE.nos.push(nn)}
  // the famous wide smile
  const mouthPts=k=>{const xs=[-0.14,-0.1,-0.05,0,0.05,0.1,0.14];return xs.map(x0=>{const u=Math.abs(x0)/0.14,x=k==='f'?x0*.9:x0;
    const y=k==='n'?0.162+u*u*0.022:k==='s'?0.156+u*u*0.04:0.17-u*u*0.018;
    const p=marchIn([x,y,0.8],[0,0,-1]);return vadd(p,vsc(nrm(p),0.003))})};
  const [mn,ms,mf]=['n','s','f'].map(k=>tube(mouthPts(k),30,u=>0.0042*(0.55+0.45*Math.sin(u*PI)),6,true));
  const mNode=H.add(new Node(vsc(REST.head,-1)));
  FACE.mouth=addItem(upload(mn,{m1:ms.pos,m2:mf.pos}),mNode,{color:hex(0x8a3a4e),flat:0,rough:.4,cast:false});
  const mc=marchIn([0,0.16,0.8],[0,0,-1]);const mo=H.add(new Node(headLocal(vadd(mc,[0,-0.004,-0.012]))));mo.rm=M4.basis(nrm(mc));mo.s=[0.07,0.001,0.03];
  FACE.open=mo;FACE.openS=[0.075,0.045,0.03];addItem(gNos,mo,{color:hex(0x5a1a2c),flat:0,rough:.6,cast:false});
  const tg=mo.add(new Node([0,-0.4,0.35]));tg.s=[0.6,0.45,0.55];addItem(gNos,tg,{color:hex(0xf28aa0),flat:0,rough:.3,cast:false});
  FACE.fangs=[];
  const gB=upload(disc(0.03,20));FACE.blush=[];
  for(const s of [1,-1]){const d=vnorm([0.85*s,-0.15,0.5]);const p=marchOut([0,0.18,0.38],d);const n=nrm(p);
    const bn=H.add(new Node(headLocal(vadd(p,vsc(n,0.002)))));bn.rm=M4.basis(n);bn.s=[1,0.7,1];
    FACE.blush.push(addItem(gB,bn,{color:[0,0,0],emis:hex(0xff5c86).map(v=>v*.8),flat:0,op:0,trans:true,cast:false}))}
  // feathery external gills: 3 per side, each a stalk with paired filaments
  FACE.gills=[];
  for(const s of [1,-1])[[0.72,0.62,-0.38,1],[0.95,0.18,-0.32,0.9],[0.82,-0.25,-0.42,0.8]].forEach(([dx,dy,dz,L],k)=>{
    const dir=vnorm([dx*s,dy,dz]);const bp=vsub(marchOut([0,0.19,0.33],dir),vsc(dir,0.012));const sd=vnorm(vadd(dir,[0,0,-0.55]));
    const g=new Geo();const P=[[0,0,0],[0,0.012,0.055*L],[0,0.006,0.11*L],[0,-0.01,0.16*L]];g.merge(tube(P,16,u=>lerp(0.012,0.005,u),7,true));
    const F=catmull(P);for(let j=1;j<=10;j++){const p=F(j/11);for(const sg of [1,-1]){const q=vadd(p,[sg*0.034*(1-j/15),0.006,0.014]);g.merge(tube([p,vadd(vsc(vadd(p,q),.5),[0,0.004,0]),q],6,u=>lerp(0.0038,0.0016,u),5,true))}}
    const n=H.add(new Node(headLocal(bp)));n.rm=M4.basis(sd);
    addItem(upload(g),n,{color:hex(COL.gill),emis:hex(0x6a1028).map(v=>v*.25),flat:0,rough:.35,spec:.9,rim:.6,cast:true});FACE.gills.push({n,k,s})});
  // little fingers (4 front, 5 back)
  const gF=upload((()=>{const g=new Geo();g.merge(tube([[0,0,0],[0,0.002,0.02],[0,0,0.036]],6,u=>lerp(0.009,0.0065,u),6,true));g.merge(sphere(0.0068,8,6),M4.trs([0,0,0.036],null,[0,0,0],[1,1,1]));return g})());
  for(const [bn,end,nf] of [['flL',[0.205,0.03,0.27],4],['frL',[-0.205,0.03,0.27],4],['blL',[0.205,0.03,-0.24],5],['brL',[-0.205,0.03,-0.24],5]]){const s=Math.sign(end[0]);
    for(let k=0;k<nf;k++){const a=(k/(nf-1)-.5)*1.5;const out=vnorm([s*Math.cos(a),0,Math.sin(a)*1.0+(bn[0]==='f'?0.35:-0.25)]);
      const nd=B[bn].add(new Node(vsub(end,REST[bn])));nd.rm=M4.basis(out);addItem(gF,nd,{color:hex(COL.foot),flat:0,rough:.3,spec:1,rim:.4,cast:true})}}
}
''')
# ---------------- poses ----------------
rep("const LL=0.5;","const EXPR={",r'''const LL=0.12;
function crouchB(P,d,fk=1,bk=1){P[RY]-=d}
const TB=['t0','t1','t2','t3','t4'];
function tailSway(P,t,sp,amp,lift=0){TB.forEach((n,i)=>S(P,n,lift,Math.sin(t*sp-i*.6)*amp*(.6+i*.25),0))}
let BALL_DY=0,BALL_C=[0,0.15,0],BALL_R=0.15;
// salamander legs splay sideways: stride = rotation about y, lift = rotation about z
function sprawl(P,leg,fwd,lift){const side=leg[1]==='l'?1:-1;S(P,leg+'U',0,-side*fwd,side*lift)}
function tuck(P,k){for(const l of ['fl','fr'])sprawl(P,l,-1.0*k,0.25*k);for(const l of ['bl','br'])sprawl(P,l,-1.1*k,0.3*k)}
const POSES={
  idle(t,L){const P=P0(),br=Math.sin(t*1.4);S(P,'chest',br*.01,0,0);
    S(P,'neck',0,L.yaw*.25,0);S(P,'head',-.04+Math.sin(t*.6)*.03,L.yaw*.4+Math.sin(t*.35)*.08,Math.sin(t*.27)*.05);
    TB.forEach((n,i)=>S(P,n,0,Math.sin(t*.9-i*.6)*.06*(1+i*.3),0));P[RY]=br*.002;return P},
  walk(t,L,ph){const P=P0();for(const [l,o] of [['fl',0],['br',0],['fr',PI],['bl',PI]]){const q=ph+o;sprawl(P,l,Math.sin(q)*.55,Math.max(0,Math.cos(q))*.4)}
    S(P,'hips',0,Math.sin(ph)*.16,0);S(P,'spine',0,-Math.sin(ph)*.1,0);S(P,'chest',0,-Math.sin(ph)*.1,0);S(P,'head',0,Math.sin(ph)*.12+L.yaw*.15,0);
    TB.forEach((n,i)=>S(P,n,0,Math.sin(ph-1-i*.7)*.16*(1+i*.2),0));P[RY]=.012;return P},
  run(t,L,ph){const P=P0();tuck(P,1);P[RY]=.42+Math.sin(t*1.7)*.04;S(P,'hips',-.04,Math.sin(ph)*.14,0);S(P,'spine',0,-Math.sin(ph-.5)*.1,0);S(P,'chest',0,-Math.sin(ph-1)*.08,0);
    S(P,'head',.04,Math.sin(ph-1.6)*-.06,0);TB.forEach((n,i)=>S(P,n,0,Math.sin(ph-1.5-i*.8)*.33*(.6+i*.25),0));return P},
  eat(t,L){const P=P0();S(P,'neck',.15,Math.sin(t*.7)*.12,0);S(P,'head',.14+Math.max(0,Math.sin(t*4))*.06,Math.sin(t*.7)*.15,0);
    for(const l of ['fl','fr'])sprawl(P,l,.25,0);TB.forEach((n,i)=>S(P,n,0,Math.sin(t*1.5-i*.6)*.1,0));return P},
  bend(t,L){const P=P0(),a=.8+.2*Math.sin(t*1.2);for(const n of ['hips','spine','chest'])S(P,n,0,.3*a,0);S(P,'neck',0,.25*a,0);S(P,'head',0,.25*a,Math.sin(t)*.1);
    TB.forEach((n,i)=>S(P,n,0,.38*a,0));for(const l of ['fl','bl'])sprawl(P,l,-.3*a,0);return P},
  happy(t,L){const P=P0(),j=Math.abs(Math.sin(t*4.5));P[RY]=.03+j*.09;S(P,'hips',0,Math.sin(t*9)*.22,0);S(P,'chest',0,-Math.sin(t*9)*.12,0);S(P,'head',-.05,L.yaw*.3,Math.sin(t*4.5)*.18);
    for(const l of ['fl','fr','bl','br'])sprawl(P,l,0,j*.4);TB.forEach((n,i)=>S(P,n,0,Math.sin(t*12-i*.8)*.3,0));return P},
  sleep(t,L){const P=P0(),br=Math.sin(t*.9);S(P,'chest',br*.01,0,0);S(P,'head',.06,.2,0);S(P,'neck',0,.12,0);
    TB.forEach((n,i)=>S(P,n,0,.2+Math.sin(t*.5-i)*.02,0));for(const l of ['fl','fr'])sprawl(P,l,-.4,0);for(const l of ['bl','br'])sprawl(P,l,-.5,0);return P},
};
const ACTIONS={
  attack:{dur:1.7,pose(t,L){const P=P0();
    if(t<.6){const k=sstep(0,.45,t);S(P,'neck',-.15*k,0,0);S(P,'head',-.12*k,0,0);S(P,'spine',0,.18*k,0);S(P,'chest',0,-.22*k,0);S(P,'hips',0,.1*k,0);TB.forEach((n,i)=>S(P,n,0,-.15*k,0))}
    else if(t<.9){const u=(t-.6)/.3,e=Math.sin(u*PI);S(P,'neck',.1*e,0,0);S(P,'head',.12*e,0,0);tuck(P,.6*e);P[RY]=.04*e;TB.forEach((n,i)=>S(P,n,0,Math.sin(u*9-i)*.25,0))}
    else{const v=(t-.9)/.8,k=1-sstep(0,1,v);S(P,'head',Math.sin(v*18)*.05*k,0,0);TB.forEach((n,i)=>S(P,n,0,Math.sin(v*6-i)*.1*k,0))}
    return P},speed:t=>t>.15&&t<.55?-.12:t>=.6&&t<.9?2.6*Math.sin((t-.6)/.3*PI):0,face:t=>t<.55?'angry':t<1.1?'roar':'content',
    fx(at,fw){if(at>.8&&!st.fx.b){st.fx.b=1;st.shake=.06;const p=worldOf(FACE.open);for(let i=0;i<10;i++)spawn('bubble',vadd(p,[rr(-.04,.04),rr(0,.03),rr(-.04,.04)]),[rr(-.15,.15),rr(.3,.7),rr(-.15,.15)],rr(.008,.02),rr(2,4),0xeefcff)}}},
  jump:{dur:3.2,pose(t,L){const P=P0();const up=sstep(0,1.1,t)*(1-sstep(1.9,3.2,t));tuck(P,sstep(0,.4,t)*(1-sstep(2.6,3.2,t)));P[RY]=.85*up;
    S(P,'hips',-.25*sstep(0,.6,t)*(1-sstep(.9,1.4,t))+.12*sstep(1.9,2.4,t)*(1-sstep(2.8,3.2,t)),0,0);
    TB.forEach((n,i)=>S(P,n,0,Math.sin(t*(t<1.2?9:3)-i*.8)*(t<1.2?.3:.12)*(.6+i*.25),0));for(const l of ['fl','fr','bl','br'])sprawl(P,l,0,.6*sstep(1.4,1.9,t)*(1-sstep(2.6,3.1,t)));return P},
    speed:t=>t<1.2?.6:0,face:t=>t<1.2?'excited':t<2.6?'happy':'content',
    fx(at){st.fx.land=1;const c=Math.floor(at/.18);if(at<1.4&&c!==st.fx.c){st.fx.c=c;const p=worldOf(B.hips);spawn('bubble',vadd(p,[rr(-.05,.05),.05,rr(-.05,.05)]),[0,rr(.3,.6),0],rr(.008,.016),3,0xeefcff)}}},
  shake:{dur:1.4,pose(t,L){const P=P0(),e=Math.pow(Math.sin(PI*t/1.4),.6),w=t*22;
    S(P,'head',0,Math.sin(w)*.45*e,Math.sin(w)*.1*e);S(P,'neck',0,Math.sin(w-.6)*.25*e,0);S(P,'chest',0,-Math.sin(w-1.1)*.15*e,0);S(P,'hips',0,Math.sin(w-1.6)*.12*e,0);
    tailSway(P,w,1,.3*e);return P},speed:()=>0,face:()=>'squint',fx(at){st.fx.land=1;if(at>.3&&at<1.1&&rnd()<.15){const p=worldOf(B.head);spawn('bubble',vadd(p,[rr(-.1,.1),.05,rr(-.1,.1)]),[rr(-.3,.3),rr(.3,.6),rr(-.3,.3)],rr(.006,.014),2.5,0xeefcff)}}},
};
''')
# ---------------- pond habitat ----------------
a=s.index("function noise2(x,z)");b=s.index("// particles",a)
s=s[:a]+r'''function noise2(x,z){const h=(i,j)=>{const s=Math.sin(i*127.1+j*311.7)*43758.5453;return s-Math.floor(s)};const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return lerp(lerp(h(i,j),h(i+1,j),u),lerp(h(i,j+1),h(i+1,j+1),u),v)}
const WATER_Y=3.4;
function terrainH(x,z){const r=Math.hypot(x,z);return (noise2(x*.5,z*.5)-.5)*0.04+sstep(7,22,r)*(noise2(x*.12+2,z*.12)*2.4+1.4)}
function buildEnv(){
  const g=new Geo();const N=76,S=84;
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){let x=(i/N-.5)*S,z=(j/N-.5)*S;if(i%N&&j%N){x+=rr(-.3,.3);z+=rr(-.3,.3)}g.pos.push(x,terrainH(x,z),z);g.nor.push(0,1,0);g.col.push(1,1,1)}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;g.idx.push(a,c,b,b,c,d)}
  const ground=flatten(g,c=>{const r=Math.hypot(c[0],c[2]),n=noise2(c[0]*.45+4,c[2]*.45);let h;
    if(r<8)h=n>.68?0x7c6a4c:[0xb9a47c,0xae9871,0xa58f69][Math.floor(rnd()*3)];else h=n>.55?[0x6e7a45,0x627040][Math.floor(rnd()*2)]:[0x8d7b59,0x7d6c4e][Math.floor(rnd()*2)];
    return hex(h).map(v=>v*(1+(rnd()-.5)*.07))});
  const env=new Geo();env.merge(ground);const props=new Geo();
  const place=(rmin,rmax)=>{const a=rnd()*TAU,r=rr(rmin,rmax);const x=Math.cos(a)*r,z=Math.sin(a)*r;return [x,terrainH(x,z),z]};
  const STONE=[0x9e968a,0x8a8278,0xb0a898,0x6f6a62,0xc2b49a,0x8f8a7a];
  for(let i=0;i<420;i++){const [x,y,z]=place(.6,15),sc=rr(.015,.07);props.merge(flatten(jitter(icosa(sc,0),sc*.25),()=>hex(STONE[i%6]).map(v=>v*rr(.9,1.08))),M4.trs([x,y+sc*.2,z],null,[rnd(),rnd()*3,rnd()],[1,rr(.45,.7),1]))}
  for(let i=0;i<22;i++){const [x,y,z]=place(5,20),sc=rr(.25,.9);props.merge(flatten(jitter(icosa(sc,1),sc*.2),c=>hex(c[1]>sc*.25&&rnd()<.75?(rnd()<.5?0x5f7a3c:0x4f6a34):STONE[Math.floor(rnd()*6)]).map(v=>v*rr(.9,1.06))),M4.trs([x,y+sc*.3,z],null,[rnd(),rnd()*3,0],[1,rr(.55,.8),1]))}
  // sunken log
  props.merge(flatten(jitter(cyl(.28,.32,4.2,9),.04),c=>hex(c[1]>.15&&rnd()<.5?0x56703a:(rnd()<.5?0x5a4330:0x4c3828))),M4.trs([-5.6,.24,3.2],null,[0,0,PI/2+.08],[1,1,1]));
  props.merge(flatten(jitter(cyl(.2,.24,2.4,8),.03),c=>hex(c[1]>.1&&rnd()<.5?0x56703a:0x4f3a2a)),M4.trs([5.4,.18,-4.5],null,[.2,.9,PI/2],[1,1,1]));
  // lily pads floating on the surface (seen from below)
  for(let i=0;i<34;i++){const a=rnd()*TAU,r=rr(1,16),sc=rr(.25,.7);const pad=new Geo();const seg=18;pad.pos.push(0,0,0);pad.nor.push(0,0,1);
    for(let k=0;k<=seg;k++){const t=.25+k/seg*(TAU-.5);pad.pos.push(Math.cos(t)*sc,Math.sin(t)*sc,0);pad.nor.push(0,0,1)}for(let k=0;k<seg;k++)pad.idx.push(0,k+1,k+2);
    props.merge(flatten(pad,()=>hex(rnd()<.5?0x3d6f36:0x47803c)),M4.trs([Math.cos(a)*r,WATER_Y-.02,Math.sin(a)*r],null,[-PI/2,0,rnd()*TAU],[1,1,1]));
    if(i%5===0)props.merge(flatten(jitter(icosa(.08,0),.02),()=>hex(0xf3a6c3)),M4.trs([Math.cos(a)*r,WATER_Y+.03,Math.sin(a)*r],null,[0,0,0],[1,.6,1]))}
  env.merge(props);
  const envN=sceneRoot.add(new Node());addItem(upload(env,{flat:true}),envN,{rough:.85,rim:.1,spec:.15});
  // swaying water plants (hair attribute = height factor used by the sway shader)
  const pl=new Geo(),ph=[];const addP=(part,m,colr,y0,h)=>{const n0=pl.n;pl.merge(part,m,colr);for(let i=n0;i<pl.n;i++)ph.push(clamp((pl.pos[i*3+1]-y0)/h,0,1))};
  for(let i=0;i<120;i++){const [x,y,z]=place(2.6,17);const hh=rr(.7,2.4);
    for(let k=0;k<4;k++){const bx=x+rr(-.12,.12),bz=z+rr(-.12,.12),h=hh*rr(.6,1),lx=rr(-.25,.25),lz=rr(-.25,.25);
      addP(tube([[bx,y,bz],[bx+lx*.3,y+h*.35,bz+lz*.3],[bx+lx*.7,y+h*.7,bz+lz*.7],[bx+lx,y+h,bz+lz]],10,u=>lerp(.014,.004,u),4,true),null,[0x4f8a3a,0x5e9a40,0x3f7a34][k%3],y,h)}}
  for(let i=0;i<34;i++){const [x,y,z]=place(3,15);const h=rr(.5,1.2);addP(tube([[x,y,z],[x,y+h*.5,z+.05],[x,y+h,z]],8,.008,4,false),null,0x4c7d36,y,h);
    for(let k=1;k<9;k++){const yy=y+h*k/9;for(let q=0;q<5;q++){const a=q/5*TAU+k;addP(icosa(.03,0),M4.trs([x+Math.cos(a)*.04,yy,z+.025*k/9+Math.sin(a)*.04],null,[0,a,0],[1.4,.35,.6]),0x5aa042,y,h)}}}
  addItem(upload(pl,{hair:ph}),envN,{flat:0,rough:.6,rim:.3,spec:.3,sway:.22});
  // water surface + light shafts
  const ws=new Geo();ws.merge(disc(45,40),M4.euler(-PI/2,0,0));const wN=sceneRoot.add(new Node([0,WATER_Y,0]));
  addItem(upload(ws),wN,{color:[0,0,0],emis:[.33,.62,.6],op:.62,trans:true,flat:0,cast:false,rim:0,spec:0});
  const rays=new Geo();for(let i=0;i<12;i++){const a=rnd()*TAU,r=rr(1.5,11);rays.merge(box(rr(.2,.6),WATER_Y*1.25,.02),M4.trs([Math.cos(a)*r,WATER_Y*.55,Math.sin(a)*r],null,[.25,rnd()*3,.18],[1,1,1]))}
  addItem(upload(rays),sceneRoot.add(new Node()),{color:[0,0,0],emis:[.55,.85,.78],op:.05,trans:true,flat:0,cast:false});
  initSnow();
  return {clN:sceneRoot.add(new Node())}
}
// drifting motes in the water (one buffer, updated every frame)
const SNOWN=260,snowF=[];let snowIt,snowArr;
function initSnow(){const g=new Geo();const O=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],F=[[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]];
  for(let i=0;i<SNOWN;i++){snowF.push([rr(-5,5),rr(0,3.2),rr(-5,5),rr(.01,.05),rnd()*TAU,rr(.004,.009)]);for(const v of O){g.pos.push(0,0,0);g.nor.push(...v)}for(const f of F)g.idx.push(...f.map(k=>k+i*6))}
  snowArr=new Float32Array(SNOWN*18);snowIt=addItem(upload(g),sceneRoot.add(new Node()),{color:[0,0,0],emis:[.5,.62,.52],flat:0,cast:false,rough:1,spec:0,rim:0})}
function updSnow(dt,t){if(!snowIt)return;const O=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];const c=cam.target;
  for(let i=0;i<SNOWN;i++){const f=snowF[i];f[1]-=dt*f[3];f[0]+=Math.sin(t*.4+f[4])*dt*.05;f[2]+=Math.cos(t*.33+f[4])*dt*.05;if(f[1]<0){f[1]+=3.2}
    const wx=c[0]+((f[0]+5)%10+10)%10-5,wz=c[2]+((f[2]+5)%10+10)%10-5,wy=f[1];for(let k=0;k<6;k++){const o=(i*6+k)*3;snowArr[o]=wx+O[k][0]*f[5];snowArr[o+1]=wy+O[k][1]*f[5];snowArr[o+2]=wz+O[k][2]*f[5]}}
  gl.bindBuffer(gl.ARRAY_BUFFER,snowIt.gl.bufs[0]);gl.bufferSubData(gl.ARRAY_BUFFER,0,snowArr);
  st.bt=(st.bt||0)-dt;if(st.bt<0){st.bt=rr(.12,.35);const a=rnd()*TAU,r=rr(.8,6);spawn('bubble',[st.pos[0]+Math.cos(a)*r,.04,st.pos[2]+Math.sin(a)*r],[0,rr(.3,.55),0],rr(.01,.028),rr(6,9),0xeefcff)}
  if(st.loop==='eat'&&!st.act){const k=Math.floor(t*4/TAU);if(k!==st.eb){st.eb=k;const p=worldOf(FACE.open);spawn('bubble',p,[rr(-.05,.05),.35,rr(-.05,.05)],rr(.006,.012),3,0xeefcff)}}
  if(FACE.gills){const fl=.07+.1*st.w.run+.12*st.w.happy;for(const g of FACE.gills){g.n.r=[Math.sin(t*2.4+g.k*1.3+g.s)*fl+st.w.run*.3,Math.sin(t*2.9+g.k*.8)*fl*.6,0];const sc=1+.14*st.w.happy;g.n.s=[sc,sc,sc]}}
}
'''+s[b:]
# ---------------- shader: sway + caustics ----------------
sub("uniform float uShell,uShellL,uFlare;uniform vec3 uComb;","uniform float uShell,uShellL,uFlare,uSway,uTime;uniform vec3 uComb;")
sub(" if(uFlare>0.)w.xyz+=normalize(n)*aHair*uFlare;"," if(uFlare>0.)w.xyz+=normalize(n)*aHair*uFlare;\n if(uSway>0.){float hh=aHair*aHair;w.x+=sin(uTime*1.1+w.x*.7+w.z*.5)*hh*uSway;w.z+=cos(uTime*.9+w.x*.4+w.z*.8)*hh*uSway*.6;}")
sub("uniform float uOp,uFlat,uRough,uRim,uFogN,uFogF,uSpec,uSkinD,uShellL;","uniform float uOp,uFlat,uRough,uRim,uFogN,uFogF,uSpec,uSkinD,uShellL,uCaus,uTime;")
sub(" float f=smoothstep(uFogN,uFogF,length(vW-uCam));"," if(uCaus>0.){vec2 q=vW.xz*2.3;float c1=sin(q.x+uTime*.7+sin(q.y*1.7+uTime*.5)*1.3)*sin(q.y*1.2-uTime*.6+sin(q.x*1.3-uTime*.4)*1.3);col+=uSunC*base*pow(abs(c1),5.)*1.5*max(N.y,0.)*sh*smoothstep(3.6,0.,vW.y);}\n float f=smoothstep(uFogN,uFogF,length(vW-uCam));")
sub("    gl.uniform2fv(U.uMW,it.mw);gl.uniform1f(U.uFlare,it.flare||0);","    gl.uniform2fv(U.uMW,it.mw);gl.uniform1f(U.uFlare,it.flare||0);gl.uniform1f(U.uSway,it.sway||0);gl.uniform1f(U.uTime,clock);")
sub("gl.uniform1f(U.uFogN,26);gl.uniform1f(U.uFogF,100);","gl.uniform1f(U.uFogN,1.5);gl.uniform1f(U.uFogF,19);gl.uniform1f(U.uCaus,1);")
# sky -> underwater gradient
s=re.sub(r"float h=max\(d\.y,0\.\);\s*vec3 top=vec3\(\.14,\.36,\.74\),hor=vec3\(\.84,\.88,\.92\);vec3 c=mix\(hor,top,pow\(h,\.55\)\);",
 "float h=d.y;vec3 top=vec3(.34,.68,.68),deep=vec3(.012,.08,.1);vec3 c=mix(deep,top,smoothstep(-.4,.95,h));",s)
assert "vec3 deep=" in s or "deep=vec3" in s
sub("const SUN=vnorm([0.55,0.78,0.38]),SUNC=hex(0xffeedd).map(v=>v*1.85),SKY=hex(0xb9d6f5).map(v=>v*.5),GND=hex(0xa09c90).map(v=>v*.32),FOG=hex(0xd3dbe2);",
    "const SUN=vnorm([0.32,0.9,0.28]),SUNC=hex(0xeafff2).map(v=>v*1.55),SKY=hex(0x8fd6d0).map(v=>v*.55),GND=hex(0x7d6e50).map(v=>v*.3),FOG=[.07,.19,.205];")
# bubbles as particles
sub("for(let i=0;i<70;i++)","for(let i=0;i<130;i++)")
sub("P.it.gl=kind==='heart'?gHeart:kind==='z'?gZ:kind==='drop'?gDrop:gPuff;P.it.color=hex(color);P.it.flat=kind==='drop'?0:1;",
    "P.it.gl=kind==='heart'?gHeart:kind==='z'?gZ:(kind==='drop'||kind==='bubble')?gDrop:gPuff;P.it.color=hex(color);P.it.flat=(kind==='drop'||kind==='bubble')?0:1;if(kind==='bubble'){P.it.emis=[.3,.42,.45];P.it.spec=1.6;P.it.rough=.05}else{P.it.spec=0;P.it.rough=1}")
sub("  else if(P.kind==='drop'){","  else if(P.kind==='bubble'){P.n.p[0]+=Math.sin(P.life*5+P.spin)*dt*.06;P.n.s=Array(3).fill(P.size);P.it.op=.6*sstep(0,.04,t)*(1-sstep(.9,1,t));if(P.n.p[1]>WATER_Y-.05){P.life=0;P.n.visible=false}}\n  else if(P.kind==='drop'){")
# misc
sub("const pig=buildPig();pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.6,rim:.35,spec:.25,skinD:1});","const pig=buildPig();pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.2,rim:.45,spec:1.3,skinD:1});buildFins();")
sub("const SHELLS=16,HAIR_LEN=0.042;","const SHELLS=0,HAIR_LEN=0.01;")
sub("one furry skin · rosette coat · 21 bones · drag to orbit","one wet skin · feathery gills · 21 bones · drag to orbit")
sub("0.56+pose[RY]*.4","0.2+pose[RY]*.8");sub("target:[0,0.56,0]","target:[0,0.2,0]");sub("cam={th:0.62,ph:1.24,d:3.7","cam={th:0.62,ph:1.3,d:2.2");sub("cam.d=Math.max(cam.d,4.4)","cam.d=Math.max(cam.d,2.7)")
s=s.replace("cam.d=clamp(cam.d*pinch0/d,2.2,12)","cam.d=clamp(cam.d*pinch0/d,1.1,10)").replace("cam.d=clamp(cam.d*Math.exp(e.deltaY*.001),2.2,12)","cam.d=clamp(cam.d*Math.exp(e.deltaY*.001),1.1,10)")
sub("const tgtSpd=(st.loop==='walk'?.7:st.loop==='run'?3.0:0)*(1-aw);","const tgtSpd=(st.loop==='walk'?.28:st.loop==='run'?1.1:0)*(1-aw);")
sub("st.walkPh+=dt*st.speed/0.7*TAU*1.0;st.runPh+=dt*Math.max(st.speed,.5)/3.0*TAU*2.1;","st.walkPh+=dt*st.speed/0.28*TAU*.8;st.runPh+=dt*Math.max(st.speed,.4)/1.1*TAU*1.3;")
s=re.sub(r"const ACTS=\[[^;]*\];","const ACTS=[['idle','Idle'],['walk','Walk'],['run','Swim'],['attack','Snap'],['jump','Float'],['eat','Eat'],['bend','Curl'],['happy','Happy'],['shake','Shake'],['sleep','Sleep']];",s)
sub("const LOOP_FACE={idle:'neutral',walk:'neutral',run:'excited',eat:'content',bend:'squint',happy:'content',sleep:'asleep'};","const LOOP_FACE={idle:'happy',walk:'neutral',run:'happy',eat:'content',bend:'happy',happy:'excited',sleep:'asleep'};")
sub("if(st.w.run>.5&&st.speed>1.5)","if(st.w.run>.5&&st.speed>9)")
s=s.replace("background:#dfe6ec","background:#cfe6e2")
sub("<title>Low-Poly Menagerie · 04 Snow Leopard</title>","<title>Low-Poly Menagerie · 05 Axolotl</title>")
sub("04 / 20 · LOW-POLY MENAGERIE</span><h1>Snow Leopard</h1>","05 / 20 · LOW-POLY MENAGERIE</span><h1>Axolotl</h1>")
sub("Climbing the mountain…","Filling the pond…")
open('index.html','w').write(s)
print('ok')
s=open('index.html').read()
a=s.index("   base*=.92+.16*m2;\n   float zH=");b=s.index("base=mix(base,vec3(.055,.05,.045),clamp(pat*.88,0.,1.));",a)+len("base=mix(base,vec3(.055,.05,.045),clamp(pat*.88,0.,1.));")
s=s[:a]+"""   base*=.94+.12*m2;
   float sp=smoothstep(.17,.1,worley(vR*34.))*smoothstep(.5,.66,fbm(vR*4.+2.));                 // sparse freckles
   float gold=smoothstep(.12,.07,worley(vR*52.+5.))*smoothstep(.55,.7,fbm(vR*3.+8.));          // tiny gold flecks
   base=mix(base,base*vec3(.72,.5,.58),sp*.75);base=mix(base,vec3(.85,.62,.35)*base*1.5,gold*.5);"""+s[b:]
s=s.replace("const COL={skin:0xf2afbd,back:0xe99aab,belly:0xf9d6dc,foot:0xf7c9d1,fin:0xf9dbe1,","const COL={skin:0xf7889f,back:0xec7590,belly:0xfab8c6,foot:0xf8aabb,fin:0xfbc7d3,")
open('index.html','w').write(s);print('pattern ok')
# ================= TRANSLUCENT SKIN (subsurface scattering approximation) =================
s=open('index.html').read()
def sub3(o,n):
    global s
    assert o in s,o[:70];s=s.replace(o,n)
sub3("uniform float uOp,uFlat,uRough,uRim,uFogN,uFogF,uSpec,uSkinD,uShellL,uCaus,uTime;","uniform float uOp,uFlat,uRough,uRim,uFogN,uFogF,uSpec,uSkinD,uShellL,uCaus,uTime,uSSS;uniform vec3 uSSSC;")
sub3(" vec3 col=base*(hemi+uSunC*mix(ndl,wrap,.25+sheen)*sh)+uSunC*sp*sh+rim*uSky*base*1.4+uEmis;",
""" vec3 col=base*(hemi+uSunC*mix(ndl,wrap,.25+sheen+.55*uSSS)*mix(sh,1.,.45*uSSS))+uSunC*sp*sh+rim*uSky*base*1.4+uEmis;
 if(uSSS>0.){                                                     // light scattering through the soft skin
   vec3 Lt=normalize(uSun+N*.4);float back=pow(max(dot(V,-Lt),0.),2.5);           // transmitted sunlight (no shadow: it passes through)
   float edge=pow(1.-max(dot(N,V),0.),1.8);                                       // thin silhouette glows
   float inner=1.-ndl;                                                            // light scattered into the shaded side
   col+=uSSSC*(uSunC*back*.9+uSky*edge*1.3+uSky*inner*.35+(uSunC*.06))*uSSS*(.55+.45*base.r);
 }""")
sub3("gl.uniform1f(U.uSway,it.sway||0);","gl.uniform1f(U.uSway,it.sway||0);gl.uniform1f(U.uSSS,it.sss||0);")
sub3("gl.uniform1f(U.uCaus,1);","gl.uniform1f(U.uCaus,1);gl.uniform3fv(U.uSSSC,hex(0xff4f6c));")
# faint veins under the skin
sub3("base=mix(base,base*vec3(.72,.5,.58),sp*.75);","base=mix(base,base*vec3(.72,.5,.58),sp*.75);\n   float vein=smoothstep(.035,0.,abs(vn(vR*16.+vec3(fbm(vR*6.)*.8))-.5))*smoothstep(.45,.65,fbm(vR*2.5+1.));base=mix(base,base*vec3(1.05,.62,.68),vein*.45*uSSS);")
# per-part translucency: body, fins & gills see-through, toes, lids
sub3("pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.2,rim:.45,spec:1.3,skinD:1});","pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.2,rim:.3,spec:1.3,skinD:1,sss:.75});")
sub3("addItem(upload(g,{si:o.si,sw:o.sw,m1:o.pos}),null,{skin:true,flat:1,rough:.3,spec:.9,rim:.6})","addItem(upload(g,{si:o.si,sw:o.sw,m1:o.pos}),null,{skin:true,flat:1,rough:.3,spec:.9,rim:.3,sss:1.1,trans:true,op:.72,cast:false})")
sub3("addItem(upload(g),n,{color:hex(COL.gill),emis:hex(0x6a1028).map(v=>v*.25),flat:0,rough:.35,spec:.9,rim:.6,cast:true})","addItem(upload(g),n,{color:hex(COL.gill),emis:hex(0x6a1028).map(v=>v*.2),flat:0,rough:.35,spec:.9,rim:.3,cast:true,sss:1.2,trans:true,op:.86})")
sub3("addItem(gF,nd,{color:hex(COL.foot),flat:0,rough:.3,spec:1,rim:.4,cast:true})","addItem(gF,nd,{color:hex(COL.foot),flat:0,rough:.3,spec:1,rim:.3,cast:true,sss:.9})")
sub3("addItem(gLidU,lu,{color:skC,flat:0,rough:.3,spec:1,cast:false,rim:.3});","addItem(gLidU,lu,{color:skC,flat:0,rough:.3,spec:1,cast:false,rim:.3,sss:.75});")
sub3("addItem(gLidL,ll,{color:skC.map(v=>v*.97),flat:0,rough:.3,spec:1,cast:false});","addItem(gLidL,ll,{color:skC.map(v=>v*.97),flat:0,rough:.3,spec:1,cast:false,sss:.75});")
open('index.html','w').write(s);print('sss ok')
# ================= STRONGER TRANSLUCENCY: see-through edges, inner anatomy, brighter glow =================
s=open('index.html').read()
def sub4(o,n):
    global s
    assert o in s,o[:70];s=s.replace(o,n)
sub4(" col=aces(col*.9);o=vec4(pow(col,vec3(1./2.2)),uOp);}`;",
     " float al=uOp;if(uSSS>0.&&uOp>.99)al=1.-.55*pow(1.-max(dot(N,V),0.),1.6)*min(uSSS,1.);\n col=aces(col*.9);o=vec4(pow(col,vec3(1./2.2)),al);}`;")
sub4("   col+=uSSSC*(uSunC*back*.9+uSky*edge*1.3+uSky*inner*.35+(uSunC*.06))*uSSS*(.55+.45*base.r);",
     "   col+=uSSSC*(uSunC*back*1.5+uSky*edge*1.7+uSky*inner*.55+(uSunC*.08))*uSSS*(.4+.6*base.r);")
sub4("gl.uniform3fv(U.uSSSC,hex(0xff4f6c));","gl.uniform3fv(U.uSSSC,hex(0xff2a52));")
# inner anatomy seen through the skin: spine, ribs, heart/gut shadow
sub4("   float vein=","   if(uSSS>0.){float onTrunk=smoothstep(-1.05,-.85,vR.z)*smoothstep(.36,.2,vR.z);\n"
     "     float spine=smoothstep(.035,.0,abs(vR.x))*smoothstep(.17,.24,vR.y)*onTrunk;\n"
     "     float ribs=smoothstep(.55,.95,sin(vR.z*95.))*smoothstep(-.3,-.15,vR.z)*smoothstep(.22,.1,vR.z)*smoothstep(.05,.11,abs(vR.x))*smoothstep(.1,.2,vR.y)*smoothstep(.26,.18,vR.y);\n"
     "     float gut=smoothstep(.12,.0,length((vR-vec3(0.,.1,-.02))*vec3(1.4,2.2,.55)))+.7*smoothstep(.07,.0,length((vR-vec3(0.,.12,.17))*vec3(1.6,2.,1.6)));\n"
     "     base=mix(base,base*vec3(.78,.34,.46),clamp(spine*.8+ribs*.45+gut*.6,0.,1.));}\n   float vein=")
# draw the body after the pond (blended, depth-writing) so the see-through edges show the water behind
sub4("pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.2,rim:.3,spec:1.3,skinD:1,sss:.75});","pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.2,rim:.3,spec:1.3,skinD:1,sss:.9,late:true});")
sub4("  drawItems(PM,vp,false,it=>!it.trans&&!it.wire);\n","  drawItems(PM,vp,false,it=>!it.trans&&!it.wire&&!it.late);\n  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);drawItems(PM,vp,false,it=>it.late);gl.disable(gl.BLEND);\n")
open('index.html','w').write(s);print('sss2 ok')
