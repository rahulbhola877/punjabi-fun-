import re,sys
s=open('/home/claude/horse/index.html').read()
def rep(a_mark,b_mark,new):
    global s
    a=s.index(a_mark); b=s.index(b_mark,a); s=s[:a]+new+s[b:]
def sub(old,new):
    global s
    assert old in s, old[:70]; s=s.replace(old,new)
rep("// ===== HORSE SCULPT =====","function grad(",r'''// ===== RABBIT SCULPT =====
const EAR_C=[0.042,0.5,0.155], EAR_M=M4.inv(M4.trs(EAR_C,null,[-0.2,0.15,-0.12],[1,1,1]));
function earLocal(x,y,z){return M4.pt(EAR_M,[x,y,z])}
function sdEar(ax,y,z){const q=earLocal(ax,y,z);const tp=1+0.5*Math.max(0,q[1]+0.03)/0.1;return sdEll(q[0]*tp,q[1],q[2]+q[0]*q[0]*14,0,0,0,0.036,0.115,0.012)}
function sdLegF(ax,y,z){const d=sdCone(ax,y,z,0.058,0.15,0.14,0.06,0.025,0.185,0.03,0.02);return smin(d,sdEll(ax,y,z,0.06,0.016,0.198,0.024,0.016,0.032),0.02)}
function sdLegB(ax,y,z){let d=sdEll(ax,y,z,0.095,0.14,-0.1,0.07,0.1,0.115);d=smin(d,sdCone(ax,y,z,0.095,0.09,-0.15,0.09,0.03,-0.13,0.04,0.028),0.04);return smin(d,sdEll(ax,y,z,0.088,0.018,-0.05,0.032,0.019,0.095),0.03)}
function sdSnout(x,y,z){return sdEll(x,y,z,0,0.302,0.285,0.042,0.036,0.034)}
const TAILP=[[0,0.2,-0.22],[0,0.21,-0.245],[0,0.215,-0.26],[0,0.22,-0.27],[0,0.222,-0.275],[0,0.224,-0.28]],TAILR=[0.03,0.03,0.03,0.03,0.03,0.03];
function sdTail(x,y,z){return sdEll(x,y,z,0,0.215,-0.25,0.042,0.042,0.038)}
function pigSDF(x,y,z){const ax=Math.abs(x);
  let d=sdEll(x,y,z,0,0.19,-0.07,0.15,0.15,0.17);
  d=smin(d,sdEll(x,y,z,0,0.19,0.08,0.11,0.13,0.12),0.08);
  d=smin(d,smin(sdEll(x,y,z,0,0.33,0.2,0.09,0.085,0.095),sdEll(x,y,z,0,0.3,0.235,0.088,0.064,0.075),0.04),0.06);
  d=smin(d,sdSnout(x,y,z),0.03);
  d=smin(d,sdEar(ax,y,z),0.016);
  d=smin(d,sdLegF(ax,y,z),0.035);
  d=smin(d,sdLegB(ax,y,z),0.05);
  d=smin(d,sdTail(x,y,z),0.03);
  return Math.max(d,-(y-0.003));
}
''')
rep("// ---------- rig ----------","function tailW(p)",r'''// ---------- rig ----------
const BN=['root','hips','spine','chest','neck','head','earL','earR','flU','flL','frU','frL','blU','blL','brU','brL','t0','t1','t2','t3','t4'];
const REST={root:[0,0,0],hips:[0,0.19,-0.08],spine:[0,0.2,0.02],chest:[0,0.21,0.1],neck:[0,0.26,0.14],head:[0,0.32,0.18],
  earL:[0.035,0.4,0.165],earR:[-0.035,0.4,0.165],flU:[0.058,0.15,0.14],flL:[0.059,0.08,0.16],frU:[-0.058,0.15,0.14],frL:[-0.059,0.08,0.16],
  blU:[0.095,0.15,-0.11],blL:[0.092,0.05,-0.14],brU:[-0.095,0.15,-0.11],brL:[-0.092,0.05,-0.14],t0:TAILP[0],t1:TAILP[1],t2:TAILP[2],t3:TAILP[3],t4:TAILP[4]};
const PARENT={hips:'root',spine:'hips',chest:'spine',neck:'chest',head:'neck',earL:'head',earR:'head',flU:'chest',flL:'flU',frU:'chest',frL:'frU',
  blU:'hips',blL:'blU',brU:'hips',brL:'brU',t0:'hips',t1:'t0',t2:'t1',t3:'t2',t4:'t3'};
const SEG={hips:[[0,0.19,-0.22],[0,0.2,0.02]],spine:[REST.spine,REST.chest],chest:[REST.chest,REST.neck],neck:[REST.neck,REST.head],head:[REST.head,[0,0.3,0.31]],
  earL:[REST.earL,[0.05,0.61,0.14]],earR:[REST.earR,[-0.05,0.61,0.14]],flU:[REST.flU,REST.flL],flL:[REST.flL,[0.06,0.01,0.21]],frU:[REST.frU,REST.frL],frL:[REST.frL,[-0.06,0.01,0.21]],
  blU:[REST.blU,REST.blL],blL:[REST.blL,[0.088,0.01,0.04]],brU:[REST.brU,REST.brL],brL:[REST.brL,[-0.088,0.01,0.04]]};
for(let i=0;i<5;i++)SEG['t'+i]=[TAILP[i],TAILP[i+1]];
function segDist(p,a,b){const ab=vsub(b,a),l=vdot(ab,ab)||1e-9,t=clamp(vdot(vsub(p,a),ab)/l,0,1);return vlen(vsub(p,vadd(a,vsc(ab,t))))}
function topW(W){W.sort((a,b)=>b[1]-a[1]);const top=W.slice(0,4);while(top.length<4)top.push([0,0]);const s=top.reduce((a,b)=>a+b[1],0);return [top.map(w=>w[0]),top.map(w=>w[1]/s)]}
function pigWeights(p){const ax=Math.abs(p[0]),side=p[0]>=0?'L':'R',fs=p[0]>=0?'fl':'fr',bs=p[0]>=0?'bl':'br';const W=[];
  const push=(name,d,pw=4)=>W.push([BN.indexOf(name),1/Math.pow(d+0.006,pw)]);
  for(const n of ['hips','spine','chest'])push(n,segDist(p,...SEG[n])+0.03,6);for(const n of ['neck','head'])push(n,segDist(p,...SEG[n]));
  if(sdEar(ax,p[1],p[2])<0.008&&p[1]>0.37){const e='ear'+side;W.length=0;push(e,0.001)}
  if(sdTail(p[0],p[1],p[2])<0.01)push('t0',segDist(p,...SEG.t0)*0.5);
  const lf=sdLegF(ax,p[1],p[2]);if(lf<0.012&&p[1]<0.14){push(fs+'U',segDist(p,...SEG[fs+'U']));push(fs+'L',segDist(p,...SEG[fs+'L']))}
  const lb=sdLegB(ax,p[1],p[2]);if(lb<0.015&&p[1]<0.17){const k=1+Math.max(0,p[1]-0.1)*14;push(bs+'U',segDist(p,...SEG[bs+'U'])*k);push(bs+'L',segDist(p,...SEG[bs+'L'])*k)}
  return topW(W)}
''')
rep("const COL={","/* =====================================================================\n   Scene",r'''const COL={skin:0xffffff,nose:0xd98a98};
function mixc(a,b,t){return a.map((v,i)=>lerp(v,b[i],t))}
// vertex colour = [shade, pointsMask (nose, ears, feet, tail), bellyMask]; hair >1.5 encodes the lionhead mane zone
function pigVertex(p){const [x,y,z]=p,ax=Math.abs(x);
  const ear=sdEar(ax,y,z)<0.01?1:0,nose=sstep(0.02,-0.01,sdSnout(x,y,z))*sstep(0.28,0.31,z),feet=sstep(0.035,0.02,y),tail=sdTail(x,y,z)<0.01?1:0;
  const el=earLocal(ax,y,z);const inner=ear*sstep(-0.002,0.006,el[2])*sstep(0.09,0.05,Math.abs(el[0]))*0.6;
  const belly=sstep(0.15,0.1,y)*sstep(0.07,0.03,ax)+sstep(0.3,0.27,y)*sstep(0.24,0.28,z)*sstep(0.05,0.02,ax)*0.8+tail*0.9;
  const mane=sstep(0.15,0.1,vlen(vsub(p,[0,0.32,0.17])))*sstep(0.27,0.23,z)*(1-ear)*(1-sstep(0.26,0.29,z));
  return [[1-inner*0.25,clamp(ear+nose+feet*0.8+tail*0.6,0,1),clamp(belly,0,1)],(1-nose*0.5)*(1-ear*0.45)+mane*2]}
function buildPig(){
  const f=pigSDF;const sn=surfaceNets(f,[-0.19,-0.02,-0.3],[0.19,0.66,0.34],0.0082);
  relax(f,sn.pos,sn.idx,3);orient(f,sn.pos,sn.idx);
  const pos=sn.pos,idx=sn.idx,N=pos.length/3,nor=[],col=[],si=[],sw=[],hair=[];
  for(let i=0;i<N;i++){const p=[pos[i*3],pos[i*3+1],pos[i*3+2]];nor.push(...vnorm(grad(f,...p)));
    const [c,hr]=pigVertex(p);col.push(...c);hair.push(hr);const [I,W]=pigWeights(p);si.push(...I);sw.push(...W)}
  const g=new Geo();g.pos=pos;g.nor=nor;g.col=col;g.idx=idx;
  const wg=new Geo();wg.pos=pos;wg.nor=nor;wg.col=col;for(let t=0;t<idx.length;t+=3)wg.idx.push(idx[t],idx[t+1],idx[t+1],idx[t+2],idx[t+2],idx[t]);
  window.__skin={pos,si,sw};return {geo:upload(g,{si,sw,m1:pos,hair}),wire:upload(wg,{si,sw,m1:pos,hair}),tris:idx.length/3}}
let scaleItem,maneItem;function buildManeTail(){}

''')
rep("function buildFace(){","function eH(p)",r'''function buildFace(){
  const H=B.head,rE=0.03;const skC=[0.6,0.5,0.45];
  const gEye=upload(sphere(rE,28,20)),gIris=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.004,32,10,0,TAU,0,1.2),M4.euler(PI/2,0,0));return g})());
  const gPup=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.03,28,8,0,TAU,0,0.62),M4.euler(PI/2,0,0));return g})());
  const gRing=upload((()=>{const g=new Geo();g.merge(sphere(rE*1.012,32,4,0,TAU,1.12,0.08),M4.euler(PI/2,0,0));return g})());
  const gHi=upload(sphere(rE*.22,12,8)),gHi2=upload(sphere(rE*.1,10,6));
  const gLidU=upload(sphere(rE*1.14,32,12,0,TAU,0,PI/2)),gLidL=upload(sphere(rE*1.12,32,12,0,TAU,PI/2,PI/2));
  const gLash=upload(torus(rE*1.14,rE*.07,6,40));
  const gBrow=upload(tube([[-rE*.7,-rE*.1,0],[-rE*.22,rE*.07,0],[rE*.22,rE*.07,0],[rE*.7,-rE*.1,0]],14,u=>0.003+0.003*Math.sin(u*PI),7));
  FACE.eyes=[];
  for(const s of [1,-1]){
    const dir=vnorm([0.78*s,0.32,0.55]);const S=marchOut([0,0.335,0.2],dir);const c=vsub(S,vsc(dir,rE*0.34));
    const eg=H.add(new Node(headLocal(c)));eg.rm=M4.basis(vnorm([0.55*s,0.08,0.82]));
    addItem(gEye,eg,{color:hex(0xf2ece2),flat:0,rough:.12,spec:1.3,rim:.05,cast:false});
    const ig=eg.add(new Node());addItem(gIris,ig,{color:hex(0x3a2214),flat:0,rough:.1,spec:1.4,cast:false});
    addItem(gRing,ig,{color:hex(0x140a06),flat:0,rough:.3,cast:false});
    const pg=ig.add(new Node());addItem(gPup,pg,{color:hex(0x040303),flat:0,rough:.1,spec:1.2,cast:false});
    const h1=eg.add(new Node(vsc(vnorm([-0.36,0.40,0.84]),rE*.95)));addItem(gHi,h1,{color:[0,0,0],emis:[1.6,1.6,1.6],flat:0,cast:false});
    const h2=eg.add(new Node(vsc(vnorm([0.30,-0.28,0.91]),rE*1.0)));addItem(gHi2,h2,{color:[0,0,0],emis:[1.1,1.1,1.1],flat:0,cast:false});
    const lu=eg.add(new Node());FACE.lidItems=(FACE.lidItems||[]);FACE.lidItems.push(addItem(gLidU,lu,{color:skC,flat:0,rough:.8,cast:false,rim:.25}));
    addItem(gLash,lu,{color:hex(0x1a1414),flat:0,rough:.6,cast:false});
    const ll=eg.add(new Node());FACE.lidItems.push(addItem(gLidL,ll,{color:skC,flat:0,rough:.8,cast:false}));
    const bg=eg.add(new Node([0,rE*1.3,rE*0.62]));addItem(gBrow,bg,{color:hex(0x5a4a44),flat:0,rough:.7,cast:false});
    FACE.eyes.push({s,eg,ig,pg,lu,ll,bg})}
  FACE.rE=rE;
  const gNos=upload(sphere(1,16,12));
  const np=marchIn([0,0.312,1],[0,0,-1]);
  {const n=nrm(np);const nn=H.add(new Node(headLocal(vadd(np,vsc(n,-0.003)))));nn.rm=M4.basis(n);nn.base=[0.013,0.009,0.007];nn.s=[...nn.base];
    addItem(gNos,nn,{color:hex(COL.nose),flat:0,rough:.3,spec:.9,cast:false});FACE.nos=[nn]}
  const q1=marchIn([0,0.3,1],[0,0,-1]),q2=marchIn([0,0.289,1],[0,0,-1]);
  const phN=H.add(new Node(vsc(REST.head,-1)));addItem(upload(tube([vadd(np,[0,-0.008,-0.002]),vadd(q1,vsc(nrm(q1),0.002)),vadd(q2,vsc(nrm(q2),0.002))],8,0.0016,5)),phN,{color:hex(0x6a4a48),flat:0,rough:.6,cast:false});
  const mouthPts=k=>{const xs=[-0.026,-0.018,-0.009,0,0.009,0.018,0.026];return xs.map(x0=>{const u=Math.abs(x0)/0.026,x=k==='f'?x0*.88:x0;
    const y=k==='n'?0.287+u*u*0.004+(1-u)*0:k==='s'?0.284+u*u*0.01:0.29-u*u*0.006;const p=marchIn([x,y,1],[0,0,-1]);return vadd(p,vsc(nrm(p),0.002))})};
  const [mn,ms,mf]=['n','s','f'].map(k=>tube(mouthPts(k),18,u=>0.0018*(0.55+0.45*Math.sin(u*PI)),5,true));
  const mNode=H.add(new Node(vsc(REST.head,-1)));
  FACE.mouth=addItem(upload(mn,{m1:ms.pos,m2:mf.pos}),mNode,{color:hex(0x6a4a48),flat:0,rough:.5,cast:false});
  const mc=marchIn([0,0.285,1],[0,0,-1]);const mo=H.add(new Node(headLocal(vadd(mc,[0,-0.003,-0.008]))));mo.rm=M4.basis(nrm(mc));mo.s=[0.014,0.001,0.008];
  FACE.open=mo;FACE.openS=[0.014,0.012,0.008];addItem(gNos,mo,{color:hex(0x3a1016),flat:0,rough:.6,cast:false});
  // buck teeth
  const gT=upload(box(1,1,1));FACE.teeth=[];for(const sx of [1,-1]){const tt=H.add(new Node(headLocal(vadd(mc,[0.0042*sx,-0.004,0.001]))));tt.s=[0.0075,0.009,0.003];addItem(gT,tt,{color:hex(0xfbf7ee),flat:0,rough:.3,spec:.8,cast:false});FACE.teeth.push(tt)}
  // whiskers
  const wk=new Geo();for(const s of [1,-1])for(let k=0;k<4;k++){const p=marchOut([0,0.3-k*0.004,0.27],vnorm([0.9*s,-0.1+k*0.04,0.4]));
    wk.merge(tube([vadd(p,[-0.002*s,0,0]),vadd(p,[0.04*s,0.006-k*0.006,0.005]),vadd(p,[0.08*s,-k*0.012,-0.01])],8,u=>lerp(0.0011,0.0003,u),4,false))}
  addItem(upload(wk),H.add(new Node(vsc(REST.head,-1))),{color:hex(0xf4f2ee),emis:[.12,.12,.12],flat:0,rough:.3,spec:.6,cast:false});
  FACE.fangs=[];FACE.blush=[];
}
''')
rep("const LL=1.0;","const EXPR={",r'''const LL=0.14;
function crouchB(P,d){P[RY]-=d}
const TB=['t0','t1','t2','t3','t4'];
function swish(P,t,sp,amp){S(P,'t0',0,Math.sin(t*sp)*amp,0)}function tailSway(P,t,sp,amp){swish(P,t,sp,amp)}function wag(P,t,sp,amp){swish(P,t,sp,amp)}
let BALL_DY=0,BALL_C=[0,0.15,0],BALL_R=0.15;
function hop(P,ph,h,reach){const s=Math.sin(ph),air=Math.max(0,s);P[RY]=air*h;
  S(P,'blU',-0.9*Math.max(0,-Math.cos(ph))*reach+0.5*air*reach,0,0);S(P,'blL',0.4*air*reach,0,0);   // hind push, then tuck
  S(P,'flU',-0.9*air*reach,0,0);S(P,'flL',0.6*(1-air)*reach,0,0);   // front reach
  S(P,'hips',-0.25*s*reach,0,0);S(P,'chest',0.12*s*reach,0,0);S(P,'head',-0.1*s*reach,0,0);earBob(P,-0.25*air*reach,0)}
const POSES={
  idle(t,L){const P=P0(),br=Math.sin(t*2.2);S(P,'chest',br*.015,0,0);
    S(P,'neck',0,L.yaw*.3,0);S(P,'head',Math.sin(t*.7)*.04,L.yaw*.5+Math.sin(t*.4)*.1,Math.sin(t*.3)*.05);
    earBob(P,twitch(t,0)*.35,twitch(t,2)*.3);P[RY]=br*.002;return P},
  walk(t,L,ph){const P=P0();hop(P,ph,0.035,0.55);return P},
  run(t,L,ph){const P=P0();hop(P,ph,0.11,1.0);return P},
  eat(t,L){const P=P0();S(P,'neck',.35,Math.sin(t*.6)*.12,0);S(P,'head',.4+Math.abs(Math.sin(t*9))*.04,Math.sin(t*.6)*.14,0);S(P,'hips',.08,0,0);earBob(P,.3,.15);return P},
  bend(t,L){const P=P0(); // groom: sit up, wash face with front paws
    S(P,'hips',-.55,0,0);S(P,'blU',.55,0,0);P[RY]=.01;const r=Math.sin(t*5);
    S(P,'flU',-1.7+r*.25,0,-.15);S(P,'flL',1.4,0,0);S(P,'frU',-1.7-r*.25,0,.15);S(P,'frL',1.4,0,0);S(P,'neck',.45,0,0);S(P,'head',.45+r*.12,0,r*.08);earBob(P,.4,.2);return P},
  happy(t,L){const P=P0();const c=(t*1.1)%1,j=Math.sin(c*PI);P[RY]=j*.22;S(P,'hips',0,Math.sin(c*TAU)*.7*j,Math.sin(c*TAU)*.5*j);S(P,'chest',0,-Math.sin(c*TAU)*.5*j,0);
    S(P,'blU',.6*j,0,0);S(P,'flU',-.4*j,0,0);S(P,'head',0,0,Math.sin(c*TAU)*.4*j);earBob(P,-.3*j,Math.sin(c*TAU*2)*.5*j);return P},
  sit(t,L){const P=P0(); // periscope: stand up tall on hind legs
    S(P,'hips',-1.05,0,0);S(P,'blU',1.0,0,0);S(P,'blL',.05,0,0);S(P,'brU',1.0,0,0);S(P,'brL',.05,0,0);S(P,'flU',.35,0,0);S(P,'flL',1.2,0,0);S(P,'frU',.35,0,0);S(P,'frL',1.2,0,0);
    S(P,'neck',.55,L.yaw*.4,0);S(P,'head',.4,L.yaw*.4+Math.sin(t*.9)*.2,0);earBob(P,-.15,0);P[RY]=.03;return P},
  sleep(t,L){const P=P0(),br=Math.sin(t*1.4);P[RY]=-.035+br*.002;S(P,'flU',-1.1,0,0);S(P,'flL',.4,0,0);S(P,'frU',-1.1,0,0);S(P,'frL',.4,0,0);
    S(P,'neck',.15,0,0);S(P,'head',.15,0,0);S(P,'chest',br*.02,0,0);earBob(P,.9,.1);return P},
};
const ACTIONS={
  attack:{dur:1.6,pose(t,L){const P=P0();const k=sstep(0,.2,t)*(1-sstep(1.3,1.6,t));S(P,'hips',-.1*k,0,0);earBob(P,-.3*k,-.1*k);S(P,'head',-.1*k,0,0);
    const th=[.45,.85].reduce((a,b)=>a+Math.exp(-Math.pow((t-b)/.05,2)),0);S(P,'blU',-.2*k+th*.6,0,0);S(P,'blL',th*.3,0,0);return P},speed:()=>0,face:()=>'angry',
    fx(at,fw){for(const [i,b] of [[0,.45],[1,.85]])if(at>b&&st.fx['t'+i]!==1){st.fx['t'+i]=1;st.shake=.08;const p=worldOf(B.blL);for(let j=0;j<6;j++){const a=rnd()*TAU;spawn('puff',[p[0],.01,p[2]],[Math.cos(a)*.4,.15,Math.sin(a)*.4],.03,.6,0xd8c49c)}}}},
  jump:{dur:1.0,pose(t,L){const P=P0();const u=sstep(0,1,t);hop(P,u*PI,0.35,1.2);return P},speed:t=>t>.1&&t<.9?1.2:0,face:t=>t<.3?'surprised':'excited'},
  shake:{dur:1.2,pose(t,L){const P=P0(),e=Math.pow(Math.sin(PI*t/1.2),.6),w=t*30;S(P,'head',0,Math.sin(w)*.45*e,Math.sin(w)*.2*e);S(P,'neck',0,Math.sin(w-.6)*.2*e,0);
    earBob(P,Math.sin(w-1.5)*.5*e,Math.sin(w-1.8)*.9*e);return P},speed:()=>0,face:()=>'squint'},
};
''')
# coat shader for rabbits
a=s.index("   if(uCoatK>-.5){vec3 cc=mix(uCoatA,uCoatB,vC.g);");E_="base=cc*vC.r*(.94+.12*m2);}";b=s.index(E_,a)+len(E_)
s=s[:a]+"""   if(uCoatK>-.5){vec3 W=vec3(.93,.92,.9);vec3 cc=uCoatA;int K=int(uCoatK+.5);
     if(K==1){float sp=smoothstep(.5,.55,fbm(vR*14.+3.));cc=mix(W,uCoatA,max(sp,vC.g*.95));}
     else if(K==2){float band=smoothstep(.0,.025,vR.z)*smoothstep(.17,.145,vR.z)*smoothstep(.29,.26,vR.y);float blaze=smoothstep(.022,.01,abs(vR.x))*smoothstep(.22,.25,vR.z)*smoothstep(.27,.3,vR.y);
       float feet=smoothstep(.035,.02,vR.y)*smoothstep(-.1,-.05,vR.z)*0.;cc=mix(uCoatA,W,clamp(band+blaze+feet,0.,1.)*(1.-vC.g*.0));}
     else if(K==3){cc=mix(W,uCoatB,vC.g);}
     else if(K==4){float tk=vn(vR*260.);cc=uCoatA*(.7+.6*tk);cc=mix(cc,uCoatB,vC.b);}
     else {cc=mix(cc,uCoatB,vC.b*.55);}
     base=cc*vC.r*(.94+.12*m2);}"""+s[b:]
# lionhead mane: aHair>1.5 marks mane zone
sub("if(uShell>0.){vec3 nn=normalize(n);w.xyz+=nn*uShell*(.35+.65*aHair)+uComb*uShellL*uShellL*aHair;}",
    "float hm=aHair>1.5?1.:0.,ha=aHair>1.5?aHair-2.:aHair;if(uShell>0.){vec3 nn=normalize(n);w.xyz+=nn*uShell*(.35+.65*ha)*(1.+uMane*hm*2.2)+uComb*uShellL*uShellL*ha*(1.+uMane*hm*2.);}")
sub("vR=aM1;vH=aHair;","vR=aM1;vH=aHair>1.5?aHair-2.:aHair;")
sub("uniform float uShell,uShellL,uFlare;","uniform float uShell,uShellL,uFlare,uMane;")
sub("const SHELLS=8,HAIR_LEN=0.014;","let SHELLS=16,HAIR_LEN=0.012;")
sub("gl.uniform3fv(U.uComb,","gl.uniform1f(U.uMane,BREED.mane||0);gl.uniform3fv(U.uComb,")
# breed + colour rows (replaces horse coat row)
a=s.index("{const CO=[['Bay'");b=s.index("window.__pig={",a)
s=s[:a]+r"""const BREEDS=[['Netherland Dwarf',{size:.78,head:1.2,ear:.58,lop:0,fur:.011}],['Holland Lop',{size:.92,head:1.12,ear:.85,lop:1,fur:.013}],['Lionhead',{size:.9,head:1.05,ear:.66,lop:0,fur:.012,mane:1}],
  ['Dutch',{size:1,head:1,ear:.92,lop:0,fur:.011,col:'Dutch'}],['Rex',{size:1.05,head:1,ear:1,lop:0,fur:.006}],['Angora',{size:1,head:1,ear:.8,lop:0,fur:.032}],['Flemish Giant',{size:1.65,head:.95,ear:1.12,lop:0,fur:.012}],['English Lop',{size:1.1,head:1,ear:1.75,lop:1,fur:.011}]];
const COLS=[['White',0xf0eeea,0xe8e4de,0,0xb8323c],['Black',0x1c1a1a,0x2a2626,0,0x2a1810],['Agouti',0x8a6a4a,0xe4dccc,4,0x3a2214],['Blue',0x6e7480,0x9aa0aa,0,0x2a2a3a],['Orange',0xd7823e,0xf0d6b0,0,0x5a3010],['Chocolate',0x4e3022,0x6a4636,0,0x2a1408],['Broken',0x3a2a22,0xffffff,1,0x2a1810],['Himalayan',0xf0eeea,0x2a2424,3,0xc0303a],['Dutch',0x262222,0xffffff,2,0x2a1810]];
let BREED=BREEDS[0][1];
function applyBreed(br){BREED=br;pigN.s=[br.size,br.size,br.size];B.head.s=[br.head,br.head,br.head];B.earL.s=[1,br.ear,1];B.earR.s=[1,br.ear,1];HAIR_LEN=br.fur;cam.d=Math.max(1.3,1.55*br.size*(br.ear>1.3?1.2:1));if(br.col)setCol(COLS.find(c=>c[0]===br.col),true)}
function setCol(c,quiet){COAT={A:hex(c[1]),B:hex(c[2]),K:c[3],S:0};FACE.eyes.forEach(e=>{const its=items.filter(it=>it.node===e.ig);its[0].color=hex(c[4])});
  for(const it of FACE.lidItems||[])it.color=hex(c[1]).map(v=>v*.85);if(!quiet)for(const x of document.querySelectorAll('#cols button'))x.classList.toggle('on',x.dataset.c===c[0]);else for(const x of document.querySelectorAll('#cols button'))x.classList.toggle('on',x.dataset.c===c[0])}
{const rb=document.getElementById('breeds'),rc=document.getElementById('cols');
  BREEDS.forEach(([l,br],i)=>{const b=document.createElement('button');b.textContent=l;b.onclick=()=>{applyBreed(br);for(const x of rb.querySelectorAll('button'))x.classList.toggle('on',x===b)};if(!i)b.classList.add('on');rb.appendChild(b)});
  COLS.forEach(c=>{const b=document.createElement('button');b.dataset.c=c[0];b.innerHTML=`<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#${c[1].toString(16).padStart(6,'0')};border:2px solid #${c[2].toString(16).padStart(6,'0')};margin-right:6px;vertical-align:-2px"></span>${c[0]}`;
    b.onclick=()=>setCol(c);rc.appendChild(b)});window.__coat=()=>{applyBreed(BREEDS[0][1]);setCol(COLS[2])}}
window.__rab={BREEDS,COLS,applyBreed,setCol};
"""+s[b:]
sub('<div class="row face" id="coats"><span class="lbl">Coat</span></div>','<div class="row face" id="breeds"><span class="lbl">Breed</span></div>\n  <div class="row face" id="cols"><span class="lbl">Colour</span></div>')
s=re.sub(r"const ACTS=\[[^;]*\];","const ACTS=[['idle','Idle'],['walk','Hop'],['run','Zoom'],['happy','Binky'],['attack','Thump'],['jump','Jump'],['eat','Nibble'],['bend','Groom'],['sit','Periscope'],['shake','Shake'],['sleep','Sleep']];",s)
s=re.sub(r"const LOOP_FACE=\{[^}]*\};","const LOOP_FACE={idle:'neutral',walk:'neutral',run:'excited',eat:'content',bend:'content',happy:'excited',sit:'surprised',sleep:'asleep'};",s)
sub("one sleek skin · flowing mane & tail · 21 bones · drag to orbit","one fluffy skin · 8 breeds · 9 colours · drag to orbit")
sub("const tgtSpd=(st.loop==='walk'?1.5:st.loop==='bend'?3.0:st.loop==='run'?6.5:0)*(1-aw);","const tgtSpd=(st.loop==='walk'?.35*BREED.size:st.loop==='run'?1.4*BREED.size:0)*(1-aw);")
sub("st.walkPh+=dt*st.speed/1.5*TAU*.85;st.runPh+=dt*Math.max(st.speed,1)/6.5*TAU*2.1;","st.walkPh+=dt*TAU*1.4;st.runPh+=dt*TAU*2.4;")
sub("if(dist>5.5){","if(dist>4.0){");s=s.replace("sstep(5.5,7.5,dist)","sstep(4,6,dist)")
sub("1.2+pose[RY]*.5","0.2*pigN.s[1]+pose[RY]*.5");sub("target:[0,1.2,0]","target:[0,0.2,0]");sub("cam={th:0.7,ph:1.3,d:7","cam={th:0.7,ph:1.3,d:1.4");sub("cam.d=Math.max(cam.d,8.5)","cam.d=Math.max(cam.d,1.8)")
s=s.replace("cam.d=clamp(cam.d*pinch0/d,2.2,20)","cam.d=clamp(cam.d*pinch0/d,0.6,12)").replace("cam.d=clamp(cam.d*Math.exp(e.deltaY*.001),2.2,20)","cam.d=clamp(cam.d*Math.exp(e.deltaY*.001),0.6,12)")
sub("<title>Low-Poly Menagerie · 11 Horse</title>","<title>Low-Poly Menagerie · 12 Rabbits</title>")
sub("11 / 20 · LOW-POLY MENAGERIE</span><h1>Horse</h1>","12 / 20 · LOW-POLY MENAGERIE</span><h1>Rabbits</h1>")
sub("Saddling up…","Fluffing the bunnies…")
# ground snap config: paws & body
s=s.replace("PAWS=['flL','frL','blL','brL'],EXTRA=[['chest',[0,-0.4,0]],['hips',[0,-0.36,0]]],SKIPL=['happy'],SKIPA=['jump']","PAWS=['flL','frL','blL','brL'],EXTRA=[['hips',[0,-0.17,-0.05]],['chest',[0,-0.17,0]]],SKIPL=['happy','walk','run'],SKIPA=['jump']")
s=s.replace("const sc=pigN.s[0]*0.09*(1+h*3)","const sc=pigN.s[0]*0.03*(1+h*3)")
sub("  pigN.p=[st.pos[0],0,st.pos[2]];","  if(BREED.lop){const k=BREED.lop;B.earL.r[2]+=-2.35*k;B.earL.r[0]+=.35*k;B.earR.r[2]+=2.35*k;B.earR.r[0]+=.35*k;B.earL.r[1]+=-.3*k;B.earR.r[1]+=.3*k}\n  pigN.p=[st.pos[0],0,st.pos[2]];")
sub("function applyBreed(br){BREED=br;","function applyBreed(br){BREED=br;for(const x of document.querySelectorAll('#breeds button'))x.classList.toggle('on',x.textContent===BREEDS.find(q=>q[1]===br)[0]);")
open('index.html','w').write(s);print('ok')
