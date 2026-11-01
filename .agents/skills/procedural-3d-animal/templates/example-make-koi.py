import re
s=open('/home/claude/axolotl/index.html').read()
def rep(a_mark,b_mark,new):
    global s
    a=s.index(a_mark); b=s.index(b_mark,a); s=s[:a]+new+s[b:]
def sub(old,new):
    global s
    assert old in s, old[:70]; s=s.replace(old,new)
Y0=0.45
rep("// ===== AXOLOTL SCULPT =====","function grad(",r'''// ===== KOI SCULPT =====
const KY=0.45;
function earLocal(){return [9,9,9]}function sdEar(){return 9}
function sdLegF(){return 9}function sdLegB(){return 9}
function sdSnout(x,y,z){return sdEll(x,y,z,0,KY-0.012,0.38,0.05,0.045,0.04)}
const TAILP=[[0,KY,-0.1],[0,KY,-0.2],[0,KY,-0.29],[0,KY,-0.37],[0,KY,-0.44],[0,KY,-0.5]],TAILR=[0.08,0.065,0.048,0.034,0.026,0.022];
function sdTail(x,y,z){let d=9;for(let i=0;i<5;i++)d=smin(d,sdEll(x*1.6,y,z,0,0,0,9,9,9),0);
  return smin(sdEll(x,y,z,0,KY,-0.18,0.07,0.085,0.16),sdCone(x*1.5,y,z,0,KY,-0.2,0,KY,-0.44,0.07,0.028),0.05)/1.2}
function pigSDF(x,y,z){
  let d=sdEll(x,y,z,0,KY+0.01,0.04,0.098,0.12,0.26);            // deep body
  d=smin(d,sdEll(x,y,z,0,KY+0.035,0.0,0.07,0.1,0.2),0.06);       // back hump
  d=smin(d,sdEll(x,y,z,0,KY,0.24,0.088,0.095,0.14),0.06);        // head
  d=smin(d,sdSnout(x,y,z),0.04);
  d=smin(d,sdTail(x,y,z),0.06);
  return d}
''')
rep("// ---------- rig ----------","const COL={",r'''// ---------- rig ----------
const BN=['root','hips','spine','chest','neck','head','earL','earR','flU','flL','frU','frL','blU','blL','brU','brL','t0','t1','t2','t3','t4'];
const REST={root:[0,0,0],hips:[0,KY,-0.06],spine:[0,KY,0.04],chest:[0,KY,0.13],neck:[0,KY,0.2],head:[0,KY,0.26],earL:[0.05,KY+0.05,0.25],earR:[-0.05,KY+0.05,0.25],
  flU:[0.05,KY-0.06,0.15],flL:[0.06,KY-0.08,0.13],frU:[-0.05,KY-0.06,0.15],frL:[-0.06,KY-0.08,0.13],blU:[0.04,KY-0.08,-0.04],blL:[0.05,KY-0.1,-0.06],brU:[-0.04,KY-0.08,-0.04],brL:[-0.05,KY-0.1,-0.06],
  t0:TAILP[0],t1:TAILP[1],t2:TAILP[2],t3:TAILP[3],t4:TAILP[4]};
const PARENT={hips:'root',spine:'hips',chest:'spine',neck:'chest',head:'neck',earL:'head',earR:'head',flU:'chest',flL:'flU',frU:'chest',frL:'frU',
  blU:'hips',blL:'blU',brU:'hips',brL:'brU',t0:'hips',t1:'t0',t2:'t1',t3:'t2',t4:'t3'};
const SEG={hips:[[0,KY,-0.12],[0,KY,0.04]],spine:[REST.spine,REST.chest],chest:[REST.chest,REST.neck],neck:[REST.neck,REST.head],head:[REST.head,[0,KY,0.44]]};
for(let i=0;i<5;i++)SEG['t'+i]=[TAILP[i],TAILP[i+1]];
function segDist(p,a,b){const ab=vsub(b,a),l=vdot(ab,ab)||1e-9,t=clamp(vdot(vsub(p,a),ab)/l,0,1);return vlen(vsub(p,vadd(a,vsc(ab,t))))}
function pigWeights(p){const W=[];const push=(name,d,pw=4)=>W.push([BN.indexOf(name),1/Math.pow(d+0.01,pw)]);
  for(const n of ['hips','spine','chest','neck','head'])push(n,segDist(p,...SEG[n])+0.02,5);
  if(p[2]<-0.08)for(let i=0;i<5;i++)push('t'+i,segDist(p,...SEG['t'+i])+0.004,5);
  W.sort((a,b)=>b[1]-a[1]);const top=W.slice(0,4);while(top.length<4)top.push([0,0]);const s=top.reduce((a,b)=>a+b[1],0);
  return [top.map(w=>w[0]),top.map(w=>w[1]/s)]}

''')
rep("const COL={","/* =====================================================================\n   Scene",r'''const COL={skin:0xfbf8f2,red:0xe8481c,black:0x141414,fin:0xfdfaf4,lip:0xf0a080};
function mixc(a,b,t){return a.map((v,i)=>lerp(v,b[i],t))}
function pigVertex(p){return [hex(COL.skin),0.1]}
function buildPig(){
  const f=pigSDF;const sn=surfaceNets(f,[-0.13,KY-0.15,-0.56],[0.13,KY+0.18,0.44],0.0115);
  relax(f,sn.pos,sn.idx,3);orient(f,sn.pos,sn.idx);
  const pos=sn.pos,idx=sn.idx,N=pos.length/3,nor=[],col=[],si=[],sw=[],hair=[];
  for(let i=0;i<N;i++){const p=[pos[i*3],pos[i*3+1],pos[i*3+2]];nor.push(...vnorm(grad(f,...p)));
    const [c,hr]=pigVertex(p);col.push(...c);hair.push(hr);const [I,W]=pigWeights(p);si.push(...I);sw.push(...W)}
  const g=new Geo();g.pos=pos;g.nor=nor;g.col=col;g.idx=idx;
  const wg=new Geo();wg.pos=pos;wg.nor=nor;wg.col=col;for(let t=0;t<idx.length;t+=3)wg.idx.push(idx[t],idx[t+1],idx[t+1],idx[t+2],idx[t+2],idx[t]);
  return {geo:upload(g,{si,sw,m1:pos,hair}),wire:upload(wg,{si,sw,m1:pos,hair}),tris:idx.length/3}}
let scaleItem;
// fins: flowing translucent membranes with darker rays, skinned to the body
function finMesh(A,root,tip,nu,nv,colFn){const base=A.pos.length/3;
  for(let i=0;i<=nu;i++){const u=i/nu;const r0=root(u),r1=tip(u);
    for(let j=0;j<=nv;j++){const v=j/nv;const p=vadd(vadd(r0,vsc(vsub(r1,r0),v)),[0,0,0]);const ray=Math.pow(Math.abs(Math.sin(u*nu*PI*0.5)),8);
      const W=pigWeights(r0);const Wt=pigWeights(p);const w=v<0.3?W:Wt;
      A.v(p,[1,0,0],colFn(u,v,ray),w)}}
  for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=base+i*(nv+1)+j,b=a+nv+1;A.idx.push(a,b,a+1,b,b+1,a+1)}}
function buildFins(){const A=new Acc2();
  const fc=(u,v,ray)=>{const c=mixc(hex(COL.fin),hex(0xf3c9a8),0.25*v);return c.map(x=>x*(1-0.18*ray))};
  // caudal (tail) fin: two flowing lobes with a notch
  finMesh(A,u=>[0,KY+(u-0.5)*0.05,-0.44],u=>{const a=Math.abs(u*2-1);return [0,KY+(u-0.5)*0.34,-0.6-0.08*a+0.02*Math.sin(u*TAU*3)]},24,10,(u,v,ray)=>fc(u,v,ray).map((x,i)=>i==0?x:x*(1-0.06*v)));
  // dorsal fin along the back
  {const F=u=>{const z=lerp(0.1,-0.24,u);const p=marchOut([0,KY,z],[0,1,0]);return vsub(p,[0,0.008,0])};finMesh(A,F,u=>{const p=F(u);return vadd(p,[0,0.075*Math.sin(PI*Math.min(1,u*1.15+0.05))+0.008,-0.05])},20,6,fc)}
  // anal fin + pelvic fins underneath
  {const F=u=>{const z=lerp(-0.12,-0.26,u);const p=marchOut([0,KY,z],[0,-1,0]);return vadd(p,[0,0.006,0])};finMesh(A,F,u=>vadd(F(u),[0,-0.05*Math.sin(PI*u),-0.03]),10,5,fc)}
  for(const sx of [1,-1]){const F=u=>{const z=lerp(0.02,-0.04,u);const p=marchOut([0,KY-0.04,z],vnorm([sx*0.5,-1,0]));return vadd(p,[0,0.005,0])};finMesh(A,F,u=>vadd(F(u),[sx*0.035,-0.05*Math.sin(PI*u),-0.04]),8,5,fc)}
  const g=new Geo();g.pos=A.pos;g.nor=A.nor;g.col=A.col;g.idx=A.idx;
  addItem(upload(g,{si:A.si,sw:A.sw,m1:A.pos}),null,{skin:true,flat:0,rough:.35,spec:.8,rim:.5,trans:true,op:.82,cast:false,sss:1.0})}
class Acc2{constructor(){this.pos=[];this.nor=[];this.col=[];this.si=[];this.sw=[];this.idx=[]}
  v(p,n,c,w){this.pos.push(...p);this.nor.push(...n);this.col.push(...c);this.si.push(...w[0]);this.sw.push(...w[1]);return this.pos.length/3-1}}

''')
rep("function buildFace(){","function eH(p)",r'''function buildFace(){
  const H=B.head,rE=0.019;const skC=hex(COL.skin);
  const gEye=upload(sphere(rE,24,16)),gIris=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.004,28,10,0,TAU,0,1.0),M4.euler(PI/2,0,0));return g})());
  const gPup=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.03,24,8,0,TAU,0,0.6),M4.euler(PI/2,0,0));return g})());
  const gRing=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.012,28,4,0,TAU,0.95,0.09),M4.euler(PI/2,0,0));return g})());
  const gHi=upload(sphere(rE*.22,10,8)),gHi2=upload(sphere(rE*.1,8,6));
  const gLidU=upload(sphere(rE*1.14,28,10,0,TAU,0,PI/2)),gLidL=upload(sphere(rE*1.12,28,10,0,TAU,PI/2,PI/2));
  const gBrow=upload(tube([[-rE*.7,-rE*.1,0],[-rE*.22,rE*.07,0],[rE*.22,rE*.07,0],[rE*.7,-rE*.1,0]],12,u=>0.003+0.003*Math.sin(u*PI),6));
  FACE.eyes=[];
  for(const s of [1,-1]){
    const dir=vnorm([0.82*s,0.3,0.48]);const S=marchOut([0,KY+0.01,0.27],dir);const c=vsub(S,vsc(dir,rE*0.55));
    const eg=H.add(new Node(headLocal(c)));eg.rm=M4.basis(vnorm([0.7*s,0.1,0.7]));
    addItem(gEye,eg,{color:hex(0xf4eadb),flat:0,rough:.1,spec:1.4,rim:.05,cast:false});
    const ig=eg.add(new Node());addItem(gIris,ig,{color:hex(0xd8a23c),flat:0,rough:.1,spec:1.4,cast:false});
    addItem(gRing,ig,{color:hex(0x7a4a14),flat:0,rough:.3,spec:.8,cast:false});
    const pg=ig.add(new Node());addItem(gPup,pg,{color:hex(0x030203),flat:0,rough:.1,spec:1.2,cast:false});
    const h1=eg.add(new Node(vsc(vnorm([-0.36,0.40,0.84]),rE*.95)));addItem(gHi,h1,{color:[0,0,0],emis:[1.6,1.6,1.6],flat:0,cast:false});
    const h2=eg.add(new Node(vsc(vnorm([0.30,-0.28,0.91]),rE*1.0)));addItem(gHi2,h2,{color:[0,0,0],emis:[1.1,1.1,1.1],flat:0,cast:false});
    const lu=eg.add(new Node());addItem(gLidU,lu,{color:skC,flat:0,rough:.3,spec:1,cast:false,rim:.3});
    const ll=eg.add(new Node());addItem(gLidL,ll,{color:skC.map(v=>v*.97),flat:0,rough:.3,spec:1,cast:false});
    const bg=eg.add(new Node([0,rE*1.3,rE*0.62]));addItem(gBrow,bg,{color:hex(0xc9a080),flat:0,rough:.5,cast:false});
    FACE.eyes.push({s,eg,ig,pg,lu,ll,bg})}
  FACE.rE=rE;
  const gNos=upload(sphere(1,14,10));FACE.nos=[];
  for(const s of [1,-1]){const p=marchIn([0.018*s,KY+0.02,0.8],[0,0,-1]);const nn=H.add(new Node(headLocal(p)));nn.rm=M4.basis(nrm(p));nn.base=[0.004,0.003,0.003];nn.s=[...nn.base];
    addItem(gNos,nn,{color:hex(0x5a3020),flat:0,rough:.5,cast:false});FACE.nos.push(nn)}
  // round koi mouth: lips ring + dark opening
  const mc=marchIn([0,KY-0.012,0.8],[0,0,-1]);
  const mouthPts=k=>{const xs=[-0.026,-0.018,-0.009,0,0.009,0.018,0.026];return xs.map(x0=>{const u=Math.abs(x0)/0.026,x=k==='f'?x0*.9:x0;
    const y=k==='n'?KY-0.028+u*u*0.006:k==='s'?KY-0.031+u*u*0.014:KY-0.026-u*u*0.008;const p=marchIn([x,y,0.8],[0,0,-1]);return vadd(p,vsc(nrm(p),0.002))})};
  const [mn,ms,mf]=['n','s','f'].map(k=>tube(mouthPts(k),18,u=>0.003*(0.55+0.45*Math.sin(u*PI)),6,true));
  const mNode=H.add(new Node(vsc(REST.head,-1)));FACE.mouth=addItem(upload(mn,{m1:ms.pos,m2:mf.pos}),mNode,{color:hex(0xc87a68),flat:0,rough:.4,cast:false});
  const mo=H.add(new Node(headLocal(vadd(mc,[0,0,-0.004]))));mo.rm=M4.basis([0,0,1]);mo.s=[0.02,0.001,0.012];
  FACE.open=mo;FACE.openS=[0.018,0.017,0.012];addItem(gNos,mo,{color:hex(0x4a1820),flat:0,rough:.6,cast:false});
  const lips=H.add(new Node(headLocal(vadd(mc,[0,0,0.002]))));lips.r=[PI/2,0,0];addItem(upload(torus(0.016,0.0045,8,24)),lips,{color:hex(COL.lip),flat:0,rough:.35,spec:.8,cast:false});FACE.lips=lips;
  // barbels (whiskers) at the mouth corners
  const bb=new Geo();for(const s of [1,-1]){const a=vadd(mc,[0.017*s,0.004,-0.01]);bb.merge(tube([a,vadd(a,[0.012*s,-0.012,0.006]),vadd(a,[0.022*s,-0.03,-0.004])],8,u=>lerp(0.0028,0.0009,u),5,true))}
  addItem(upload(bb),H.add(new Node(vsc(REST.head,-1))),{color:hex(0xf2c8a8),flat:0,rough:.4,spec:.6,cast:false});
  FACE.fangs=[];FACE.blush=[];
  // pectoral fins: rigid fans on the chest that flutter (reuses the gill flutter loop)
  FACE.gills=[];const pf=new Geo();const fan=new Geo();fan.pos.push(0,0,0);fan.nor.push(1,0,0);fan.col.push(1,1,1);
  for(let i=0;i<=12;i++){const a=-0.2+i/12*1.2;fan.pos.push(0,-Math.sin(a)*0.07,-Math.cos(a)*0.07);fan.nor.push(1,0,0);fan.col.push(...hex(0xfdf7ef).map(v=>v*(i%2?1:.86)))}
  for(let i=0;i<12;i++)fan.idx.push(0,i+1,i+2);const gFan=upload(fan);
  for(const s of [1,-1]){const p=marchOut([0,KY-0.04,0.13],vnorm([s,-0.6,0]));const n=B.chest.add(new Node(vsub(p,REST.chest)));n.rm=M4.basis(vnorm([0,0.2,1]));
    addItem(gFan,n,{color:[1,1,1],flat:0,rough:.35,spec:.6,rim:.4,trans:true,op:.8,cast:false,sss:1});FACE.gills.push({n,k:s>0?0:1,s,fin:1})}
}
''')
rep("const LL=0.12;","const EXPR={",r'''const LL=0.12;
function crouchB(P,d){P[RY]-=d}
const TB=['t0','t1','t2','t3','t4'],SP=['hips','spine','chest','neck','head'];
function wave(P,ph,amp,head=0.3){S(P,'chest',0,Math.sin(ph+1.2)*amp*0.25,0);S(P,'spine',0,Math.sin(ph+0.8)*amp*0.25,0);S(P,'hips',0,Math.sin(ph+0.3)*amp*0.35,0);
  TB.forEach((n,i)=>S(P,n,0,Math.sin(ph-0.5-i*0.75)*amp*(0.5+i*0.25),0));S(P,'head',0,-Math.sin(ph+1.2)*amp*head,0)}
function tailSway(P,t,sp,amp){wave(P,t*sp,amp)}function wag(){}
let BALL_DY=0,BALL_C=[0,KY,0],BALL_R=0.1;
const POSES={
  idle(t,L){const P=P0();wave(P,t*1.6,0.18);P[RY]=Math.sin(t*0.9)*0.02;S(P,'hips',Math.sin(t*0.7)*0.04,0,0);S(P,'head',0,L.yaw*.25,0);return P},
  walk(t,L,ph){const P=P0();wave(P,ph,0.38);P[RY]=Math.sin(t*0.7)*0.03;return P},
  run(t,L,ph){const P=P0();wave(P,ph,0.6,0.15);P[RY]=0.05+Math.sin(t*0.6)*0.05;S(P,'hips',-0.04,0,0);return P},
  eat(t,L){const P=P0();P[RY]=-0.3;S(P,'hips',0.45,0,0);wave(P,t*2,0.15);S(P,'head',0.12+Math.sin(t*5)*0.04,Math.sin(t*0.8)*0.2,0);return P},
  bend(t,L){const P=P0(),a=0.75+0.25*Math.sin(t*1.3);for(const n of SP)S(P,n,0,0.32*a,0);TB.forEach((n,i)=>S(P,n,0,0.42*a,0));return P},
  happy(t,L){const P=P0();wave(P,t*7,0.45);P[RY]=0.12+Math.abs(Math.sin(t*3))*0.12;S(P,'hips',0,0,Math.sin(t*3)*0.5);return P},
  sleep(t,L){const P=P0();P[RY]=-0.36;S(P,'hips',0.02,0,0.12);wave(P,t*0.6,0.05);return P},
};
const ACTIONS={
  attack:{dur:1.4,pose(t,L){const P=P0();if(t<.45){const k=sstep(0,.4,t);for(const n of SP)S(P,n,0,-0.2*k,0);TB.forEach(n=>S(P,n,0,-0.3*k,0))}
      else{const u=(t-.45)/.95;wave(P,u*25,0.5*(1-u))}return P},speed:t=>t>.45&&t<.85?2.4*Math.sin((t-.45)/.4*PI):0,face:t=>t<.45?'angry':t<.9?'roar':'content',mouth:t=>t>.4&&t<.9?1:0.1,
    fx(at,fw){if(at>.75&&!st.fx.b){st.fx.b=1;const p=worldOf(FACE.open);for(let i=0;i<8;i++)spawn('bubble',vadd(p,[rr(-.03,.03),0.02,rr(-.03,.03)]),[rr(-.12,.12),rr(.3,.6),rr(-.12,.12)],rr(.006,.014),rr(2,4),0xeefcff)}}},
  jump:{dur:2.4,pose(t,L){const P=P0();const u=sstep(0,2.4,t);P[RY]=Math.sin(u*PI)*1.6;S(P,'hips',-1.1*Math.cos(u*PI)*Math.sin(Math.min(1,u*1.3)*PI*0.5+0.0)*0.8,0,0);wave(P,t*14,0.4);return P},
    speed:t=>1.0*Math.sin(Math.min(1,t/2.4)*PI),face:t=>t<.3?'surprised':'excited',
    fx(at){st.fx.land=1;const c=Math.floor(at/.12);if(c!==st.fx.c){st.fx.c=c;const p=worldOf(B.t3);spawn('bubble',p,[0,rr(.2,.4),0],rr(.005,.011),2.5,0xeefcff)}}},
  shake:{dur:1.4,pose(t,L){const P=P0(),e=Math.pow(Math.sin(PI*t/1.4),.6);wave(P,t*26,0.4*e);S(P,'hips',0,0,Math.sin(t*26)*0.2*e);return P},speed:()=>0,face:()=>'squint',
    fx(at){st.fx.land=1;if(at>.3&&at<1.1&&rnd()<.2){const p=worldOf(B.chest);spawn('bubble',vadd(p,[rr(-.06,.06),.03,rr(-.06,.06)]),[rr(-.2,.2),rr(.3,.5),rr(-.2,.2)],rr(.005,.012),2.5,0xeefcff)}}},
};
''')
# koi skin: kohaku/sanke pattern + crescent scales + metallic sheen (body only: skinD 2)
sub(" float sh=shadow(vW,N);",""" if(uSkinD>1.5){base=uColor*vC;vec3 q=vR-vec3(0.,.45,0.);
   float red=smoothstep(.42,.47,fbm(q*vec3(6.,4.,3.5)+vec3(3.,1.,2.)))*smoothstep(-.05,-.01,q.y)*smoothstep(-.44,-.32,q.z);
   red=max(red,smoothstep(.06,.03,length((q-vec3(0.,.07,.27))*vec3(1.,1.4,.9))));
   float blk=smoothstep(.6,.63,fbm(q*11.+vec3(7.,5.,1.)))*smoothstep(-.02,.02,q.y)*(1.-smoothstep(.2,.26,q.z));
   base=mix(base,vec3(1.,.2,.04)*1.1,red);base=mix(base,vec3(.03,.03,.035),blk);
   float zc=q.z*62.,yc=q.y*62.+floor(zc)*.5;vec2 f2=vec2(fract(zc),fract(yc))-vec2(.15,.5);float sc=smoothstep(.36,.5,length(f2*vec2(1.,1.25)));
   base*=1.-.14*sc*smoothstep(.26,.18,q.z);base+=vec3(.05,.045,.03)*(1.-sc)*smoothstep(-.04,.0,q.y);}
 float sh=shadow(vW,N);""")
sub("pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.2,rim:.3,spec:1.3,skinD:1,sss:.9,late:true});buildFins();","pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.18,rim:.35,spec:1.6,skinD:2,sss:.18});buildFins();")
# pectoral flutter: fins rotate about the body axis
sub("if(FACE.gills){const fl=.07+.1*st.w.run+.12*st.w.happy;for(const g of FACE.gills){g.n.r=[Math.sin(t*2.4+g.k*1.3+g.s)*fl+st.w.run*.3,Math.sin(t*2.9+g.k*.8)*fl*.6,0];const sc=1+.14*st.w.happy;g.n.s=[sc,sc,sc]}}",
    "if(FACE.gills){const fl=.25+.2*st.w.happy-.15*st.w.run;for(const g of FACE.gills){g.n.r=[0,0,g.s*(0.35+Math.sin(t*4.2+g.k*1.6)*fl+st.w.run*0.5)]}}")
sub("if(st.loop==='eat'&&!st.act){","if(st.loop==='eat'&&!st.act&&false){")
s=re.sub(r"const ACTS=\[[^;]*\];","const ACTS=[['idle','Hover'],['walk','Glide'],['run','Swim fast'],['attack','Gulp'],['jump','Leap'],['eat','Forage'],['bend','Turn'],['happy','Happy'],['shake','Shimmy'],['sleep','Rest']];",s)
s=re.sub(r"const LOOP_FACE=\{[^}]*\};","const LOOP_FACE={idle:'content',walk:'neutral',run:'excited',eat:'content',bend:'happy',happy:'excited',sleep:'asleep'};",s)
sub("const tgtSpd=(st.loop==='walk'?.28:st.loop==='run'?1.1:0)*(1-aw);","const tgtSpd=(st.loop==='walk'?.32:st.loop==='run'?1.1:st.loop==='idle'?0.04:0)*(1-aw);")
sub("st.walkPh+=dt*st.speed/0.28*TAU*.8;st.runPh+=dt*Math.max(st.speed,.4)/1.1*TAU*1.3;","st.walkPh+=dt*Math.max(st.speed,.1)/0.32*TAU*.75;st.runPh+=dt*Math.max(st.speed,.4)/1.1*TAU*1.6;")
sub("0.2+pose[RY]*.8","0.45+pose[RY]*.8");sub("target:[0,0.2,0]","target:[0,0.45,0]")
sub("one wet skin · feathery gills · 21 bones · drag to orbit","one skin · kohaku scales · flowing fins · drag to orbit")
sub("<title>Low-Poly Menagerie · 05 Axolotl</title>","<title>Low-Poly Menagerie · 09 Koi</title>")
sub("05 / 20 · LOW-POLY MENAGERIE</span><h1>Axolotl</h1>","09 / 20 · LOW-POLY MENAGERIE</span><h1>Koi</h1>")
sub("Filling the pond…","Filling the koi pond…")
open('index.html','w').write(s);print('ok')
