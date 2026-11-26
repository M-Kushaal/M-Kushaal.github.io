"""Browser QA for the static portfolio. Requires Python Playwright and installed Chrome."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / '.backups' / 'responsive'
OUT.mkdir(parents=True, exist_ok=True)
URL = (ROOT / 'index.html').as_uri()
SIZES = [(320,568),(360,640),(375,812),(390,844),(430,932),(480,320),
         (640,360),(768,1024),(820,1180),(932,430),(1024,768),(1025,768),
         (1280,400),(1280,720),(1366,768),(1440,900),(1920,1080),
         (2560,1440),(3440,1440)]
TABS = ['home','experience','projects','beyond','blogs','contact']
report = {'browser':'Installed Chrome, headless; emulated viewports, not physical devices',
          'layout':[],'ocean':[],'errors':[],'failures':[]}

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    page = browser.new_page(reduced_motion='reduce')
    page.on('pageerror', lambda error: report['errors'].append(str(error)))
    page.goto(URL, wait_until='networkidle')
    for width,height in SIZES:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(90)
        for tab in TABS:
            page.evaluate('(id)=>location.hash=id',tab)
            page.wait_for_function('(id)=>!document.getElementById(id).hidden',arg=tab)
            result=page.locator('#'+tab).evaluate('''e=>{
              const r=e.getBoundingClientRect();
              const selectors='h1,h2,h3,.hero-content,.btn,.tl-body,.card,.contact-card';
              const bad=[...e.querySelectorAll(selectors)].filter(a=>{
                const b=a.getBoundingClientRect();return b.left<r.left-1 || b.right>r.right+1;
              }).map(a=>a.className||a.tagName);
              return {horizontalOverflow:bad,scrollHeight:e.scrollHeight,height:e.clientHeight};
            }''')
            result.update({'viewport':[width,height],'tab':tab})
            report['layout'].append(result)
            if result['horizontalOverflow']:report['failures'].append(result)
            if tab=='home':
                # Short windows may scroll, but every action must remain reachable.
                for button in page.locator('#home .btn').all():
                    button.scroll_into_view_if_needed()
                    bounds=button.bounding_box()
                    if not bounds or bounds['y']<0 or bounds['y']+bounds['height']>height+1:
                        report['failures'].append({'viewport':[width,height],'unreachable':button.inner_text()})
                page.locator('#home').evaluate('(e)=>e.scrollTop=0')
        page.evaluate('location.hash="home"')
        page.wait_for_function('!document.querySelector("#home").hidden')
        page.locator('#home').evaluate('(e)=>e.scrollTop=0')
        if width in [320,640,768,1025,1280,1920,2560]:
            page.screenshot(path=str(OUT/f'final-{width}-{height}.png'))
        if width<=1024:
            page.locator('#navToggle').click()
            page.locator('#nav a[href="#contact"]').click()
            if page.locator('#navToggle').get_attribute('aria-expanded')!='false':
                report['failures'].append({'viewport':[width,height],'menu':'did not close'})
        print('Layout checked',width,height,flush=True)

    page.set_viewport_size({'width':1440,'height':900})
    page.evaluate('location.hash="home"')
    page.emulate_media(reduced_motion='no-preference')
    page.wait_for_function('document.querySelector("#home").dataset.oceanState==="running"',timeout=45000)
    # Resize the same live GPU renderer through both orientations and navigation breakpoints.
    for width,height in [(320,568),(640,360),(768,1024),(1025,768),(1920,1080),(3440,1440),(375,812),(1440,900)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(950)
        value=page.locator('#home').evaluate('''e=>{const c=e.querySelector('.home-ocean');return {
          state:e.dataset.oceanState,error:e.dataset.oceanError,
          canvas:c?[c.clientWidth,c.clientHeight]:null,
          softMask:c?getComputedStyle(c).maskImage.startsWith('url('):false
        }}''')
        value['viewport']=[width,height];report['ocean'].append(value)
        if value['state']!='running' or value.get('error') or value['canvas']!=[width,height] or not value['softMask']:
            report['failures'].append(value)
        page.screenshot(path=str(OUT/f'ocean-{width}-{height}.png'))
        if height<500:
            page.locator('#home .btn').last.scroll_into_view_if_needed()
            page.wait_for_timeout(100)
            top=page.locator('.home-ocean').bounding_box()['y']
            if abs(top)>2:report['failures'].append({'viewport':[width,height],'backgroundTopAfterScroll':top})
            page.locator('#home').evaluate('(e)=>e.scrollTop=0')
        print('Live ocean checked',width,height,value['state'],flush=True)

    page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(100)
    report['reducedMotionRestoresFallback']=page.locator('.home-ocean').count()==0
    if not report['reducedMotionRestoresFallback']:report['failures'].append('Reduced-motion fallback')
    fallback=browser.new_page(viewport={'width':375,'height':812})
    fallback.add_init_script('Object.defineProperty(navigator,"gpu",{value:undefined})')
    fallback.goto(URL,wait_until='domcontentloaded');fallback.wait_for_timeout(100)
    report['unsupportedGpuRestoresFallback']=fallback.locator('#home').get_attribute('data-ocean-state')=='fallback'
    if not report['unsupportedGpuRestoresFallback']:report['failures'].append('Unsupported-GPU fallback')
    browser.close()

report['limits']=['No physical-device testing','No Safari or Firefox testing','Reflow tested down to 320 CSS pixels; physical browser UI zoom not exercised']
destination=ROOT/'effects'/'fft-ocean'/'responsive-verification.json'
destination.write_text(json.dumps(report,indent=2),encoding='utf-8')
print('Report:',destination,'Failures:',len(report['failures']),'Errors:',len(report['errors']),flush=True)
assert not report['failures'] and not report['errors'],report['failures']+report['errors']
