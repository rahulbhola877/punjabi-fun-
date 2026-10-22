import sys, json
from playwright.sync_api import sync_playwright
archs = sys.argv[1].split(',') if len(sys.argv)>1 else ['male']
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'])
    pg = b.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:5173/preview.html'); pg.wait_for_function('window.ready===true')
    for a in archs:
        raw = pg.evaluate(f"window.audit('{a}', false)")
        g = pg.evaluate(f"window.audit('{a}', true)")
        print(f"== {a}   (pen cm raw->guarded | flex min..max rad raw | wrist rad raw->g)")
        for k in raw:
            r, q = raw[k], g[k]
            flag = '  <<' if (r['pen']>0.3 or r['fMin']<-0.05 or r['fMax']>2.6 or r['wrist']>1.2 or q['pen']>0.3) else ''
            print(f"{k:13s} pen {r['pen']:5.1f}->{q['pen']:4.1f} | flex {r['fMin']:5.2f}..{r['fMax']:4.2f} | wr {r['wrist']:4.2f}->{q['wrist']:4.2f}{flag}")
    print(errs[:3]); b.close()
