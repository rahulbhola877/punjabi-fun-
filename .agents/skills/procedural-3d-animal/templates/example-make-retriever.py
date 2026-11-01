import re
s=open('/home/claude/aussie/index.html').read()
KIT=open('/home/claude/kit/asset-kit.js').read()
def sub(old,new):
    global s
    assert s.count(old)==1,(s.count(old),old[:90]); s=s.replace(old,new)
def rep(a_mark,b_mark,new):
    global s
    a=s.index(a_mark); b=s.index(b_mark,a); s=s[:a]+new+s[b:]

# ---------------- sculpt: broad skull, defined stop, longer deeper muzzle with flews, pendant ears, long level tail
sub("// ===== AUSTRALIAN SHEPHERD SCULPT =====","// ===== GOLDEN RETRIEVER SCULPT =====")
a=s.index("const EAR_C=");b=s.index("function sdLegF",a)
s=s[:a]+r'''const EAR_C=[0.104,0.862,0.545], EAR_M=M4.inv(M4.trs(EAR_C,null,[0.08,0.18,0.42],[1,1,1]));
function earLocal(x,y,z){return M4.pt(EAR_M,[x,y,z])}
function sdEar(ax,y,z){const q=earLocal(ax,y,z);const v=clamp(-(q[1]+0.0)/0.15,0,1);const rz=0.034+0.03*Math.sin(Math.min(1,v*1.25)*PI*.5);
  return sdEll(q[0]+0.006-v*v*0.02,q[1]+0.078,q[2]+0.004,0,0,0,0.021,0.088,rz)}           // soft pendant flap hanging beside the cheek
'''+s[b:]
sub("function sdSnout(x,y,z){return sdCone(x,y,z,0,0.775,0.63,0,0.748,0.8,0.076,0.05)}","function sdSnout(x,y,z){return sdCone(x*1.04,y,z,0,0.772,0.635,0,0.75,0.818,0.082,0.058)}")
sub("const TAILP=[[0,0.6,-0.46],[0,0.6,-0.57],[0,0.575,-0.67],[0,0.535,-0.76],[0,0.5,-0.83],[0,0.48,-0.89]],TAILR=[0.052,0.048,0.044,0.04,0.034,0.026];",
    "const TAILP=[[0,0.6,-0.46],[0,0.6,-0.58],[0,0.59,-0.7],[0,0.57,-0.81],[0,0.548,-0.91],[0,0.525,-1.0]],TAILR=[0.054,0.048,0.042,0.036,0.029,0.02];")
sub("d=smin(d,sdEll(x,y,z,0,0.8,0.57,0.118,0.11,0.12),0.06);","d=smin(d,sdEll(x,y,z,0,0.806,0.562,0.126,0.116,0.126),0.06);d=smin(d,sdEll(x,y,z,0,0.79,0.64,0.09,0.06,0.05),0.04);")
sub("d=smin(d,sdEll(x,y,z,0,0.73,0.66,0.06,0.035,0.08),0.04);","d=smin(d,sdEll(x,y,z,0,0.727,0.705,0.068,0.04,0.1),0.04);")
sub("d=smin(d,sdEar(ax,y,z),0.02);","d=smin(d,sdEar(ax,y,z),0.012);")
sub("earL:[0.085,0.88,0.55],earR:[-0.085,0.88,0.55]","earL:[0.104,0.862,0.545],earR:[-0.104,0.862,0.545]")
sub("earL:[REST.earL,[0.11,1.0,0.57]],earR:[REST.earR,[-0.11,1.0,0.57]]","earL:[REST.earL,[0.15,0.7,0.53]],earR:[REST.earR,[-0.15,0.7,0.53]]")
sub("surfaceNets(f,[-0.21,-0.02,-0.96],[0.21,1.03,0.88],0.02)","surfaceNets(f,[-0.23,-0.02,-1.06],[0.23,1.0,0.92],0.019)")

# ---------------- coat: real vertex colours (they export), recolourable; masks kept on the CPU
a=s.index("const COL={");b=s.index("function buildPig(){",a)
s=s[:a]+r'''const COL={skin:0xc27e3c,white:0xf6e6c4,tan:0xb7762c,nose:0x161414};
function mixc(a,b,t){return a.map((v,i)=>lerp(v,b[i],t))}
let COATM=[],CLUMP=null,COAT={base:hex(0xc27e3c),light:hex(0xe2b578),dark:hex(0x9c5e26)};
function coatMask(p){const [x,y,z]=p,ax=Math.abs(x);
  const ear=sstep(0.02,0,sdEar(ax,y,z));
  const chest=sstep(0.16,0.3,z)*sstep(0.66,0.48,y)*sstep(0.6,0.5,z+0)*1;
  const belly=sstep(0.45,0.36,y)*sstep(0.13,0.04,ax)*sstep(0.35,0.1,Math.abs(z-0.02));
  const legB=sstep(0.42,0.2,y)*0.25,muz=sstep(0.02,-0.01,sdSnout(x,y,z))*0.3,brow=sstep(0.02,0.008,Math.hypot(ax-0.05,y-0.86,z-0.648))*0.25;
  const saddle=sstep(0.63,0.71,y)*sstep(-0.45,-0.1,z)*sstep(0.45,0.2,z)*0.3;
  const light=clamp(chest*.55+belly*.65+muz+legB+brow,0,1),dark=clamp(ear*.55+saddle,0,1);
  const na=[0,0.62,0.36],nb=[0,0.75,0.52],nd=vsub(nb,na),nt=vdot(vsub(p,na),nd)/vdot(nd,nd);
  const mane=sstep(0.15,0.4,nt)*sstep(0.9,0.6,nt),face=sstep(0.6,0.7,z)*sstep(0.66,0.72,y),mz=sstep(0.02,0,sdSnout(x,y,z));
  const hair=clamp(0.9+mane*0.4+sstep(-0.45,-0.55,z)*0.3+chest*.35-face*0.5-mz*0.4-ear*0.1-sstep(0.25,0.08,y)*0.4,0.2,1.5);
  return [light,dark,hair]}
function coatColor(m){return mixc(mixc(COAT.base,COAT.light,m[0]),COAT.dark,m[1])}
function pigVertex(p){const m=coatMask(p);COATM.push(m);return [coatColor(m),m[2]]}
'''+s[b:]
# clumps of feathering: real geometry, skinned, exportable
sub("let scaleItem;\n",r'''let scaleItem;
function buildClumps(){const A={pos:[],nor:[],col:[],idx:[],si:[],sw:[],meta:[]};
  const put=(P,r0,W,kl)=>{const g=tube(P,7,u=>r0*Math.pow(1-u,.7)*(0.75+0.25*Math.sin(u*PI))+0.0015,5,false);const b=A.pos.length/3,rf=rr(.9,1.08);
    for(let i=0;i<g.n;i++){A.pos.push(g.pos[i*3],g.pos[i*3+1],g.pos[i*3+2]);A.nor.push(g.nor[i*3],g.nor[i*3+1],g.nor[i*3+2]);A.col.push(1,1,1);A.si.push(...W[0]);A.sw.push(...W[1]);A.meta.push([kl,rf])}for(const k of g.idx)A.idx.push(k+b)};
  let NC=0;const clump=(root,dir,L,r0,kl,grav=.6,curl=[0,0,0])=>{if((NC++)%2)return;const d=vnorm(dir);const side=vnorm(vcross(d,[0,1,0.001]));const ph=rnd()*TAU;const P=[root];L*=.85;for(let j=1;j<=5;j++){const u=j/5;const wv=Math.sin(u*5+ph)*.12*L*u;P.push(vadd(root,vadd(vadd(vadd(vsc(d,L*u),[0,-grav*L*u*u*.5,0]),vsc(curl,u*u*L)),vadd(vsc(side,wv),vsc(d,-.0)))))}const tip=P[P.length-1];P[P.length-1]=vadd(tip,vsc(vnorm(vsub(tip,root)),-.01));put(P,r0*1.75,pigWeights(root),kl)};
  const IE=M4.inv(EAR_M);
  for(const s of [1,-1])for(let i=0;i<24;i++){const a=rr(-PI*.97,-PI*.03);const q=[0,-0.078+0.088*Math.sin(a),0.055*Math.cos(a)-0.004];let p=M4.pt(IE,q);p=[p[0]*s,p[1],p[2]];
    clump(p,[s*.25,-1,-.12+rr(-.2,.2)],rr(.04,.075),.011,.25,.3,[s*.1,0,0])}
  for(let i=0;i<90;i++){const o=[rr(-.06,.06),rr(.42,.68),.22];const r=marchOut(o,vnorm([rr(-.8,.8),rr(-.25,.1),1]));clump(vadd(r,[0,0,-.004]),[r[0]*2,-.85,.5],rr(.06,.11),.015,.55)}
  for(let i=0;i<60;i++){const a=rr(-1.7,1.7);const o=[0,.68,.42];const r=marchOut(o,vnorm([Math.sin(a),Math.cos(a)*.6+.2,-.35]));clump(vadd(r,[0,-.003,0]),[Math.sin(a)*.4,-.45,-.8],rr(.045,.075),.013,.3)}
  for(const s of [1,-1])for(let i=0;i<24;i++){const r=marchOut([s*.09,rr(.18,.44),.33],vnorm([s*rr(-.3,.5),0,-1]));clump(r,[s*.1,-.8,-.55],rr(.045,.08),.01,.55)}
  for(const s of [1,-1])for(let i=0;i<34;i++){const r=marchOut([s*.1,rr(.3,.56),-.3],vnorm([s*rr(0,.9),rr(-.2,.2),-1]));clump(r,[s*.25,-.8,-.55],rr(.06,.1),.013,.6)}
  for(let i=0;i<34;i++){const r=marchOut([rr(-.08,.08),.47,rr(-.16,.24)],[0,-1,0]);clump(r,[0,-1,-.35],rr(.045,.075),.012,.7,.3)}
  const TF=catmull(TAILP);for(let i=0;i<90;i++){const t=rr(.08,1);const c=TF(t);const a=-PI/2+rr(-1.05,1.05);const r=marchOut(c,[Math.cos(a),Math.sin(a),0]);
    clump(r,[Math.cos(a)*.45,-.85,-.5],(.05+.09*Math.sin(PI*Math.min(1,t*1.1)))*rr(.8,1.1),.014,.5,.5)}
  const g=new Geo();g.pos=A.pos;g.nor=A.nor;g.col=A.col;g.idx=A.idx;
  CLUMP=addItem(upload(g,{si:A.si,sw:A.sw,m1:A.pos}),null,{skin:true,flat:0,rough:.72,spec:.3,rim:.35});CLUMP.meta=A.meta;CLUMP.src=g}
function setCoat(c){COAT={base:hex(c[1]),light:hex(c[2]),dark:hex(c[3])};
  {const g=pigItem.gl.src.g;for(let i=0;i<COATM.length;i++){const cc=coatColor(COATM[i]);g.col[i*3]=cc[0];g.col[i*3+1]=cc[1];g.col[i*3+2]=cc[2]}gl.bindBuffer(gl.ARRAY_BUFFER,pigItem.gl.bufs[2]);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(g.col))}
  {const g=CLUMP.gl.src.g;CLUMP.meta.forEach(([kl,rf],i)=>{const cc=mixc(COAT.base,COAT.light,kl).map(v=>v*rf);g.col[i*3]=cc[0];g.col[i*3+1]=cc[1];g.col[i*3+2]=cc[2]});gl.bindBuffer(gl.ARRAY_BUFFER,CLUMP.gl.bufs[2]);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(g.col))}
  for(const it of items){if(it.lid)it.color=COAT.base.map(v=>v*.85);if(it.brow)it.color=COAT.dark.map(v=>v*.8)}kitRecolorFur()}
''')
# keep CPU copies of every uploaded geometry (the exporter reads them)
sub("gl.bindVertexArray(null);return {vao,count,indexed,bufs}}","gl.bindVertexArray(null);return {vao,count,indexed,bufs,src:{g,extra}}}")
# face: warm brown eyes, tagged lids & brows
s=s.replace("hex(s>0?0x5f9fd6:0x6e4322)","hex(0x5a3418)").replace("hex(s>0?0x24496e:0x2e1a0c)","hex(0x26140a)")
sub("{color:skC.map(v=>v*.8),flat:0,rough:.8,cast:false,rim:.25,skinD:1}","{color:skC.map(v=>v*.8),flat:0,rough:.8,cast:false,rim:.25,skinD:1,lid:1}")
sub("{color:skC.map(v=>v*.8),flat:0,rough:.8,cast:false,skinD:1}","{color:skC.map(v=>v*.8),flat:0,rough:.8,cast:false,skinD:1,lid:1}")
sub("addItem(gBrow,bg,{color:hex(0xa8642e),flat:0,rough:.7,cast:false});","addItem(gBrow,bg,{color:hex(0xa8642e),flat:0,rough:.7,cast:false,brow:1});")
sub("// heterochromia: one blue eye, one brown eye","// warm brown eyes")
# merle block only matches grey: harmless, but turn it off
s=s.replace("float greyM=smoothstep(.55,.42,mxc)","float greyM=0.*smoothstep(.55,.42,mxc)")
# ---------------- studio by default, habitat optional
sub("precision highp float;in vec2 vP;out vec4 o;uniform mat4 uIVP;uniform vec3 uCam,uSun;","precision highp float;in vec2 vP;out vec4 o;uniform mat4 uIVP;uniform vec3 uCam,uSun;uniform float uStudio;")
sub(" o=vec4(pow(aces(c*.95),vec3(1./2.2)),1.);}`;"," if(uStudio>.5)c=mix(vec3(.95,.93,.9),vec3(.74,.79,.86),pow(h,.5))*.85;\n o=vec4(pow(aces(c*.95),vec3(1./2.2)),1.);}`;")
sub("gl.uniform3fv(PS.U.uSun,SUN);","gl.uniform3fv(PS.U.uSun,SUN);gl.uniform1f(PS.U.uStudio,KIT.bg?0:1);")
sub("function drawShells(U){if(wireItem.visible||window.__noFur)return;","function drawShells(U){return;")  # fur is real geometry now (exports)
sub("buildFace();const env=buildEnv();initParticles();","buildFace();buildClumps();const _n0=items.length;const env=buildEnv();KIT.env=items.slice(_n0);kitStudio();initParticles();")
sub("function init(){","const ASSET_NAME='GoldenRetriever';\n"+KIT+"\nfunction init(){")
sub("refreshUI();const L=document.getElementById('load')","window.__coat&&window.__coat();kitBuildFur({count:22000,len:0.05,width:0.0055,tip:.28,color:i=>coatColor(COATM[i])});kitBuildUI();refreshUI();const L=document.getElementById('load')")
sub('  <div class="row face" id="faces"><span class="lbl">Face</span></div>\n</div>','  <div class="row face" id="faces"><span class="lbl">Face</span></div>\n  <div class="row face" id="coats"><span class="lbl">Coat</span></div>\n  <div class="row face" id="asset"><span class="lbl">Asset</span></div>\n</div>')
sub("window.__pig={",r"""{const CO=[['Light golden',0xd9ad72,0xf0d8ae,0xbf8a4c],['Golden',0xc27e3c,0xe2b578,0x9c5e26],['Dark golden',0xa2582a,0xc98450,0x7a3c18]];
  const row=document.getElementById('coats');CO.forEach((c,i)=>{const b=document.createElement('button');b.innerHTML=`<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#${c[1].toString(16).padStart(6,'0')};margin-right:6px;vertical-align:-2px"></span>${c[0]}`;
    b.onclick=()=>{setCoat(c);for(const x of row.querySelectorAll('button'))x.classList.toggle('on',x===b)};if(i===1)b.classList.add('on');row.appendChild(b)});window.__coat=()=>setCoat(CO[1])}
window.__pig={B,items,""")
# camera & text
sub("const cam={th:0.62,ph:1.24,d:3.7,target:[0,0.56,0],eye:[0,0,0]};","const cam={th:0.7,ph:1.3,d:3.6,target:[0,0.5,0],eye:[0,0,0]};")
sub("one furry skin · blue merle coat · 21 bones · drag to orbit","toon asset · one skin · soft fur + feathered coat · export GLB / glTF / FBX / three.js r187")
sub("<title>Low-Poly Menagerie · 06 Australian Shepherd</title>","<title>Low-Poly Menagerie · 15 Golden Retriever</title>")
sub("06 / 20 · LOW-POLY MENAGERIE</span><h1>Australian Shepherd</h1>","15 / 20 · LOW-POLY MENAGERIE</span><h1>Golden Retriever</h1>")
sub("Fluffing the coat…","Brushing the golden coat…")
open('/home/claude/retriever/index.html','w').write(s);print('ok',len(s))
