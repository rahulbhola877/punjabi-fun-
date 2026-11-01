# Very-low-poly, stylised-realistic spotted pig: ONE skinned mesh, painted faces (eyes, snout, hooves, spots), ~1.3k tris, tiny GLB
import subprocess
subprocess.run(['python3','/home/claude/retriever/make.py'],check=True)
s=open('/home/claude/retriever/index.html').read()
QEM=open('/home/claude/kit/qem.js').read()
def sub(old,new,cnt=1):
    global s
    assert s.count(old)==cnt,(s.count(old),old[:90]); s=s.replace(old,new)
def rep(a_mark,b_mark,new):
    global s
    a=s.index(a_mark); b=s.index(b_mark,a); s=s[:a]+new+s[b:]

rep("// ===== GOLDEN RETRIEVER SCULPT =====","function grad(",r'''// ===== SPOTTED PIG SCULPT (stylised realistic) =====
const EAR_C=[0.082,0.668,0.43],EAR_M=(()=>{const L=vnorm([0.78,-0.4,0.5]),Y=vsc(L,-1),Z=vnorm([L[2],0,-L[0]]),X=vcross(Y,Z);const m=M4.id();
  m[0]=X[0];m[1]=X[1];m[2]=X[2];m[4]=Y[0];m[5]=Y[1];m[6]=Y[2];m[8]=Z[0];m[9]=Z[1];m[10]=Z[2];m[12]=EAR_C[0];m[13]=EAR_C[1];m[14]=EAR_C[2];return M4.inv(m)})();   // lop ear: hangs forward over the eye
function earLocal(x,y,z){return M4.pt(EAR_M,[x,y,z])}
function sdEar(ax,y,z){const q=earLocal(ax,y,z);const v=clamp(-q[1]/.17,0,1);return sdEll(q[0]-v*v*.025,q[1]+.088,q[2],0,0,0,.017,.098,.046+.028*Math.sin(v*PI*.8))}
function sdLegF(ax,y,z){const d=sdCone(ax,y,z,0.11,0.4,0.24,0.11,0.06,0.268,0.078,0.045);return smin(d,sdEll(ax,y,z,0.11,0.034,0.282,0.04,0.038,0.05),0.025)}
function sdLegB(ax,y,z){let d=sdEll(ax,y,z,0.115,0.42,-0.32,0.1,0.15,0.13);d=smin(d,sdCone(ax,y,z,0.12,0.3,-0.38,0.12,0.06,-0.35,0.062,0.045),0.05);return smin(d,sdEll(ax,y,z,0.12,0.034,-0.338,0.042,0.038,0.05),0.025)}
function sdSnout(x,y,z){return sdCone(x,y,z,0,0.52,0.55,0,0.458,0.715,0.108,0.074)}
function sdDisc(x,y,z){return sdEll(x,y,z,0,0.455,0.728,0.077,0.068,0.022)}
const TAILP=[[0,0.6,-0.49],[0,0.635,-0.55],[0.03,0.635,-0.595],[0.036,0.595,-0.6],[0.006,0.588,-0.575],[-0.012,0.612,-0.588]],TAILR=[0.026,0.021,0.018,0.016,0.014,0.012];
function sdTail(x,y,z){let d=9;for(let i=0;i<5;i++)d=smin(d,sdCone(x,y,z,...TAILP[i],...TAILP[i+1],TAILR[i],TAILR[i+1]),0.01);return d}
function pigSDF(x,y,z){const ax=Math.abs(x);
  let d=sdEll(x,y,z,0,0.5,-0.03,0.2,0.21,0.42);
  d=smin(d,sdEll(x,y,z,0,0.51,-0.3,0.2,0.21,0.2),0.1);          // hams
  d=smin(d,sdEll(x,y,z,0,0.5,0.2,0.19,0.215,0.2),0.1);           // shoulders
  d=smin(d,sdEll(x,y,z,0,0.36,0.0,0.16,0.11,0.33),0.08);          // belly
  d=smin(d,sdEll(x,y,z,0,0.535,0.43,0.14,0.155,0.15),0.08);      // head
  d=smin(d,sdEll(x,y,z,0,0.45,0.44,0.125,0.1,0.13),0.06);        // jowls
  d=smin(d,sdSnout(x,y,z),0.06);d=smin(d,sdDisc(x,y,z),0.025);
  d=smin(d,sdEar(ax,y,z),0.016);d=smin(d,sdLegF(ax,y,z),0.05);d=smin(d,sdLegB(ax,y,z),0.06);d=smin(d,sdTail(x,y,z),0.025);
  return Math.max(d,-(y-0.004))}
''')
rep("// ---------- rig ----------","const COL={",r'''// ---------- rig ----------
const BN=['root','hips','spine','chest','neck','head','earL','earR','flU','flL','frU','frL','blU','blL','brU','brL','t0','t1','t2','t3','t4'];
const mir=p=>[-p[0],p[1],p[2]];const EAR_T=M4.pt(M4.inv(EAR_M),[0,-0.18,0]);
const REST={root:[0,0,0],hips:[0,0.5,-0.25],spine:[0,0.5,0],chest:[0,0.5,0.2],neck:[0,0.52,0.32],head:[0,0.54,0.44],earL:EAR_C,earR:mir(EAR_C),
  flU:[0.11,0.4,0.24],flL:[0.11,0.2,0.255],frU:[-0.11,0.4,0.24],frL:[-0.11,0.2,0.255],blU:[0.12,0.4,-0.33],blL:[0.12,0.2,-0.37],brU:[-0.12,0.4,-0.33],brL:[-0.12,0.2,-0.37],
  t0:TAILP[0],t1:TAILP[1],t2:TAILP[2],t3:TAILP[3],t4:TAILP[4]};
const PARENT={hips:'root',spine:'hips',chest:'spine',neck:'chest',head:'neck',earL:'head',earR:'head',flU:'chest',flL:'flU',frU:'chest',frL:'frU',
  blU:'hips',blL:'blU',brU:'hips',brL:'brU',t0:'hips',t1:'t0',t2:'t1',t3:'t2',t4:'t3'};
const SEG={hips:[[0,0.5,-0.52],[0,0.5,0]],spine:[REST.spine,REST.chest],chest:[REST.chest,[0,0.52,0.32]],neck:[REST.neck,REST.head],head:[REST.head,[0,0.455,0.75]],
  earL:[EAR_C,EAR_T],earR:[mir(EAR_C),mir(EAR_T)],flU:[REST.flU,REST.flL],flL:[REST.flL,[0.11,0.0,0.28]],frU:[REST.frU,REST.frL],frL:[REST.frL,[-0.11,0,0.28]],
  blU:[REST.blU,REST.blL],blL:[REST.blL,[0.12,0.0,-0.34]],brU:[REST.brU,REST.brL],brL:[REST.brL,[-0.12,0,-0.34]]};
for(let i=0;i<5;i++)SEG['t'+i]=[TAILP[i],TAILP[i+1]];
function segDist(p,a,b){const ab=vsub(b,a),t=clamp(vdot(vsub(p,a),ab)/vdot(ab,ab),0,1);return vlen(vsub(p,vadd(a,vsc(ab,t))))}
function pigWeights(p){const ax=Math.abs(p[0]),side=p[0]>=0?'L':'R',fs=p[0]>=0?'fl':'fr',bs=p[0]>=0?'bl':'br';const W=[];
  const push=(name,d,pw=4)=>W.push([BN.indexOf(name),1/Math.pow(d+0.012,pw)]);
  for(const n of ['hips','spine','chest'])push(n,segDist(p,...SEG[n])+0.06,6);for(const n of ['neck','head'])push(n,segDist(p,...SEG[n])+0.02);
  if(sdEar(ax,p[1],p[2])<0.02){const e='ear'+side;push(e,segDist(p,...SEG[e])*0.45)}
  if(sdTail(p[0],p[1],p[2])<0.03&&p[2]<-0.47)for(let i=0;i<5;i++)push('t'+i,segDist(p,...SEG['t'+i])+0.004,5);
  const lf=sdLegF(ax,p[1],p[2]);if(lf<0.035&&p[1]<0.38){const k=1+Math.max(0,p[1]-0.28)*10;push(fs+'U',segDist(p,...SEG[fs+'U'])*k);push(fs+'L',segDist(p,...SEG[fs+'L'])*k)}
  const lb=sdLegB(ax,p[1],p[2]);if(lb<0.035&&p[1]<0.4){const k=1+Math.max(0,p[1]-0.3)*10;push(bs+'U',segDist(p,...SEG[bs+'U'])*k);push(bs+'L',segDist(p,...SEG[bs+'L'])*k)}
  W.sort((a,b)=>b[1]-a[1]);const top=W.slice(0,4);while(top.length<4)top.push([0,0]);const s=top.reduce((a,b)=>a+b[1],0);return [top.map(w=>w[0]),top.map(w=>w[1]/s)]}

''')
a=s.index("const COL={");b=s.index("function setCoat(c){",a);b2=s.index("kitRecolorFur()}",b)+len("kitRecolorFur()}")
s=s[:a]+r'''const COL={skin:0xeddcd2,white:0xf0e6de,tan:0xe9b9ad,nose:0x3a3030};
function mixc(a,b,t){return a.map((v,i)=>lerp(v,b[i],t))}
'''+QEM+r'''
const LP={target:2400};let FM=[],COATM=[],CLUMP=null,LPW=null,BRD=null;
// pig colourways: every colour is painted per face, so the asset is one mesh + one material
const BREEDS=[
  {n:'Spotted pink',base:0xd99a8a,pink:0xe2a898,spot:0x35261f,sw:[0xd99a8a,0x35261f]},{n:'Old Spot',base:0xeddcd2,pink:0xe9b6a8,spot:0x2a2321,sw:[0xeddcd2,0x2a2321]},
  {n:'Large White',base:0xf1cbbd,pink:0xe9a696,sw:[0xf1cbbd,0xe9a696]},
  {n:'Berkshire',base:0x24201e,pink:0x2c2624,point:0xece2da,sw:[0x24201e,0xece2da]},
  {n:'Saddleback',base:0x24201e,pink:0x2c2624,belt:0xece2da,sw:[0x24201e,0xece2da]},
  {n:'Tamworth',base:0xb3622c,pink:0xc77a44,sw:[0xb3622c,0xd89a62]}];
function faceMasks(c,n){const [x,y,z]=c,ax=Math.abs(x);const m={};
  m.ao=clamp(pigSDF(...vadd(c,vsc(n,0.06)))/0.06,0,1);m.jit=rr(-.035,.035);
  m.spot=0;for(const S of SPOTS){const d=vlen(vsub(c,S[0]))/S[1]*(1+0.12*Math.sin(x*61+z*23)*Math.sin(y*53+x*11));m.spot=Math.max(m.spot,d<1?1:0)}m.sj=rr(-.14,.14);
  const disc=z>0.722&&Math.hypot(x/0.077,(y-0.455)/0.068)<0.97?1:0;m.disc=disc;m.nos=disc&&Math.min(Math.hypot(x-0.025,y-0.452),Math.hypot(x+0.025,y-0.452))<0.019?1:0;
  m.snout=sstep(0.012,-0.005,sdSnout(x,y,z))*sstep(0.58,0.64,z);
  m.pink=clamp(sstep(0.36,0.31,y)*sstep(-0.1,0.0,y)*(1-sstep(0.12,0.06,y))+m.snout*0.8+sstep(0.01,0,sdEar(ax,y,z))*0.35*(n[0]*Math.sign(x)<0?1:0.4),0,1);
  m.hoof=y<0.075&&(sdLegF(ax,y,z)<0.02||sdLegB(ax,y,z)<0.02)?1:0;
  m.point=clamp(m.snout+sstep(0.15,0.1,y)*((sdLegF(ax,y,z)<0.02||sdLegB(ax,y,z)<0.02)?1:0)+(z<-0.57&&sdTail(x,y,z)<0.02?1:0)+sstep(0.025,0.01,Math.hypot(x,y-0.64,z-0.53)),0,1);
  m.belt=sstep(0.05,0.1,z)*sstep(0.34,0.28,z)*(y>0.12?1:0)+((sdLegF(ax,y,z)<0.02)?1:0);m.belt=clamp(m.belt,0,1);
  m.eye=0;for(const E of EYES){const d=vlen(vsub(c,E));m.eye=Math.max(m.eye,d<0.03?0.45:0)}
  return m}
function faceColor(m,b){const H=v=>hex(v);let c=H(b.base);c=mixc(c,H(b.pink),m.pink*.75);
  if(b.spot&&m.spot)c=H(b.spot).map(v=>v*(1+(m.sj||0)));if(b.point)c=mixc(c,H(b.point),m.point);if(b.belt)c=mixc(c,H(b.belt),m.belt);
  const lum=c[0]*.3+c[1]*.6+c[2]*.1;const darkBreed=H(b.base)[1]<.1;
  if(m.disc)c=darkBreed&&!b.point?H(0x3a3232):H(0xc47a6c);if(m.nos)c=H(0x3b1e1c);
  if(m.hoof)c=H(0x2c211c);
  if(m.eye)c=mixc(c,c.map(v=>v*.62),m.eye*1.6);
  return c.map(v=>clamp(v*(.66+.34*m.ao)*(1+m.jit),0,1))}
let SPOTS=[],EYES=[];
function eyeColor(m){let c=hex(0xf2ece4).map(v=>v*.55);if(m.fw>.45)c=hex(0x5a3518);if(m.fw>.8)c=hex(0x0c0806);if(m.hl>.93)c=[.95,.95,.95];return c}
function buildPig(){
  const f=pigSDF;const sn=surfaceNets(f,[-0.27,-0.02,-0.66],[0.27,0.8,0.84],0.016);
  relax(f,sn.pos,sn.idx,3);orient(f,sn.pos,sn.idx);
  EYES=[1,-1].map(s=>marchOut([0,0.585,0.5],vnorm([s*0.92,0.32,0.36])));
  _seed=777;SPOTS=[];
  for(let i=0;i<24;i++){const zz=lerp(-0.45,0.3,(i%8+rnd())/8);const a=(i%2?1:-1)*rr(.1,PI*.7);SPOTS.push([marchOut([0,0.48,zz],vnorm([Math.sin(a),Math.cos(a),0])),rr(.045,.085)])}
  for(let i=0;i<3;i++){const a=rr(-1.3,1.3);SPOTS.push([marchOut([0,0.56,0.46],vnorm([Math.sin(a),Math.cos(a)*.9,0.25])),rr(.022,.035)])}
  for(const sx of [1,-1])for(let i=0;i<2;i++){SPOTS.push([marchOut([sx*0.115,rr(.18,.36),i?-0.33:0.25],[sx,0,rr(-.4,.4)]),rr(.018,.03)])}
  SPOTS.push([M4.pt(M4.inv(EAR_M),[0,-0.11,0.01]),0.03]);
  const pos=sn.pos,idx=sn.idx,N=pos.length/3;const W0=[];for(let i=0;i<N;i++)W0.push(pigWeights([pos[i*3],pos[i*3+1],pos[i*3+2]]));
  const imp=i=>{const p=[pos[i*3],pos[i*3+1],pos[i*3+2]],ax=Math.abs(p[0]);let k=1;if(p[2]>0.3&&p[1]>0.38)k+=4;
    for(const E of EYES)if(vlen(vsub(p,E))<0.05)k+=12;if(p[2]>0.62)k+=6;if(Math.abs(sdDisc(...p))<0.012||(p[2]>0.71&&Math.min(Math.hypot(p[0]-0.025,p[1]-0.452),Math.hypot(p[0]+0.025,p[1]-0.452))<0.03))k+=14;for(const S of SPOTS){const d=vlen(vsub(p,S[0]))/S[1]*(1+0.2*Math.sin(p[0]*41+p[2]*17)*Math.sin(p[1]*37));if(Math.abs(d-1)<0.3)k+=9}if(p[1]>0.055&&p[1]<0.095&&(sdLegF(ax,p[1],p[2])<0.02||sdLegB(ax,p[1],p[2])<0.02))k+=10;if(sdEar(ax,p[1],p[2])<0.02)k+=6;if(p[1]<0.07)k+=3;if(p[2]<-0.47&&sdTail(...p)<0.03)k+=6;return k};
  const D=qemDecimate(pos,idx,LP.target,imp);
  const wpos=D.P.flat(),wnor=Array(wpos.length).fill(0);D.F.forEach(t=>{const n=vcross(vsub(D.P[t[1]],D.P[t[0]]),vsub(D.P[t[2]],D.P[t[0]]));for(const v of t)for(let q=0;q<3;q++)wnor[v*3+q]+=n[q]});
  for(let i=0;i<wnor.length;i+=3){const n=vnorm([wnor[i],wnor[i+1],wnor[i+2]]);wnor[i]=n[0];wnor[i+1]=n[1];wnor[i+2]=n[2]}
  LPW={pos:wpos,nor:wnor,idx:D.F.flat(),si:D.keep.flatMap(v=>W0[v][0]),sw:D.keep.flatMap(v=>W0[v][1])};
  // smooth welded skin: colours per vertex (soft spot edges), smooth normals
  // unwelded corners that KEEP the smooth normals: smooth shading, crisp per-face colour (polygonal spot edges)
  const fp=[],fn=[],fc=[],fi=[],si=[],sw=[],hair=[];FM=[];
  D.F.forEach(t=>{const P3=t.map(v=>D.P[v]);const fnn=vnorm(vcross(vsub(P3[1],P3[0]),vsub(P3[2],P3[0])));const c=vsc(vadd(vadd(P3[0],P3[1]),P3[2]),1/3);const m=faceMasks(c,fnn);m.jit*=.6;
    for(const v of t){fp.push(...D.P[v]);fn.push(wnor[v*3],wnor[v*3+1],wnor[v*3+2]);fc.push(0,0,0);si.push(...W0[D.keep[v]][0]);sw.push(...W0[D.keep[v]][1]);hair.push(0);fi.push(fi.length);FM.push(m)}});
  // eyes: small low-poly eyeballs merged into the SAME mesh (one mesh, one material), rigid on the head joint
  const rE=0.021,hb=BN.indexOf('head');
  for(const E of EYES){const n=vnorm(vsub(E,[0,0.56,0.46]));const look=vnorm(vadd(n,[0,0,0.55]));const C=vsub(E,vsc(n,rE*0.35));
    const sp=sphere(rE,10,7);const base=fp.length/3;const up=[0,1,0],X=vnorm(vcross(up,look)),Y=vcross(look,X);
    for(let k=0;k<sp.n;k++){const q=[sp.pos[k*3],sp.pos[k*3+1],sp.pos[k*3+2]];const d=vnorm(q);fp.push(...vadd(C,q));fn.push(...d);fc.push(0,0,0);si.push(hb,0,0,0);sw.push(1,0,0,0);hair.push(0);
      const fw=vdot(d,look),hl=vdot(d,vnorm(vadd(vadd(look,vsc(Y,.55)),vsc(X,-.3))));FM.push({eyeball:1,fw,hl})}
    for(const t of sp.idx)fi.push(t+base)}
  const g=new Geo();g.pos=fp;g.nor=fn;g.col=fc;g.idx=fi;
  const wg=new Geo();wg.pos=wpos;wg.nor=wnor;wg.col=Array(wpos.length).fill(1);for(let t=0;t<LPW.idx.length;t+=3)wg.idx.push(LPW.idx[t],LPW.idx[t+1],LPW.idx[t+1],LPW.idx[t+2],LPW.idx[t+2],LPW.idx[t]);
  return {geo:upload(g,{si,sw,m1:fp,hair}),wire:upload(wg,{si:LPW.si,sw:LPW.sw,m1:wpos}),tris:fi.length/3}}
let scaleItem;
function buildClumps(){}
function setCoat(b){BRD=b;const g=pigItem.gl.src.g;FM.forEach((m,v)=>{const c=m.eyeball?eyeColor(m):faceColor(m,b);g.col[v*3]=c[0];g.col[v*3+1]=c[1];g.col[v*3+2]=c[2]});
  gl.bindBuffer(gl.ARRAY_BUFFER,pigItem.gl.bufs[2]);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(g.col))}'''+s[b2:]
# no separate face parts: eyes, snout and hooves are painted into the single skin
a=s.index("function buildFace(){");b=s.index("function eH(p)",a)
s=s[:a]+r'''function buildFace(){FACE.eyes=[];FACE.nos=[];FACE.blush=[];FACE.fangs=[];FACE.mouth={mw:[0,0]};FACE.tongue=null;FACE.rE=0.02;
  const o=B.head.add(new Node(vsub([0,0.45,0.8],REST.head)));o.noExport=1;FACE.open=o;FACE.openS=[1,1,1]}
'''+s[b:]
# coat row = pig colourways
a=s.index("{const CO=[['Light golden'");b=s.index("window.__coat=()=>setCoat(CO[1])}",a)+len("window.__coat=()=>setCoat(CO[1])}")
s=s[:a]+r"""{const row=document.getElementById('coats');BREEDS.forEach((c,i)=>{const b=document.createElement('button');b.innerHTML=`<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#${c.sw[0].toString(16).padStart(6,'0')};border:3px solid #${c.sw[1].toString(16).padStart(6,'0')};margin-right:6px;vertical-align:-3px"></span>${c.n}`;
    b.onclick=()=>{setCoat(c);for(const x of row.querySelectorAll('button'))x.classList.toggle('on',x===b)};if(!i)b.classList.add('on');row.appendChild(b)});window.__coat=()=>setCoat(BREEDS[0])}"""+s[b:]
sub("kitBuildFur({count:22000,len:0.05,width:0.0055,tip:.28,color:i=>coatColor(COATM[i])});","")
sub("mk('Soft fur',b=>{KIT.fur=!KIT.fur;if(KIT.furItem)KIT.furItem.visible=KIT.fur;b.classList.toggle('on',KIT.fur)},()=>KIT.fur);","")
sub("const KIT={bg:false,fur:true,","const KIT={bg:false,fur:false,flat:false,toon:false,compact:true,noNormals:false,")
sub("env:[],floor:null,fps:30};","env:[],floor:null,fps:15,clips:['idle','walk','run','eat','roll','sleep']};")
sub("pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.6,rim:.35,spec:.25,skinD:1});","pigItem=addItem(pig.geo,null,{skin:true,flat:0,rough:.7,rim:.22,spec:.18,skinD:0});")
s=s.replace("const LL=0.46;","const LL=0.38;")
s=s.replace("const ACTS=[['idle','Idle'],['walk','Walk'],['run','Run'],['attack','Bark'],['sit','Sit'],['jump','Jump'],['bend','Play bow'],['roll','Roll over'],['happy','Happy'],['eat','Eat'],['shake','Shake'],['sleep','Sleep']];",
            "const ACTS=[['idle','Idle'],['walk','Walk'],['run','Run'],['eat','Root'],['roll','Mud roll'],['sleep','Sleep']];")
sub("const ASSET_NAME='GoldenRetriever';","const ASSET_NAME='SpottedPig_LowPoly';")
sub('<div class="row face" id="faces"><span class="lbl">Face</span></div>','<div class="row face" id="faces" style="display:none"><span class="lbl">Face</span></div>')
sub('<span class="lbl">Coat</span>','<span class="lbl">Breed</span>')
sub("const cam={th:0.7,ph:1.3,d:3.6,target:[0,0.5,0],eye:[0,0,0]};","const cam={th:0.75,ph:1.3,d:3.3,target:[0,0.42,0],eye:[0,0,0]};")
s=s.replace("0.56+pose[RY]*.4","0.42+pose[RY]*.4")
sub("toon asset · one skin · soft fur + feathered coat · export GLB / glTF / FBX / three.js r187","low poly · stylised realistic · ONE smooth skin · hand-painted spots")
sub("kitBuildUI();refreshUI();","kitBuildUI();refreshUI();setTimeout(()=>{document.querySelector('#top p').textContent+=` · ${window.__tris} tris · 1 mesh · 1 material`},50);")
sub("<title>Low-Poly Menagerie · 15 Golden Retriever</title>","<title>Low-Poly Menagerie · 01b Spotted Pig (very low poly)</title>")
sub("15 / 20 · LOW-POLY MENAGERIE</span><h1>Golden Retriever</h1>","01 / 20 · LOW-POLY MENAGERIE · VERY LOW POLY</span><h1>Spotted Pig</h1>")
sub("Brushing the golden coat…","Painting the spots…")
open('/home/claude/pigvlp/index.html','w').write(s);print('ok',len(s))
