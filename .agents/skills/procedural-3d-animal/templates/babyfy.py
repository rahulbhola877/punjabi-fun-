# Generic "young version" warp for a quadruped template page.
# usage: babyfy(src_html, cfg) -> html ; cfg keys: ch (head centre), s (head scale), legK, xK, zK, size, rEk, hashToggle
def babyfy(s,cfg):
    def r(o,n):
        nonlocal s
        assert o in s,o[:80]; s=s.replace(o,n,1)
    C=cfg
    # 1) adult SDF renamed; pigSDF becomes the warped one (switchable for face building)
    r("function pigSDF(x,y,z){","function adultSDF(x,y,z){")
    r("function surfaceNets(f,mn,mx,h){",r'''// ---------- AGE WARP: adult anatomy -> young proportions ----------
const YOUNG=%(young)s;const YC={ch:%(ch)s,s:%(s)s,legY:%(legY)s,legK:%(legK)s,xK:%(xK)s,zK:%(zK)s,r0:%(r0)s,r1:%(r1)s};
function legG(y){return y-(1-YC.legK)*YC.legY*sstep(0,YC.legY,y)}
function warpF(p){if(!YOUNG)return p;const q=[p[0]*YC.xK,legG(p[1]),p[2]*YC.zK];const c=YC.ch,cq=[0,legG(c[1]),c[2]*YC.zK];
  const w=sstep(YC.r1,YC.r0,vlen(vsub(p,c)));const hp=vadd(cq,vsc(vsub(p,c),YC.s));return vadd(q,vsc(vsub(hp,q),w))}
function warpInv(p){if(!YOUNG)return p;let q=[p[0]/YC.xK,p[1],p[2]/YC.zK];
  for(let it=0;it<8;it++){const f=warpF(q),e=vsub(f,p);if(vlen(e)<1e-6)break;const h=1e-4,J=[];for(let k=0;k<3;k++){const d=[0,0,0];d[k]=h;J.push(vsc(vsub(warpF(vadd(q,d)),f),1/h))}
    // solve J^T columns: J[k] = dF/dq_k ; Newton step q -= J^-1 e
    const a=J[0],b=J[1],c2=J[2];const det=vdot(a,vcross(b,c2));if(Math.abs(det)<1e-9)break;
    const dx=[vdot(e,vcross(b,c2))/det,vdot(a,vcross(e,c2))/det,vdot(a,vcross(b,e))/det];q=vsub(q,dx)}return q}
let SDF_ADULT=0;
let WARP_ALWAYS=false;function pigSDF(x,y,z){return adultSDF(x,y,z)}
function surfaceNets(f,mn,mx,h){'''%dict(young=C['young'],ch=C['ch'],s=C['s'],legY=C['legY'],legK=C['legK'],xK=C['xK'],zK=C['zK'],r0=C['r0'],r1=C['r1'],dk=C.get('dk',0.9)))
    # 2) colours + weights are evaluated in adult anatomy
    r("  const g=new Geo();g.pos=pos;g.nor=nor;g.col=col;g.idx=idx;","  if(YOUNG||WARP_ALWAYS){for(let i=0;i<pos.length/3;i++){const q=warpF([pos[i*3],pos[i*3+1],pos[i*3+2]]);pos[i*3]=q[0];pos[i*3+1]=q[1];pos[i*3+2]=q[2]}\n    nor.fill(0);for(let t=0;t<idx.length;t+=3){const a=idx[t],b=idx[t+1],c=idx[t+2];const P=k=>[pos[k*3],pos[k*3+1],pos[k*3+2]];const fn=vcross(vsub(P(b),P(a)),vsub(P(c),P(a)));for(const k of [a,b,c]){nor[k*3]+=fn[0];nor[k*3+1]+=fn[1];nor[k*3+2]+=fn[2]}}\n    for(let i=0;i<nor.length;i+=3){const v=vnorm([nor[i],nor[i+1],nor[i+2]]);nor[i]=v[0];nor[i+1]=v[1];nor[i+2]=v[2]}}\n  const g=new Geo();g.pos=pos;g.nor=nor;g.col=col;g.idx=idx;")
    # 3) bones live in young space (adult REST kept for the face build)
    r("const sceneRoot=new Node();const pigN=sceneRoot.add(new Node());const B={};","const REST_A={};for(const k in REST){REST_A[k]=[...REST[k]];REST[k]=warpF(REST[k])}\nconst sceneRoot=new Node();const pigN=sceneRoot.add(new Node());const B={};")
    # 4) face built in adult space on a scaled face root under the head bone
    r("function headLocal(p){return vsub(p,REST.head)}","function headLocal(p){return vsub(p,REST_A.head)}")
    a=s.index("function buildFace(){");b=s.index("\nfunction eH(p)",a)
    body=s[a:b]
    body=body.replace("REST.head","REST_A.head").replace("H.add(","FR.add(")
    body=body.replace("function buildFace(){","function buildFace(){SDF_ADULT=1;const FR=B.head.add(new Node());{const k=YOUNG?YC.s*%s:1;FR.s=[k,k,k];}"%1.0,1)
    # close: set SDF_ADULT=0 at end (last closing brace of buildFace)
    body=body.rstrip()
    assert body.endswith("}")
    body=body[:-1]+"SDF_ADULT=0;}\n"
    s=s[:a]+body+s[b:]
    # 5) overall size
    r("  pigN.p=[st.pos[0],0,st.pos[2]];pigN.r=[0,st.head,0];","  pigN.p=[st.pos[0],0,st.pos[2]];pigN.r=[0,st.head,0];if(YOUNG)pigN.s=[%(sz)s,%(sz)s,%(sz)s];"%dict(sz=C['size']))
    r("np[i*3]=x-g[0]*d/gg;np[i*3+1]=y-g[1]*d/gg;np[i*3+2]=z-g[2]*d/gg","const mv=clamp(d/Math.sqrt(gg),-0.008,0.008)/Math.sqrt(gg);np[i*3]=x-g[0]*mv;np[i*3+1]=y-g[1]*mv;np[i*3+2]=z-g[2]*mv")
    return s
