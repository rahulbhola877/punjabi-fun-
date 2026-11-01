import sys;sys.path.insert(0,'/home/claude/young')
from babyfy import babyfy
from ground import add_ground
s=open('/home/claude/aussie/index.html').read()
def r(o,n):
    global s
    assert o in s,o[:80];s=s.replace(o,n)
# puppy anatomy tweaks (adult space): short round muzzle, floppier ears, bigger eyes, fluffier coat
r("function sdSnout(x,y,z){return sdCone(x,y,z,0,0.775,0.63,0,0.748,0.8,0.076,0.05)}","function sdSnout(x,y,z){return sdCone(x,y,z,0,0.772,0.63,0,0.752,0.745,0.08,0.06)}")
r("EAR_M=M4.inv(M4.trs(EAR_C,null,[0.1,0.15,-0.4],[1,1,1]));","EAR_M=M4.inv(M4.trs(EAR_C,null,[0.35,0.15,-0.85],[1,1,1]));")
r("const H=B.head,rE=0.033;","const H=B.head,rE=0.039;")
r("const SHELLS=18,HAIR_LEN=0.056;","const SHELLS=18,HAIR_LEN=0.062;")
s=babyfy(s,dict(young='true',ch='[0,0.78,0.63]',s=1.3,legY=0.46,legK=0.64,xK=1.1,zK=0.76,r0=0.15,r1=0.36,size=0.6))
# size-appropriate camera + speeds
r("0.56+pose[RY]*.4","0.34+pose[RY]*.3");r("target:[0,0.56,0]","target:[0,0.34,0]");r("cam={th:0.62,ph:1.24,d:3.7","cam={th:0.62,ph:1.26,d:2.3");r("cam.d=Math.max(cam.d,4.4)","cam.d=Math.max(cam.d,2.8)")
r("const tgtSpd=(st.loop==='walk'?.75:st.loop==='run'?3.2:0)*(1-aw);","const tgtSpd=(st.loop==='walk'?.42:st.loop==='run'?1.8:0)*(1-aw);")
r("st.walkPh+=dt*st.speed/0.7*TAU*1.0;st.runPh+=dt*Math.max(st.speed,.5)/3.0*TAU*2.1;","st.walkPh+=dt*st.speed/0.42*TAU*1.0;st.runPh+=dt*Math.max(st.speed,.4)/1.8*TAU*2.3;")
r("<title>Low-Poly Menagerie · 06 Australian Shepherd</title>","<title>Low-Poly Menagerie · 07 Australian Shepherd Pup</title>")
r("06 / 20 · LOW-POLY MENAGERIE</span><h1>Australian Shepherd</h1>","07 / 20 · LOW-POLY MENAGERIE</span><h1>Aussie Pup</h1>")
r("Fluffing the coat…","Shrinking to puppy size…")
r("return {geo:upload(g,{si,sw,m1:pos,hair})","window.__skin={pos,si,sw};return {geo:upload(g,{si,sw,m1:pos,hair})")
r("window.__pig={","window.__pig={B,boneMats,bm(){BN.forEach((n,i)=>{const m=M4.mul(M4.id(),B[n].world,boneInv[i]);boneMats.set(m,i*16)})},")
s=add_ground(s)
open('index.html','w').write(s);print('ok')
