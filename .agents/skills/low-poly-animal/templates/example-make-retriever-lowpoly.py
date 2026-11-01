# Low-poly golden retriever: run after make.py (reads its index.html)
import re,subprocess
subprocess.run(['python3','/home/claude/retriever/make.py'],check=True)
s=open('/home/claude/retriever/index.html').read()
def sub(old,new,cnt=1):
    global s
    assert s.count(old)==cnt,(s.count(old),old[:90]); s=s.replace(old,new)

# ---------- skin: sculpt at full detail, then quadric-error decimation (detail kept where it reads: face, ears, paws, tail tip), then unweld for flat facets
a=s.index("function buildPig(){");b=s.index("let scaleItem;",a)
s=s[:a]+r'''const LP={target:2900};
// quadric edge-collapse decimation (Garland-Heckbert) with link-condition + fold-over checks
function qemDecimate(pos,idx,target,imp){const nv=pos.length/3;const P=[];for(let i=0;i<nv;i++)P.push([pos[i*3],pos[i*3+1],pos[i*3+2]]);
  const F=[];for(let t=0;t<idx.length;t+=3)F.push([idx[t],idx[t+1],idx[t+2]]);const alive=F.map(()=>true);let nAlive=F.length;
  const Q=Array.from({length:nv},()=>new Float64Array(10)),VF=Array.from({length:nv},()=>new Set());
  const fN=f=>vcross(vsub(P[f[1]],P[f[0]]),vsub(P[f[2]],P[f[0]]));
  F.forEach((f,fi)=>{const n=fN(f),l=vlen(n);for(const v of f)VF[v].add(fi);if(l<1e-14)return;const nn=vsc(n,1/l),d=-vdot(nn,P[f[0]]),w=l*.5;
    for(const v of f){const q=Q[v],k=w*imp(v);q[0]+=k*nn[0]*nn[0];q[1]+=k*nn[0]*nn[1];q[2]+=k*nn[0]*nn[2];q[3]+=k*nn[0]*d;q[4]+=k*nn[1]*nn[1];q[5]+=k*nn[1]*nn[2];q[6]+=k*nn[1]*d;q[7]+=k*nn[2]*nn[2];q[8]+=k*nn[2]*d;q[9]+=k*d*d}});
  const err=(q,x)=>q[0]*x[0]*x[0]+2*q[1]*x[0]*x[1]+2*q[2]*x[0]*x[2]+2*q[3]*x[0]+q[4]*x[1]*x[1]+2*q[5]*x[1]*x[2]+2*q[6]*x[1]+q[7]*x[2]*x[2]+2*q[8]*x[2]+q[9];
  const stamp=new Int32Array(nv),dead=new Uint8Array(nv);
  const best=(u,v)=>{const q=new Float64Array(10);for(let i=0;i<10;i++)q[i]=Q[u][i]+Q[v][i];
    const a=q[0],b=q[1],c=q[2],d=q[4],e=q[5],f=q[7];const det=a*(d*f-e*e)-b*(b*f-c*e)+c*(b*e-c*d);let x=null;
    if(Math.abs(det)>1e-12){const r=[-q[3],-q[6],-q[8]];x=[(r[0]*(d*f-e*e)-b*(r[1]*f-e*r[2])+c*(r[1]*e-d*r[2]))/det,(a*(r[1]*f-e*r[2])-r[0]*(b*f-c*e)+c*(b*r[2]-r[1]*c))/det,(a*(d*r[2]-r[1]*e)-b*(b*r[2]-r[1]*c)+r[0]*(b*e-c*d))/det];
      if(vlen(vsub(x,vsc(vadd(P[u],P[v]),.5)))>vlen(vsub(P[u],P[v]))*2)x=null}
    const C=[P[u],P[v],vsc(vadd(P[u],P[v]),.5)];if(x)C.push(x);let bx=C[0],be=Infinity;for(const c of C){const e2=err(q,c);if(e2<be){be=e2;bx=c}}return [be,bx]};
  const H=[];const push=(u,v)=>{const [c,x]=best(u,v);H.push([c,u,v,stamp[u],stamp[v],x]);let i=H.length-1;while(i>0){const p=(i-1)>>1;if(H[p][0]<=H[i][0])break;[H[p],H[i]]=[H[i],H[p]];i=p}};
  const pop=()=>{const top=H[0],last=H.pop();if(H.length){H[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<H.length&&H[l][0]<H[m][0])m=l;if(r<H.length&&H[r][0]<H[m][0])m=r;if(m===i)break;[H[m],H[i]]=[H[i],H[m]];i=m}}return top};
  const nbr=u=>{const s=new Set();for(const fi of VF[u])for(const w of F[fi])if(w!==u)s.add(w);return s};
  for(let u=0;u<nv;u++)for(const w of nbr(u))if(u<w)push(u,w);
  while(nAlive>target&&H.length){let [c,u,v,su,sv,x]=pop();if(dead[u]||dead[v]||stamp[u]!==su||stamp[v]!==sv)continue;
    const nu=nbr(u),nvv=nbr(v);if(!nu.has(v))continue;let common=0;for(const w of nu)if(nvv.has(w))common++;if(common!==2)continue;
    let ok=true;for(const w of [u,v])for(const fi of VF[w]){const f=F[fi];if(f.includes(u)&&f.includes(v))continue;const n0=fN(f);const g=f.map(k=>k===u||k===v?x:P[k]);
      const n1=vcross(vsub(g[1],g[0]),vsub(g[2],g[0]));if(vdot(n0,n1)<=1e-4*vlen(n0)*vlen(n1)||vlen(n1)<1e-14){ok=false;break}}if(!ok)continue;
    if(vlen(vsub(x,P[v]))<vlen(vsub(x,P[u]))){const t=u;u=v;v=t}               // survivor keeps its attributes: the one nearest the new spot
    P[u]=x;for(let i=0;i<10;i++)Q[u][i]+=Q[v][i];
    for(const fi of [...VF[v]]){const f=F[fi];if(f.includes(u)){alive[fi]=false;nAlive--;for(const w of f)VF[w].delete(fi)}else{f[f.indexOf(v)]=u;VF[u].add(fi)}}
    VF[v].clear();dead[v]=1;stamp[u]++;for(const w of nbr(u))stamp[w]++;for(const w of nbr(u)){for(const z of nbr(w))if(z!==w)push(w,z)}}
  const map=new Int32Array(nv).fill(-1),keep=[];const outF=[];F.forEach((f,fi)=>{if(!alive[fi])return;for(const v of f)if(map[v]<0){map[v]=keep.length;keep.push(v)}outF.push(f.map(v=>map[v]))});
  return {keep,P:keep.map(v=>P[v]),F:outF}}
let LPW=null;
function buildPig(){
  const f=pigSDF;const sn=surfaceNets(f,[-0.23,-0.02,-1.06],[0.23,1.0,0.92],0.019);
  relax(f,sn.pos,sn.idx,3);orient(f,sn.pos,sn.idx);
  const pos=sn.pos,idx=sn.idx,N=pos.length/3;const M0=[],W0=[];for(let i=0;i<N;i++){const p=[pos[i*3],pos[i*3+1],pos[i*3+2]];M0.push(coatMask(p));W0.push(pigWeights(p))}
  const imp=i=>{const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2],ax=Math.abs(x);let k=1;if(z>0.46&&y>0.6)k+=7;if(sdEar(ax,y,z)<0.02)k+=6;if(y<0.09)k+=3;if(z<-0.85)k+=2;if(z>0.66&&y<0.8)k+=5;return k};
  const D=qemDecimate(pos,idx,LP.target,imp);
  // welded low mesh (outline + soft-fur base), then unwelded flat-faceted render mesh
  const wpos=D.P.flat(),wnor=Array(wpos.length).fill(0);D.F.forEach(t=>{const n=vcross(vsub(D.P[t[1]],D.P[t[0]]),vsub(D.P[t[2]],D.P[t[0]]));for(const v of t)for(let q=0;q<3;q++)wnor[v*3+q]+=n[q]});
  for(let i=0;i<wnor.length;i+=3){const n=vnorm([wnor[i],wnor[i+1],wnor[i+2]]);wnor[i]=n[0];wnor[i+1]=n[1];wnor[i+2]=n[2]}
  LPW={pos:wpos,nor:wnor,idx:D.F.flat(),si:D.keep.flatMap(v=>W0[v][0]),sw:D.keep.flatMap(v=>W0[v][1])};
  const fp=[],fn=[],fc=[],fi=[],si=[],sw=[],hair=[];COATM=[];
  D.F.forEach(t=>{const n=vnorm(vcross(vsub(D.P[t[1]],D.P[t[0]]),vsub(D.P[t[2]],D.P[t[0]])));const ms=t.map(v=>M0[D.keep[v]]);const m=[0,1,2].map(q=>(ms[0][q]+ms[1][q]+ms[2][q])/3);const jit=rr(-.02,.02);
    for(const v of t){const o=D.keep[v];fp.push(...D.P[v]);fn.push(...n);const mm=[clamp(m[0]+jit,0,1),m[1],m[2]];COATM.push(mm);fc.push(...coatColor(mm));si.push(...W0[o][0]);sw.push(...W0[o][1]);hair.push(m[2]);fi.push(fi.length)}});
  const g=new Geo();g.pos=fp;g.nor=fn;g.col=fc;g.idx=fi;
  const wg=new Geo();wg.pos=wpos;wg.nor=wnor;wg.col=Array(wpos.length).fill(1);for(let t=0;t<LPW.idx.length;t+=3)wg.idx.push(LPW.idx[t],LPW.idx[t+1],LPW.idx[t+1],LPW.idx[t+2],LPW.idx[t+2],LPW.idx[t]);
  return {geo:upload(g,{si,sw,m1:fp,hair}),wire:upload(wg,{si:LPW.si,sw:LPW.sw,m1:wpos}),tris:D.F.length}}
// inverted-hull outline: the welded low mesh pushed out along its normals, winding flipped, drawn with back-face culling
function buildOutline(){const o=[],ix=[];for(let i=0;i<LPW.pos.length;i+=3){o.push(LPW.pos[i]+LPW.nor[i]*.0065,LPW.pos[i+1]+LPW.nor[i+1]*.0065,LPW.pos[i+2]+LPW.nor[i+2]*.0065)}
  for(let t=0;t<LPW.idx.length;t+=3)ix.push(LPW.idx[t],LPW.idx[t+2],LPW.idx[t+1]);const g=new Geo();g.pos=o;g.nor=LPW.nor.map(v=>-v);g.col=Array(o.length).fill(1);g.idx=ix;
  KIT.outline=addItem(upload(g,{si:LPW.si,sw:LPW.sw,m1:o}),null,{skin:true,color:hex(0x2a1a10).map(v=>v*.6),emis:[0,0,0],flat:0,rough:1,spec:0,rim:0,cast:false,outline:true,unlit:true,noFBX:true,cullBack:true})}
'''+s[b:]
# chunky low-poly tufts instead of the strand clumps (each tuft: 3-sided, two segments, 9 faceted triangles)
a=s.index("function buildClumps(){");b=s.index("function setCoat(c){",a)
s=s[:a]+r'''function buildClumps(){const A={pos:[],nor:[],col:[],idx:[],si:[],sw:[],meta:[]};
  const tuft=(root,dir,L,r0,kl)=>{L*=.85;r0*=1.35;const d=vnorm(dir),s1=vnorm(vcross(d,[0,1,0.001])),s2=vcross(s1,d);const W=pigWeights(root);
    const ring=(c,r,ph)=>[0,1,2].map(k=>{const a=ph+k*TAU/3;return vadd(c,vadd(vsc(s1,Math.cos(a)*r),vsc(s2,Math.sin(a)*r)))});
    const mid=vadd(root,vadd(vsc(d,L*.5),[0,-L*.1,0])),tip=vadd(root,vadd(vsc(d,L),[0,-L*.32,0]));const R0=ring(root,r0,rnd()*TAU),R1=ring(mid,r0*.62,0.5);
    const tri=(a,b,c,k)=>{const n=vnorm(vcross(vsub(b,a),vsub(c,a)));const base=A.pos.length/3;for(const p of [a,b,c]){A.pos.push(...p);A.nor.push(...n);A.col.push(1,1,1);A.si.push(...W[0]);A.sw.push(...W[1]);A.meta.push([clamp(kl+k,0,1),rr(.92,1.06)])}A.idx.push(base,base+1,base+2)};
    for(let k=0;k<3;k++){const k2=(k+1)%3;tri(R0[k],R0[k2],R1[k2],0);tri(R0[k],R1[k2],R1[k],0);tri(R1[k],R1[k2],tip,.25)}};
  const IE=M4.inv(EAR_M);
  for(const s of [1,-1])for(let i=0;i<3;i++){const a=-PI*(.3+.2*i);const q=[0,-0.078+0.088*Math.sin(a),0.055*Math.cos(a)];let p=M4.pt(IE,q);p=[p[0]*s,p[1],p[2]];tuft(p,[s*.2,-1,-.1],.07,.022,.15)}
  for(let i=0;i<9;i++){const x=(i%3-1)*.05,y=.6-Math.floor(i/3)*.07;const r=marchOut([x,y,.22],vnorm([x*4,-.1,1]));tuft(vadd(r,[0,0,-.01]),[x*3,-.85,.5],.11,.028,.55)}
  for(let i=0;i<5;i++){const a=-1.2+i*.6;const r=marchOut([0,.68,.42],vnorm([Math.sin(a),Math.cos(a)*.6+.2,-.35]));tuft(vadd(r,[0,-.008,0]),[Math.sin(a)*.4,-.45,-.8],.085,.024,.3)}
  for(const s of [1,-1]){for(let i=0;i<2;i++){const r=marchOut([s*.09,.26+i*.12,.33],[0,0,-1]);tuft(r,[s*.1,-.8,-.55],.075,.018,.55)}
    for(let i=0;i<4;i++){const r=marchOut([s*.1,.33+i*.065,-.3],vnorm([s*.5,0,-1]));tuft(r,[s*.25,-.8,-.55],.1,.025,.6)}}
  for(let i=0;i<4;i++){const r=marchOut([(i%2?.05:-.05),.47,-.1+i*.09],[0,-1,0]);tuft(r,[0,-1,-.35],.07,.022,.7)}
  const TF=catmull(TAILP);for(let i=0;i<9;i++){const t=.15+i*.1;const c=TF(t);const a=-PI/2+(i%3-1)*.75;const r=marchOut(c,[Math.cos(a),Math.sin(a),0]);
    tuft(r,[Math.cos(a)*.45,-.85,-.5],.07+.08*Math.sin(PI*Math.min(1,t*1.1)),.026,.5)}
  const g=new Geo();g.pos=A.pos;g.nor=A.nor;g.col=A.col;g.idx=A.idx;
  CLUMP=addItem(upload(g,{si:A.si,sw:A.sw,m1:A.pos}),null,{skin:true,flat:1,rough:.85,spec:.1,rim:.3});CLUMP.meta=A.meta;CLUMP.src=g;KIT.tufts=A.idx.length/3}
'''+s[b:]
# low-segment face parts
rep=[("sphere(rE,28,20)","sphere(rE,12,8)"),("sphere(rE*1.004,32,10,0,TAU,0,1.0)","sphere(rE*1.004,12,3,0,TAU,0,1.0)"),("sphere(rE*1.03,28,8,0,TAU,0,0.44)","sphere(rE*1.03,10,2,0,TAU,0,0.44)"),
     ("sphere(rE*1.012,32,4,0,TAU,0.92,0.08)","sphere(rE*1.012,12,1,0,TAU,0.92,0.08)"),("sphere(rE*.2,12,8)","sphere(rE*.2,6,4)"),("sphere(rE*.09,10,6)","sphere(rE*.09,5,3)"),
     ("sphere(rE*1.14,32,12,0,TAU,0,PI/2)","sphere(rE*1.14,12,4,0,TAU,0,PI/2)"),("sphere(rE*1.12,32,12,0,TAU,PI/2,PI/2)","sphere(rE*1.12,12,4,0,TAU,PI/2,PI/2)"),
     ("torus(rE*1.14,rE*.1,6,40)","torus(rE*1.14,rE*.1,3,12)"),("torus(rE*1.12,rE*.07,6,40)","torus(rE*1.12,rE*.07,3,12)"),
     ("14,u=>0.006+0.006*Math.sin(u*PI),7)","4,u=>0.006+0.006*Math.sin(u*PI),4)"),("const gNos=upload(sphere(1,18,12));","const gNos=upload(sphere(1,8,5));"),
     ("10,0.0035,6)),phN","4,0.0035,4)),phN"),("tube(mouthPts(k),22,u=>0.0045*(0.55+0.45*Math.sin(u*PI)),6,true)","tube(mouthPts(k),8,u=>0.0045*(0.55+0.45*Math.sin(u*PI)),4,true)"),
     ("cyl(0,0.007,0.022,6)","cyl(0,0.007,0.022,4)"),("NS=26,NR=14","NS=9,NR=6")]
for o,n in rep: sub(o,n)
# toon light: three steps; facets everywhere on the skin
sub("uniform float uOp,uFlat,","uniform float uToon;uniform float uOp,uFlat,")
sub(" vec3 col=base*(hemi+uSunC*mix(ndl,wrap,.25+sheen)*sh)+uSunC*sp*sh+"," float lt=mix(ndl,wrap,.25+sheen)*sh;if(uToon>.5){lt=lt<.16?.18:lt<.55?.6:1.;sp=step(.35,sp)*.35*uSpec;}\n vec3 col=base*(hemi+uSunC*lt)+uSunC*sp*sh+")
sub("gl.uniform1f(U.uFogN,22);","gl.uniform1f(U.uToon,1);gl.uniform1f(U.uFogN,22);")
sub("pigItem=addItem(pig.geo,null,{skin:true,flat:0,","pigItem=addItem(pig.geo,null,{skin:true,flat:1,lp:1,")
s=s.replace("pigItem=addItem(pig.geo,null,{skin:true,flat:1,lp:1,rough:.6,rim:.35,spec:.25,skinD:1});","pigItem=addItem(pig.geo,null,{skin:true,flat:1,rough:.75,rim:.3,spec:.2,skinD:0});")
# outline pass: cull the near faces of the flipped hull
sub("    gl.bindVertexArray(it.gl.vao);const mode=it.wire?gl.LINES:gl.TRIANGLES;","    gl.bindVertexArray(it.gl.vao);const mode=it.wire?gl.LINES:gl.TRIANGLES;if(it.cullBack){gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK)}")
sub("    if(it.gl.indexed)gl.drawElements(mode,it.gl.count,gl.UNSIGNED_INT,0);else gl.drawArrays(mode,0,it.gl.count)}}","    if(it.gl.indexed)gl.drawElements(mode,it.gl.count,gl.UNSIGNED_INT,0);else gl.drawArrays(mode,0,it.gl.count);if(it.cullBack)gl.disable(gl.CULL_FACE)}}")
sub("buildFace();buildClumps();","buildFace();buildClumps();buildOutline();")
# soft fur off by default here (low poly), short blades if switched on; outline toggle
sub("const KIT={bg:false,fur:true,","const KIT={bg:false,fur:false,flat:true,")
sub("kitBuildFur({count:22000,len:0.05,width:0.0055,","kitBuildFur({count:9000,len:0.04,width:0.007,")
sub("mk('⬇ GLB',","mk('Outline',b=>{KIT.outline.visible=!KIT.outline.visible;b.classList.toggle('on',KIT.outline.visible)},()=>true);mk('⬇ GLB',")
s=s.replace("const ASSET_NAME='GoldenRetriever';","const ASSET_NAME='GoldenRetriever_LowPoly';")
sub("toon asset · one skin · soft fur + feathered coat · export GLB / glTF / FBX / three.js r187","LOW POLY toon asset · faceted skin · chunky tufts · outline · export GLB / glTF / FBX / three.js r187")
sub("<title>Low-Poly Menagerie · 15 Golden Retriever</title>","<title>Low-Poly Menagerie · 15b Golden Retriever (Low poly)</title>")
sub("15 / 20 · LOW-POLY MENAGERIE</span><h1>Golden Retriever</h1>","15 / 20 · LOW-POLY MENAGERIE</span><h1>Golden Retriever · Low poly</h1>")
sub("kitBuildUI();refreshUI();","kitBuildUI();refreshUI();setTimeout(()=>{const p=document.querySelector('#top p');p.textContent+=' · '+window.__lpTris()+' tris'},50);")
# show the triangle budget
sub("document.getElementById('top').querySelector('p').textContent=","window.__lpTris=()=>{let t=0;for(const it of items){if(!it.gl.src||it.wire||it.visible===false)continue;if(!(it.skin||(it.node&&isVis(it.node))))continue;if(KIT.env.includes(it)||it===KIT.floor)continue;const g=it.gl.src.g;t+=(g.idx.length||g.pos.length/3)/3}return Math.round(t)};document.getElementById('top').querySelector('p').textContent=")
open('/home/claude/retriever/index_lp.html','w').write(s);print('ok',len(s))
