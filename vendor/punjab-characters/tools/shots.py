import sys, json, base64
from playwright.sync_api import sync_playwright
from PIL import Image
import io

def run(cfgs, out, cols=None, cell=(512,640)):
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'])
        pg = b.new_page(viewport={'width':512,'height':640})
        logs=[]
        pg.on('console', lambda m: logs.append(m.text))
        pg.on('pageerror', lambda e: logs.append('ERR '+str(e)))
        pg.add_init_script('window.__noguard = %s' % ('true' if __import__('os').environ.get('NOGUARD') else 'false')); pg.goto('http://localhost:5173/preview.html')
        try:
            pg.wait_for_function('window.ready===true', timeout=20000)
        except Exception as e:
            print('not ready', logs[-10:]); raise
        imgs=[]
        for c in cfgs:
            info = pg.evaluate('(c)=>window.shot(c)', c)
            png = pg.locator('canvas').screenshot()
            imgs.append(Image.open(io.BytesIO(png)).convert('RGB'))
            print(c.get('arch'), c.get('outfit'), c.get('clip'), info)
        for l in logs[-10:]: print('LOG', l)
        b.close()
    cols = cols or len(imgs)
    rows = (len(imgs)+cols-1)//cols
    w,h = imgs[0].size
    sheet = Image.new('RGB',(w*cols,h*rows))
    for i,im in enumerate(imgs): sheet.paste(im,((i%cols)*w,(i//cols)*h))
    import os
    sc=float(os.environ.get('SCALE','1'))
    if sc!=1: sheet=sheet.resize((int(sheet.width*sc),int(sheet.height*sc)),Image.LANCZOS)
    sheet.save(out)

if __name__=='__main__':
    cfgs = json.loads(sys.argv[1]); out = sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv)>3 else None
    run(cfgs,out,cols)
