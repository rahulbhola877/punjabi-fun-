import base64, os, sys, json
from playwright.sync_api import sync_playwright
OUT = os.path.expanduser('~/punjab-characters/dist-models')
DEFAULTS = [('male','kurta_pajama','punjabi_man'),('female','patiala_suit','punjabi_woman'),('uncle','kurta_pajama','punjabi_uncle'),('aunty','patiala_suit','punjabi_aunty'),('boy','kurta_pajama','punjabi_boy'),('girl','patiala_suit','punjabi_girl')]
PACK = [('male','diwali_kurta'),('uncle','pandit'),('male','eid_kurta'),('uncle','imam'),('uncle','pagri_farmer'),('uncle','netaji'),('male','office_casual'),('male','church_m'),
        ('female','diwali_suit'),('aunty','saree'),('female','eid_suit'),('aunty','eid_suit'),('female','church_f'),('female','casual_f'),('boy','eid_kurta'),('girl','diwali_suit')]
os.makedirs(OUT + '/community', exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'])
    pg = b.new_page(); pg.goto('http://localhost:5173/preview.html'); pg.wait_for_function('window.ready===true')
    jobs = [(a,o,f'{OUT}/{n}.glb') for a,o,n in DEFAULTS] + [(a,o,f'{OUT}/community/{a}_{o}.glb') for a,o in PACK]
    for a,o,path in jobs:
        r = pg.evaluate(f"window.exportGLB('{a}','{o}')")
        open(path,'wb').write(base64.b64decode(r['b64']))
        print(os.path.basename(path), r['clips'], 'clips', round(os.path.getsize(path)/1e6,2), 'MB')
    b.close()
