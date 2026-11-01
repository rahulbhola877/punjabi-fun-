import re,sys
s=open('/home/claude/horse/index.html').read()
L=open('/home/claude/leopard/index.html').read()
def rep(a_mark,b_mark,new):
    global s
    a=s.index(a_mark); b=s.index(b_mark,a); s=s[:a]+new+s[b:]
def sub(old,new):
    global s
    assert old in s, old[:70]; s=s.replace(old,new)
def lgrab(a_mark,b_mark):
    a=L.index(a_mark); b=L.index(b_mark,a); return L[a:b]

# ------------------------------------------------------------------ sculpt
rep("// ===== HORSE SCULPT =====","function grad(",r'''// ===== EAGLE SCULPT =====
// rest pose = flight T-pose: body level, wings spread flat, legs hanging. Units: metres.
const WS=[0.10,0.47,0.08],WE=[0.31,0.47,0.04],WW=[0.51,0.47,0.08],WT=[0.66,0.47,0.06];
const LH=[0.07,0.36,-0.02],LA=[0.075,0.18,0.0],LF=[0.075,0.036,0.03];
const TOE_T=[[0.032,-0.024,0.062],[0,-0.026,0.074],[-0.028,-0.024,0.06],[0.002,-0.022,-0.05]].map(o=>vadd(LF,o));
function chain(x,y,z,P,R,k){let d=9;for(let i=0;i<P.length-1;i++)d=smin(d,sdCone(x,y,z,...P[i],...P[i+1],R[i],R[i+1]),k);return d}
function sdToes(ax,y,z){let d=9;for(const t of TOE_T)d=Math.min(d,sdCone(ax,y,z,...LF,...t,0.013,0.0085));return d}
function sdLeg(ax,y,z){let d=sdCone(ax,y,z,...LH,...LA,0.06,0.044);                 // feathered "trousers"
  d=smin(d,sdEll(ax,y,z,LA[0],LA[1]+0.03,LA[2]-0.005,0.052,0.05,0.054),0.03);
  d=smin(d,sdCone(ax,y,z,...LA,...LF,0.019,0.016),0.022);                             // bare yellow tarsus
  d=smin(d,sdToes(ax,y,z),0.012);return d}
const BU=[[0,.567,.37],[0,.567,.402],[0,.559,.433],[0,.543,.453],[0,.526,.458],[0,.512,.449]],BUR=[.027,.023,.018,.012,.007,.003];
const BL=[[0,.537,.368],[0,.532,.40],[0,.528,.428]],BLR=[.019,.014,.0065];
function sdBeakU(x,y,z){let d=chain(x*1.32,y,z,BU,BUR,.01)/1.32;return smin(d,sdEll(x,y,z,0,.551,.405,.021,.02,.034),.012)}
function sdBeakL(x,y,z){return chain(x*1.25,y,z,BL,BLR,.01)/1.25}
function sdBeak(x,y,z){return Math.min(sdBeakU(x,y,z),sdBeakL(x,y,z))}
function sdHead(x,y,z,ax){let d=sdEll(x,y,z,0,.556,.312,.062,.06,.078);
  d=smin(d,sdEll(x,y,z,0,.574,.30,.05,.038,.06),.03);                 // flat crown
  d=smin(d,sdEll(ax,y,z,.041,.577,.345,.021,.011,.032),.014);         // supraorbital brow shelf: the fierce stare
  d=smin(d,sdEll(x,y,z,0,.532,.33,.044,.04,.05),.03);                 // throat
  return d}
function sdBody(x,y,z){let d=sdEll(x,y,z,0,.42,-.03,.13,.13,.25);
  d=smin(d,sdEll(x,y,z,0,.405,.09,.122,.13,.14),.08);                 // keel / breast
  d=smin(d,sdEll(x,y,z,0,.46,.05,.115,.075,.15),.06);                 // back between the shoulders
  d=smin(d,sdCone(x,y,z,0,.43,-.17,0,.445,-.30,.08,.03),.06);         // rump
  d=smin(d,sdCone(x,y,z,0,.46,.13,0,.535,.27,.088,.06),.07);          // thick feathered neck
  return d}
function sdArm(ax,y,z){if(ax<0.06)return 9;let d=sdCone(ax,y,z,...WS,...WE,.034,.022);d=smin(d,sdCone(ax,y,z,...WE,...WW,.022,.016),.02);
  d=smin(d,sdCone(ax,y,z,...WW,...WT,.016,.008),.015);d=smin(d,sdEll(ax,y,z,.29,.47,.088,.17,.011,.03),.03);return d}
const TAILP=[[0,.44,-.22],[0,.445,-.32]];
function pigSDF(x,y,z){const ax=Math.abs(x);
  if(ax>0.2)return sdArm(ax,y,z);
  let d=sdBody(x,y,z);d=smin(d,sdHead(x,y,z,ax),.05);d=smin(d,sdBeak(x,y,z),.012);
  d=smin(d,sdArm(ax,y,z),.04);d=smin(d,sdLeg(ax,y,z),.05);
  return Math.max(d,-(y-0.002))}
''')

# ------------------------------------------------------------------ rig
rep("// ---------- rig ----------","const COL={",r'''// ---------- rig ----------
const BN=['root','body','chest','neck','neck2','head','jaw','shL','wUL','wFL','wHL','shR','wUR','wFR','wHR','thL','tsL','ftL','thR','tsR','ftR','tail'];
const mir=p=>[-p[0],p[1],p[2]];
const REST={root:[0,0,0],body:[0,.42,-.06],chest:[0,.43,.08],neck:[0,.47,.16],neck2:[0,.505,.235],head:[0,.548,.30],jaw:[0,.546,.356],
  shL:WS,wUL:WS,wFL:WE,wHL:WW,shR:mir(WS),wUR:mir(WS),wFR:mir(WE),wHR:mir(WW),thL:LH,tsL:LA,ftL:LF,thR:mir(LH),tsR:mir(LA),ftR:mir(LF),tail:TAILP[0]};
const PARENT={body:'root',chest:'body',neck:'chest',neck2:'neck',head:'neck2',jaw:'head',shL:'chest',wUL:'shL',wFL:'wUL',wHL:'wFL',shR:'chest',wUR:'shR',wFR:'wUR',wHR:'wFR',
  thL:'body',tsL:'thL',ftL:'tsL',thR:'body',tsR:'thR',ftR:'tsR',tail:'body'};
const SEG={body:[[0,.43,-.3],[0,.42,.0]],chest:[[0,.42,0],[0,.45,.16]],neck:[REST.neck,REST.neck2],neck2:[REST.neck2,REST.head],head:[REST.head,[0,.556,.36]],
  wUL:[WS,WE],wFL:[WE,WW],wHL:[WW,WT],thL:[LH,LA],tsL:[LA,LF],ftL:[LF,vadd(LF,[0,-.02,.05])],tail:TAILP};
for(const n of ['wU','wF','wH','th','ts','ft'])SEG[n+'R']=SEG[n+'L'].map(mir);
function segDist(p,a,b){const ab=vsub(b,a),t=clamp(vdot(vsub(p,a),ab)/vdot(ab,ab),0,1);return vlen(vsub(p,vadd(a,vsc(ab,t))))}
function topW(W){W.sort((a,b)=>b[1]-a[1]);const top=W.slice(0,4);while(top.length<4)top.push([0,0]);const s=top.reduce((a,b)=>a+b[1],0);return [top.map(w=>w[0]),top.map(w=>w[1]/s)]}
function pigWeights(p){const [x,y,z]=p,ax=Math.abs(x),sd=x>=0?'L':'R',q=[ax,y,z];const W=[];
  const push=(name,d,pw=4)=>W.push([BN.indexOf(name),1/Math.pow(d+0.012,pw)]);
  if(z>0.352&&ax<0.045&&y>0.49&&sdBeak(x,y,z)<0.008){                 // beak: lower mandible rides the jaw bone
    if(sdBeakL(x,y,z)<sdBeakU(x,y,z)){const k=sstep(0.352,0.372,z);return topW([[BN.indexOf('jaw'),k+1e-4],[BN.indexOf('head'),1-k+1e-4]])}
    return topW([[BN.indexOf('head'),1]])}
  for(const n of ['body','chest'])push(n,segDist(p,...SEG[n])+0.1,6);for(const n of ['neck','neck2','head'])push(n,segDist(p,...SEG[n]));
  if(sdArm(ax,y,z)<0.03&&ax>0.075){const k=1+Math.max(0,0.15-ax)*22;for(const n of ['wU','wF','wH'])push(n+sd,segDist(q,...SEG[n+'L'])*k)}
  if(sdLeg(ax,y,z)<0.03&&y<0.34){const k=1+Math.max(0,y-0.27)*14;for(const n of ['th','ts'])push(n+sd,segDist(q,...SEG[n+'L'])*k);
    if(y<0.05)push('ft'+sd,segDist(q,...SEG.ftL)*0.35);}
  if(z<-0.2)push('tail',segDist(p,...SEG.tail)*0.8);
  return topW(W)}

''')

# ------------------------------------------------------------------ skin colour masks, mesh, feathers
rep("const COL={","/* =====================================================================\n   Scene",r'''const COL={skin:0xffffff,nose:0x1a1414};
function mixc(a,b,t){return a.map((v,i)=>lerp(v,b[i],t))}
// vertex colour = [shade, headMask, bare] ; bare: 1 = horn (beak), 0.6 = fleshy yellow (cere, legs, toes)
function pigVertex(p){const [x,y,z]=p,ax=Math.abs(x);
  const bU=sdBeakU(x,y,z),bL=sdBeakL(x,y,z),bk=Math.min(bU,bL);
  const beak=sstep(0.007,0.0,bk)*sstep(0.352,0.366,z);
  const cere=beak*sstep(0.392,0.38,z)*sstep(0.546,0.557,y);
  const legs=sdLeg(ax,y,z)<0.02&&y<0.152?1:0;
  const b=Math.max(legs*0.6,beak*(1-cere)+cere*0.6);
  const gape=beak*sstep(0.012,0.0,Math.abs(bU-bL))*sstep(0.356,0.37,z)*(1-cere);
  const head=sstep(0.15,0.23,z+(y-0.46)*0.55)*(1-beak);
  const hair=b>0.05?0:(sdLeg(ax,y,z)<0.02&&y<0.34?1.0:(head>0.5?0.75:1));
  return [[1-gape*0.86,head,b],hair]}
function buildPig(){
  const f=pigSDF;const sn=surfaceNets(f,[-0.7,-0.01,-0.36],[0.7,0.65,0.5],0.0095);
  relax(f,sn.pos,sn.idx,3);orient(f,sn.pos,sn.idx);
  const pos=sn.pos,idx=sn.idx,N=pos.length/3,nor=[],col=[],si=[],sw=[],hair=[];
  for(let i=0;i<N;i++){const p=[pos[i*3],pos[i*3+1],pos[i*3+2]];nor.push(...vnorm(grad(f,...p)));
    const [c,hr]=pigVertex(p);col.push(...c);hair.push(hr);const [I,W]=pigWeights(p);si.push(...I);sw.push(...W)}
  const g=new Geo();g.pos=pos;g.nor=nor;g.col=col;g.idx=idx;
  const wg=new Geo();wg.pos=pos;wg.nor=nor;wg.col=col;for(let t=0;t<idx.length;t+=3)wg.idx.push(idx[t],idx[t+1],idx[t+1],idx[t+2],idx[t+2],idx[t]);
  return {geo:upload(g,{si,sw,m1:pos,hair}),wire:upload(wg,{si,sw,m1:pos,hair}),tris:idx.length/3}}
let scaleItem,maneItem;
/* ---------- feathers: real cards, each rooted on its bone; the wing fold is a 3-state morph per feather
   (spread → half → folded), each feather swinging about its own follicle the way real flight feathers do */
const FEATH=[];let crestItem,preyN,talonItems=[];
function rotY(p,o,th){const x=p[0]-o[0],z=p[2]-o[2],c=Math.cos(th),s=Math.sin(th);return [o[0]+c*x+s*z,p[1],o[2]-s*x+c*z]}
function featherCard(A,o){ // o: root, a (angle from -z toward +x), L, W, bone, zone, th (fold swing), lift, nrm, emarg, asym, camber, a2 (alt angle for morph target 1 instead of rotation)
  const n=o.seg||7,nr=o.nrm||[0,1,0];const dirOf=a=>vnorm(vadd([Math.sin(a),0,-Math.cos(a)],[0,o.lift||0,0]));
  const make=a=>{const dir=dirOf(a),side=vnorm(vcross(nr,dir));const P=[];
    for(let i=0;i<=n;i++){const u=i/n;let w=o.W*(u<.12?lerp(.45,1,u/.12):1)*Math.sqrt(Math.max(0,1-Math.pow(Math.max(0,(u-.5)/.5),2.4)));
      if(o.emarg)w*=lerp(1,.48,sstep(.42,.68,u));
      const c=vadd(vadd(o.root,vsc(dir,o.L*u)),vsc(nr,(o.camber!=null?o.camber:.035)*o.L*Math.sin(PI*u)));
      const wl=w*(o.asym?.5:1),wr=w*(o.asym?1.2:1);
      P.push(vsub(c,vsc(side,wl)),vadd(c,vsc(nr,.0016*(1-u))),vadd(c,vsc(side,wr)))}return P};
  const P0=make(o.a);let P1,P2;
  if(o.a2!=null){P1=make(o.a2);P2=P1}else{P1=P0.map(p=>rotY(p,o.root,(o.th||0)*.5));P2=P0.map(p=>rotY(p,o.root,o.th||0))}
  const b=A.pos.length/3,rf=rr(.9,1.07),bi=BN.indexOf(o.bone);
  P0.forEach((p,k)=>{A.pos.push(...p);A.m1.push(...P1[k]);A.m2.push(...P2[k]);A.nor.push(...nr);A.col.push(1,1,1);A.si.push(bi,0,0,0);A.sw.push(1,0,0,0);
    A.hair.push(Math.floor(k/3)/n);A.meta.push([o.zone,rf,k%3,Math.floor(k/3)/n,o.fi||0])});
  for(let i=0;i<n;i++){const r0=b+i*3,r1=r0+3;A.idx.push(r0,r0+1,r1,r0+1,r1+1,r1,r0+1,r0+2,r1+1,r0+2,r1+2,r1+1)}}
function newAcc(){return {pos:[],nor:[],col:[],idx:[],si:[],sw:[],m1:[],m2:[],hair:[],meta:[]}}
function mirAcc(A){const B_=newAcc();const sw=n=>n.replace(/L$/,'R');
  for(let i=0;i<A.pos.length;i+=3){B_.pos.push(-A.pos[i],A.pos[i+1],A.pos[i+2]);B_.m1.push(-A.m1[i],A.m1[i+1],A.m1[i+2]);B_.m2.push(-A.m2[i],A.m2[i+1],A.m2[i+2]);B_.nor.push(-A.nor[i],A.nor[i+1],A.nor[i+2])}
  B_.col=[...A.col];B_.hair=[...A.hair];B_.meta=A.meta.map(m=>[...m]);B_.sw=[...A.sw];for(let i=0;i<A.si.length;i+=4)B_.si.push(BN.indexOf(sw(BN[A.si[i]])),0,0,0);
  for(let t=0;t<A.idx.length;t+=3)B_.idx.push(A.idx[t],A.idx[t+2],A.idx[t+1]);return B_}
function accItem(A,o){const g=new Geo();g.pos=A.pos;g.nor=A.nor;g.col=A.col;g.idx=A.idx;
  const it=addItem(upload(g,{si:A.si,sw:A.sw,m1:A.m1,m2:A.m2,hair:A.hair}),null,Object.assign({skin:true,flat:1,rough:.78,spec:.22,rim:.32,skinD:-1},o));it.meta=A.meta;FEATH.push(it);return it}
const lerp3=(a,b,t)=>vadd(a,vsc(vsub(b,a),t));
function armAt(t){return t<.5?lerp3(WS,WE,t*2):lerp3(WE,WW,(t-.5)*2)}
function buildFeathers(){
  const ARM=newAcc(),HAND=newAcc();
  // flight feathers: secondaries (forearm) and tertials (humerus)
  for(let i=0;i<14;i++){const t=i/13;const a=lerp(-.05,.26,t);featherCard(ARM,{root:vadd(lerp3(WE,WW,t),[0,-.006+.0006*i,-.01]),a,L:.29+.012*Math.sin(PI*t),W:.062,bone:'wFL',zone:'sec',th:a+1.47,fi:i})}
  for(let i=0;i<5;i++){const t=i/4;const a=lerp(-.48,-.08,t);featherCard(ARM,{root:vadd(lerp3(WS,WE,.3+.7*t),[0,-.0075+.0005*i,-.012]),a,L:lerp(.2,.27,t),W:.06,bone:'wUL',zone:'sec',th:a-1.4,fi:i})}
  // greater coverts over the secondaries
  for(let i=0;i<14;i++){const t=i/13;const a=lerp(-.05,.26,t);featherCard(ARM,{root:vadd(lerp3(WE,WW,t),[0,.012+.0004*i,-.004]),a,L:.135,W:.05,bone:'wFL',zone:'gcov',th:a+1.47,lift:-.13,camber:.02})}
  for(let i=0;i<5;i++){const t=i/4;const a=lerp(-.45,-.08,t);featherCard(ARM,{root:vadd(lerp3(WS,WE,.3+.7*t),[0,.014,-.004]),a,L:.12,W:.05,bone:'wUL',zone:'gcov',th:a-1.4,lift:-.14,camber:.02})}
  // median + lesser coverts (leading edge, over the arm skin)
  for(let i=0;i<18;i++){const t=i/17,r=armAt(t),fore=t>=.5;const a=lerp(-.25,.15,t);featherCard(ARM,{root:vadd(r,[0,.02,.006]),a,L:.085,W:.042,bone:fore?'wFL':'wUL',zone:'mcov',th:fore?a+1.3:a-1.3,lift:-.18,camber:.02})}
  for(let i=0;i<22;i++){const t=i/21,r=armAt(t),fore=t>=.5;const a=lerp(-.2,.1,t);featherCard(ARM,{root:vadd(r,[0,.026,.024]),a,L:.06,W:.034,bone:fore?'wFL':'wUL',zone:'lcov',th:fore?a+1.2:a-1.2,lift:-.25,camber:.02})}
  // underwing coverts (seen in flight from below)
  for(let i=0;i<18;i++){const t=i/17,r=armAt(t),fore=t>=.5;const a=lerp(-.15,.2,t);featherCard(ARM,{root:vadd(r,[0,-.016,.0]),a,L:.11,W:.045,bone:fore?'wFL':'wUL',zone:'ucov',th:fore?a+1.4:a-1.4,lift:.1,nrm:[0,-1,0],camber:.02})}
  for(let i=0;i<16;i++){const t=i/15,r=armAt(t),fore=t>=.5;const a=lerp(-.15,.15,t);featherCard(ARM,{root:vadd(r,[0,-.022,.02]),a,L:.07,W:.036,bone:fore?'wFL':'wUL',zone:'ucov',th:fore?a+1.3:a-1.3,lift:.18,nrm:[0,-1,0],camber:.02})}
  // primaries (hand) — emarginated "fingers" on the outer six
  const PL_=[.30,.31,.325,.335,.35,.36,.365,.36,.345,.305];
  for(let i=0;i<10;i++){const t=i/9;const a=lerp(.36,1.42,Math.pow(t,1.15));featherCard(HAND,{root:vadd(lerp3(WW,WT,t),[0,-.004-.0009*i,-.004]),a,L:PL_[i],W:lerp(.058,.046,t),bone:'wHL',zone:'prim',th:a-1.62,emarg:i>=4,asym:i>=3,fi:i,seg:8})}
  for(let i=0;i<9;i++){const t=i/8;const a=lerp(.4,1.35,t);featherCard(HAND,{root:vadd(lerp3(WW,WT,t*.9),[0,.011,.0]),a,L:.13,W:.045,bone:'wHL',zone:'pcov',th:a-1.62,lift:-.1,camber:.02})}
  for(let i=0;i<9;i++){const t=i/8;const a=lerp(.4,1.35,t);featherCard(HAND,{root:vadd(lerp3(WW,WT,t*.9),[0,-.014,.004]),a,L:.11,W:.042,bone:'wHL',zone:'ucov',th:a-1.62,lift:.08,nrm:[0,-1,0],camber:.02})}
  for(let k=0;k<3;k++){const a=1.95-.18*k;featherCard(HAND,{root:vadd(WW,[0,.016+.002*k,.018]),a,L:.08-.008*k,W:.024,bone:'wHL',zone:'pcov',th:a-1.75,lift:-.05,camber:.02})}
  FACE.wing={armL:accItem(ARM),handL:accItem(HAND),armR:accItem(mirAcc(ARM)),handR:accItem(mirAcc(HAND))};
  // tail: fan morph (closed → spread)
  const T=newAcc();
  for(let i=0;i<12;i++){const t=i/11,ce=Math.abs(t-.5)*2;featherCard(T,{root:[lerp(-.042,.042,t),.447-.0016*ce*6,-.235],a:lerp(-.11,.11,t),a2:lerp(-.82,.82,t),L:.29-.015*ce,W:.056,bone:'tail',zone:'tail',seg:8,lift:.02})}
  for(let i=0;i<8;i++){const t=i/7;featherCard(T,{root:[lerp(-.035,.035,t),.462,-.2],a:lerp(-.15,.15,t),a2:lerp(-.5,.5,t),L:.14,W:.05,bone:'tail',zone:'tcov',lift:-.05})}
  for(let i=0;i<6;i++){const t=i/5;featherCard(T,{root:[lerp(-.03,.03,t),.418,-.2],a:lerp(-.15,.15,t),a2:lerp(-.45,.45,t),L:.12,W:.05,bone:'tail',zone:'tcov',lift:.05,nrm:[0,-1,0]})}
  FACE.tail=accItem(T,{rough:.8});
  // scapulars: body feathers draping over the wing roots (rigid on the chest)
  const SC=newAcc();
  for(let i=0;i<9;i++){const t=i/8;const r0=marchOut([.075-.02*t,.43,.13-.17*t],[0.45,1,0]);const n=nrm(r0);
    featherCard(SC,{root:vadd(r0,vsc(n,-.004)),a:-.32-.1*t,L:.16+.03*t,W:.055,bone:'chest',zone:'scap',nrm:n,lift:-.18,camber:.03})}
  for(let i=0;i<7;i++){const t=i/6;const r0=marchOut([.09,.34+.02*t,.12-.2*t],[1,-.2,0]);const n=nrm(r0);    // flank feathers that tuck the folded wing
    featherCard(SC,{root:vadd(r0,vsc(n,-.004)),a:-.08,L:.13,W:.05,bone:'body',zone:'scap',nrm:n,lift:-.1,camber:.03})}
  const SCm=mirAcc(SC);for(const k in SC)SC[k].push(...SCm[k].map?SCm[k]:[]);
  {const off=SC.pos.length/3-SCm.pos.length/3;SC.idx.length=SC.idx.length-SCm.idx.length;for(const i of SCm.idx)SC.idx.push(i+off)}
  FACE.scap=accItem(SC);
  // crest (harpy eagle) on the head
  const CR=newAcc();for(let i=0;i<12;i++){const t=i/11,sx=t<.5?1:-1;const r0=marchOut([.02*sx,.57,.29-.02*(i%6)/5],[0.25*sx,1,-.4]);
    featherCard(CR,{root:r0,a:.3*sx*(.4+(i%6)/5),L:.075+.02*((i%6)/5),W:.022,bone:'head',zone:'crest',lift:.9,nrm:vnorm([sx,.3,.2]),camber:.05})}
  crestItem=accItem(CR);crestItem.visible=false;
  // talons — hooked black claws on every toe
  const gT=new Geo();for(const tip of TOE_T){const d=vnorm(vsub(tip,LF));const dn=[0,-1,0];
    gT.merge(tube([tip,vadd(tip,vadd(vsc(d,.012),vsc(dn,.002))),vadd(tip,vadd(vsc(d,.019),vsc(dn,.012))),vadd(tip,vadd(vsc(d,.014),vsc(dn,.022)))],8,u=>lerp(.0068,.0012,u),6,true))}
  const gTu=upload(gT),gTm=(()=>{const g=new Geo();g.merge(gT,M4.trs([0,0,0],null,[0,0,0],[-1,1,1]));for(let t=0;t<g.idx.length;t+=3){const a=g.idx[t+1];g.idx[t+1]=g.idx[t+2];g.idx[t+2]=a}return upload(g)})();
  talonItems=[addItem(gTu,B.ftL.add(new Node(vsc(REST.ftL,-1))),{color:hex(0x171412),flat:0,rough:.25,spec:1.1,rim:.2}),addItem(gTm,B.ftR.add(new Node(vsc(REST.ftL,-1).map((v,i)=>i===0?-v:v))),{color:hex(0x171412),flat:0,rough:.25,spec:1.1,rim:.2})];
  // prey (a trout) for the tear / dive
  const fg=new Geo();fg.merge(sphere(1,18,12),M4.trs([0,0,0],null,[0,0,0],[.035,.03,.14]));fg.merge(cyl(0,.05,.07,6,true),M4.trs([0,0,-.16],null,[PI/2,0,0],[.3,1,1]));
  preyN=sceneRoot.add(new Node());preyN.visible=false;addItem(upload(flatten(fg,c=>hex(c[1]>.008?0x6f7c62:0xd9dccf).map(v=>v*rr(.92,1.05)))),preyN,{flat:1,rough:.35,spec:.9,rim:.3});
}
function recolorFeathers(sp){for(const it of FEATH){const c=[];for(const [zone,rf,j,u,fi] of it.meta){let h=sp[zone]!=null?sp[zone]:sp.mcov;let col=hex(h);
      if(zone==='prim'&&u>.55)col=mixc(col,hex(sp.prim),0);
      const k=rf*(j===1?1.1:.94)*(u>.82?.86:1);c.push(...col.map(v=>v*k))}
    gl.bindBuffer(gl.ARRAY_BUFFER,it.gl.bufs[2]);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(c))}}

''')

# ------------------------------------------------------------------ face
rep("function buildFace(){","function eH(p)",r'''function buildFace(){
  const H=B.head,rE=0.0168;const skC=[0.9,0.9,0.9];
  const gEye=upload(sphere(rE,28,20)),gIris=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.004,32,10,0,TAU,0,1.18),M4.euler(PI/2,0,0));return g})());
  const gPup=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.03,28,8,0,TAU,0,0.46),M4.euler(PI/2,0,0));return g})());
  const gRing=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.012,32,4,0,TAU,1.1,0.08),M4.euler(PI/2,0,0));return g})());
  const gHi=upload(sphere(rE*.2,12,8)),gHi2=upload(sphere(rE*.09,10,6));
  const gLidU=upload(sphere(rE*1.14,32,12,0,TAU,0,PI/2)),gLidL=upload(sphere(rE*1.12,32,12,0,TAU,PI/2,PI/2)),gNM=upload(sphere(rE*1.06,32,12,0,TAU,0,PI/2));
  const gLash=upload(torus(rE*1.14,rE*.1,6,40));
  const gBrow=upload(tube([[-rE*.95,-rE*.15,0],[-rE*.3,rE*.08,0],[rE*.3,rE*.1,0],[rE*1.0,-rE*.05,0]],14,u=>0.006+0.006*Math.sin(u*PI),7));
  FACE.eyes=[];FACE.lidItems=[];FACE.browItems=[];FACE.irisItems=[];FACE.ballItems=[];
  for(const s of [1,-1]){
    const dir=vnorm([0.82*s,0.1,0.56]);const S_=marchOut([0,.566,.33],dir);const c=vsub(S_,vsc(dir,rE*0.42));
    const eg=H.add(new Node(headLocal(c)));eg.rm=M4.basis(vnorm([0.56*s,0.02,0.83]));
    FACE.ballItems.push(addItem(gEye,eg,{color:hex(0x5a3a10),flat:0,rough:.12,spec:1.3,rim:.05,cast:false}));
    const ig=eg.add(new Node());FACE.irisItems.push(addItem(gIris,ig,{color:hex(0xf2df7a),flat:0,rough:.1,spec:1.4,cast:false}));
    addItem(gRing,ig,{color:hex(0x6a4a14),flat:0,rough:.3,cast:false});
    const pg=ig.add(new Node());addItem(gPup,pg,{color:hex(0x040404),flat:0,rough:.12,spec:1,cast:false});
    const h1=eg.add(new Node(vsc(vnorm([-0.3,0.42,0.84]),rE*.95)));addItem(gHi,h1,{color:[0,0,0],emis:[1.6,1.6,1.6],flat:0,cast:false});
    const h2=eg.add(new Node(vsc(vnorm([0.32,-0.3,0.9]),rE*1.0)));addItem(gHi2,h2,{color:[0,0,0],emis:[1,1,1],flat:0,cast:false});
    const lu=eg.add(new Node());FACE.lidItems.push(addItem(gLidU,lu,{color:skC,flat:0,rough:.7,cast:false,rim:.25}));
    addItem(gLash,lu,{color:hex(0x2a2218),flat:0,rough:.6,cast:false});
    const ll=eg.add(new Node());FACE.lidItems.push(addItem(gLidL,ll,{color:skC,flat:0,rough:.7,cast:false}));
    const nmO=eg.add(new Node()),nmI=nmO.add(new Node());nmI.r=[PI/2,0,0];const nmIt=addItem(gNM,nmI,{color:hex(0xc8d6e0),flat:0,rough:.15,spec:1.2,trans:true,op:0,cast:false});
    const bg=eg.add(new Node([0,rE*1.15,rE*0.5]));FACE.browItems.push(addItem(gBrow,bg,{color:skC,flat:0,rough:.8,cast:false}));
    FACE.eyes.push({s,eg,ig,pg,lu,ll,bg,nmO,nmIt})}
  FACE.rE=rE;
  const gNos=upload(sphere(1,18,12));FACE.nos=[];
  for(const s of [1,-1]){const p=marchIn([.07*s,.556,.388],[-s,0,0]);const n=nrm(p);const nn=H.add(new Node(headLocal(vadd(p,vsc(n,-.0015)))));nn.rm=M4.basis(n);nn.base=[.0042,.0068,.003];nn.s=[...nn.base];
    addItem(gNos,nn,{color:hex(0x1a120c),flat:0,rough:.3,spec:.6,cast:false});FACE.nos.push(nn)}
  // tongue on the jaw (seen when screeching)
  const tg=B.jaw.add(new Node(vsub([0,.538,.392],REST.jaw)));tg.s=[.009,.0045,.026];FACE.tongue=addItem(gNos,tg,{color:hex(0xc9787a),flat:0,rough:.4,spec:.5,cast:false});
  FACE.mouth={mw:[0,0]};FACE.open={s:[1,1,1]};FACE.openS=[1,1,1];FACE.teeth=[];FACE.fangs=[];FACE.blush=[];
}
''')

# ------------------------------------------------------------------ mountains (from the snow leopard) + a dead snag
env=lgrab("function noise2","// particles")
env=env.replace("  env.merge(props);",r'''  // weathered snag near the perch spot
  {const bx=2.4,bz=-2.0,by=terrainH(bx,bz);const wood=c=>hex(rnd()<.5?0x8b8174:0x7a7064).map(v=>v*rr(.9,1.05));
   props.merge(flatten(jitter(tube([[bx,by-.1,bz],[bx+.05,by+.9,bz],[bx-.06,by+1.8,bz+.05],[bx+.03,by+2.6,bz-.04]],10,u=>lerp(.17,.05,u),7,true),.01),wood));
   for(const [h,a,l] of [[1.2,.6,1.0],[1.7,-2.3,.8],[2.2,2.0,.6]]){const p0=[bx+.02,by+h,bz];const d=[Math.cos(a),.45,Math.sin(a)];
     props.merge(flatten(jitter(tube([p0,vadd(p0,vsc(d,l*.5)),vadd(p0,vadd(vsc(d,l),[0,.15,0]))],6,u=>lerp(.06,.015,u),5,true),.008),wood))}}
  env.merge(props);''')
rep("function noise2","// particles",env)
sub("const SUN=vnorm([0.55,0.78,0.38]),SUNC=hex(0xffeedd).map(v=>v*1.85),SKY=hex(0xb9d6f5).map(v=>v*.5),GND=hex(0x9aa86a).map(v=>v*.3),FOG=hex(0xd8d2c4);",
    "const SUN=vnorm([0.55,0.78,0.38]),SUNC=hex(0xffeedd).map(v=>v*1.85),SKY=hex(0xb9d6f5).map(v=>v*.5),GND=hex(0xa09c90).map(v=>v*.32),FOG=hex(0xd3dbe2);")
sub("vec3 top=vec3(.18,.42,.78),hor=vec3(.86,.80,.70);","vec3 top=vec3(.14,.36,.74),hor=vec3(.84,.88,.92);")

# particles: feathers
sub("const PARTS=[];let gPuff,gHeart,gZ,gDrop;","const PARTS=[];let gPuff,gHeart,gZ,gDrop,gFeat;")
sub("function initParticles(){gPuff=upload(flatten(icosa(1,0)),{flat:true});","function initParticles(){gPuff=upload(flatten(icosa(1,0)),{flat:true});{const A=newAcc();featherCard(A,{root:[0,0,-.5],a:0,L:1,W:.22,bone:'root',zone:'x',camber:.08});const g=new Geo();g.pos=A.pos;g.nor=A.nor;g.col=A.col;g.idx=A.idx;gFeat=upload(g)}")
sub("P.it.gl=kind==='heart'?gHeart:kind==='z'?gZ:kind==='drop'?gDrop:gPuff;","P.it.gl=kind==='heart'?gHeart:kind==='z'?gZ:kind==='drop'?gDrop:kind==='feather'?gFeat:gPuff;")
sub("  else if(P.kind==='drop'){","  else if(P.kind==='feather'){P.v=vsc(P.v,Math.pow(.3,dt));P.v[1]=Math.max(P.v[1]-dt*2,-.35);P.v[0]+=Math.sin(t*14+P.spin)*dt*.8;P.n.r=[Math.sin(t*9+P.spin)*.6,P.n.r[1]+dt*P.spin,Math.cos(t*7)*.4];P.n.s=Array(3).fill(P.size);P.it.op=1-sstep(.8,1,t);if(P.n.p[1]<terrainH(P.n.p[0],P.n.p[2])+.01){P.v=[0,0,0]}}\n  else if(P.kind==='drop'){")

# ------------------------------------------------------------------ animation
rep("const legs=(P,f,b)=>","/* =====================================================================\n   State, input, loop",r'''const RUF=RX,FAN=RZ;
// wing: f fold (0 spread,1 folded), fl flap (up +), sw sweep (back +), tw twist (nose-down +), fe/fw elbow/wrist fold override, ef/hf elbow/hand bend
function wing(P,s,o){const n=s>0?['shL','wUL','wFL','wHL']:['shR','wUR','wFR','wHR'];const f=o.f||0,fe=o.fe!=null?o.fe:f,fw=o.fw!=null?o.fw:f;
  S(P,n[0],1.35*f+(o.tw||0),(o.sw||0)*s,s*(-1.4*f+(o.fl||0)));S(P,n[2],0,-s*2.75*fe,s*(o.ef||0));S(P,n[3],0,s*2.6*fw,s*(o.hf||0))}
function wings(P,o){wing(P,1,o);wing(P,-1,o)}
function leg(P,s,a,b,c,spl=0){const X=s>0?'L':'R';S(P,'th'+X,a,0,s*spl);S(P,'ts'+X,b,0,0);S(P,'ft'+X,c,0,0)}
function perch(P,up=.72){S(P,'root',-up,0,0);leg(P,1,up-.3,.35,-.05,.04);leg(P,-1,up-.3,.35,-.05,.04);
  S(P,'neck',.08,0,0);S(P,'neck2',.2,0,0);S(P,'head',up-.33,0,0);S(P,'tail',-.2,0,0);wings(P,{f:1})}
function seq(t,L,segs,xf=.2){let P=null;for(let i=0;i<segs.length;i++){const [t0,fn]=segs[i];if(i>0&&t<t0)break;const p=fn(t,L);
  if(!P)P=p;else{const w=sstep(t0,t0+xf,t);for(let j=0;j<PL;j++)P[j]=lerp(P[j],p[j],w)}}return P}
const POSES={
  idle(t,L){const P=P0();perch(P);const br=Math.sin(t*1.3);S(P,'chest',br*.012,0,0);
    S(P,'neck',0,L.yaw*.3,0);S(P,'neck2',0,L.yaw*.3,0);S(P,'head',L.pitch,L.yaw*.45,L.roll);
    S(P,'tail',Math.sin(t*.7)*.03,Math.sin(t*.4)*.05,0);P[FAN]=.05;return P},
  walk(t,L,ph){const P=P0();perch(P,.48);
    for(const s of [1,-1]){const q=ph+(s>0?0:PI);const lift=Math.max(0,Math.sin(q));leg(P,s,.32*Math.cos(q)-.25*lift,.55*lift,-.35*lift)}
    S(P,'root',0,Math.sin(ph)*.1,Math.sin(ph)*.09);wings(P,{f:-.12,fl:.1+.08*Math.abs(Math.sin(ph))});
    S(P,'neck',.12,0,0);S(P,'head',-.08+Math.cos(2*ph)*.06,L.yaw*.3,-Math.sin(ph)*.12);S(P,'tail',.1,-Math.sin(ph)*.1,0);P[FAN]=.15;return P},
  fly(t,L,ph){const P=P0();const c=Math.cos(ph),sn=Math.sin(ph);const tuck=sstep(.25,1.4,L.alt);
    S(P,'root',.06-.6*(1-tuck),0,0);
    wings(P,{fl:.12+.62*c,sw:.04-.14*sn,tw:-.1*sn,fe:.22*Math.max(0,-sn),fw:.42*Math.max(0,-sn),hf:-.3*c});
    S(P,'neck',.3*tuck,0,0);S(P,'neck2',.12,0,0);S(P,'head',-.42*tuck+.3*(1-tuck)+sn*.03,L.yaw*.3,0);
    leg(P,1,lerp(.2,1.35,tuck),lerp(.3,.5,tuck),lerp(-.1,1,tuck));leg(P,-1,lerp(.2,1.35,tuck),lerp(.3,.5,tuck),lerp(-.1,1,tuck));
    S(P,'tail',.05*Math.sin(ph+1)-.2*(1-tuck),0,0);P[FAN]=.3+.5*(1-tuck);P[RY]=-.03*sn;return P},
  soar(t,L,ph){const P=P0();const g=Math.sin(t*.8);
    S(P,'root',.03,0,0);wings(P,{fl:.17+.03*g,sw:-.03,tw:-.03,hf:.1,fe:.02,fw:.05+.04*Math.max(0,g)});
    S(P,'neck',.32,0,0);S(P,'neck2',.1,0,0);S(P,'head',-.36+Math.sin(t*.5)*.12,Math.sin(t*.37)*.45,Math.sin(t*.37)*.2);
    leg(P,1,1.35,.5,1);leg(P,-1,1.35,.5,1);S(P,'tail',0,Math.sin(t*.6)*.06,0);P[FAN]=.75;return P},
  land(t,L){const P=P0();const q=t*10.5,c=Math.cos(q),sn=Math.sin(q);
    S(P,'root',-.62,0,0);wings(P,{fl:.4+.5*c,sw:-.32,tw:.38,fe:.12*Math.max(0,-sn),fw:.3*Math.max(0,-sn)});
    S(P,'neck',-.05,0,0);S(P,'neck2',.12,0,0);S(P,'head',.45,0,0);
    leg(P,1,-.45,.2,.25,.06);leg(P,-1,-.45,.2,.25,.06);S(P,'tail',-.35,0,0);P[FAN]=1;return P},
  happy(t,L){const P=P0();perch(P,.55);const q=t*3.2,c=Math.cos(q);
    wings(P,{f:0,fl:.55+.25*c,sw:-.12,tw:.15,fe:.08,fw:.15+.12*Math.max(0,-Math.sin(q))});
    S(P,'neck',-.15,0,0);S(P,'head',-.22+.18*Math.max(0,Math.sin(t*1.3)),Math.sin(t*.9)*.3,0);P[FAN]=1;S(P,'tail',.12,0,0);return P},
  tear(t,L){const P=P0();perch(P,.32);const tug=Math.pow(Math.max(0,Math.sin(t*2.4)),3);
    leg(P,1,-.38,-.15,.3);S(P,'neck',.95-.35*tug,0,0);S(P,'neck2',.55-.2*tug,0,0);S(P,'head',.12-.5*tug,Math.sin(t*1.1)*.15,Math.sin(t*2.4)*.15*tug);
    wings(P,{f:-.14,fl:.12});P[FAN]=.3;return P},
  preen(t,L){const P=P0();perch(P,.6);const sd=clamp(Math.sin(t*.22)*4,-1,1);const nib=Math.sin(t*9)*.05;
    S(P,'neck',.05,sd*1.0,0);S(P,'neck2',.35,sd*.9,sd*.3);S(P,'head',.35+nib,sd*.5,sd*.5);
    wing(P,1,{f:-.1*Math.max(0,sd),fl:.14*Math.max(0,sd)});wing(P,-1,{f:-.1*Math.max(0,-sd),fl:.14*Math.max(0,-sd)});P[FAN]=.2;P[RUF]=.3;return P},
  sleep(t,L){const P=P0();perch(P,.5);const br=Math.sin(t*.9);
    S(P,'neck',-.25,1.2,0);S(P,'neck2',-.1,1.1,.3);S(P,'head',.5,.6,.4);S(P,'chest',br*.015,0,0);P[RUF]=.6+br*.06;return P},
};
const ACTIONS={
  attack:{dur:4.6,alt(t,a0){const up=Math.max(a0,3.4);if(t<1.7)return lerp(a0,up,sstep(0,1.5,t));if(t<2.75)return up*(1-Math.pow(sstep(1.7,2.75,t),1.5));return 0},
    speed:t=>t<1.7?3.4:t<2.75?6.5:t<2.95?lerp(6.5,0,(t-2.75)/.2):0,
    pose(t,L){return seq(t,L,[[0,(t,L)=>POSES.fly(t,{...L,alt:Math.max(L.alt,.5)},t*14)],[0.95,(t,L)=>POSES.soar(t,L)],
      [1.7,(t,L)=>{const P=P0();S(P,'root',.75,0,0);wings(P,{f:.55,fe:.45,fw:.75,fl:.35,sw:.45});S(P,'neck',.25,0,0);S(P,'head',-.6,0,0);leg(P,1,1.35,.5,1);leg(P,-1,1.35,.5,1);P[FAN]=0;return P}],
      [2.42,(t,L)=>{const P=P0();S(P,'root',-.7,0,0);wings(P,{fl:.5+.2*Math.cos(t*20),sw:-.4,tw:.42});S(P,'neck',.1,0,0);S(P,'head',.5,0,0);
        leg(P,1,-1.05,-.1,.35,.08);leg(P,-1,-1.05,-.1,.35,.08);S(P,'tail',-.4,0,0);P[FAN]=1;return P}],
      [2.78,(t,L)=>{const P=P0();perch(P,.25);wings(P,{f:.05,fl:-.18,sw:-.2,tw:.1});S(P,'neck',.6,0,0);S(P,'neck2',.3,0,0);S(P,'head',-.2,Math.sin(t*3)*.25,0);P[FAN]=.9;P[RUF]=.6;return P}],
      [3.9,(t,L)=>POSES.idle(t,L)]],.14)},
    face:t=>t<1.7?'fierce':t<2.9?'screech':'fierce',mouth:t=>t>2.4&&t<3.0?.8:0,
    fx(at,fw){if(at>2.78&&!st.fx.hit){st.fx.hit=1;st.shake=.32;const p=vadd(st.pos,vsc(fw,.15));
      for(let i=0;i<22;i++){const a=rnd()*TAU;spawn('puff',[p[0],.06,p[2]],[Math.cos(a)*rr(.8,2.2),rr(.3,1.2),Math.sin(a)*rr(.8,2.2)],rr(.03,.07),rr(.6,1.1),0xeef2f6)}
      for(let i=0;i<3;i++)spawn('feather',vadd(p,[rr(-.2,.2),.4,rr(-.2,.2)]),[rr(-.5,.5),rr(.3,.8),rr(-.5,.5)],.06,3.5,SP.cov)}}},
  screech:{dur:2.4,pose(t,L){const P=P0();perch(P);const k=sstep(.05,.4,t)*(1-sstep(1.9,2.35,t)),th=sstep(.3,.6,t)*(1-sstep(1.1,1.6,t));
      S(P,'neck',-.25*k,0,0);S(P,'neck2',-.15*k,0,0);S(P,'head',-.38*th-.1*k+Math.sin(t*30)*.03*th,0,0);wings(P,{f:-.1*k,fl:.08*k});P[FAN]=.3*k;P[RUF]=.55*k;return P},
    speed:()=>0,face:t=>t<.3?'alert':'screech',mouth:t=>t>.3&&t<1.8?.78+.22*Math.sin(t*26):0},
  jump:{dur:1.9,alt:(t,a0)=>a0+(t>.3&&t<1.5?.85*Math.sin(PI*(t-.3)/1.2):0),speed:t=>t>.3&&t<1.5?.9:0,
    pose(t,L){return seq(t,L,[[0,(t,L)=>{const P=P0();perch(P,.55);leg(P,1,.35,.4,-.6);leg(P,-1,.35,.4,-.6);wings(P,{f:-.2,fl:.3});return P}],
      [.28,(t,L)=>POSES.fly(t,{...L,alt:.4},t*13)],[1.25,(t,L)=>POSES.land(t,L)],[1.5,(t,L)=>POSES.idle(t,L)]],.12)},face:()=>'alert'},
  shake:{dur:1.8,pose(t,L){const P=P0();perch(P);const e=Math.pow(Math.sin(PI*t/1.8),.6),w=t*24;
      S(P,'root',0,0,Math.sin(w)*.13*e);S(P,'neck',0,Math.sin(w-.6)*.3*e,Math.sin(w-.6)*.2*e);S(P,'head',0,Math.sin(w-1)*.4*e,Math.sin(w)*.3*e);
      wings(P,{f:-.15*e,fl:.12*e+Math.sin(w*1.3)*.05*e});S(P,'tail',0,Math.sin(w-1.4)*.25*e,0);P[FAN]=.5*e;P[RUF]=1.2*e;return P},speed:()=>0,face:()=>'squint',
    fx(at,fw){if(at>.5&&at<1.2&&rnd()<.03){const p=worldOf(B.chest);spawn('feather',vadd(p,[rr(-.1,.1),rr(-.05,.1),rr(-.1,.1)]),[rr(-.6,.6),rr(.2,.7),rr(-.6,.6)],.05,3,SP.A)}}},
  roll:{dur:3.4,pose(t,L){return seq(t,L,[[0,(t,L)=>POSES.idle(t,L)],
      [.2,(t,L)=>{const P=P0();perch(P,.62);wing(P,1,{f:-.95,fl:-.55,sw:.95,tw:.15,fe:.1,fw:.1});leg(P,1,.95,.45,.9);S(P,'root',0,0,-.08);S(P,'tail',0,.25,0);P[FAN]=.9;return P}],
      [1.5,(t,L)=>{const P=P0();perch(P,.66);wings(P,{f:-.8,fl:1.15,sw:.3,tw:.35,fe:.15,fw:.25});S(P,'neck',.35,0,0);S(P,'head',.15,0,0);P[FAN]=.6;return P}],
      [2.6,(t,L)=>POSES.idle(t,L)]],.3)},speed:()=>0,face:t=>t<2.6?'calm':'neutral'},
};
const EXPR={
  neutral:{up:.2,low:.1,ba:.18,by:0,pup:1,open:0,ruff:0},
  fierce:{up:.34,low:.22,ba:.52,by:-.004,pup:.72,open:.06,ruff:.45},
  alert:{up:0,low:0,ba:-.08,by:.004,pup:.68,open:0,ruff:-.15},
  calm:{up:.42,low:.22,ba:.08,by:0,pup:1.08,open:0,ruff:.15},
  screech:{up:.12,low:.16,ba:.5,by:-.003,pup:.74,open:1,ruff:.6},
  sleepy:{up:.75,low:.32,ba:0,by:-.002,pup:1,open:0,ruff:.3},
  asleep:{up:1,low:.36,ba:0,by:-.002,pup:1,open:0,ruff:.4},
  squint:{up:.75,low:.6,ba:.3,by:-.004,pup:1,open:.25,ruff:.5},
};
const LOOP_FACE={idle:'neutral',walk:'neutral',fly:'fierce',soar:'calm',land:'alert',happy:'fierce',tear:'fierce',preen:'calm',sleep:'asleep'};
const AIR={fly:1,soar:1};

''')

# ------------------------------------------------------------------ state, UI, update
rep("const st={","function setCommon(",r'''const st={loop:'idle',w:{idle:1,walk:0,fly:0,soar:0,land:0,happy:0,tear:0,preen:0,sleep:0},act:null,actT:0,manual:'auto',
  pos:[0,0,0],head:0.5,speed:0,wander:0,walkPh:0,runPh:0,E:{...EXPR.neutral},blink:0,blinkT:2,look:[0,0],sacc:[0,0],saccT:0,shake:0,fx:{},
  alt:0,alt0:0,bank:0,hs:[0,0,0],hv:[0,0,0],hT:1,turn:0};
const cam={th:0.75,ph:1.32,d:2.5,target:[0,.5,0],eye:[0,0,0]};
function camYaw(){return Math.atan2(cam.eye[0]-st.pos[0],cam.eye[2]-st.pos[2])}
let W=1,H=1;function resize(){const dpr=Math.min(window.devicePixelRatio||1,2);W=Math.floor(innerWidth*dpr);H=Math.floor(innerHeight*dpr);cv.width=W;cv.height=H;
  if(innerWidth<600)cam.d=Math.max(cam.d,3.2)}
addEventListener('resize',resize);resize();
const ptrs=new Map();let pinch0=0;
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch0=Math.hypot(a[0]-b[0],a[1]-b[1])}});
cv.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;const pr=ptrs.get(e.pointerId);const dx=e.clientX-pr[0],dy=e.clientY-pr[1];ptrs.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptrs.size===1){cam.th-=dx*.006;cam.ph=clamp(cam.ph-dy*.005,.3,1.75)}else if(ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch0)cam.d=clamp(cam.d*pinch0/d,.9,14);pinch0=d}});
const up=e=>{ptrs.delete(e.pointerId);pinch0=0};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{e.preventDefault();cam.d=clamp(cam.d*Math.exp(e.deltaY*.001),.9,14)},{passive:false});
const ACTS=[['idle','Perch'],['walk','Walk'],['fly','Fly'],['soar','Soar'],['attack','Dive strike'],['screech','Screech'],['jump','Hop-flap'],['tear','Tear prey'],['happy','Wing display'],['preen','Preen'],['shake','Ruffle'],['roll','Stretch'],['sleep','Sleep']];
const FACES=[['auto','Auto'],['fierce','Fierce'],['alert','Alert'],['calm','Calm'],['sleepy','Sleepy']];
const actRow=document.getElementById('acts'),faceRow=document.getElementById('faces');const btn={};
for(const [k,l] of ACTS){const b=document.createElement('button');b.textContent=l;b.onclick=()=>trigger(k);actRow.appendChild(b);btn[k]=b}
for(const [k,l] of FACES){const b=document.createElement('button');b.textContent=l;b.dataset.f=k;b.onclick=()=>{st.manual=k;refreshUI()};faceRow.appendChild(b)}
document.getElementById('wire').onclick=e=>{wireItem.visible=!wireItem.visible;e.target.classList.toggle('on',wireItem.visible)};
function trigger(k){if(ACTIONS[k]){st.act=k;st.actT=0;st.fx={};st.alt0=st.alt}else st.loop=k;refreshUI()}
function refreshUI(){for(const [k] of ACTS)btn[k].classList.toggle('on',k===st.loop||k===st.act);for(const b of faceRow.querySelectorAll('button'))b.classList.toggle('on',b.dataset.f===st.manual)}
// species: skin uniforms + feather card colours
const SPECIES=[
 {n:'Bald eagle',sw:[0x3d2a1c,0xf3efe4],A:0x3d2a1c,Bh:0xf3efe4,belly:0x3d2a1c,band:0x3d2a1c,thigh:0x3d2a1c,horn:0xf0b52e,flesh:0xf3c63c,sp:[0,0,0,0],iris:0xf4e384,
  prim:0x1e1610,sec:0x2a1d15,gcov:0x3e2c20,pcov:0x2e2118,mcov:0x46332a,lcov:0x4a362b,ucov:0x33251b,scap:0x432f24,tail:0xf4f1ea,tcov:0xf4f1ea,crest:0x3a2a1e,fb:[0,0],fbc:0,tfb:[0,0],tfbc:0},
 {n:'Golden eagle',sw:[0x4a2f1d,0xd09a45],A:0x48301f,Bh:0xd4a04a,belly:0x48301f,band:0x48301f,thigh:0x553a26,horn:0x34302e,flesh:0xf0c445,sp:[0,0,1,1],iris:0x8a4c18,
  prim:0x1f1610,sec:0x382619,gcov:0x5c4029,pcov:0x3a281b,mcov:0x8c643a,lcov:0x9a7044,ucov:0x3a281c,scap:0x5a3d26,tail:0x3b2a1e,tcov:0x4a3222,crest:0x3a2a1e,fb:[5,.28],fbc:0x7a7062,tfb:[4,.45],tfbc:0x7e766a},
 {n:'Harpy eagle',sw:[0x2a2a2d,0x9c9ca2],A:0x2b2b2e,Bh:0xa2a2a8,belly:0xf1efe8,band:0x1d1d20,thigh:0xf1efe8,horn:0x1f1f22,flesh:0xf0c445,sp:[1,1,0,2],iris:0x8a7458,
  prim:0x19191c,sec:0x222226,gcov:0x2e2e33,pcov:0x26262a,mcov:0x3b3b40,lcov:0x404046,ucov:0xeeeee8,scap:0x2c2c30,tail:0x1d1d20,tcov:0x2a2a2d,crest:0x3c3c42,fb:[4,.55],fbc:0x6a6a70,tfb:[3,.7],tfbc:0x9a9aa0,crestOn:1},
 {n:"Steller's sea eagle",sw:[0x2b231d,0xf4f2ec],A:0x2b231d,Bh:0x372d25,belly:0x2b231d,band:0x2b231d,thigh:0xf4f2ec,horn:0xf59a1c,flesh:0xf5b02c,sp:[0,0,0,1],iris:0xf2e48a,
  prim:0x1a1512,sec:0x221b16,gcov:0x2a221c,pcov:0x241d18,mcov:0xf2f0ea,lcov:0xf4f2ec,ucov:0x2a221c,scap:0x2e2620,tail:0xf4f2ec,tcov:0xf4f2ec,crest:0x2a221c,fb:[0,0],fbc:0,tfb:[0,0],tfbc:0},
];
let SP=SPECIES[0];
let COAT={A:hex(0x3d2a1c),B:hex(0xf3efe4),Be:hex(0),Ba:hex(0),Th:hex(0),Ho:hex(0),Fl:hex(0),Sp:[0,0,0,0]};
function setSpecies(sp){SP=sp;COAT={A:hex(sp.A),B:hex(sp.Bh),Be:hex(sp.belly),Ba:hex(sp.band),Th:hex(sp.thigh),Ho:hex(sp.horn),Fl:hex(sp.flesh),Sp:sp.sp};
  recolorFeathers(sp);for(const it of FACE.lidItems)it.color=hex(sp.Bh).map(v=>v*.92);for(const it of FACE.browItems)it.color=hex(sp.Bh).map(v=>v*.8);
  for(const it of FACE.irisItems)it.color=hex(sp.iris);for(const it of FACE.ballItems)it.color=hex(sp.iris).map(v=>v*.45);
  crestItem.visible=!!sp.crestOn;for(const k of ['armL','armR','handL','handR']){FACE.wing[k].fb=sp.fb;FACE.wing[k].fbc=hex(sp.fbc||0)}FACE.tail.fb=sp.tfb;FACE.tail.fbc=hex(sp.tfbc||0)}
{const row=document.getElementById('coats');row.querySelector('.lbl').textContent='Species';
  SPECIES.forEach((c,i)=>{const b=document.createElement('button');b.innerHTML=`<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#${c.sw[0].toString(16).padStart(6,'0')};border:3px solid #${c.sw[1].toString(16).padStart(6,'0')};margin-right:6px;vertical-align:-3px"></span>${c.n}`;
    b.onclick=()=>{setSpecies(c);for(const x of row.querySelectorAll('button'))x.classList.toggle('on',x===b)};if(!i)b.classList.add('on');row.appendChild(b)});window.__coat=()=>setSpecies(SPECIES[0])}
window.__pig={B,boneMats,items,bm(){BN.forEach((n,i)=>{const m=M4.mul(M4.id(),B[n].world,boneInv[i]);boneMats.set(m,i*16)})},trigger,st,cam,EXPR,SPECIES,setSpecies,get FACE(){return FACE},sim(sec){for(let i=0;i<sec*60;i++){clock+=1/60;update(1/60,clock)}}};

function wrapA(a){while(a>PI)a-=TAU;while(a<-PI)a+=TAU;return a}
function forward(){return [Math.sin(st.head),0,Math.cos(st.head)]}
function worldOf(node,p=[0,0,0]){return M4.pt(node.world,p)}
const PIV=[0,.42,0];const G0={};
function mwOf(f){f=clamp(f,0,1);return f<.5?[2*f,0]:[2-2*f,2*f-1]}
function update(dt,t){
  const A=st.act?ACTIONS[st.act]:null;let aw=0;
  if(A){st.actT+=dt;const at=st.actT;aw=sstep(0,.14,at)*(1-sstep(A.dur-.32,A.dur,at));if(at>=A.dur){st.act=null;aw=0;refreshUI()}}
  // ---- altitude: air loops climb, ground loops descend through a landing flare
  const altT=st.loop==='fly'?3.2:st.loop==='soar'?5.4:0;
  if(A&&A.alt){st.alt=A.alt(st.actT,st.alt0)}else{const d=altT-st.alt;st.alt+=clamp(d*(1-Math.exp(-dt*.9)),-1.5*dt,1.7*dt);if(st.alt<.004)st.alt=0}
  const key=AIR[st.loop]?st.loop:(st.alt>.1?'land':st.loop);
  const airW=sstep(.04,.6,st.alt);
  const tgtSpd=(key==='walk'?.32:key==='fly'?4.6:key==='soar'?3.6:key==='land'?2.4*sstep(0,1.6,st.alt):0)*(1-aw);
  st.speed=lerp(st.speed,tgtSpd,1-Math.exp(-dt*2));
  const aSpd=A&&A.speed?A.speed(st.actT)*aw:0;const v=st.speed+aSpd;
  let turn=0;
  if(v>.05){st.wander=clamp(st.wander+(rnd()-.5)*dt*3,-.6,.6);turn=st.wander*(key==='walk'?.9:.45);if(key==='soar')turn=.46;
    const dist=Math.hypot(st.pos[0],st.pos[2]),R=key==='walk'?2.2:6;if(dist>R){const want=Math.atan2(-st.pos[0],-st.pos[2]);turn+=wrapA(want-st.head)*sstep(R,R+2,dist)*2}
    st.head+=turn*dt}
  st.turn=lerp(st.turn,turn,1-Math.exp(-dt*3));
  st.pos=vadd(st.pos,vsc(forward(),v*dt));
  st.walkPh+=dt*st.speed/.32*TAU*.55;st.runPh+=dt*TAU*2.3;
  for(const k in st.w){const tg=k===key?1:0;st.w[k]=lerp(st.w[k],tg,1-Math.exp(-dt*(k==='sleep'||key==='sleep'?2.6:5)))}
  // raptor head: holds still, then snaps to a new look direction
  st.hT-=dt;if(st.hT<0){st.hT=rr(.7,2.6);const ey=clamp(wrapA(camYaw()-st.head),-1.3,1.3);st.hs=[rnd()<.45?ey*.8:rr(-1.1,1.1),rr(-.15,.12),rnd()<.25?rr(-.45,.45):0]}
  st.hv=st.hv.map((x,i)=>lerp(x,st.hs[i],1-Math.exp(-dt*16)));
  const L={yaw:st.hv[0]*(1-st.w.sleep),pitch:st.hv[1],roll:st.hv[2],alt:st.alt};
  const pose=P0();let ws=0;
  for(const k in st.w){const w=st.w[k];if(w<.002)continue;const p=POSES[k](t,L,k==='walk'?st.walkPh:st.runPh);for(let i=0;i<PL;i++)pose[i]+=p[i]*w;ws+=w}
  if(ws>0)for(let i=0;i<PL;i++)pose[i]/=ws;
  if(A&&aw>0){const p=A.pose(st.actT,L);for(let i=0;i<PL;i++)pose[i]=lerp(pose[i],p[i],aw)}
  // banking into turns while airborne
  st.bank=lerp(st.bank,clamp(-st.turn*1.3,-.7,.7)*airW,1-Math.exp(-dt*2.5));
  for(const n of BN){const i=BI[n];B[n].r=[pose[i],pose[i+1],pose[i+2]]}
  B.root.r[2]+=st.bank;
  {const R=M4.euler(...B.root.r);const rc=M4.pt(R,PIV);B.root.p=[PIV[0]-rc[0],PIV[1]-rc[1]+st.alt+pose[RY],PIV[2]-rc[2]]}
  // folded wings sit out on the flanks
  for(const [sh,s] of [['shL',1],['shR',-1]]){const f=clamp(B[sh].r[0]/1.35,0,1);B[sh].p=vadd(B[sh].rest,[s*.034*f,-.005*f,-.012*f])}
  const E=st.E;B.jaw.r[0]+=E.open*.5;
  pigN.p=[st.pos[0],0,st.pos[2]];pigN.r=[0,st.head,0];
  // ---- expression
  let fk=st.manual!=='auto'?st.manual:(A&&aw>.4?A.face(st.actT):LOOP_FACE[key]);
  const T=EXPR[fk]||EXPR.neutral;const k=1-Math.exp(-dt*7);for(const key2 in T)E[key2]=lerp(E[key2],T[key2],k);
  if(A&&aw>.4&&A.mouth)E.open=Math.max(E.open,A.mouth(st.actT));
  if(st.w.tear>.4&&!A)E.open=Math.max(E.open,.45*Math.pow(Math.max(0,Math.sin(t*2.4+.3)),3));
  if(st.w.happy>.4&&!A)E.open=Math.max(E.open,.7*sstep(.6,.9,Math.sin(t*1.3)));
  B.jaw.r[0]=pose[BI.jaw]+E.open*.85;
  // ---- feathers: fold morphs from the elbow / wrist angles, tail fan, ruffle
  {const W_=FACE.wing;W_.armL.mw=mwOf(-B.wFL.r[1]/2.75);W_.handL.mw=mwOf(B.wHL.r[1]/2.6);W_.armR.mw=mwOf(B.wFR.r[1]/2.75);W_.handR.mw=mwOf(-B.wHR.r[1]/2.6);
   FACE.tail.mw=[clamp(pose[FAN],0,1),0];const rf=clamp(pose[RUF]+E.ruff*.5,-.3,1.5);pigItem.flare=Math.max(0,rf)*.012;FACE.scap.flare=0}
  sceneRoot.update(null);
  // ---- blink: raptors sweep the nictitating membrane across the eye
  st.blinkT-=dt;if(st.blinkT<0){st.blink=1;st.blinkT=rr(1.6,4.2);if(rnd()<.2)st.blinkT=.3}
  const bl=st.blink>0?Math.sin(st.blink*PI):0;st.blink=Math.max(0,st.blink-dt/.32);
  const up=Math.max(E.up,st.w.sleep);const low=Math.max(E.low,st.w.sleep*.3);
  st.saccT-=dt;if(st.saccT<0){st.saccT=rr(.5,2);st.sacc=[rr(-.08,.08),rr(-.05,.05)]}
  for(const e of FACE.eyes){
    e.lu.r=[lerp(-1.32,1.62,up),0,0];e.ll.r=[lerp(1.32,-0.55,low),0,0];
    e.bg.r=[0,0,E.ba*e.s];e.bg.p=[0,FACE.rE*1.12+E.by,FACE.rE*.5];
    const pw=Math.max(.5,E.pup);e.pg.s=[pw,pw,1];
    e.nmO.r=[0,lerp(PI*.92*e.s,0,bl),0];e.nmIt.op=bl>.02?.62:0;
    const inv=M4.inv(e.eg.world);const lc=M4.pt(inv,cam.eye);let yw=Math.atan2(lc[0],lc[2]),pt=-Math.atan2(lc[1],Math.hypot(lc[0],lc[2]));
    if(lc[2]<0){yw=Math.sign(yw)*.3;pt=0}
    e.ig.r=[clamp(pt*.4+st.sacc[1],-.2,.2),clamp(yw*.4+st.sacc[0],-.25,.25),0]}
  FACE.tongue.visible=E.open>.2;
  sceneRoot.update(null);
  // ---- ground: feet plant on the snow whenever not airborne
  {if(!G0.init){G0.init=1;const gd=upload((()=>{const g=new Geo();for(const r of [1,.75,.5])g.merge(disc(r,20),M4.euler(-PI/2,0,0));return g})());
     G0.blobs=['ftL','ftR'].map(()=>{const n=sceneRoot.add(new Node());return {n,it:addItem(gd,n,{color:[0,0,0],emis:[0,0,0],op:.16,trans:true,flat:0,cast:false,rough:1,spec:0,rim:0})}})}
   const pts=[];for(const n of ['ftL','ftR'])for(const o of [[0,-.024,.065],[0,-.022,-.05],[0,-.018,0]])pts.push(M4.pt(B[n].world,o));
   let mn=9;for(const p of pts)mn=Math.min(mn,p[1]);
   const grounded=st.alt<.02&&!(A&&A.alt&&st.alt>.001);const want=grounded?-mn+.004:Math.max(0,-mn+.004);
   G0.d=lerp(G0.d||0,want,1-Math.exp(-dt*14));if(Math.abs(G0.d)>1e-5){B.root.p[1]+=G0.d;sceneRoot.update(null)}
   ['ftL','ftR'].forEach((n,i)=>{const p=M4.pt(B[n].world,[0,-.02,.02]);const h=Math.max(0,p[1]);const b=G0.blobs[i];const sc=.07*(1+h*3);b.n.p=[p[0],.004,p[2]];b.n.s=[sc,1,sc];b.it.op=.18*Math.max(0,1-h*5)})}
  // ---- prey
  {const show=(st.w.tear>.35&&!A)||(st.act==='attack'&&st.actT>2.8);preyN.visible=show;if(show){const f=worldOf(B.ftL,[0,-.02,.03]);preyN.p=[f[0],.03,f[2]];preyN.r=[0,st.head+1.3,PI/2*0+.15]}}
  // ---- effects
  const fw=forward();
  if(A&&A.fx)A.fx(st.actT,fw);
  if(st.w.fly>.5&&st.alt<1.2&&st.alt>.02){st.fx.td=(st.fx.td||0)-dt;if(st.fx.td<0){st.fx.td=.12;const p=st.pos;for(let i=0;i<3;i++){const a=rnd()*TAU;spawn('puff',[p[0]+Math.cos(a)*.4,.05,p[2]+Math.sin(a)*.4],[Math.cos(a)*1.4,.25,Math.sin(a)*1.4],rr(.03,.06),.8,0xeef2f6)}}}
  if(st.w.sleep>.8){st.fx.z=(st.fx.z||0)-dt;if(st.fx.z<0){st.fx.z=1.1;const p=worldOf(B.head,[0,.15,.05]);spawn('z',p,[.08,.22,0],.04,2.6,0x5f7fb8)}}
  if(st.w.preen>.6&&rnd()<dt*.25){const p=worldOf(B.head,[0,0,.12]);spawn('feather',p,[rr(-.3,.3),.3,rr(-.3,.3)],.035,3,SP.scap)}
  {const tg=[0,-0.004,0];comb=vadd(comb,vsc(vsub(tg,comb),1-Math.exp(-dt*6)))}
  updSnow(dt,t);updParticles(dt);st.shake=Math.max(0,st.shake-dt);
  // ---- camera follows the bird up into the sky
  const bp=worldOf(B.chest);const tgt=[bp[0],bp[1]+.05,bp[2]];
  if(window.__camT)cam.target=window.__camT;else cam.target=vadd(cam.target,vsc(vsub(tgt,cam.target),1-Math.exp(-dt*3.5)));
  const dd=cam.d*(1+1.1*sstep(.05,1.5,st.alt));const sp=Math.sin(cam.ph);cam.eye=vadd(cam.target,[dd*sp*Math.sin(cam.th),dd*Math.cos(cam.ph),dd*sp*Math.cos(cam.th)]);
  {const gh=terrainH(cam.eye[0],cam.eye[2])+.12;if(cam.eye[1]<gh)cam.eye[1]=gh}
}

''')

# ------------------------------------------------------------------ shader: eagle skin & feather cards
a=s.index("   if(uCoatK>-.5){vec3 cc=mix(uCoatA,uCoatB,vC.g);");E_="base=cc*vC.r*(.94+.12*m2);}";b=s.index(E_,a)+len(E_)
s=s[:a]+r"""   float hd=vC.g;hd=mix(hd,hd*smoothstep(.5,.565,vR.y)*smoothstep(.37,.29,vR.z),uSp.z);
   float under=smoothstep(.43,.35,vR.y)*(1.-hd);
   float band=smoothstep(.07,.13,vR.z)*smoothstep(.33,.40,vR.y)*(1.-hd)*step(vR.y,.5);
   float thigh=smoothstep(.32,.27,vR.y)*step(abs(vR.x),.15);
   vec3 cc=uCoatA;cc=mix(cc,uBelly,under*uSp.x);cc=mix(cc,uBand,band*uSp.y);
   vec3 th=uThigh;if(uSp.w>1.5)th=mix(th,uCoatA*1.6,.75*smoothstep(.72,.8,fract(vR.y*62.+vR.z*10.))*smoothstep(.95,.87,fract(vR.y*62.+vR.z*10.)));
   cc=mix(cc,th,thigh*min(uSp.w,1.));cc=mix(cc,uCoatB,hd);
   float fwv=worley(vec3(vR.x*30.,vR.y*30.,vR.z*21.));cc*=.8+.28*smoothstep(.1,.5,fwv);
   float horn=smoothstep(.8,.95,vC.b),flesh=smoothstep(.3,.55,vC.b)*(1.-horn);
   vec3 fl=uFlesh*(.82+.18*smoothstep(.15,.45,abs(fract(vR.y*95.+abs(vR.x)*30.)-.5)*2.));
   cc=mix(cc,fl,flesh);cc=mix(cc,uHorn*(.9+.12*m2),horn);spM=1.+horn*4.+flesh*1.2;
   base=cc*vC.r*(.94+.12*m2);"""+s[b:]
sub("uniform vec3 uCoatA,uCoatB;uniform float uCoatK,uSocks;","uniform vec3 uCoatA,uCoatB,uBelly,uBand,uThigh,uHorn,uFlesh,uFBC;uniform vec4 uSp;uniform vec2 uFB;")
sub("vec3 base=uColor*vC;float sheen=0.;","vec3 base=uColor*vC;float sheen=0.;float spM=1.;")
sub(" float sh=shadow(vW,N);"," if(uSkinD<-.5){base*=.86+.26*vn(vR*vec3(380.));if(uFB.y>0.)base=mix(base,uFBC*(.9+.2*vn(vR*90.)),uFB.y*smoothstep(.45,.6,fract(vH*uFB.x+.15))*step(.08,vH));}\n float sh=shadow(vW,N);")
sub("float sp=pow(max(dot(N,H),0.),gloss)*(1.-uRough)*uSpec;","float sp=pow(max(dot(N,H),0.),gloss*(1.+spM*.6))*(1.-uRough)*uSpec*spM;")
sub("gl.uniform1f(U.uFogN,26);gl.uniform1f(U.uFogF,70);gl.uniform3fv(U.uCoatA,COAT.A);gl.uniform3fv(U.uCoatB,COAT.B);gl.uniform1f(U.uCoatK,COAT.K);gl.uniform1f(U.uSocks,COAT.S);",
    "gl.uniform1f(U.uFogN,24);gl.uniform1f(U.uFogF,75);gl.uniform3fv(U.uCoatA,COAT.A);gl.uniform3fv(U.uCoatB,COAT.B);gl.uniform3fv(U.uBelly,COAT.Be);gl.uniform3fv(U.uBand,COAT.Ba);gl.uniform3fv(U.uThigh,COAT.Th);gl.uniform3fv(U.uHorn,COAT.Ho);gl.uniform3fv(U.uFlesh,COAT.Fl);gl.uniform4fv(U.uSp,COAT.Sp);")
sub("gl.uniform2fv(U.uMW,it.mw);gl.uniform1f(U.uFlare,it.flare||0);","gl.uniform2fv(U.uMW,it.mw);gl.uniform1f(U.uFlare,it.flare||0);if(!shadowPass){gl.uniform2fv(U.uFB,it.fb||[0,0]);gl.uniform3fv(U.uFBC,it.fbc||[0,0,0])}")
sub("const c=st.pos;const lp=vadd(c,vsc(SUN,14));const lv=M4.view(lp,c);const lpj=M4.ortho(-4.2,4.2,-4.2,4.2,1,32);",
    "const c=worldOf(B.chest);const lp=vadd(c,vsc(SUN,14));const lv=M4.view(lp,c);const lpj=M4.ortho(-2.6,2.6,-2.6,2.6,1,34);")
sub("M4.persp(0.72,W/H,.05,200)","M4.persp(0.72,W/H,.03,200)")
sub("const SHELLS=8,HAIR_LEN=0.014;","const SHELLS=7,HAIR_LEN=0.0095;")
sub("const pig=buildPig();buildManeTail();pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.6,rim:.35,spec:.25,skinD:1});",
    "const pig=buildPig();pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.66,rim:.35,spec:.22,skinD:1});")
sub("buildFace();const env=buildEnv();initParticles();","buildFace();buildFeathers();const env=buildEnv();initParticles();")
sub("one sleek skin · flowing mane & tail · 21 bones · drag to orbit","one skin · 260 feather cards · 22 bones · drag to orbit")
sub("<title>Low-Poly Menagerie · 11 Horse</title>","<title>Low-Poly Menagerie · 13 Eagle</title>")
sub("11 / 20 · LOW-POLY MENAGERIE</span><h1>Horse</h1>","13 / 20 · LOW-POLY MENAGERIE</span><h1>Eagle</h1>")
sub("Saddling up…","Preening the flight feathers…")
s=s.replace("background:#d9e4ea","background:#dfe7ee")
open('/home/claude/eagle/index.html','w').write(s);print('ok',len(s))
