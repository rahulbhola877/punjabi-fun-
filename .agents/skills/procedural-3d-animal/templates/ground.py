def add_ground(s,paws="['flL','frL','blL','brL']",extra="[['hips',[0,-0.17,-0.2]]]",skip="['sleep','happy']",skipAct="['jump','roll']"):
    snippet=r'''  // ---- ground snap + paw contact shadows
  {const W=YOUNG_W();if(!G0.init){G0.init=1;G0.pts=PAWS.map(n=>[n,vsub(W(SEG[n][1]),REST[n])]).concat(EXTRA.map(([n,o])=>[n,o]));
     const gd=upload((()=>{const g=new Geo();for(const r of [1,.75,.5])g.merge(disc(r,20),M4.euler(-PI/2,0,0));return g})());
     G0.blobs=PAWS.map(()=>{const n=sceneRoot.add(new Node());return {n,it:addItem(gd,n,{color:[0,0,0],emis:[0,0,0],op:.16,trans:true,flat:0,cast:false,rough:1,spec:0,rim:0})}})}
   const grounded=!SKIPL.includes(st.loop)&&!(A&&SKIPA.includes(st.act));let mn=9;const ys=[];
   for(const [n,o] of G0.pts){const y=M4.pt(B[n].world,o)[1];mn=Math.min(mn,y);ys.push(y)}
   const want=grounded?-mn:Math.max(0,-mn);G0.d=lerp(G0.d||0,want,1-Math.exp(-dt*12));
   if(Math.abs(G0.d)>1e-5){B.root.p[1]+=G0.d/pigN.s[1];sceneRoot.update(null)}
   PAWS.forEach((n,i)=>{const p=M4.pt(B[n].world,G0.pts[i][1]);const h=Math.max(0,p[1]);const bl=G0.blobs[i];const sc=pigN.s[0]*0.09*(1+h*3);
     bl.n.p=[p[0],0.004,p[2]];bl.n.s=[sc,1,sc];bl.it.op=0.16*Math.max(0,1-h*6)})}
'''
    pre=r'''const G0={};const PAWS=%s,EXTRA=%s,SKIPL=%s,SKIPA=%s;function YOUNG_W(){return typeof warpF==='function'?warpF:(p=>p)}
'''%(paws,extra,skip,skipAct)
    assert "  // ---- effects" in s
    s=s.replace("  // ---- effects",snippet+"  // ---- effects",1)
    s=s.replace("function wrapA(a)",pre+"function wrapA(a)",1)
    if "window.__skin=" not in s:
        s=s.replace("return {geo:upload(g,{si,sw,m1:pos,hair})","window.__skin={pos,si,sw};return {geo:upload(g,{si,sw,m1:pos,hair})",1)
    if "bm(){" not in s:
        s=s.replace("window.__pig={","window.__pig={B,boneMats,bm(){BN.forEach((n,i)=>{const m=M4.mul(M4.id(),B[n].world,boneInv[i]);boneMats.set(m,i*16)})},",1)
    return s
