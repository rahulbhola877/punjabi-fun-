import sys;sys.path.insert(0,'/home/claude/young')
from babyfy import babyfy
from ground import add_ground
s=open('/home/claude/leopard/index.html').read()
bear=open('/home/claude/bear/index.html').read()
def r(o,n):
    global s
    assert o in s,o[:80];s=s.replace(o,n)
# ---- HOUSE CAT sculpt + rig (proportions from breed standards & toon refs: body ~3.3 heads, legs = chest depth, tail ≈ body & carried up)
a=s.index("// ===== SNOW LEOPARD SCULPT =====");b=s.index("function grad(",a)
s=s[:a]+"""// ===== HOUSE CAT SCULPT =====
const EAR_C=[0.104,0.94,0.43], EAR_M=M4.inv(M4.trs(EAR_C,null,[0.12,0.18,-0.34],[1,1,1]));
function earLocal(x,y,z){return M4.pt(EAR_M,[x,y,z])}
function sdEar(ax,y,z){const q=earLocal(ax,y,z);const tp=1+1.9*Math.max(0,q[1]+0.012)/0.08;return sdEll(q[0]*tp,q[1],q[2]+q[0]*q[0]*4,0,0,0,0.066,0.082,0.017)}
function sdLegF(ax,y,z){const d=sdCone(ax,y,z,0.1,0.44,0.23,0.1,0.07,0.27,0.062,0.044);return smin(d,sdEll(ax,y,z,0.1,0.034,0.3,0.05,0.034,0.062),0.04)}
function sdLegB(ax,y,z){let d=sdEll(ax,y,z,0.112,0.42,-0.27,0.085,0.14,0.11);d=smin(d,sdCone(ax,y,z,0.112,0.32,-0.33,0.112,0.07,-0.29,0.052,0.042),0.05);return smin(d,sdEll(ax,y,z,0.112,0.034,-0.26,0.048,0.034,0.062),0.04)}
function sdSnout(x,y,z){return sdEll(x,y,z,0,0.742,0.575,0.068,0.05,0.045)}
const TAILP=[[0,0.58,-0.4],[0,0.7,-0.5],[0,0.84,-0.55],[0,0.98,-0.55],[0,1.08,-0.5],[0,1.13,-0.43]],TAILR=[0.046,0.04,0.037,0.035,0.033,0.03];
function sdTail(x,y,z){let d=9;for(let i=0;i<5;i++)d=smin(d,sdCone(x,y,z,...TAILP[i],...TAILP[i+1],TAILR[i],TAILR[i+1]),0.03);return d}
function pigSDF(x,y,z){const ax=Math.abs(x);
  let d=sdEll(x,y,z,0,0.52,0,0.15,0.16,0.26);
  d=smin(d,sdEll(x,y,z,0,0.53,-0.24,0.16,0.17,0.2),0.08);
  d=smin(d,sdEll(x,y,z,0,0.55,0.19,0.15,0.17,0.18),0.08);
  d=smin(d,sdCone(x,y,z,0,0.6,0.28,0,0.72,0.38,0.11,0.1),0.06);
  d=smin(d,smin(sdEll(x,y,z,0,0.8,0.45,0.17,0.155,0.15),sdEll(x,y,z,0,0.745,0.5,0.165,0.1,0.12),0.06),0.05);
  d=smin(d,sdSnout(x,y,z),0.04);
  d=smin(d,sdEar(ax,y,z),0.022);
  d=smin(d,sdLegF(ax,y,z),0.06);
  d=smin(d,sdLegB(ax,y,z),0.06);
  d=smin(d,sdTail(x,y,z),0.05);
  return Math.max(d,-(y-0.004));
}
"""+s[b:]
a=s.index("// ---------- rig ----------");b=s.index("const COL={",a)
s=s[:a]+"""// ---------- rig ----------
const BN=['root','hips','spine','chest','neck','head','earL','earR','flU','flL','frU','frL','blU','blL','brU','brL','t0','t1','t2','t3','t4'];
const REST={root:[0,0,0],hips:[0,0.54,-0.24],spine:[0,0.54,0],chest:[0,0.55,0.2],neck:[0,0.64,0.32],head:[0,0.78,0.42],
  earL:[0.1,0.9,0.43],earR:[-0.1,0.9,0.43],flU:[0.1,0.46,0.235],flL:[0.1,0.25,0.255],frU:[-0.1,0.46,0.235],frL:[-0.1,0.25,0.255],
  blU:[0.112,0.46,-0.28],blL:[0.112,0.24,-0.32],brU:[-0.112,0.46,-0.28],brL:[-0.112,0.24,-0.32],t0:TAILP[0],t1:TAILP[1],t2:TAILP[2],t3:TAILP[3],t4:TAILP[4]};
const PARENT={hips:'root',spine:'hips',chest:'spine',neck:'chest',head:'neck',earL:'head',earR:'head',flU:'chest',flL:'flU',frU:'chest',frL:'frU',
  blU:'hips',blL:'blU',brU:'hips',brL:'brU',t0:'hips',t1:'t0',t2:'t1',t3:'t2',t4:'t3'};
const SEG={hips:[[0,0.54,-0.44],[0,0.54,0]],spine:[REST.spine,REST.chest],chest:[REST.chest,[0,0.6,0.32]],neck:[REST.neck,REST.head],head:[REST.head,[0,0.75,0.64]],
  earL:[REST.earL,[0.13,1.0,0.42]],earR:[REST.earR,[-0.13,1.0,0.42]],flU:[REST.flU,REST.flL],flL:[REST.flL,[0.1,0.02,0.3]],frU:[REST.frU,REST.frL],frL:[REST.frL,[-0.1,0.02,0.3]],
  blU:[REST.blU,REST.blL],blL:[REST.blL,[0.112,0.02,-0.25]],brU:[REST.brU,REST.brL],brL:[REST.brL,[-0.112,0.02,-0.25]]};
for(let i=0;i<5;i++)SEG['t'+i]=[TAILP[i],TAILP[i+1]];
function segDist(p,a,b){const ab=vsub(b,a),t=clamp(vdot(vsub(p,a),ab)/vdot(ab,ab),0,1);return vlen(vsub(p,vadd(a,vsc(ab,t))))}
function pigWeights(p){const ax=Math.abs(p[0]),side=p[0]>=0?'L':'R',fs=p[0]>=0?'fl':'fr',bs=p[0]>=0?'bl':'br';const W=[];
  const push=(name,d,pw=4)=>W.push([BN.indexOf(name),1/Math.pow(d+0.012,pw)]);
  for(const n of ['hips','spine','chest'])push(n,segDist(p,...SEG[n])+0.05,6);for(const n of ['neck','head'])push(n,segDist(p,...SEG[n]));
  if(sdEar(ax,p[1],p[2])<0.02){const e='ear'+side;push(e,segDist(p,...SEG[e])*0.55)}
  if(sdTail(p[0],p[1],p[2])<0.025&&(p[2]<-0.42||p[1]>0.66)&&p[2]<-0.3)for(let i=0;i<5;i++)push('t'+i,segDist(p,...SEG['t'+i])+0.005,5);
  const lf=sdLegF(ax,p[1],p[2]);if(lf<0.035&&p[1]<0.47){const k=1+Math.max(0,p[1]-0.36)*9;push(fs+'U',segDist(p,...SEG[fs+'U'])*k);push(fs+'L',segDist(p,...SEG[fs+'L'])*k)}
  const lb=sdLegB(ax,p[1],p[2]);if(lb<0.035&&p[1]<0.49){const k=1+Math.max(0,p[1]-0.36)*9;push(bs+'U',segDist(p,...SEG[bs+'U'])*k);push(bs+'L',segDist(p,...SEG[bs+'L'])*k)}
  W.sort((a,b)=>b[1]-a[1]);const top=W.slice(0,4);while(top.length<4)top.push([0,0]);const s=top.reduce((a,b)=>a+b[1],0);
  return [top.map(w=>w[0]),top.map(w=>w[1]/s)]}

"""+s[b:]
a=s.index("function pigVertex(p)");b=s.index("function buildPig",a)
s=s[:a]+"""function pigVertex(p){const [x,y,z]=p,ax=Math.abs(x);let c=hex(COL.skin);
  c=mixc(c,hex(COL.back),sstep(0.6,0.68,y)*sstep(0.32,0.2,z));
  const mz=sstep(0.02,-0.005,sdSnout(x,y,z))+sstep(0.77,0.73,y)*sstep(0.52,0.58,z)*sstep(0.09,0.05,ax);
  const bib=sstep(0.2,0.3,z)*sstep(0.7,0.62,y)*sstep(0.4,0.48,y)*sstep(0.1,0.05,ax*1.2-(0.7-y)*0.1);
  const belly=sstep(0.42,0.37,y)*sstep(0.09,0.04,ax);const paws=sstep(0.1,0.07,y);
  c=mixc(c,hex(COL.belly),clamp(mz+bib+belly+paws,0,1));
  const ed=sstep(0.02,0,sdEar(ax,y,z)),el=earLocal(ax,y,z);c=mixc(c,hex(COL.earIn),ed*sstep(0.0,0.012,el[2])*.85);
  return [c,clamp(0.9-sstep(0.55,0.62,z)*.35-ed*.45,0,1)]}
"""+s[b:]
r("surfaceNets(f,[-0.29,-0.02,-1.66],[0.29,1.0,1.0],0.025)","surfaceNets(f,[-0.3,-0.02,-0.72],[0.3,1.24,0.72],0.018)")
# face anchors moved onto the new head
r("const S=marchOut([0,0.8,0.76],dir)","const S=marchOut([0,0.8,0.47],dir)")
r("const np=marchIn([0,0.796,1.3],[0,0,-1]);","const np=marchIn([0,0.765,1.3],[0,0,-1]);")
r("const q1=marchIn([0,0.765,1.3],[0,0,-1]),q2=marchIn([0,0.742,1.3],[0,0,-1]);","const q1=marchIn([0,0.737,1.3],[0,0,-1]),q2=marchIn([0,0.717,1.3],[0,0,-1]);")
r("const y=k==='n'?0.738+u*u*0.008:k==='s'?0.733+u*u*0.024:0.743-u*u*0.015;","const y=k==='n'?0.712+u*u*0.008:k==='s'?0.707+u*u*0.022:0.717-u*u*0.014;")
r("const mc=marchIn([0,0.734,1.3],[0,0,-1]);","const mc=marchIn([0,0.708,1.3],[0,0,-1]);")
r("const p=marchOut([0,0.77-k*0.008,0.86],vnorm([0.9*s,-0.12+k*0.03,0.42]));","const p=marchOut([0,0.75-k*0.007,0.55],vnorm([0.9*s,-0.12+k*0.03,0.42]));")
r("const nd=B[bn].add(new Node(vsub([sx+o*0.024,0.03,0.52-Math.abs(o)*0.008],REST[bn])));","const nd=B[bn].add(new Node(vsub([sx+o*0.02,0.03,0.345-Math.abs(o)*0.007],REST[bn])));")
r("const H=B.head,rE=0.044;","const H=B.head,rE=YOUNG?0.056:0.05;")
r("addItem(gIris,ig,{color:hex(0xa7b48c)","addItem(gIris,ig,{color:hex(0x63b04c)")
r("e.pg.s=[pw,pw,1]","e.pg.s=[pw*Math.min(1,0.32+Math.max(0,pw-0.9)*1.5),pw*1.05,1]")
r("const SHELLS=16,HAIR_LEN=0.042;","const SHELLS=16,HAIR_LEN=YOUNG?0.034:0.026;")
r("const gLash=upload(torus(rE*1.14,rE*.1,6,40)),gLashL=upload(torus(rE*1.12,rE*.07,6,40));","const gLash=upload(torus(rE*1.14,rE*.055,6,40)),gLashL=upload(torus(rE*1.12,rE*.035,6,40));")
r("const COL={skin:0xcdc4b2,back:0xb3a996,belly:0xf4f1ea,muzzle:0xf2eee6,earBack:0x3a3632,earIn:0xe9dcd4,tip:0x2a2725};","const COL={skin:0xe8903f,back:0xd77a30,belly:0xfbf1e2,muzzle:0xfaf0e0,earBack:0xd57730,earIn:0xf2939f,tip:0xd2752c};")
# ---- ginger tabby coat (replaces rosettes): stripes across the body, rings on legs and tail, forehead M
a=s.index("   base*=.92+.16*m2;");E_="base=mix(base,vec3(.055,.05,.045),clamp(pat*.88,0.,1.));";b=s.index(E_,a)+len(E_)
s=s[:a]+"""   base*=.94+.12*m2;
   float gin=smoothstep(.18,.35,base.r-base.b);                                          // only on orange fur
   float wv=fbm(vR*6.)*.9;
   float body=smoothstep(.3,.75,sin(vR.z*38.+wv*3.+abs(vR.x)*14.))*smoothstep(-.46,-.32,vR.z)*smoothstep(.3,.2,vR.z);
   float leg=smoothstep(.35,.8,sin(vR.y*70.+wv*2.))*smoothstep(.42,.3,vR.y)*smoothstep(.08,.12,vR.y);
   float tail=smoothstep(.2,.7,sin((vR.y-vR.z)*40.+wv))*smoothstep(-.36,-.42,vR.z)*smoothstep(.6,.66,vR.y);
   float hx=abs(vR.x);float mm=smoothstep(.5,.56,vR.z)*smoothstep(.84,.88,vR.y)*(smoothstep(.012,.0,abs(hx-.012-(vR.y-.85)*.6))+smoothstep(.012,.0,abs(hx-.045+(vR.y-.85)*.4)));
   float cheek=smoothstep(.0,.008,abs(sin(vR.y*90.)))*0.+smoothstep(.5,.55,vR.z)*smoothstep(.06,.1,hx)*smoothstep(.73,.77,vR.y)*smoothstep(.82,.78,vR.y)*smoothstep(.4,.9,sin(vR.y*120.));
   float pat=clamp(body+leg+tail+mm*1.2+cheek,0.,1.)*gin;
   base=mix(base,base*vec3(.62,.42,.3),pat*.85);"""+s[b:]
# ---- back to the meadow (garden) habitat
a=s.index("function noise2(x,z)");b=s.index("// particles",a)
ba=bear.index("function noise2(x,z)");bb=bear.index("// particles",ba)
s=s[:a]+bear[ba:bb]+"function initSnow(){}\nfunction updSnow(){}\n"+s[b:]
r("vec3 top=vec3(.14,.36,.74),hor=vec3(.84,.88,.92);","vec3 top=vec3(.18,.42,.78),hor=vec3(.86,.80,.70);")
r("GND=hex(0xa09c90).map(v=>v*.32),FOG=hex(0xd3dbe2);","GND=hex(0x9aa86a).map(v=>v*.3),FOG=hex(0xd8d2c4);")
r("gl.uniform1f(U.uFogN,26);gl.uniform1f(U.uFogF,100);","gl.uniform1f(U.uFogN,22);gl.uniform1f(U.uFogF,62);")
s=s.replace("background:#dfe6ec","background:#d9e4ea")
# ---- kitten via the age warp (toggle with #kitten)
s=babyfy(s,dict(young='location.hash==="#kitten"',ch='[0,0.79,0.46]',s=1.32,legY=0.4,legK=0.8,xK=1.06,zK=0.82,r0=0.19,r1=0.46,size=0.3))
r("if(YOUNG)pigN.s=[0.3,0.3,0.3];","pigN.s=YOUNG?[0.3,0.3,0.3]:[0.5,0.5,0.5];")
r("0.56+pose[RY]*.4","(YOUNG?0.17:0.28)+pose[RY]*.3");r("target:[0,0.56,0]","target:[0,0.28,0]");r("cam={th:0.62,ph:1.24,d:3.7","cam={th:0.62,ph:1.26,d:2.0")
r("cam.d=Math.max(cam.d,4.4)","cam.d=Math.max(cam.d,YOUNG?1.7:2.4)")
r("const tgtSpd=(st.loop==='walk'?.7:st.loop==='run'?3.0:0)*(1-aw);","const SPD=YOUNG?.6:1;const tgtSpd=(st.loop==='walk'?.4*SPD:st.loop==='run'?1.9*SPD:0)*(1-aw);")
r("st.walkPh+=dt*st.speed/0.7*TAU*1.0;st.runPh+=dt*Math.max(st.speed,.5)/3.0*TAU*2.1;","st.walkPh+=dt*st.speed/(.4*SPD)*TAU*0.85;st.runPh+=dt*Math.max(st.speed,.3)/(1.9*SPD)*TAU*2.1;")
r("['roar','Roar']","['roar','Hiss']")
r('<button id="wire">Wireframe</button>','<button id="wire">Wireframe</button><button id="age" style="position:fixed;right:14px;top:58px;font-size:12px;padding:7px 11px"></button>')
r("window.__pig={","{const ab=document.getElementById('age');ab.textContent=YOUNG?'Grow up ⇢ Cat':'Make kitten ✦';ab.onclick=()=>{location.hash=YOUNG?'cat':'kitten';location.reload()};addEventListener('hashchange',()=>location.reload())}\nwindow.__pig={")
r("<title>Low-Poly Menagerie · 04 Snow Leopard</title>","<title>Low-Poly Menagerie · 08 Ginger Cat</title>")
r("04 / 20 · LOW-POLY MENAGERIE</span><h1>Snow Leopard</h1>","08 / 20 · LOW-POLY MENAGERIE</span><h1 id=\"ttl\">Ginger Cat</h1>")
r("Climbing the mountain…","Waking the cat…")
r("refreshUI();const L=document.getElementById('load')","if(YOUNG)document.getElementById('ttl').textContent='Ginger Kitten';refreshUI();const L=document.getElementById('load')")
open('index.html','w').write(s);print('ok')
s=open('index.html').read()
def r2(o,n):
    global s
    assert o in s,o[:70];s=s.replace(o,n)
import re
r2("float body=smoothstep(.3,.75,sin(vR.z*38.+wv*3.+abs(vR.x)*14.))","float body=smoothstep(.55,.9,sin(vR.z*30.+wv*4.+abs(vR.x)*12.+fbm(vR*14.)*1.5))")
r2("base=mix(base,base*vec3(.62,.42,.3),pat*.85);","base=mix(base,base*vec3(.7,.5,.36),pat*.6);")
r2("one furry skin · rosette coat · 21 bones","one furry skin · ginger tabby coat · 21 bones")
r2("const hp=vadd(cq,vsc(vsub(p,c),YC.s));","const hp=vadd(vadd(cq,vsc(vsub(p,c),YC.s)),YC.off||[0,0,0]);")

# ---- graceful cat walk: lateral sequence, single-file paw placement, shoulder roll, steady head, slow S-curve tail
a=s.index("  walk(t,L,ph){");b=s.index("return P},",a)+len("return P},")
s=s[:a]+"""  walk(t,L,ph){const P=P0();
    const leg=(n,q,back,side)=>{const sw=Math.sin(q),c=Math.cos(q),lift=Math.max(0,c);
      S(P,n+'U',-sw*.36+(back?.04:0),0,side*(.07+.04*lift));
      S(P,n+'L',Math.pow(lift,1.5)*(back?.55:.95),0,0)};
    leg('bl',ph,1,-1);leg('fl',ph+PI*.5,0,-1);leg('br',ph+PI,1,1);leg('fr',ph+PI*1.5,0,1);
    S(P,'hips',0,Math.sin(ph)*.07,Math.sin(ph)*.045);S(P,'spine',0,-Math.sin(ph+.6)*.03,0);
    S(P,'chest',0,-Math.sin(ph+PI*.5)*.06,Math.sin(ph+PI*.5)*.07);
    S(P,'neck',.05,Math.sin(ph+PI*.5)*.05,-Math.sin(ph+PI*.5)*.05);S(P,'head',-.06,Math.sin(ph+PI*.5)*.02+L.yaw*.25,-Math.sin(ph+PI*.5)*.03);
    TB.forEach((n,i)=>S(P,n,i===4?.25:0,Math.sin(ph*.5-i*.55)*.11,0));earBob(P,.05,0);P[RY]=-Math.cos(2*ph)*.006-.012;return P},"""+s[b:]
r("const tgtSpd=","const tgtSpdX=0;const tgtSpd=")
# ---- eye colour chips
r('<div class="row face" id="faces"><span class="lbl">Face</span></div>','<div class="row face" id="faces"><span class="lbl">Face</span></div>\n  <div class="row face" id="eyes"><span class="lbl">Eyes</span></div>')
r("window.__pig={",r"""{const EYES=[['Green',0x63b04c,0x2e5a20],['Amber',0xe3a51e,0x7a4a08],['Copper',0xd06a26,0x6a2c0c],['Blue',0x4aa6ee,0x1c4a80],['Hazel',0xa29040,0x4a4018],['Odd-eyed',[0x4aa6ee,0xe3a51e],[0x1c4a80,0x7a4a08]]];
  const row=document.getElementById('eyes');
  const setE=(c,rc)=>{FACE.eyes.forEach((e,i)=>{const its=items.filter(it=>it.node===e.ig);const ci=Array.isArray(c)?c[i]:c,ri=Array.isArray(rc)?rc[i]:rc;its[0].color=hex(ci);its[1].color=hex(ri)})};
  for(const [l,c,rc] of EYES){const b=document.createElement('button');const cc=Array.isArray(c)?c:[c,c];
    b.innerHTML=`<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#${cc[0].toString(16).padStart(6,'0')};margin-right:4px;vertical-align:-1px"></span>`+(cc[0]!==cc[1]?`<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#${cc[1].toString(16).padStart(6,'0')};margin-right:6px;vertical-align:-1px"></span>`:'')+l;
    b.onclick=()=>{setE(c,rc);for(const x of row.querySelectorAll('button'))x.classList.toggle('on',x===b)};row.appendChild(b)}}
window.__pig={""")
s=add_ground(s,extra="[['hips',[0,-0.14,-0.12]]]")
open('index.html','w').write(s);print('cat2 ok')
