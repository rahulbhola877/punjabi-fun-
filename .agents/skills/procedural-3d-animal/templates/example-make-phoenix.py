import re
s=open('/home/claude/eagle/index.html').read()
def sub(old,new,cnt=1):
    global s
    assert s.count(old)>=1, old[:80]
    if cnt==1: assert s.count(old)==1, ('multi',old[:80])
    s=s.replace(old,new)

# ---------------- rig: two extra tail bones carry the long streamers
sub("'thR','tsR','ftR','tail'];","'thR','tsR','ftR','tail','t1','t2'];")
sub("ftR:mir(LF),tail:TAILP[0]};","ftR:mir(LF),tail:TAILP[0],t1:[0,.447,-.42],t2:[0,.45,-.66]};")
sub("thR:'body',tsR:'thR',ftR:'tsR',tail:'body'};","thR:'body',tsR:'thR',ftR:'tsR',tail:'body',t1:'tail',t2:'t1'};")
# per-vertex weights for feather cards (streamers bend along their length)
sub("A.si.push(bi,0,0,0);A.sw.push(1,0,0,0);","{const ww=o.wfn?o.wfn(Math.floor(k/3)/n):[[bi,0,0,0],[1,0,0,0]];A.si.push(...ww[0]);A.sw.push(...ww[1])}")
sub("      if(o.emarg)w*=lerp(1,.48,sstep(.42,.68,u));","      if(o.emarg)w*=lerp(1,.48,sstep(.42,.68,u));\n      if(o.paddle)w=o.W*(.12+.88*Math.pow(Math.sin(PI*clamp((u-.58)/.42,0,1)),.6));")
# streamers + bigger flame crest
sub("  FACE.tail=accItem(T,{rough:.8});",r'''  {const sw=(L_)=>u=>{const d=u*L_;const a=BN.indexOf('tail'),b=BN.indexOf('t1'),c=BN.indexOf('t2');
      const w1=sstep(.12,.24,d),w2=sstep(.36,.5,d);return [[a,b,c,0],[(1-w1),w1*(1-w2),w2,0]]};
    for(const [x,a,a2,L_] of [[0,0,0,1.15],[.02,.07,.32,1.0],[-.02,-.07,-.32,1.0],[.035,.14,.6,.82],[-.035,-.14,-.6,.82]])
      featherCard(T,{root:[x,.452,-.23],a,a2,L:L_,W:.06,bone:'tail',zone:'stream',seg:18,paddle:1,camber:.01,wfn:sw(L_)})}
  FACE.tail=accItem(T,{rough:.8});''')
sub("featherCard(CR,{root:r0,a:.3*sx*(.4+(i%6)/5),L:.075+.02*((i%6)/5),W:.022,bone:'head',zone:'crest',lift:.9,nrm:vnorm([sx,.3,.2]),camber:.05})",
    "featherCard(CR,{root:r0,a:.3*sx*(.4+(i%6)/5),L:.09+.07*((i%6)/5),W:.016+.01*(i%3===0),bone:'head',zone:'crest',lift:.5,nrm:vnorm([sx,.3,.2]),camber:.08,paddle:i%3===0,seg:9})")

# ---------------- flame colouring of the feathers (base → glowing tip)
a=s.index("function recolorFeathers(sp){");b=s.index("new Float32Array(c))}}",a)+len("new Float32Array(c))}}")
s=s[:a]+r'''function recolorFeathers(sp){for(const it of FEATH){const c=[];for(const [zone,rf,j,u,fi] of it.meta){let h=sp[zone]!=null?sp[zone]:sp.mcov;
      const tipK=zone==='stream'?sstep(.55,.85,u):zone==='prim'||zone==='sec'||zone==='tail'?Math.pow(u,1.4):zone==='crest'?u:Math.pow(u,2)*.7;
      let col=mixc(hex(h),hex(sp.tip),tipK);if(zone==='stream'&&u>.72&&u<.9)col=mixc(col,hex(sp.eye),.8*Math.sin(PI*(u-.72)/.18));
      const k=rf*(j===1?1.12:.94);c.push(...col.map(v=>v*k))}
    gl.bindBuffer(gl.ARRAY_BUFFER,it.gl.bufs[2]);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(c))}}'''+s[b:]

# ---------------- glowing plumage in the shader
sub("uniform vec4 uSp;uniform vec2 uFB;","uniform vec4 uSp;uniform vec2 uFB;uniform float uFire;")
sub("float sheen=0.;float spM=1.;","float sheen=0.;float spM=1.;vec3 gE=vec3(0.);")
sub("   base=cc*vC.r*(.94+.12*m2);","   base=cc*vC.r*(.94+.12*m2);gE=base*uFire*.07*(1.-horn)*(.7+.6*fbm(vR*9.));")
sub(" if(uSkinD<-.5){base*=.86+.26*vn(vR*vec3(380.));"," if(uSkinD<-.5){base*=.86+.26*vn(vR*vec3(380.));gE=base*uFire*(.06+1.5*vH*vH*vH);")
sub("rim*uSky*base*1.4+uEmis;","rim*uSky*base*1.4+uEmis+gE;")
sub("gl.uniform4fv(U.uSp,COAT.Sp);","gl.uniform4fv(U.uSp,COAT.Sp);gl.uniform1f(U.uFire,FIRE);")
sub("gl.uniform3fv(U.uSunC,SUNC);","gl.uniform3fv(U.uSunC,SUNC.map(v=>v*(1+FLASH)));")

# ---------------- dusk sky, warm light, rising embers instead of snow
sub("const SUN=vnorm([0.55,0.78,0.38]),SUNC=hex(0xffeedd).map(v=>v*1.85),SKY=hex(0xb9d6f5).map(v=>v*.5),GND=hex(0xa09c90).map(v=>v*.32),FOG=hex(0xd3dbe2);",
    "const SUN=vnorm([0.62,0.42,0.42]),SUNC=hex(0xffc08a).map(v=>v*1.9),SKY=hex(0x9a8ab8).map(v=>v*.5),GND=hex(0x8a6a5a).map(v=>v*.34),FOG=hex(0xd9a890);let FIRE=1,FLASH=0;")
sub("vec3 top=vec3(.14,.36,.74),hor=vec3(.84,.88,.92);","vec3 top=vec3(.16,.14,.38),hor=vec3(1.,.62,.42);")
sub("c+=vec3(1.,.85,.6)*(pow(s,8.)*.25+pow(s,600.)*3.);","c+=vec3(1.,.6,.3)*(pow(s,6.)*.55+pow(s,500.)*4.);")
sub("gl.clearColor(.8,.85,.9,1)","gl.clearColor(.9,.6,.45,1)")
sub("f[1]-=dt*f[3];","f[1]+=dt*f[3]*.5;")
sub("if(f[1]<-0.6){f[1]+=7;","if(f[1]>6.5){f[1]-=7;")
sub("emis:[.9,.93,.97],flat:0,cast:false,rough:1,spec:0,rim:0}","emis:[2.4,.95,.25],flat:0,cast:false,rough:1,spec:0,rim:0}")
sub("snowF.push([rr(-7,7),rr(0,7),rr(-7,7),rr(.35,.8),rnd()*TAU,rr(.008,.016)])","snowF.push([rr(-7,7),rr(-.5,6.5),rr(-7,7),rr(.35,.8),rnd()*TAU,rr(.006,.012)])")
sub("const SNOWN=320","const SNOWN=220")
s=s.replace("background:#dfe7ee","background:#e9c2a8")

# ---------------- fire particles
sub("for(let i=0;i<70;i++){const n=sceneRoot.add(new Node());","for(let i=0;i<260;i++){const n=sceneRoot.add(new Node());")
sub("P.it.gl=kind==='heart'?","P.col=color;P.it.gl=kind==='heart'?")
sub("P.it.emis=kind==='heart'?","P.it.emis=kind==='flame'||kind==='ember'?hex(color).map(v=>v*2.6):kind==='heart'?")
sub("  else if(P.kind==='feather'){","  else if(P.kind==='flame'){P.v=vsc(P.v,Math.pow(.25,dt));P.v[1]+=dt*2.2;P.n.s=Array(3).fill(P.size*Math.sin(PI*Math.min(1,t*1.4+.1))*(1+t*.6));P.it.op=.75*(1-t);const c0=hex(SP.tip),c1=hex(P.col);const u=sstep(0,.45,t);P.it.emis=c0.map((v,i)=>lerp(v*1.5,c1[i]*1.3,u)*(1-.7*sstep(.5,1,t)))}\n  else if(P.kind==='ember'){P.v[1]+=dt*.4;P.v[0]+=Math.sin(t*9+P.spin)*dt*.6;P.n.s=Array(3).fill(P.size);P.it.op=(1-t)*(.6+.4*Math.sin(t*40+P.spin))}\n  else if(P.kind==='feather'){")

# ---------------- flame species
a=s.index("const SPECIES=[");b=s.index("];\nlet SP=SPECIES[0];",a)
s=s[:a]+r'''const SPECIES=[
 {n:'Crimson',sw:[0xc0281c,0xffc23a],A:0x9e1c16,Bh:0xe8901a,belly:0xd2481a,band:0xb3261e,thigh:0xc8401c,horn:0xf6d36a,flesh:0x8a4a22,sp:[1,0,0,0],iris:0xffd84a,eye:0x2a8ad8,
  prim:0xb81a12,sec:0xd23a18,gcov:0xe0601a,pcov:0xd8501a,mcov:0xec7a1e,lcov:0xf5a024,ucov:0xf08a22,scap:0xd84a1a,tail:0xc0221a,tcov:0xf08a1e,crest:0xffb02a,stream:0xd8301a,tip:0xffc93a,flame:0xff5a14,fire:1,fb:[0,0],tfb:[0,0],crestOn:1},
 {n:'Azure',sw:[0x1e4fb8,0x9ae8ff],A:0x1d4cb0,Bh:0x6fd2fa,belly:0x3c8ae8,band:0x1d4cb0,thigh:0x2a62d0,horn:0xdfeaf2,flesh:0x30406a,sp:[1,0,0,0],iris:0xc6f6ff,eye:0xffd04a,
  prim:0x1636a4,sec:0x2458c8,gcov:0x2f74dc,pcov:0x2a62d0,mcov:0x3c8ae8,lcov:0x5cb0f2,ucov:0x52a6f0,scap:0x2a62d0,tail:0x1a44b0,tcov:0x52b4f0,crest:0x9ae8ff,stream:0x2050c0,tip:0xd8fbff,flame:0x4ab8ff,fire:1,fb:[0,0],tfb:[0,0],crestOn:1},
 {n:'Golden sun',sw:[0xe0a01c,0xfff0b0],A:0xd8921c,Bh:0xffe6a0,belly:0xf2c050,band:0xd8921c,thigh:0xe8a830,horn:0xfff2c8,flesh:0x9a6a22,sp:[1,0,0,0],iris:0xff8a2a,eye:0xff5a1a,
  prim:0xc87414,sec:0xdc901a,gcov:0xeaa828,pcov:0xe09a20,mcov:0xf2bc3a,lcov:0xf8d060,ucov:0xf4c450,scap:0xe6a228,tail:0xcc7a16,tcov:0xf4c040,crest:0xfff0b0,stream:0xd88a18,tip:0xfffbe8,flame:0xffc84a,fire:1.1,fb:[0,0],tfb:[0,0],crestOn:1},
 {n:'Shadow',sw:[0x2a1240,0xff5ad8],A:0x2a1240,Bh:0x7a34c0,belly:0x4a1e72,band:0x2a1240,thigh:0x3a1858,horn:0x2a2030,flesh:0x2a1c34,sp:[1,0,0,0],iris:0xff6ae0,eye:0x6af0ff,
  prim:0x1a0a2c,sec:0x2c1248,gcov:0x441c6c,pcov:0x381860,mcov:0x5a2690,lcov:0x7a34c0,ucov:0x4a1e72,scap:0x3a1858,tail:0x220e38,tcov:0x5a2690,crest:0xc04aff,stream:0x2c1248,tip:0xff5ad8,flame:0xc04aff,fire:1.1,fb:[0,0],tfb:[0,0],crestOn:1},
'''+s[b:]
sub("FACE.tail.fb=sp.tfb;FACE.tail.fbc=hex(sp.tfbc||0)}","FACE.tail.fb=sp.tfb;FACE.tail.fbc=hex(sp.tfbc||0);for(const it of FACE.irisItems)it.emis=hex(sp.iris).map(v=>v*.55);ASH.core.emis=hex(sp.flame).map(v=>v*1.5);ASH.ball.emis=hex(sp.flame).map(v=>v*3);ASH.hot.emis=hex(sp.tip).map(v=>v*3.5)}")
sub("row.querySelector('.lbl').textContent='Species';","row.querySelector('.lbl').textContent='Flame';")

# ---------------- ash pile + fireball for the rebirth
sub("  preyN=sceneRoot.add(new Node());",r'''  {const n=sceneRoot.add(new Node());n.visible=false;const g=jitter(icosa(.3,2),.035);
    ASH.n=n;ASH.pile=addItem(upload(flatten(g,()=>hex(rnd()<.5?0x5a5550:0x46423e).map(v=>v*rr(.8,1.15))),{flat:true}),n,{flat:1,rough:1,spec:0,rim:.15});
    const ci=n.add(new Node());ci.s=[.93,.93,.93];ASH.core=addItem(upload(flatten(jitter(icosa(.3,1),.02),()=>[0,0,0]),{flat:true}),ci,{color:[0,0,0],flat:1,rough:1,spec:0,rim:0,cast:false});
    const bn=sceneRoot.add(new Node());bn.visible=false;ASH.bn=bn;const gs=upload(sphere(1,28,18));
    ASH.ball=addItem(gs,bn,{color:[0,0,0],trans:true,op:.7,flat:0,cast:false,rough:1,spec:0,rim:1.2});const hn=bn.add(new Node());hn.s=[.6,.6,.6];
    ASH.hot=addItem(gs,hn,{color:[0,0,0],trans:true,op:.9,flat:0,cast:false,rough:1,spec:0,rim:0})}
  preyN=sceneRoot.add(new Node());''')
sub("const FEATH=[];","const FEATH=[];const ASH={};")

# ---------------- moves
sub("['attack','Dive strike'],['screech','Screech'],['jump','Hop-flap'],['tear','Tear prey'],","['rebirth','Rise from ashes'],['attack','Fire dive'],['screech','Fire cry'],['jump','Hop-flap'],")
sub("const ACTIONS={",r'''const REB={scale:t=>t<1.2?1:t<2.2?Math.max(.001,1-sstep(1.2,2.1,t)):t<5?.001:lerp(.12,1,sstep(5,6.6,t)),
  fire:t=>1+3*sstep(0,1.1,t)*(1-sstep(1.8,2.3,t))+4*sstep(4.6,5.1,t)*(1-sstep(6,7.6,t)),
  ash:t=>sstep(1.3,2.2,t)*(1-sstep(5.2,6.4,t)),ball:t=>sstep(4.0,5.0,t)*(1-sstep(5.5,6.7,t)),
  flash:t=>1.4*Math.exp(-Math.pow((t-2.0)/.16,2))+2.2*Math.exp(-Math.pow((t-5.05)/.16,2))};
const ACTIONS={
  rebirth:{dur:8.6,alt:(t,a0)=>a0*(1-sstep(0,.9,t)),speed:()=>0,
    pose(t,L){return seq(t,L,[[0,(t,L)=>{const P=P0();perch(P,.4);wings(P,{f:-.55,fl:-.35,sw:-.75,tw:.2});S(P,'neck',.45,0,0);S(P,'head',-.15,0,0);S(P,'root',0,0,Math.sin(t*34)*.03*sstep(.3,1,t));P[RUF]=1.2;return P}],
      [4.8,(t,L)=>{const P=P0();perch(P,.85);wings(P,{f:-.85,fl:1.05+.1*Math.sin(t*6),sw:.12,tw:.35,fe:.1,fw:.18});S(P,'neck',-.35,0,0);S(P,'head',-.3,0,0);P[FAN]=1;P[RUF]=.4;return P}],
      [7.7,(t,L)=>POSES.idle(t,L)]],.35)},
    face:t=>t<2.2?'squint':t<5.5?'asleep':t<7.4?'screech':'fierce',mouth:t=>t>5.7&&t<7.2?.85+.15*Math.sin(t*24):0},
''')
sub("const AIR={fly:1,soar:1};","const AIR={fly:1,soar:1};\nconst rnd3=r=>[rr(-r,r),rr(-r,r),rr(-r,r)];")
# no fish for the phoenix
sub("const show=(st.w.tear>.35&&!A)||(st.act==='attack'&&st.actT>2.8);","const show=false;")

# ---------------- per-frame: scale, fire level, streamer drape, emitters
sub("pigN.p=[st.pos[0],0,st.pos[2]];pigN.r=[0,st.head,0];","pigN.p=[st.pos[0],0,st.pos[2]];pigN.r=[0,st.head,0];{const k=st.act==='rebirth'?REB.scale(st.actT):1;pigN.s=[k,k,k]}")
sub("B.root.p[1]+=G0.d;","B.root.p[1]+=G0.d/Math.max(.05,pigN.s[1]);")
sub("  // ---- feathers: fold morphs",r'''  // streamers: sway, and drape back along the ground instead of digging in when perched
  {B.t1.r=[pose[BI.t1]+Math.sin(t*1.7)*.06,Math.sin(t*1.1)*.12,0];B.t2.r=[pose[BI.t2]+.08+Math.sin(t*1.7-1)*.08,Math.sin(t*1.1-.8)*.16,0];
   sceneRoot.update(null);const d=vnorm(M4.dir(B.tail.world,[0,0,-1]));const down=Math.asin(clamp(-d[1],-1,1));const want=.04+(1-airW)*.0;
   const lift=clamp(down-want,0,1.6)*(1-airW*.6);st.slift=lerp(st.slift||0,lift,1-Math.exp(-dt*8));B.t1.r[0]+=st.slift*.75;B.t2.r[0]+=st.slift*.3}
  // ---- feathers: fold morphs''')
sub("  // ---- effects\n  const fw=forward();",r'''  // ---- phoenix fire
  const fw=forward();
  {const R=st.act==='rebirth'?st.actT:-1;const fl=SP.flame;
   FIRE=SP.fire*(1+.12*Math.sin(t*9)+.06*Math.sin(t*23))*(R>=0?REB.fire(R):1)*(st.w.sleep>.5?.55:1)*(st.act==='screech'?1.6:1)*(1+.6*st.w.happy);
   FLASH=lerp(FLASH,R>=0?REB.flash(R):0,1-Math.exp(-dt*20));
   const hot=(p,v,sz,life,col=fl)=>spawn('flame',p,v,sz*.6,life,col);
   if(R>=0){const a=REB.ash(R);ASH.n.visible=a>.01;ASH.n.p=[st.pos[0],0,st.pos[2]];ASH.n.s=[a*1.1,a*.42,a*1.1];
     const glow=R<4?.35+.25*Math.sin(R*3):lerp(.6,2.5,sstep(4,5,R));ASH.core.emis=hex(fl).map(v=>v*glow);
     const bb=REB.ball(R);ASH.bn.visible=bb>.01;const br=bb*.48*(1+.06*Math.sin(t*30));ASH.bn.p=[st.pos[0],.32*bb+.05,st.pos[2]];ASH.bn.s=[br,br*1.15,br];ASH.ball.op=.55*bb+.15;
     if(R<2.2&&rnd()<dt*70){const sc=pigN.s[0];hot(vadd(st.pos,[rr(-.3,.3)*sc,rr(.05,.8)*sc,rr(-.3,.3)*sc]),[rr(-.2,.2),rr(.4,1),rr(-.2,.2)],rr(.05,.12),rr(.5,.9))}
     if(R>2.2&&R<4.2&&rnd()<dt*8)spawn('ember',vadd(st.pos,[rr(-.2,.2),.08,rr(-.2,.2)]),[rr(-.1,.1),rr(.3,.6),rr(-.1,.1)],.012,rr(1.5,2.5),fl);
     if(R>4&&R<5.6&&rnd()<dt*55)hot(vadd(st.pos,[rr(-.15,.15),rr(.05,.4),rr(-.15,.15)]),[rr(-.3,.3),rr(1,2.2),rr(-.3,.3)],rr(.06,.14),rr(.5,.9));
     if(R>5.05&&!st.fx.ring){st.fx.ring=1;st.shake=.35;for(let i=0;i<34;i++){const a2=i/34*TAU;hot(vadd(st.pos,[Math.cos(a2)*.2,.1,Math.sin(a2)*.2]),[Math.cos(a2)*2.6,rr(.2,.8),Math.sin(a2)*2.6],rr(.08,.14),rr(.6,1))}}
     if(R>1.95&&!st.fx.col){st.fx.col=1;st.shake=.25;for(let i=0;i<24;i++)hot(vadd(st.pos,[rr(-.25,.25),rr(.05,.4),rr(-.25,.25)]),[rr(-.8,.8),rr(1.5,3),rr(-.8,.8)],rr(.08,.16),rr(.6,1.1))}
     if(R>5.2&&R<7.4&&rnd()<dt*40){const s2=rnd()<.5?'L':'R';hot(worldOf(B['wH'+s2],[s2==='L'?.3:-.3,0,-.1]),[rr(-.3,.3),rr(.4,1),rr(-.3,.3)],rr(.04,.09),rr(.4,.8))}
   }else{ASH.n.visible=false;ASH.bn.visible=false}
   // wing-tip and streamer flame trails in the air
   if(airW>.3)for(const s2 of ['L','R'])if(rnd()<dt*32){const p=worldOf(B['wH'+s2],[s2==='L'?.32:-.32,0,-.12]);hot(p,vadd(vsc(fw,-1.2),[0,.3,0]),rr(.04,.08),rr(.35,.6))}
   if(airW>.3&&rnd()<dt*30){const p=worldOf(B.t2,[rr(-.1,.1),0,-.45]);hot(p,vadd(vsc(fw,-.8),[0,.3,0]),rr(.04,.08),rr(.4,.7))}
   // resting glow: a few embers drift off the plumage
   if(airW<.3&&R<0&&rnd()<dt*(st.w.sleep>.5?2:5)){const p=worldOf(B.chest,rnd3(.12));spawn('ember',p,[rr(-.1,.1),rr(.2,.5),rr(-.1,.1)],.01,rr(1.5,2.5),fl)}
   if(st.w.happy>.5&&rnd()<dt*40){const s2=rnd()<.5?'L':'R';hot(worldOf(B['wH'+s2],[s2==='L'?rr(0,.3):-rr(0,.3),0,rr(-.3,0)]),[rr(-.2,.2),rr(.6,1.2),rr(-.2,.2)],rr(.04,.08),rr(.4,.8))}
   if(st.act==='screech'&&st.actT>.4&&st.actT<1.8&&rnd()<dt*60){const p=worldOf(B.head,[0,-.01,.2]);const d=vnorm(M4.dir(B.head.world,[0,.2,1]));hot(p,vadd(vsc(d,rr(1.6,2.6)),rnd3(.25)),rr(.04,.09),rr(.4,.7))}
   if(st.act==='attack'&&st.actT>1.7&&st.actT<2.75&&rnd()<dt*60)hot(worldOf(B.body,rnd3(.15)),vadd(vsc(fw,-2),[0,1,0]),rr(.06,.12),rr(.3,.6));
   if(st.act==='attack'&&st.actT>2.78&&!st.fx.fr){st.fx.fr=1;for(let i=0;i<30;i++){const a2=i/30*TAU;hot(vadd(st.pos,[0,.08,0]),[Math.cos(a2)*2.4,rr(.3,1),Math.sin(a2)*2.4],rr(.07,.13),rr(.6,1))}}
   if(st.act==='shake'&&st.actT>.3&&st.actT<1.4&&rnd()<dt*50)spawn('ember',worldOf(B.chest,rnd3(.15)),[rr(-1.5,1.5),rr(.5,1.5),rr(-1.5,1.5)],.014,rr(.8,1.4),SP.tip)}
''')

# ================= phoenix anatomy (not an eagle): slender body, long S-neck, small high head, short gently curved beak, no fierce brow
sub("function sdBeakU(x,y,z){","function _sdBeakU(x,y,z){")
sub("function sdBeakL(x,y,z){","function _sdBeakL(x,y,z){")
sub("function sdHead(x,y,z,ax){","function _sdHead(x,y,z,ax){")
sub("function sdBeak(x,y,z){",r"""const HC=[0,.556,.312],HT=[0,.655,.335],HS=.82;const hq=(x,y,z)=>[HC[0]+(x-HT[0])/HS,HC[1]+(y-HT[1])/HS,HC[2]+(z-HT[2])/HS];const hpI=q=>vadd(HT,vsc(vsub(q,HC),HS));
function sdBeakU(x,y,z){const q=hq(x,y,z);return _sdBeakU(...q)*HS}
function sdBeakL(x,y,z){const q=hq(x,y,z);return _sdBeakL(...q)*HS}
function sdHead(x,y,z,ax){const q=hq(x,y,z);return _sdHead(q[0],q[1],q[2],Math.abs(q[0]))*HS}
function sdBeak(x,y,z){""")
sub("const BU=[[0,.567,.37],[0,.567,.402],[0,.559,.433],[0,.543,.453],[0,.526,.458],[0,.512,.449]]","const BU=[[0,.566,.37],[0,.565,.4],[0,.558,.428],[0,.548,.448],[0,.537,.458],[0,.53,.46]]")
sub("d=smin(d,sdEll(ax,y,z,.041,.577,.345,.021,.011,.032),.014);","d=smin(d,sdEll(ax,y,z,.04,.572,.345,.01,.005,.018),.008);")
sub("let d=sdEll(x,y,z,0,.42,-.03,.13,.13,.25);","let d=sdEll(x,y,z,0,.42,-.03,.105,.112,.25);")
sub("sdEll(x,y,z,0,.405,.09,.122,.13,.14),.08);","sdEll(x,y,z,0,.415,.1,.1,.115,.13),.08);")
sub("sdEll(x,y,z,0,.46,.05,.115,.075,.15),.06);","sdEll(x,y,z,0,.455,.05,.095,.065,.15),.06);")
sub("sdCone(x,y,z,0,.46,.13,0,.535,.27,.088,.06),.07);","sdCone(x,y,z,0,.45,.13,0,.56,.235,.075,.05),.06);d=smin(d,sdCone(x,y,z,0,.56,.235,0,.625,.3,.05,.042),.04);")
sub("sdCone(ax,y,z,...LH,...LA,0.06,0.044);","sdCone(ax,y,z,...LH,...LA,0.045,0.032);")
sub("sdEll(ax,y,z,LA[0],LA[1]+0.03,LA[2]-0.005,0.052,0.05,0.054),0.03);","sdEll(ax,y,z,LA[0],LA[1]+0.03,LA[2]-0.005,0.036,0.04,0.038),0.025);")
sub("sdCone(ax,y,z,...LA,...LF,0.019,0.016),0.022);","sdCone(ax,y,z,...LA,...LF,0.014,0.012),0.02);")
sub("d=Math.min(d,sdCone(ax,y,z,...LF,...t,0.013,0.0085));","d=Math.min(d,sdCone(ax,y,z,...LF,...t,0.01,0.0065));")
sub("[0.7,0.65,0.5],0.0095","[0.7,0.76,0.5],0.0095")
sub("neck2:[0,.505,.235],head:[0,.548,.30],jaw:[0,.546,.356],","neck2:[0,.56,.235],head:hpI([0,.548,.30]),jaw:hpI([0,.546,.356]),")
sub("head:[REST.head,[0,.556,.36]]","head:[REST.head,hpI([0,.556,.36])]")
sub("  if(z>0.352&&ax<0.045&&y>0.49&&sdBeak(x,y,z)<0.008){","  const Q_=hq(x,y,z);if(Q_[2]>0.352&&Math.abs(Q_[0])<0.045&&Q_[1]>0.49&&sdBeak(x,y,z)<0.008){")
sub("const k=sstep(0.352,0.372,z);","const k=sstep(0.352,0.372,Q_[2]);")
sub("const bU=sdBeakU(x,y,z),bL=sdBeakL(x,y,z),bk=Math.min(bU,bL);","const Q_=hq(x,y,z),qz=Q_[2],qy=Q_[1];const bU=sdBeakU(x,y,z),bL=sdBeakL(x,y,z),bk=Math.min(bU,bL);")
sub("sstep(0.352,0.366,z)","sstep(0.352,0.366,qz)")
sub("sstep(0.392,0.38,z)*sstep(0.546,0.557,y)","sstep(0.392,0.38,qz)*sstep(0.546,0.557,qy)")
sub("sstep(0.356,0.37,z)","sstep(0.356,0.37,qz)")
sub("sstep(0.15,0.23,z+(y-0.46)*0.55)","sstep(0.13,0.2,z+(y-0.46)*0.55)")
sub("const S_=marchOut([0,.566,.33],dir)","const S_=marchOut(hpI([0,.566,.33]),dir)")
sub("marchIn([.07*s,.556,.388],[-s,0,0])","marchIn(hpI([.07*s,.556,.388]),[-s,0,0])")
sub("vsub([0,.538,.392],REST.jaw)","vsub(hpI([0,.538,.392]),REST.jaw)")
sub("marchOut([.02*sx,.57,.29-.02*(i%6)/5]","marchOut(hpI([.02*sx,.57,.29-.02*(i%6)/5])")
sub("const PL_=[.30,.31,.325,.335,.35,.36,.365,.36,.345,.305];","const PL_=[.34,.36,.38,.4,.42,.44,.45,.45,.43,.39];")
sub("u=>lerp(.0068,.0012,u),6,true))}","u=>lerp(.0048,.001,u),6,true))}")
sub("neutral:{up:.2,low:.1,ba:.18,","neutral:{up:.14,low:.08,ba:-.06,")
sub("fierce:{up:.34,low:.22,ba:.52,","fierce:{up:.26,low:.18,ba:.3,")
# graceful perch: taller, neck in an S, head high
sub("function perch(P,up=.72){S(P,'root',-up,0,0);","function perch(P,up=.72){up+=.08;S(P,'root',-up,0,0);")
sub("S(P,'neck',.08,0,0);S(P,'neck2',.2,0,0);S(P,'head',up-.33,0,0);S(P,'tail',-.2,0,0);wings(P,{f:1})}","S(P,'neck',-.1,0,0);S(P,'neck2',.32,0,0);S(P,'head',up-.32,0,0);S(P,'tail',-.05,0,0);wings(P,{f:1})}")
# text
sub("one skin · 260 feather cards · 22 bones · drag to orbit","one skin · flame plumage · 24 bones · drag to orbit")
sub("<title>Low-Poly Menagerie · 13 Eagle</title>","<title>Low-Poly Menagerie · 14 Phoenix</title>")
sub("13 / 20 · LOW-POLY MENAGERIE</span><h1>Eagle</h1>","14 / 20 · LOW-POLY MENAGERIE</span><h1>Phoenix</h1>")
sub("Preening the flight feathers…","Kindling the embers…")
open('/home/claude/phoenix/index.html','w').write(s);print('ok',len(s))
