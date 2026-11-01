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
