# breeds, horse-shaped head, tail carried up at speed.  run after make.py
s=open('/home/claude/horse/index.html').read()
def sub(old,new):
    global s
    assert s.count(old)==1,(s.count(old),old[:90]); s=s.replace(old,new)

# ---------- head: broad forehead, round jowls, deep jaw, square muzzle, defined throatlatch
sub("function sdSnout(x,y,z){return sdEll(x,y,z,0,1.62,1.47,0.1,0.1,0.11)}",
r"""function sdSnout(x,y,z){return smin(sdEll(x,y,z,0,1.635,1.45,0.108,0.108,0.11),sdEll(x,y,z,0,1.6,1.5,0.08,0.055,0.062),0.04)}
function sdHHead(x,y,z){const ax=Math.abs(x);
  let h=sdCone(x*1.1,y,z,0,1.99,1.1,0,1.7,1.41,0.112,0.094)/1.1;          // flat face
  h=smin(h,sdEll(x,y,z,0,2.03,1.07,0.112,0.085,0.12),0.05);                   // poll + broad forehead
  h=smin(h,sdEll(ax,y,z,0.05,1.84,1.08,0.088,0.15,0.145),0.05);            // round cheeks / jowls
  h=smin(h,sdCone(x*1.2,y,z,0,1.8,1.13,0,1.59,1.41,0.07,0.05)/1.2,0.06);      // lower jaw line
  h=smin(h,sdSnout(x,y,z),0.05);h=smin(h,sdEll(x,y,z,0,1.565,1.445,0.058,0.038,0.052),0.03); // chin
  return h}""")
sub("  d=smin(d,smin(sdCone(x,y,z,0,2.0,1.05,0,1.66,1.42,0.12,0.095),sdEll(x,y,z,0,1.86,1.08,0.115,0.14,0.15),0.06),0.06);\n  d=smin(d,sdSnout(x,y,z),0.05);",
    "  d=smin(d,sdHHead(x,y,z),0.035);")
sub("d=smin(d,sdCone(x*1.3,y,z,0,1.35,0.62,0,1.92,1.0,0.3,0.15)/1.3,0.1);","d=smin(d,sdCone(x*1.3,y,z,0,1.35,0.62,0,1.87,0.96,0.3,0.105)/1.3,0.1);")
sub("const dir=vnorm([0.92*s,0.25,0.3]);const S=marchOut([0,1.93,1.1],dir);","const dir=vnorm([0.95*s,0.16,0.26]);const S=marchOut([0,1.94,1.12],dir);")

# ---------- breed profile morph (dished Arabian face / convex Roman nose) on the skin's 2nd morph slot
sub("window.__skin={pos,si,sw};return {geo:upload(g,{si,sw,m1:pos,hair}),wire:upload(wg,{si,sw,m1:pos,hair}),tris:idx.length/3}}",
r"""window.__skin={pos,si,sw};const m2=[];const C0=[0,1.905,1.335],FN=vnorm([0,.73,.68]);
  for(let i=0;i<N;i++){const p=[pos[i*3],pos[i*3+1],pos[i*3+2]],n=[nor[i*3],nor[i*3+1],nor[i*3+2]];const r=vlen(vsub(p,C0));
    const g=Math.exp(-Math.pow(r/.12,2))*Math.max(0,vdot(n,FN))*sstep(1.0,1.12,p[2]);m2.push(...vsub(p,vsc(n,.05*g)))}
  return {geo:upload(g,{si,sw,m1:pos,m2,hair}),wire:upload(wg,{si,sw,m1:pos,m2,hair}),tris:idx.length/3}}""")
sub("gl.uniform2fv(U.uMW,[0,0]);","gl.uniform2fv(U.uMW,pigItem.mw);")

# ---------- tail: streams back and up at the gallop, flags when prancing, never tucks under
sub("earBob(P,-.5,-.1);TB.forEach((n,i)=>S(P,n,-.35-i*.05,Math.sin(ph-i*.5)*.06,0));","earBob(P,-.5,-.1);TB.forEach((n,i)=>S(P,n,[.95,.12,.02,-.06,-.06][i],Math.sin(ph-i*.5)*.07,0));")
sub("swish(P,t,3,.15,-.1);earBob(P,-.1,0);return P},","swish(P,t,3,.15,.38);earBob(P,-.1,0);return P},")
sub("swish(P,t,4,.2,-.3);earBob(P,-.1,0);return P},","swish(P,t,4,.2,.7);earBob(P,-.1,0);return P},")
sub("TB.forEach((n,i)=>S(P,n,-.4*tk,0,0))}","TB.forEach((n,i)=>S(P,n,(i?.1:.7)*tk,0,0))}")
sub("swish(P,t,8,.3*k,-.4*k);return P},speed:()=>0,face:t=>t<1.2?'angry':'neutral',","swish(P,t,8,.3*k,.6*k);return P},speed:()=>0,face:t=>t<1.2?'angry':'neutral',")
# knee action per breed
sub("function gaitLeg(P,n,q,amp,lift,back){S(P,n+'U',-Math.sin(q)*amp,0,0);S(P,n+'L',Math.pow(Math.max(0,Math.cos(q)),1.3)*lift*(back?0.8:1),0,0)}",
    "function gaitLeg(P,n,q,amp,lift,back){S(P,n+'U',-Math.sin(q)*amp*(back?1:BR.ka*.9+.1),0,0);S(P,n+'L',Math.pow(Math.max(0,Math.cos(q)),1.3)*lift*(back?0.8:BR.ka),0,0)}")

# ---------- mane/tail variants + fetlock feathering
a=s.index("function buildManeTail(){");b=s.index("maneItem=addItem(",a);b=s.index("}\n",b)+2
s=s[:a]+r"""const MANES={};let featherItem;
function buildManeTail(){for(const [k,o] of Object.entries({std:{},long:{len:2.1,n:230,wave:1,th:1.15,tl:1.25,tn:1.6},sparse:{len:.6,n:80,th:.75,tl:1,tn:.7,fl:.3}})){MANES[k]=buildMane(o);MANES[k].visible=k==='std'}
  buildFeathering()}
function buildMane(o){const A={pos:[],nor:[],col:[],idx:[],si:[],sw:[]};const K=o.len||1,TH=o.th||1,WV=o.wave||0;
  const put=(g,wf,sh)=>{const b=A.pos.length/3;for(let i=0;i<g.n;i++){const p=[g.pos[i*3],g.pos[i*3+1],g.pos[i*3+2]];A.pos.push(...p);A.nor.push(g.nor[i*3],g.nor[i*3+1],g.nor[i*3+2]);A.col.push(sh,sh,sh);const [I,W]=wf(p);A.si.push(...I);A.sw.push(...W)}for(const k of g.idx)A.idx.push(k+b)};
  const neckW=p=>{const W=[];for(const n of ['chest','neck','head'])W.push([BN.indexOf(n),1/Math.pow(segDist(p,...SEG[n])+0.05,4)]);return topW(W)};
  const perp=vnorm([0,0.52,-0.85]);const NM=o.n||160;
  for(let i=0;i<NM;i++){const t=i/(NM-1);const c=vadd([0,1.4,0.62],vsc([0,0.6,0.37],t*0.95));const r=vadd(marchOut(c,perp),vsc(perp,-0.012));const L=rr(0.18,0.3)*(1-0.35*t)*K;const side=rnd()<0.85?1:-0.6;
    const ph=rnd()*TAU,wv=u=>WV*.028*Math.sin(u*9+ph);
    const P=[r,vadd(r,[0.03*side,0.035,-0.02]),vadd(r,[0.09*side,-0.04,-0.05]),vadd(r,[(0.12+wv(.4))*side,-L*0.4,-0.06]),vadd(r,[(0.14+wv(.7))*side,-L*0.72,-0.055]),vadd(r,[(0.15+wv(1))*side,-L,-0.05])];
    put(tube(P,WV?12:8,u=>lerp(0.03*TH,0.004,u),5,false),p=>neckW(r),rr(0.85,1.1))}
  const NF=Math.round(14*(o.fl||1)*(K>1?1.6:1));for(let i=0;i<NF;i++){const r=[rr(-0.03,0.03),2.09,1.04+rr(-0.02,0.02)];const L2=Math.min(K,1.5);const P=[r,vadd(r,[rr(-.02,.02),0.02,0.05]),vadd(r,[rr(-.04,.04),-0.06*L2,0.1]),vadd(r,[rr(-.05,.05),-0.15*L2,0.13])];
    put(tube(P,6,u=>lerp(0.016,0.003,u),5,false),()=>[[BN.indexOf('head'),0,0,0],[1,0,0,0]],rr(0.85,1.1))}
  const TP=(o.tl||1)>1.1?[...TAILP,[0,.38,-1.04],[0,.2,-1.02]]:TAILP;const TF=catmull(TP);const TN=Math.round(70*(o.tn||1));
  for(let i=0;i<TN;i++){const a=rnd()*TAU,rad=Math.sqrt(rnd());const P=[];const len=rr(0.85,1)*Math.min(1,o.tl||1);const ph=rnd()*TAU;
    for(let j=0;j<=7;j++){const t=j/7*len;const c=TF(t);const spread=0.015+t*0.09+(WV?.02*Math.sin(t*12+ph)*t:0);P.push(vadd(c,[Math.cos(a)*rad*spread,0,Math.sin(a)*rad*spread*0.7]))}
    put(tube(P,10,u=>lerp(0.016*TH,0.004,u),5,false),tailW,rr(0.85,1.1))}
  const g=new Geo();g.pos=A.pos;g.nor=A.nor;g.col=A.col;g.idx=A.idx;
  return addItem(upload(g,{si:A.si,sw:A.sw,m1:A.pos}),null,{skin:true,flat:0,rough:.45,spec:.7,rim:.3})}
function buildFeathering(){const A={pos:[],nor:[],col:[],idx:[],si:[],sw:[]};
  for(const [bn,c] of [['flL',[.17,.0,.62]],['frL',[-.17,0,.62]],['blL',[.18,0,-.67]],['brL',[-.18,0,-.67]]]){const bi=BN.indexOf(bn);
    for(let i=0;i<46;i++){const a=rnd()*TAU,y=rr(.1,.3);const r=marchOut([c[0],y,c[2]+(bn[0]==='f'?-.02:0)],[Math.cos(a),0,Math.sin(a)]);const out=[Math.cos(a),0,Math.sin(a)];const L=rr(.12,.2)*(.6+y*1.6);
      const P=[r,vadd(r,vadd(vsc(out,.025),[0,-.03,0])),vadd(r,vadd(vsc(out,.05),[0,-L*.6,0])),vadd(r,vadd(vsc(out,.06),[0,-Math.min(L,y-.012),0]))];
      const g=tube(P,6,u=>lerp(.012,.003,u),4,false);const b=A.pos.length/3;for(let k=0;k<g.n;k++){A.pos.push(g.pos[k*3],g.pos[k*3+1],g.pos[k*3+2]);A.nor.push(g.nor[k*3],g.nor[k*3+1],g.nor[k*3+2]);const sh=rr(.85,1.1);A.col.push(sh,sh,sh);A.si.push(bi,0,0,0);A.sw.push(1,0,0,0)}for(const k of g.idx)A.idx.push(k+b)}}
  const g=new Geo();g.pos=A.pos;g.nor=A.nor;g.col=A.col;g.idx=A.idx;featherItem=addItem(upload(g,{si:A.si,sw:A.sw,m1:A.pos}),null,{skin:true,flat:0,rough:.5,spec:.5,rim:.35});featherItem.visible=false}
"""+s[b:]
sub("if(maneItem)maneItem.color=hex(c[3]);","for(const k in MANES)MANES[k].color=hex(c[3]);if(featherItem)featherItem.color=hex(c[3]).map(v=>Math.min(1,v*1.15+.02));")

# ---------- coat sheen (Akhal-Teke metallic gloss)
sub("uniform float uCoatK,uSocks;","uniform float uCoatK,uSocks,uGloss;")
sub("float sp=pow(max(dot(N,H),0.),gloss)*(1.-uRough)*uSpec;","float sp=pow(max(dot(N,H),0.),gloss)*(1.-uRough)*uSpec;if(uSkinD>0.||uShellL>0.){sp*=uGloss;sheen*=.5+.5*uGloss;}")
sub(" vec3 col=base*(hemi+"," float met=clamp(uGloss-1.5,0.,1.)*step(.001,uSkinD+uShellL);vec3 spC=mix(vec3(1.),normalize(base+.001)*1.6,met*.55);\n vec3 col=base*(hemi+")
sub("+uSunC*sp*sh+","+uSunC*sp*sh*spC*(1.+met*1.4)+met*sh*uSunC*base*pow(max(dot(N,H),0.),14.)*1.8+met*uSky*base*pow(fr,2.)*1.6+")
sub("function drawShells(U){if(wireItem.visible||window.__noFur)return;","function drawShells(U){if(wireItem.visible||window.__noFur||BR.sleek)return;")
sub("gl.uniform1f(U.uSocks,COAT.S);","gl.uniform1f(U.uSocks,COAT.S);gl.uniform1f(U.uGloss,BR.gloss);")
# golden coat
sub("['White',0xe6e2da,0xbdb8b0,0xf2efe8,0,0]];","['White',0xe6e2da,0xbdb8b0,0xf2efe8,0,0],['Golden',0xd9b06a,0xc29a58,0xe9d3a2,0,0],['Grey',0xb4b2ae,0x55524e,0xe8e6e0,0,0]];")
sub("CO.forEach((c,i)=>{const b=document.createElement('button');","window.__coatBtn={};CO.forEach((c,i)=>{const b=document.createElement('button');window.__coatBtn[c[0]]=b;")

# ---------- breeds
sub('  <div class="row face" id="coats"><span class="lbl">Coat</span></div>','  <div class="row face" id="breeds"><span class="lbl">Breed</span></div>\n  <div class="row face" id="coats"><span class="lbl">Coat</span></div>')
sub("let COAT={A:hex(0x74391a),B:hex(0x1a1412),K:0,S:0};",r"""let COAT={A:hex(0x74391a),B:hex(0x1a1412),K:0,S:0};
const BREEDS=[
 {n:'Quarter Horse',coat:'Bay',s:1,wx:1.07,dish:0,neck:.97,leg:.98,mane:'std',feath:0,tl:0,ka:1,gloss:1.1},
 {n:'Arabian',coat:'Grey',carry:.15,s:.9,wx:.93,dish:1,neck:1.04,leg:1.03,mane:'std',feath:0,tl:.45,ka:1.08,gloss:1.3},
 {n:'Akhal-Teke',coat:'Golden',s:1.02,wx:.8,dish:.1,neck:1.2,leg:1.1,mane:'sparse',feath:0,tl:.12,ka:1.12,gloss:3.2,carry:.22,sleek:1},
 {n:'Friesian',coat:'Black',carry:.12,s:1.05,wx:1.08,dish:-.15,neck:1.06,leg:1,mane:'long',feath:1,tl:.1,ka:1.5,gloss:1.8},
 {n:'Andalusian',coat:'White',carry:.1,s:1,wx:1.04,dish:-.45,neck:1.03,leg:1,mane:'long',feath:0,tl:.12,ka:1.3,gloss:1.4},
 {n:'Spanish Norman',coat:'Dapple grey',s:1.13,wx:1.2,dish:-.75,neck:.96,leg:.97,mane:'long',feath:.6,tl:.05,ka:1.15,gloss:1}];
let BR=BREEDS[0];
function setBreed(b){BR=b;for(const k in MANES)MANES[k].visible=k===b.mane;featherItem.visible=b.feath>0;pigItem.mw=[0,b.dish];wireItem.mw=[0,b.dish];
  const cb=window.__coatBtn&&window.__coatBtn[b.coat];if(cb)cb.click()}
window.__pig.setBreed=setBreed;""")
sub("refreshUI();const L=document.getElementById('load')",r"""{const row=document.getElementById('breeds');BREEDS.forEach((b,i)=>{const e=document.createElement('button');e.textContent=b.n;
    e.onclick=()=>{setBreed(b);for(const x of row.querySelectorAll('button'))x.classList.toggle('on',x===e)};if(!i)e.classList.add('on');row.appendChild(e)});window.__breed=i=>row.querySelectorAll('button')[i].click()}
  refreshUI();const L=document.getElementById('load')""")
sub("pigN.p=[st.pos[0],0,st.pos[2]];pigN.r=[0,st.head,0];",
    "pigN.p=[st.pos[0],0,st.pos[2]];pigN.r=[0,st.head,0];pigN.s=[BR.s*BR.wx,BR.s,BR.s];B.head.p=vsc(B.head.rest,BR.neck);for(const n of ['flL','frL','blL','brL'])B[n].p=vsc(B[n].rest,BR.leg);B.t0.r[0]+=BR.tl*(1-st.w.sleep)*(1-st.w.sit);{const aw2=(1-st.w.eat)*(1-st.w.sleep)*(1-st.w.sit);B.neck.r[0]-=(BR.carry||0)*aw2;B.head.r[0]+=(BR.carry||0)*.55*aw2;B.earL.r[0]-=(BR.carry||0)*.8*aw2;B.earR.r[0]-=(BR.carry||0)*.8*aw2}")
sub("one sleek skin · flowing mane & tail · 21 bones · drag to orbit","six breeds · one sleek skin · flowing mane & tail · drag to orbit")
open('/home/claude/horse/index.html','w').write(s);print('ok',len(s))
