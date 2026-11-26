import { createRenderer } from './renderer';

const home = document.getElementById('home')!;
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let renderer: ReturnType<typeof createRenderer> | undefined;
let unavailable = false;
let generation = 0;
let canvas: HTMLCanvasElement | undefined;

function ready(value: boolean) {
  home.classList.toggle('ocean-ready', value);
  home.dispatchEvent(new Event('oceanvisibilitychange'));
}
function stop() {
  generation++;
  renderer?.dispose();
  renderer = undefined;
  canvas?.remove();
  canvas = undefined;
  ready(false);
}
function fallback(error: unknown) {
  unavailable = true;
  home.dataset.oceanError = error instanceof Error ? error.message : String(error);
  home.dataset.oceanState = 'fallback';
  stop();
}
function maskText() {
  if (!canvas) return;
  const h = home.getBoundingClientRect();
  const text = home.querySelector('.hero-content')!.getBoundingClientRect();
  // Feather the particle-free area into the glass instead of cutting a black box.
  const x = text.left - h.left + 6;
  const y = text.top - h.top + 6;
  const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="${h.width}" height="${h.height}" viewBox="0 0 ${h.width} ${h.height}"><defs><filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="24"/></filter><mask id="clear" maskUnits="userSpaceOnUse" x="0" y="0" width="${h.width}" height="${h.height}"><rect width="100%" height="100%" fill="white"/><rect x="${x}" y="${y}" width="${Math.max(0,text.width-12)}" height="${Math.max(0,text.height-12)}" rx="24" fill="black" filter="url(#soft)"/></mask></defs><rect width="100%" height="100%" fill="white" mask="url(#clear)"/></svg>`;
  canvas.style.clipPath = 'none';
  canvas.style.maskImage = `url("data:image/svg+xml,${encodeURIComponent(mask)}")`;
  canvas.style.maskSize = '100% 100%';
  canvas.style.maskRepeat = 'no-repeat';
}
function sync() {
  if (preference.matches) { home.dataset.oceanState = 'reduced-motion'; stop(); return; }
  if (unavailable || !navigator.gpu) { home.dataset.oceanState = 'fallback'; ready(false); return; }
  if (home.hidden || document.hidden) { renderer?.setPaused(true); return; }
  if (renderer) { renderer.setPaused(false); maskText(); return; }
  const attempt = ++generation;
  canvas = document.createElement('canvas');
  canvas.className = 'home-ocean';
  canvas.setAttribute('aria-hidden', 'true');
  home.prepend(canvas);
  maskText();
  home.dataset.oceanState = 'loading';
  renderer = createRenderer({canvas,
    onFrame: () => {
      if (attempt !== generation) return;
      home.dataset.oceanState = 'running';
      if (!home.classList.contains('ocean-ready')) ready(true);
    },
    onError: fallback
  });
  void renderer.ready.catch(error => { if(attempt === generation) fallback(error); });
}
const resize = new ResizeObserver(maskText);
resize.observe(home);
resize.observe(home.querySelector('.hero-content')!);
home.addEventListener('scroll', maskText, {passive:true});
new MutationObserver(sync).observe(home, {attributes:true,attributeFilter:['hidden']});
preference.addEventListener('change', sync);
document.addEventListener('visibilitychange', sync);
addEventListener('pagehide', stop);
addEventListener('pageshow', sync);
sync();
