const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:480,height:360}});
p.on('pageerror',e=>console.log('pe:',e.message));p.on('console',m=>{const t=m.text();if(!/THREE.FBXLoader/.test(t)||m.type()==='error')console.log('c:',t.slice(0,240))});
for(const q of JSON.parse(process.argv[2])){await p.goto('http://127.0.0.1:8765/test.html?'+q);await p.waitForFunction(()=>window.__info,null,{timeout:120000});console.log(q,JSON.stringify(await p.evaluate(()=>window.__info)));await p.screenshot({path:'v_'+q.replace(/[^a-z0-9]/gi,'_')+'.png'})}
await b.close()})();
