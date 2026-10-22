import sys
from playwright.sync_api import sync_playwright
preset = sys.argv[1] if len(sys.argv)>1 else 'mohalla'
out = sys.argv[2] if len(sys.argv)>2 else '/tmp/shots/demo.png'
wait = float(sys.argv[3]) if len(sys.argv)>3 else 6
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'])
    pg = b.new_page(viewport={'width':1280,'height':720})
    errs=[]
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:5173/'); pg.wait_for_timeout(3000)
    pg.select_option('#preset', preset)
    pg.click('#populate'); pg.wait_for_timeout(wait*1000)
    pg.keyboard.press('g'); pg.wait_for_timeout(1500)
    pg.screenshot(path=out)
    print('errors:', errs[:8])
    print('stats:', pg.inner_text('#stats')[:200])
    b.close()
