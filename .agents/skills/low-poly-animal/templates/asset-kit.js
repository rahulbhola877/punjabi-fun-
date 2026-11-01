/* =====================================================================
   TOON ASSET KIT — background is optional (studio by default) and the
   animal exports as GLB / glTF 2.0 / FBX 7.4 ASCII, plus a three.js r187
   starter page. Skinned mesh + skeleton + rigid face parts + morphs + every
   move baked as an animation clip (in place, 30 fps).
   ===================================================================== */
const KIT={bg:false,fur:true,env:[],floor:null,fps:30};
function kitStudio(){const g=new Geo();for(const r of [7])g.merge(disc(r,64),M4.euler(-PI/2,0,0));
  KIT.floor=addItem(upload(g),sceneRoot.add(new Node([0,0.001,0])),{color:hex(0xd9d6d0),flat:0,rough:.95,spec:.05,rim:0,cast:false});kitSetBg(KIT.bg)}
function kitSetBg(on){KIT.bg=on;for(const it of KIT.env)it.visible=on;if(KIT.floor)KIT.floor.visible=!on}
// ---------- scene capture
function kitNodes(){const list=[],nm=new Map();for(const n of BN)nm.set(B[n],n);
  const walk=(n,par)=>{if(n.noExport)return;const i=list.length;list.push({n,par,name:n===pigN?ASSET_NAME:(nm.get(n)||null),bone:nm.has(n)});for(const k of n.kids)walk(k,i)};walk(pigN,-1);
  let c=0;for(const e of list)if(!e.name)e.name='part_'+(c++);return list}
function kitItemVisible(it){if(it.visible===false)return false;if(it.node&&!isVis(it.node))return false;return true}
function kitPickItems(nodeSet){return items.filter(it=>!it.wire&&it.gl.src&&(it.skin?it.node==null:nodeSet.has(it.node)))}
function quatM(m){const m00=m[0],m01=m[4],m02=m[8],m10=m[1],m11=m[5],m12=m[9],m20=m[2],m21=m[6],m22=m[10],tr=m00+m11+m22;let x,y,z,w;
  if(tr>0){const s=.5/Math.sqrt(tr+1);w=.25/s;x=(m21-m12)*s;y=(m02-m20)*s;z=(m10-m01)*s}
  else if(m00>m11&&m00>m22){const s=2*Math.sqrt(1+m00-m11-m22);w=(m21-m12)/s;x=.25*s;y=(m01+m10)/s;z=(m02+m20)/s}
  else if(m11>m22){const s=2*Math.sqrt(1+m11-m00-m22);w=(m02-m20)/s;x=(m01+m10)/s;y=.25*s;z=(m12+m21)/s}
  else{const s=2*Math.sqrt(1+m22-m00-m11);w=(m10-m01)/s;x=(m02+m20)/s;y=(m12+m21)/s;z=.25*s}const l=Math.hypot(x,y,z,w);return [x/l,y/l,z/l,w/l]}
function eulZYX(m){const D=180/PI;const m31=m[2],m32=m[6],m33=m[10],m21=m[1],m11=m[0],m12=m[4],m22=m[5];const y=Math.asin(-clamp(m31,-1,1));let x,z;
  if(Math.abs(m31)<.9999999){x=Math.atan2(m32,m33);z=Math.atan2(m21,m11)}else{x=0;z=Math.atan2(-m12,m22)}return [x*D,y*D,z*D]}
function rotOf(n){const R=M4.euler(n.r[0],n.r[1],n.r[2]);return n.rm?M4.mul(M4.id(),n.rm,R):R}
function kitTRS(n){const R=rotOf(n);return {p:[...n.p],q:quatM(R),e:eulZYX(R),s:[...n.s]}}
function kitReset(){st.act=null;st.actT=0;st.fx={};st.pos=[0,0,0];st.head=0;st.speed=0;st.wander=0;st.manual='auto';for(const k in st.w)st.w[k]=0;if(st.alt!=null)st.alt=0}
function kitBind(){for(const n of BN){B[n].p=[...B[n].rest];B[n].r=[0,0,0];B[n].s=[1,1,1]}}
// record every move: loops get a seamless end→start blend
function kitClipName(k){const A_=typeof ACTS!=='undefined'?ACTS:[];const e=A_.find(a=>a[0]===k);return (e?e[1]:k).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
function kitRecord(NL,its){const fps=KIT.fps,dt=1/fps,clips=[];const saved={loop:st.loop,man:st.manual};const pN={p:[...pigN.p],r:[...pigN.r]};
  const snap=()=>({trs:NL.map(e=>kitTRS(e.n)),mw:its.map(it=>[...(it.mw||[0,0])]),vis:its.map(kitItemVisible)});
  const run=(sec)=>{for(let i=0;i<Math.round(sec*fps);i++){clock+=dt;update(dt,clock)}};
  const keep=k=>!KIT.clips||KIT.clips.includes(k);const loops=Object.keys(st.w).filter(k=>POSES[k]&&keep(k));const LB=.5,LT=3;
  for(const k of loops){kitReset();st.loop=k;st.w[k]=1;run(1.2);const F=[];for(let i=0;i<=Math.round((LT+LB)*fps);i++){if(i)run(dt);F.push(snap())}
    const NT=Math.round(LT*fps),NBl=Math.round(LB*fps),out=[];for(let i=0;i<=NT;i++){if(i<NBl){const u=i/NBl;out.push(kitBlend(F[i+NT],F[i],u))}else out.push(F[i])}
    clips.push({name:kitClipName(k),frames:out,loop:true})}
  for(const k of Object.keys(ACTIONS).filter(keep)){kitReset();st.loop='idle';st.w.idle=1;run(.6);st.act=k;st.actT=0;st.fx={};if(st.alt0!=null)st.alt0=st.alt;const F=[snap()];
    for(let i=1;i<=Math.round(ACTIONS[k].dur*fps);i++){run(dt);F.push(snap())}clips.push({name:kitClipName(k),frames:F,loop:false})}
  kitReset();st.loop=saved.loop;st.w[saved.loop]=1;st.manual=saved.man;run(.05);if(typeof refreshUI==='function')refreshUI();return clips}
function kitBlend(a,b,u){return {trs:a.trs.map((x,i)=>{const y=b.trs[i];let q2=y.q;if(x.q[0]*q2[0]+x.q[1]*q2[1]+x.q[2]*q2[2]+x.q[3]*q2[3]<0)q2=q2.map(v=>-v);
    const q=x.q.map((v,j)=>lerp(v,q2[j],u)),l=Math.hypot(...q);const e=x.e.map((v,j)=>{let w=y.e[j];while(w-v>180)w-=360;while(w-v<-180)w+=360;return lerp(v,w,u)});
    return {p:x.p.map((v,j)=>lerp(v,y.p[j],u)),q:q.map(v=>v/l),e,s:x.s.map((v,j)=>lerp(v,y.s[j],u))}}),mw:a.mw.map((x,i)=>x.map((v,j)=>lerp(v,b.mw[i][j],u))),vis:b.vis}}
function kitUnwrap(clips){for(const c of clips)for(let i=1;i<c.frames.length;i++)c.frames[i].trs.forEach((t,j)=>{const pv=c.frames[i-1].trs[j];
  let q=t.q;if(q[0]*pv.q[0]+q[1]*pv.q[1]+q[2]*pv.q[2]+q[3]*pv.q[3]<0)t.q=q.map(v=>-v);t.e=t.e.map((v,k)=>{while(v-pv.e[k]>180)v-=360;while(v-pv.e[k]<-180)v+=360;return v})})}
// build a neutral description shared by the glTF and FBX writers
function kitScene(){const NL=kitNodes(),nodeSet=new Set(NL.map(e=>e.n));let its=kitPickItems(nodeSet);
  const clips=kitRecord(NL,its);kitUnwrap(clips);KIT.loops=clips.filter(c=>c.loop).map(c=>c.name);
  const everVis=its.map((it,i)=>clips.some(c=>c.frames.some(f=>f.vis[i])));
  // bind / default transforms: bones at rest, parts as at the start of the first clip
  kitBind();sceneRoot.update(null);const f0=clips[0].frames[0];
  const nodes=NL.map((e,i)=>({name:e.name,par:e.par,bone:e.bone,trs:e.n===pigN?{p:[0,0,0],q:[0,0,0,1],e:[0,0,0],s:[1,1,1]}:e.bone?kitTRS(e.n):f0.trs[i],src:i}));
  const meshes=[];its.forEach((it,i)=>{if(!everVis[i])return;const src=it.gl.src,g=src.g,ex=src.extra||{};const n=g.pos.length/3;if(n<3)return;
    let idxF;const flat=!!ex.flat||!g.idx.length;const idx=flat?Array.from({length:n},(_,k)=>k):g.idx;
    const col=[];const ic=it.color||[1,1,1];for(let k=0;k<n;k++){const c=g.col.length?[g.col[k*3],g.col[k*3+1],g.col[k*3+2]]:[1,1,1];col.push(...c.map((v,j)=>clamp(v*ic[j],0,1)))}
    const mws=clips.flatMap(c=>c.frames.map(f=>f.mw[i]));const varies=mws.some(w=>Math.abs(w[0]-mws[0][0])>1e-3||Math.abs(w[1]-mws[0][1])>1e-3);
    let pos=Array.from(g.pos);let targets=null;
    if(ex.m1&&ex.m1!==g.pos){const d1=[],d2=[];let nz=false;for(let k=0;k<n*3;k++){d1.push(ex.m1[k]-g.pos[k]);d2.push((ex.m2||ex.m1)[k]-g.pos[k]);if(Math.abs(d1[k])>1e-6||Math.abs(d2[k])>1e-6)nz=true}
      if(nz){if(varies)targets=[d1,d2];else{const w=mws[0];pos=pos.map((v,k)=>v+w[0]*d1[k]+w[1]*d2[k])}}}
    const visVar=clips.some(c=>c.frames.some(f=>f.vis[i]!==c.frames[0].vis[i]))||!kitItemVisible(it);
    const nor=[];for(let k=0;k<n;k++){const v=vnorm([g.nor[k*3]||0,g.nor[k*3+1]||1,g.nor[k*3+2]||0]);nor.push(...v)}
    {const ix=idx===g.idx?Array.from(idx):idx;for(let t=0;t<ix.length;t+=3){const a=ix[t],b=ix[t+1],c=ix[t+2];const pa=[pos[a*3],pos[a*3+1],pos[a*3+2]];   // winding follows the normals (exporters/engines cull or flip by winding)
      const fn=vcross(vsub([pos[b*3],pos[b*3+1],pos[b*3+2]],pa),vsub([pos[c*3],pos[c*3+1],pos[c*3+2]],pa));const vn=[0,1,2].map(q=>nor[a*3+q]+nor[b*3+q]+nor[c*3+q]);if(vdot(fn,vn)<0){ix[t+1]=c;ix[t+2]=b}}idxF=ix}
    meshes.push({name:it.skin?'skin_'+meshes.length:NL[NL.findIndex(e=>e.n===it.node)].name+'_mesh',item:i,skin:!!it.skin,parent:it.skin?0:NL.findIndex(e=>e.n===it.node),pos,nor,col,idx:idxF,
      si:it.skin?Array.from(ex.si):null,sw:it.skin?Array.from(ex.sw):null,targets,visVar,
      noFBX:!!it.noFBX,mat:{rough:clamp(it.rough==null?.8:it.rough,.05,1),emis:it.emis||[0,0,0],op:it.trans?(it.op==null?1:it.op):1,trans:!!it.trans,unlit:!!it.unlit,single:!!it.outline}})});
  return {nodes,meshes,clips,fps:KIT.fps}}
// ---------- glTF 2.0 / GLB writer
function kitGLTF(S,binary){const bin=[];let off=0;const bufferViews=[],accessors=[];
  const add=(ta,target)=>{const u8=new Uint8Array(ta.buffer,ta.byteOffset,ta.byteLength);const bv={buffer:0,byteOffset:off,byteLength:u8.byteLength};if(target)bv.target=target;bufferViews.push(bv);bin.push(u8);off+=u8.byteLength;const pad=(4-off%4)%4;if(pad){bin.push(new Uint8Array(pad));off+=pad}return bufferViews.length-1};
  const acc=(ta,type,ct,count,target,mm,norm)=>{const a={bufferView:add(ta,target),componentType:ct,count,type};if(mm){const k={SCALAR:1,VEC3:3,VEC4:4}[type];const mn=Array(k).fill(Infinity),mx=Array(k).fill(-Infinity);for(let i=0;i<count;i++)for(let j=0;j<k;j++){mn[j]=Math.min(mn[j],ta[i*k+j]);mx[j]=Math.max(mx[j],ta[i*k+j])}a.min=mn;a.max=mx}if(norm)a.normalized=true;accessors.push(a);return accessors.length-1};
  const J={asset:{version:'2.0',generator:'Low-Poly Menagerie toon asset kit'},scene:0,scenes:[{name:ASSET_NAME,nodes:[0]}],nodes:[],meshes:[],materials:[],skins:[],animations:[]};const used=new Set();
  S.nodes.forEach((n,i)=>{const o={name:n.name,translation:n.trs.p,rotation:n.trs.q,scale:n.trs.s};J.nodes.push(o)});
  S.nodes.forEach((n,i)=>{if(n.par>=0)(J.nodes[n.par].children=J.nodes[n.par].children||[]).push(i)});
  const jointIdx=BN.map(b=>S.nodes.findIndex(n=>n.name===b));
  const ibm=new Float32Array(BN.length*16);BN.forEach((b,i)=>{const m=M4.id();m[12]=-REST[b][0];m[13]=-REST[b][1];m[14]=-REST[b][2];ibm.set(m,i*16)});
  J.skins.push({joints:jointIdx,inverseBindMatrices:acc(ibm,'MAT4',5126,BN.length),skeleton:jointIdx[0]});
  const meshNode={};
  S.meshes.forEach((m,mi)=>{const mat=m.mat,me=Math.max(...mat.emis);const M={name:m.name+'_mat',pbrMetallicRoughness:{baseColorFactor:[1,1,1,mat.op],metallicFactor:0,roughnessFactor:mat.rough},doubleSided:!mat.single};if(mat.unlit){M.extensions=Object.assign(M.extensions||{},{KHR_materials_unlit:{}});used.add('KHR_materials_unlit')}
    if(me>0){M.emissiveFactor=mat.emis.map(v=>v/Math.max(1,me));if(me>1){M.extensions={KHR_materials_emissive_strength:{emissiveStrength:me}};used.add('KHR_materials_emissive_strength')}}
    if(mat.trans){M.alphaMode='BLEND'}J.materials.push(M);
    const n=m.pos.length/3;const at={POSITION:acc(new Float32Array(m.pos),'VEC3',5126,n,34962,true)};
    if(!KIT.noNormals)at.NORMAL=acc(new Float32Array(m.nor),'VEC3',5126,n,34962);
    if(KIT.compact){const c8=new Uint8Array(n*4);for(let k=0;k<n;k++){for(let j=0;j<3;j++)c8[k*4+j]=Math.round(clamp(m.col[k*3+j],0,1)*255);c8[k*4+3]=255}at.COLOR_0=acc(c8,'VEC4',5121,n,34962,false,true)}
    else at.COLOR_0=acc(new Float32Array(m.col),'VEC3',5126,n,34962);
    if(m.skin){const w=new Float32Array(m.sw);for(let k=0;k<n;k++){const s=w[k*4]+w[k*4+1]+w[k*4+2]+w[k*4+3]||1;for(let j=0;j<4;j++)w[k*4+j]/=s}
      if(KIT.compact&&BN.length<256){at.JOINTS_0=acc(new Uint8Array(m.si),'VEC4',5121,n,34962);const w8=new Uint8Array(n*4);for(let k=0;k<n;k++){let tot=0,mx=0;for(let j=0;j<4;j++){w8[k*4+j]=Math.round(w[k*4+j]*255);tot+=w8[k*4+j];if(w8[k*4+j]>w8[k*4+mx])mx=j}w8[k*4+mx]+=255-tot}
        at.WEIGHTS_0=acc(w8,'VEC4',5121,n,34962,false,true)}
      else{at.JOINTS_0=acc(new Uint16Array(m.si),'VEC4',5123,n,34962);at.WEIGHTS_0=acc(w,'VEC4',5126,n,34962)}}
    const prim={attributes:at,indices:acc(new Uint32Array(m.idx),'SCALAR',5125,m.idx.length,34963),material:mi,mode:4};
    if(m.targets)prim.targets=m.targets.map(d=>({POSITION:acc(new Float32Array(d),'VEC3',5126,n,34962,true)}));
    const mesh={name:m.name,primitives:[prim]};if(m.targets){mesh.weights=[0,0];mesh.extras={targetNames:['smile','frown']}}J.meshes.push(mesh);
    const ni=J.nodes.length;const node={name:m.name,mesh:mi};if(m.skin)node.skin=0;J.nodes.push(node);meshNode[mi]=ni;
    (J.nodes[m.parent].children=J.nodes[m.parent].children||[]).push(ni)});
  // animations (channels pruned when they never leave the default pose)
  const eq=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-5);
  for(const c of S.clips){const nf=c.frames.length;const T=new Float32Array(nf);for(let i=0;i<nf;i++)T[i]=i/S.fps;const tin=acc(T,'SCALAR',5126,nf,null,true);
    const A={name:c.name,samplers:[],channels:[]};const ch=(node,path,data,type)=>{A.samplers.push({input:tin,output:acc(data,type,5126,data.length/({VEC3:3,VEC4:4,SCALAR:1}[type])),interpolation:'LINEAR'});A.channels.push({sampler:A.samplers.length-1,target:{node,path}})};
    S.nodes.forEach((n,i)=>{if(i===0)return;const fr=c.frames.map(f=>f.trs[i]);
      if(!fr.every(t=>eq(t.p,n.trs.p)))ch(i,'translation',new Float32Array(fr.flatMap(t=>t.p)),'VEC3');
      if(!fr.every(t=>eq(t.q,n.trs.q)))ch(i,'rotation',new Float32Array(fr.flatMap(t=>t.q)),'VEC4');
      if(!fr.every(t=>eq(t.s,n.trs.s)))ch(i,'scale',new Float32Array(fr.flatMap(t=>t.s)),'VEC3')});
    S.meshes.forEach((m,mi)=>{if(m.targets)ch(meshNode[mi],'weights',new Float32Array(c.frames.flatMap(f=>f.mw[m.item])),'SCALAR');
      if(m.visVar)ch(meshNode[mi],'scale',new Float32Array(c.frames.flatMap(f=>f.vis[m.item]?[1,1,1]:[1e-4,1e-4,1e-4])),'VEC3')});
    J.animations.push(A)}
  J.accessors=accessors;J.bufferViews=bufferViews;if(used.size)J.extensionsUsed=[...used];
  const body=new Uint8Array(off);let o=0;for(const b of bin){body.set(b,o);o+=b.byteLength}
  if(!binary){J.buffers=[{byteLength:off,uri:'data:application/octet-stream;base64,'+kitB64(body)}];return JSON.stringify(J)}
  J.buffers=[{byteLength:off}];let js=new TextEncoder().encode(JSON.stringify(J));const jp=(4-js.length%4)%4;if(jp){const t=new Uint8Array(js.length+jp);t.set(js);t.fill(32,js.length);js=t}
  const total=12+8+js.length+8+body.length;const out=new Uint8Array(total);const dv=new DataView(out.buffer);
  dv.setUint32(0,0x46546C67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);dv.setUint32(12,js.length,true);dv.setUint32(16,0x4E4F534A,true);out.set(js,20);
  dv.setUint32(20+js.length,body.length,true);dv.setUint32(24+js.length,0x004E4942,true);out.set(body,28+js.length);return out}
function kitB64(u8){let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return btoa(s)}
// ---------- FBX 7.4 ASCII writer (Blender, Maya, Unity, Unreal, three.js FBXLoader)
function kitFBX(S){S={...S,meshes:S.meshes.filter(m=>!m.noFBX)};let id=100000;const nid=()=>++id;const L=[];const w=s=>L.push(s);const f=v=>{const r=Math.round(v*1e6)/1e6;return (Object.is(r,-0)?0:r).toString()};
  const T_=n=>'\t'.repeat(n);
  const KL=(v,ind=2)=>{if(!v.length){w(T_(ind+1)+'a: ');return}for(let i=0;i<v.length;i+=4096)w(`${i?'':T_(ind+1)+'a: '}${v.slice(i,i+4096).join(',')}${i+4096<v.length?',':''}`)};
  const arrI=(name,a,ind=2)=>{w(`${T_(ind)}${name}: *${a.length} {`);KL(a,ind);w(T_(ind)+'}')};
  const arr=(name,a,ind=2)=>arrI(name,a.map(f),ind);
  const KT=46186158000;const C=[];const obj=[];
  w('; FBX 7.4.0 project file');w('FBXHeaderExtension:  {\n\tFBXHeaderVersion: 1003\n\tFBXVersion: 7400\n\tCreator: "Low-Poly Menagerie toon asset kit"\n}');
  const dur=Math.max(...S.clips.map(c=>c.frames.length))/S.fps;
  w(`GlobalSettings:  {\n\tVersion: 1000\n\tProperties70:  {\n\t\tP: "UpAxis", "int", "Integer", "",1\n\t\tP: "UpAxisSign", "int", "Integer", "",1\n\t\tP: "FrontAxis", "int", "Integer", "",2\n\t\tP: "FrontAxisSign", "int", "Integer", "",1\n\t\tP: "CoordAxis", "int", "Integer", "",0\n\t\tP: "CoordAxisSign", "int", "Integer", "",1\n\t\tP: "OriginalUpAxis", "int", "Integer", "",1\n\t\tP: "OriginalUpAxisSign", "int", "Integer", "",1\n\t\tP: "UnitScaleFactor", "double", "Number", "",100\n\t\tP: "OriginalUnitScaleFactor", "double", "Number", "",100\n\t\tP: "TimeMode", "enum", "", "",6\n\t\tP: "TimeSpanStart", "KTime", "Time", "",0\n\t\tP: "TimeSpanStop", "KTime", "Time", "",${Math.round(dur*KT)}\n\t\tP: "CustomFrameRate", "double", "Number", "",${S.fps}\n\t}\n}`);
  // ids
  const mId=S.nodes.map(()=>nid()),attrId=S.nodes.map(n=>n.bone?nid():0);const meshM=S.meshes.map(()=>nid()),geoId=S.meshes.map(()=>nid()),matId=S.meshes.map(()=>nid());
  w('Objects:  {');
  const model=(idv,name,type,t,pv)=>{w(`\tModel: ${idv}, "Model::${name}", "${type}" {\n\t\tVersion: 232\n\t\tProperties70:  {\n\t\t\tP: "InheritType", "enum", "", "",1\n\t\t\tP: "DefaultAttributeIndex", "int", "Integer", "",0\n\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",${t.p.map(f).join(',')}\n\t\t\tP: "Lcl Rotation", "Lcl Rotation", "", "A",${t.e.map(f).join(',')}\n\t\t\tP: "Lcl Scaling", "Lcl Scaling", "", "A",${t.s.map(f).join(',')}${pv||''}\n\t\t}\n\t\tShading: T\n\t\tCulling: "CullingOff"\n\t}`)};
  S.nodes.forEach((n,i)=>{if(n.bone){w(`\tNodeAttribute: ${attrId[i]}, "NodeAttribute::${n.name}", "LimbNode" {\n\t\tTypeFlags: "Skeleton"\n\t\tProperties70:  {\n\t\t\tP: "Size", "double", "Number", "",3\n\t\t}\n\t}`);C.push(`\tC: "OO",${attrId[i]},${mId[i]}`)}
    model(mId[i],n.name,n.bone?'LimbNode':'Null',n.trs);C.push(`\tC: "OO",${mId[i]},${n.par>=0?mId[n.par]:0}`)});
  const ident={p:[0,0,0],e:[0,0,0],s:[1,1,1]};
  const global=[];S.nodes.forEach((n,i)=>{const R=M4.trs(n.trs.p,null,[0,0,0],[1,1,1]);global[i]=n.par>=0?M4.mul(M4.id(),global[n.par],R):R});  // bind: bones carry no rotation
  const shapes=[];
  S.meshes.forEach((m,mi)=>{const n=m.pos.length/3,nt=m.idx.length/3;
    w(`\tGeometry: ${geoId[mi]}, "Geometry::${m.name}", "Mesh" {`);arr('Vertices',m.pos);
    const pvi=[];for(let t=0;t<nt;t++){pvi.push(m.idx[t*3],m.idx[t*3+1],-m.idx[t*3+2]-1)}arrI('PolygonVertexIndex',pvi);
    w('\t\tGeometryVersion: 124');w('\t\tLayerElementNormal: 0 {\n\t\t\tVersion: 101\n\t\t\tName: ""\n\t\t\tMappingInformationType: "ByVertice"\n\t\t\tReferenceInformationType: "Direct"');arr('Normals',m.nor,3);w('\t\t}');
    const rgba=[];const sg=v=>Math.pow(clamp(v,0,1),1/2.2);for(let k=0;k<n;k++)rgba.push(sg(m.col[k*3]),sg(m.col[k*3+1]),sg(m.col[k*3+2]),1);  // FBX vertex colours are sRGB
    w('\t\tLayerElementColor: 0 {\n\t\t\tVersion: 101\n\t\t\tName: "Col"\n\t\t\tMappingInformationType: "ByPolygonVertex"\n\t\t\tReferenceInformationType: "IndexToDirect"');arr('Colors',rgba,3);
    arrI('ColorIndex',m.idx,3);w('\t\t}');
    w('\t\tLayerElementMaterial: 0 {\n\t\t\tVersion: 101\n\t\t\tName: ""\n\t\t\tMappingInformationType: "AllSame"\n\t\t\tReferenceInformationType: "IndexToDirect"\n\t\t\tMaterials: *1 {\n\t\t\t\ta: 0\n\t\t\t}\n\t\t}');
    w('\t\tLayer: 0 {\n\t\t\tVersion: 100\n\t\t\tLayerElement:  {\n\t\t\t\tType: "LayerElementNormal"\n\t\t\t\tTypedIndex: 0\n\t\t\t}\n\t\t\tLayerElement:  {\n\t\t\t\tType: "LayerElementColor"\n\t\t\t\tTypedIndex: 0\n\t\t\t}\n\t\t\tLayerElement:  {\n\t\t\t\tType: "LayerElementMaterial"\n\t\t\t\tTypedIndex: 0\n\t\t\t}\n\t\t}\n\t}');
    model(meshM[mi],m.name,'Mesh',ident);C.push(`\tC: "OO",${meshM[mi]},${mId[m.parent]}`,`\tC: "OO",${geoId[mi]},${meshM[mi]}`,`\tC: "OO",${matId[mi]},${meshM[mi]}`);
    const mt=m.mat,me=Math.max(...mt.emis);w(`\tMaterial: ${matId[mi]}, "Material::${m.name}_mat", "" {\n\t\tVersion: 102\n\t\tShadingModel: "phong"\n\t\tMultiLayer: 0\n\t\tProperties70:  {\n\t\t\tP: "DiffuseColor", "Color", "", "A",1,1,1\n\t\t\tP: "Diffuse", "Vector3D", "Vector", "",1,1,1\n\t\t\tP: "EmissiveColor", "Color", "", "A",${mt.emis.map(v=>f(Math.min(1,v))).join(',')}\n\t\t\tP: "EmissiveFactor", "Number", "", "A",${f(me>0?Math.max(1,me):0)}\n\t\t\tP: "Shininess", "double", "Number", "",${f((1-mt.rough)*60+2)}\n\t\t\tP: "Opacity", "double", "Number", "",${f(mt.op)}\n\t\t}\n\t}`);
    if(m.skin){const sk=nid();w(`\tDeformer: ${sk}, "Deformer::${m.name}_skin", "Skin" {\n\t\tVersion: 101\n\t\tLink_DeformAcuracy: 50\n\t}`);C.push(`\tC: "OO",${sk},${geoId[mi]}`);
      BN.forEach((b,bi)=>{const ix=[],wt=[];for(let k=0;k<n;k++){let s=0;for(let j=0;j<4;j++)s+=m.sw[k*4+j];for(let j=0;j<4;j++)if(m.si[k*4+j]===bi&&m.sw[k*4+j]>1e-4){ix.push(k);wt.push(m.sw[k*4+j]/(s||1))}}
        if(!ix.length)return;const cl=nid(),ni=S.nodes.findIndex(x=>x.name===b);w(`\tDeformer: ${cl}, "SubDeformer::${b}", "Cluster" {\n\t\tVersion: 100\n\t\tUserData: "", ""`);
        arrI('Indexes',ix);arr('Weights',wt);arr('Transform',Array.from(M4.id()));arr('TransformLink',Array.from(global[ni]));w('\t}');
        C.push(`\tC: "OO",${cl},${sk}`,`\tC: "OO",${mId[ni]},${cl}`)})}
    if(m.targets){const bs=nid();w(`\tDeformer: ${bs}, "Deformer::${m.name}_morph", "BlendShape" {\n\t\tVersion: 100\n\t}`);C.push(`\tC: "OO",${bs},${geoId[mi]}`);
      m.targets.forEach((d,ti)=>{const ch=nid(),sh=nid();const ix=[],vv=[];for(let k=0;k<n;k++){ix.push(k);vv.push(d[k*3],d[k*3+1],d[k*3+2])}
        w(`\tGeometry: ${sh}, "Geometry::${m.name}_${ti?'frown':'smile'}", "Shape" {\n\t\tVersion: 100`);arrI('Indexes',ix);arr('Vertices',vv);arr('Normals',Array(vv.length).fill(0));w('\t}');
        w(`\tDeformer: ${ch}, "SubDeformer::${ti?'frown':'smile'}", "BlendShapeChannel" {\n\t\tVersion: 100\n\t\tDeformPercent: 0\n\t\tFullWeights: *1 {\n\t\t\ta: 100\n\t\t}\n\t}`);
        C.push(`\tC: "OO",${ch},${bs}`,`\tC: "OO",${sh},${ch}`);shapes.push({mi,ti,ch})})}});
  // bind pose
  const pose=nid();const pn=[];S.nodes.forEach((n,i)=>{if(n.bone||i===0)pn.push([mId[i],global[i]])});S.meshes.forEach((m,mi)=>{if(m.skin)pn.push([meshM[mi],M4.id()])});
  w(`\tPose: ${pose}, "Pose::BindPose", "BindPose" {\n\t\tType: "BindPose"\n\t\tVersion: 100\n\t\tNbPoseNodes: ${pn.length}`);for(const [i,mt] of pn){w(`\t\tPoseNode:  {\n\t\t\tNode: ${i}`);arr('Matrix',Array.from(mt),3);w('\t\t}')}w('\t}');
  // animation stacks
  const eq=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-4);
  for(const c of S.clips){const stk=nid(),lay=nid(),nf=c.frames.length,stop=Math.round((nf-1)/S.fps*KT);const times=Array.from({length:nf},(_,i)=>Math.round(i/S.fps*KT));
    w(`\tAnimationStack: ${stk}, "AnimStack::${c.name}", "" {\n\t\tProperties70:  {\n\t\t\tP: "LocalStart", "KTime", "Time", "",0\n\t\t\tP: "LocalStop", "KTime", "Time", "",${stop}\n\t\t\tP: "ReferenceStart", "KTime", "Time", "",0\n\t\t\tP: "ReferenceStop", "KTime", "Time", "",${stop}\n\t\t}\n\t}`);
    w(`\tAnimationLayer: ${lay}, "AnimLayer::BaseLayer", "" {\n\t}`);C.push(`\tC: "OO",${lay},${stk}`);
    const curveNode=(target,prop,label,comps,vals)=>{const cn=nid();w(`\tAnimationCurveNode: ${cn}, "AnimCurveNode::${label}", "" {\n\t\tProperties70:  {`);comps.forEach((k,j)=>w(`\t\t\tP: "d|${k}", "Number", "", "A",${f(vals[0][j])}`));w('\t\t}\n\t}');
      C.push(`\tC: "OO",${cn},${lay}`,`\tC: "OP",${cn},${target}, "${prop}"`);
      comps.forEach((k,j)=>{const cv=nid();w(`\tAnimationCurve: ${cv}, "AnimCurve::", "" {\n\t\tDefault: ${f(vals[0][j])}\n\t\tKeyVer: 4009`);
        arrI('KeyTime',times);arr('KeyValueFloat',vals.map(v=>v[j]));
        w(`\t\t;KeyAttrFlags: Cubic|TangeantAuto|GenericTimeIndependent|GenericClampProgressive\n\t\tKeyAttrFlags: *1 {\n\t\t\ta: 24836\n\t\t}\n\t\tKeyAttrDataFloat: *4 {\n\t\t\ta: 0,0,255790911,0\n\t\t}\n\t\tKeyAttrRefCount: *1 {\n\t\t\ta: ${nf}\n\t\t}\n\t}`);C.push(`\tC: "OP",${cv},${cn}, "d|${k}"`)})};
    S.nodes.forEach((n,i)=>{if(i===0)return;const fr=c.frames.map(fm=>fm.trs[i]);
      if(!fr.every(t=>eq(t.p,n.trs.p)))curveNode(mId[i],'Lcl Translation','T',['X','Y','Z'],fr.map(t=>t.p));
      if(!fr.every(t=>eq(t.e,n.trs.e)))curveNode(mId[i],'Lcl Rotation','R',['X','Y','Z'],fr.map(t=>t.e));
      if(!fr.every(t=>eq(t.s,n.trs.s)))curveNode(mId[i],'Lcl Scaling','S',['X','Y','Z'],fr.map(t=>t.s))});
    S.meshes.forEach((m,mi)=>{if(m.visVar)curveNode(meshM[mi],'Lcl Scaling','S',['X','Y','Z'],c.frames.map(fm=>fm.vis[m.item]?[1,1,1]:[1e-4,1e-4,1e-4]))});
    for(const sh of shapes)curveNode(sh.ch,'DeformPercent','DeformPercent',['DeformPercent'],c.frames.map(fm=>[fm.mw[S.meshes[sh.mi].item][sh.ti]*100]))}
  w('}');w('Connections:  {');for(const c of C)w(c);w('}');return L.join('\n')}
// ---------- three.js r187 starter page (GLB embedded)
function kitThreeStarter(glb){const b64=kitB64(glb);return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ASSET_NAME} · three.js r187</title>
<style>html,body{margin:0;height:100%;background:#eceae6;font:14px system-ui,sans-serif}#ui{position:fixed;left:10px;bottom:10px;right:10px;display:flex;flex-wrap:wrap;gap:6px}button{border:0;border-radius:10px;padding:8px 12px;background:#fff;box-shadow:0 1px 4px #0002;cursor:pointer}button.on{background:#e8607a;color:#fff}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/"}}<\/script></head>
<body><div id="ui"></div><script type="module">
import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xeceae6);const cam=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.01,100);cam.position.set(1.8,1.0,2.4);
const ctl=new OrbitControls(cam,renderer.domElement);ctl.target.set(0,.45,0);ctl.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xffffff,0x8a8070,1.4));const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(2,4,2);sun.castShadow=true;scene.add(sun);
const floor=new THREE.Mesh(new THREE.CircleGeometry(4,64),new THREE.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const LOOPS=${JSON.stringify(KIT.loops||[])};
const FLAT=${KIT.flat?'true':'false'};
const TOON=${KIT.toon===false?'false':'true'}; // set false for the PBR materials stored in the file
const grad=new THREE.DataTexture(new Uint8Array([90,170,255]),3,1,THREE.RedFormat);grad.minFilter=grad.magFilter=THREE.NearestFilter;grad.needsUpdate=true;
const bin=Uint8Array.from(atob('${b64}'),c=>c.charCodeAt(0));
new GLTFLoader().parse(bin.buffer,'',g=>{const model=g.scene;scene.add(model);
  model.traverse(o=>{if(o.isMesh){o.castShadow=!o.material.isMeshBasicMaterial;if(TOON&&!o.material.isMeshBasicMaterial){const m=o.material;o.material=new THREE.MeshToonMaterial({vertexColors:true,gradientMap:grad,transparent:m.transparent,opacity:m.opacity,emissive:m.emissive,emissiveIntensity:m.emissiveIntensity,side:m.side,flatShading:FLAT});}}});
  const mixer=new THREE.AnimationMixer(model);const ui=document.getElementById('ui');let cur;
  const play=c=>{const a=mixer.clipAction(c);if(cur&&cur!==a)cur.fadeOut(.25);a.reset().fadeIn(.25).play();a.setLoop(LOOPS.includes(c.name)?THREE.LoopRepeat:THREE.LoopOnce,Infinity);a.clampWhenFinished=true;cur=a;
    for(const b of ui.children)b.classList.toggle('on',b.textContent===c.name)};
  for(const c of g.animations){const b=document.createElement('button');b.textContent=c.name;b.onclick=()=>play(c);ui.appendChild(b)}
  play(g.animations.find(c=>c.name==='idle')||g.animations[0]);window.__loops=LOOPS;const clock=new THREE.Clock();
  renderer.setAnimationLoop(()=>{mixer.update(clock.getDelta());ctl.update();renderer.render(scene,cam)});window.__three={model,clips:g.animations,mixer}});
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
<\/script></body></html>`}

// ---------- soft fur as real geometry (exports with the model): skinned triangle blades grown from the skin
function kitBuildFur(o){const src=pigItem.gl.src,g=src.g,ex=src.extra,P=g.pos,N=g.nor,I=g.idx,H=ex.hair||[];const nt=I.length/3;
  const area=[];let tot=0;for(let t=0;t<nt;t++){const a=I[t*3],b=I[t*3+1],c=I[t*3+2];const pa=[P[a*3],P[a*3+1],P[a*3+2]],pb=[P[b*3],P[b*3+1],P[b*3+2]],pc=[P[c*3],P[c*3+1],P[c*3+2]];
    const ar=vlen(vcross(vsub(pb,pa),vsub(pc,pa)))*.5*Math.pow(((H[a]||1)+(H[b]||1)+(H[c]||1))/3,1.5);area.push(tot+=ar)}
  const A={pos:[],nor:[],col:[],idx:[],si:[],sw:[]};const vsrc=[],vk=[];const down=o.comb||[0,-.55,-.8];
  for(let k=0;k<o.count;k++){const r=rnd()*tot;let lo=0,hi=nt-1;while(lo<hi){const m=(lo+hi)>>1;if(area[m]<r)lo=m+1;else hi=m}const t=lo;
    const ids=[I[t*3],I[t*3+1],I[t*3+2]];let u=rnd(),v=rnd();if(u+v>1){u=1-u;v=1-v}const w=[1-u-v,u,v];
    const p=[0,0,0],n=[0,0,0];let h=0;ids.forEach((id,j)=>{for(let q=0;q<3;q++){p[q]+=P[id*3+q]*w[j];n[q]+=N[id*3+q]*w[j]}h+=(H[id]||1)*w[j]});const nn=vnorm(n);
    if(h<.25)continue;const tg=vnorm(vsub(down,vsc(nn,vdot(down,nn))));const side=vnorm(vcross(nn,tg));const L=o.len*h*rr(.6,1.05),W=o.width*rr(.8,1.2);
    const tip=vadd(p,vadd(vsc(nn,L*.55),vsc(tg,L*.85)));const b0=vadd(vsub(p,vsc(side,W)),vsc(nn,-.002)),b1=vadd(vadd(p,vsc(side,W)),vsc(nn,-.002));
    const main=ids[w.indexOf(Math.max(...w))];const base=A.pos.length/3;
    for(const [q,kk] of [[b0,0],[b1,0],[tip,1]]){A.pos.push(...q);A.nor.push(...nn);A.col.push(1,1,1);for(let j=0;j<4;j++){A.si.push(ex.si[main*4+j]);A.sw.push(ex.sw[main*4+j])}vsrc.push(main);vk.push(kk*rr(.7,1.2))}
    {const fn=vcross(vsub(b1,b0),vsub(tip,b0));if(vdot(fn,nn)>=0)A.idx.push(base,base+1,base+2);else A.idx.push(base,base+2,base+1)}}
  const gg=new Geo();gg.pos=A.pos;gg.nor=A.nor;gg.col=A.col;gg.idx=A.idx;
  const it=addItem(upload(gg,{si:A.si,sw:A.sw,m1:A.pos}),null,{skin:true,flat:0,rough:.8,spec:.15,rim:.4,cast:false});it.furSrc=vsrc;it.furK=vk;it.furColor=o.color;it.tipK=o.tip||.25;
  KIT.furItem=it;kitRecolorFur();it.visible=KIT.fur;return it}
function kitRecolorFur(){const it=KIT.furItem;if(!it)return;const g=it.gl.src.g;for(let i=0;i<it.furSrc.length;i++){const c=it.furColor(it.furSrc[i]);const k=it.furK[i];
    const m=k>0?1+it.tipK*k:.82;for(let q=0;q<3;q++)g.col[i*3+q]=Math.min(1,c[q]*m+(k>0?.02*k:0))}
  gl.bindBuffer(gl.ARRAY_BUFFER,it.gl.bufs[2]);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(g.col))}
// ---------- UI
// zip (store) so .glb/.gltf/.fbx pass the artifact download allowlist
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function kitCRC(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRCT[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function kitZip(files){const enc=new TextEncoder();const parts=[],cen=[];let off=0;
  for(const f of files){const d=typeof f.data==='string'?enc.encode(f.data):f.data,nm=enc.encode(f.name),crc=kitCRC(d);
    const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(8,0,true);h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,nm.length,true);
    parts.push(new Uint8Array(h.buffer),nm,d);const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
    cen.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+d.length}
  const cs=cen.reduce((a,b)=>a+b.length,0);const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cs,true);e.setUint32(16,off,true);
  return new Blob([...parts,...cen,new Uint8Array(e.buffer)],{type:'application/zip'})}
let KIT_DL=null;try{if(window.claude&&window.claude.use)window.claude.use('downloads').then(d=>{KIT_DL=d}).catch(()=>{})}catch(e){}
async function kitSave(name,data){if(!KIT_DL&&window.claude&&window.claude.use){try{KIT_DL=await window.claude.use('downloads')}catch(e){}}if(KIT_DL){try{await KIT_DL.save({filename:name,data});return}catch(e){if(e&&e.code==='declined')return;console.warn(e)}}
  const b=data instanceof Blob?data:new Blob([data]);const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},3000)}
function kitReadme(){return `${ASSET_NAME} — toon asset from the Low-Poly Menagerie
Units: metres, Y up, faces +Z. Skinned mesh (${BN.length} joints) + rigid face parts on the head joint.
Animations (in place, ${KIT.fps} fps): ${(KIT.loops||[]).join(', ')} (loops) and one-shot actions.
Colours are vertex colours (COLOR_0). For a toon look in three.js use MeshToonMaterial({vertexColors:true}).
Files: .glb (binary glTF 2.0), .gltf (embedded), .fbx (FBX 7.4 ASCII; Blender/Maya/Unity/Unreal/three FBXLoader), ${ASSET_NAME}-three-r187.html (three.js r187 starter).`}
function kitBuildUI(){const row=document.getElementById('asset');if(!row)return;const mk=(t,fn,tog)=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>fn(b);if(tog)b.classList.toggle('on',tog());row.appendChild(b);return b};
  mk('Background',b=>{kitSetBg(!KIT.bg);b.classList.toggle('on',KIT.bg)},()=>KIT.bg);mk('Soft fur',b=>{KIT.fur=!KIT.fur;if(KIT.furItem)KIT.furItem.visible=KIT.fur;b.classList.toggle('on',KIT.fur)},()=>KIT.fur);
  const busy=(b,fn)=>{const t=b.textContent;b.textContent='Baking…';setTimeout(async()=>{try{await fn()}catch(e){console.error(e);alert('Export failed: '+e.message)}b.textContent=t},30)};
  const N=ASSET_NAME;
  mk('⬇ GLB',b=>busy(b,()=>kitSave(N+'-glb.zip',kitZip([{name:N+'.glb',data:kitGLTF(kitScene(),true)},{name:'README.txt',data:kitReadme()}]))));
  mk('⬇ glTF',b=>busy(b,()=>kitSave(N+'-gltf.zip',kitZip([{name:N+'.gltf',data:kitGLTF(kitScene(),false)},{name:'README.txt',data:kitReadme()}]))));
  mk('⬇ FBX',b=>busy(b,()=>kitSave(N+'-fbx.zip',kitZip([{name:N+'.fbx',data:kitFBX(kitScene())},{name:'README.txt',data:kitReadme()}]))));
  mk('⬇ three.js r187',b=>busy(b,()=>kitSave(N+'-three-r187.html',kitThreeStarter(kitGLTF(kitScene(),true)))));
  mk('⬇ All (.zip)',b=>busy(b,()=>{const S=kitScene();const glb=kitGLTF(S,true);return kitSave(N+'-asset-pack.zip',kitZip([{name:N+'.glb',data:glb},{name:N+'.gltf',data:kitGLTF(S,false)},{name:N+'.fbx',data:kitFBX(S)},{name:N+'-three-r187.html',data:kitThreeStarter(glb)},{name:'README.txt',data:kitReadme()}]))}))}
window.__kit={KIT,kitScene,kitGLTF,kitFBX,kitThreeStarter,kitSetBg,kitB64,kitZip};
