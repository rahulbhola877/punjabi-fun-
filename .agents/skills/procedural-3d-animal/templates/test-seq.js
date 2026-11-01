// each shot in a fresh page state: reload between shots
const { chromium } = require('playwright');
(async () => {
  const shots = JSON.parse(process.argv[2]);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 520, height: 400 } });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto('file://' + __dirname + '/index.html');
  await p.waitForFunction(() => window.__tris, null, { timeout: 90000 });
  await p.evaluate(()=>{document.getElementById('panel').style.display='none';document.getElementById('top').style.display='none'});
  let i=0;
  for (const sh of shots) {
    await p.evaluate((sh) => { const P=window.__pig;window.__noFur=sh.fur?0:1;const st=P.st;
      if(sh.reset){st.act=null;st.loop='idle';for(const k in st.w)st.w[k]=k==='idle'?1:0;st.alt=0;st.pos=[0,0,0];st.speed=0}
      if(sh.face)P.st.manual=sh.face;if(sh.sp!=null)P.setSpecies(P.SPECIES[sh.sp]); if (sh.a) P.trigger(sh.a); P.sim(sh.t||0); if(sh.cam)Object.assign(P.cam,sh.cam); if(sh.rel!=null)P.cam.th=P.st.head+sh.rel; window.__camT=null;
      const tg=P.B.chest.world;P.cam.target=[tg[12],tg[13],tg[14]];window.__camT=P.cam.target;P.sim(0.02);window.__camT=null }, sh);
    await p.waitForTimeout(150);
    await p.screenshot({ path: `m_${i++}.png`, timeout: 180000 });
  }
  await b.close();
})();
