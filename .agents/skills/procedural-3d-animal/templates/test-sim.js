const { chromium } = require('playwright');
(async () => {
  const shots = JSON.parse(process.argv[2]);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(process.argv[3]||520), height: +(process.argv[4]||400) } });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.route(/fonts\./, r => r.abort());
  await p.goto('file://' + __dirname + '/index.html');
  await p.waitForFunction(() => window.__tris, null, { timeout: 60000 });
  let i=0;
  for (const [act, sec, cam, face] of shots) {
    await p.evaluate(([a,s,c,f]) => { const P=window.__pig;window.__noFur=1; if (c) {Object.assign(P.cam, c); if(c.rel!==undefined) P.cam.th=P.st.head+c.rel;} if(f){P.st.manual=f;if(P.EXPR[f])Object.assign(P.st.E,P.EXPR[f]);} if (a) P.trigger(a); P.sim(s); if(c&&c.head){window.__camT=null;P.sim(0.01);const h=P.items.find(i=>i.node&&i.node.parent&&i.node.parent.parent===undefined);} if(c&&c.rel!==undefined){P.cam.th=P.st.head+c.rel;P.sim(0.02);} }, [act, sec, cam, face]);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `m_${i++}.png`, timeout: 180000 });
  }
  await b.close();
})();
