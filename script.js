const header = document.getElementById("siteHeader");
const nav = document.getElementById("nav");
const toggle = document.getElementById("navToggle");
const links = [...nav.querySelectorAll("a")];
const pages = [...document.querySelectorAll(".page")];
const order = pages.map((p) => p.id);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const DURATION = 550;
const EASING = "cubic-bezier(0.65, 0, 0.35, 1)";

let current = null;
let running = [];

/* ---------- Mobile menu ---------- */
function setMenu(open) {
  nav.classList.toggle("open", open);
  toggle.classList.toggle("open", open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  document.body.classList.toggle("menu-open", open);
}
toggle.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && nav.classList.contains("open")) {
    setMenu(false);
    toggle.focus();
  }
});

/* ---------- Page switching ---------- */
function setActiveLink(id) {
  links.forEach((a) => {
    const on = a.getAttribute("href") === `#${id}`;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  header.classList.toggle("scrolled", id !== "home");
  document.body.dataset.page = id;
}

// Skipping pages slides through every page in between, like a filmstrip.
// Each extra page adds a little time so you can see it pass, up to a cap.
const PER_EXTRA_PAGE = 170;
const MAX_DURATION = 1250;
let generation = 0;

function show(id, { animate = true } = {}) {
  if (!order.includes(id)) id = "home";
  if (id === current) return;

  // Finish any slide still in progress so rapid clicks stay snappy
  running.forEach((a) => a.finish());
  running = [];
  const gen = ++generation;

  const from = current;
  const next = document.getElementById(id);
  const prev = from && document.getElementById(from);
  setActiveLink(id);
  current = id;

  const slide = prev && animate && !reduceMotion.matches;
  const a = order.indexOf(from);
  const b = order.indexOf(id);
  const dir = b > a ? 1 : -1;
  const steps = Math.abs(b - a);

  // The filmstrip: from-page, every page in between, to-page
  const strip = slide
    ? Array.from({ length: steps + 1 }, (_, k) => document.getElementById(order[a + dir * k]))
    : [next];

  // Only pages on the strip are visible
  pages.forEach((p) => (p.hidden = !strip.includes(p)));
  strip.forEach((p) => { if (p !== prev) p.scrollTop = 0; });

  if (slide) {
    const duration = Math.min(DURATION + (steps - 1) * PER_EXTRA_PAGE, MAX_DURATION);
    strip.forEach((page, k) => {
      const anim = page.animate(
        [
          { transform: `translateX(${dir * k * 100}%)` },
          { transform: `translateX(${dir * (k - steps) * 100}%)` },
        ],
        { duration, easing: EASING }
      );
      running.push(anim);
      if (page !== next) {
        anim.onfinish = () => { if (gen === generation) page.hidden = true; };
      }
    });
  }

  next.focus({ preventScroll: true });
}

// Nav, logo and any in-page link to a page id
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute("href").slice(1);

  if (a.classList.contains("skip-link")) {
    e.preventDefault();
    document.getElementById(current).focus();
    return;
  }
  if (!order.includes(id)) return;

  e.preventDefault();
  setMenu(false);
  if (id !== current) {
    history.pushState(null, "", `#${id}`);
    show(id);
  }
});

// Browser back / forward
window.addEventListener("popstate", () => show(location.hash.slice(1) || "home"));

/* ---------- Card links (projects & blogs) ---------- */
// A card with data-link="…" gets its title turned into a link with a chain icon.
const LINK_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
  '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

document.querySelectorAll("#projects .card[data-link], #blogs .card[data-link]").forEach((card) => {
  const h3 = card.querySelector("h3");
  const url = card.dataset.link;
  if (!h3 || !url) return;
  const a = document.createElement("a");
  a.className = "card-link";
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.title = "Opens in a new tab";
  while (h3.firstChild) a.appendChild(h3.firstChild);
  const icon = document.createElement("span");
  icon.className = "card-link-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = LINK_ICON;
  a.appendChild(icon);
  h3.appendChild(a);
  card.classList.add("has-link");
});

// Initial page (supports deep links like /#projects)
pages.forEach((p) => (p.hidden = true));
show(location.hash.slice(1) || "home", { animate: false });

/* Dots react only inside a small neighborhood of the pointer. */
const homeAtmosphere = document.getElementById("home");
const dotsCanvas = document.createElement("canvas");
dotsCanvas.className = "home-dots";
dotsCanvas.setAttribute("aria-hidden", "true");
const dotsContext = dotsCanvas.getContext("2d");
if (dotsContext) {
  homeAtmosphere.prepend(dotsCanvas);
  homeAtmosphere.classList.add("has-dot-canvas");
  const pointer = { x: -1000, y: -1000 };
  const finePointer = window.matchMedia("(pointer: fine)");
  let points = [], frame = 0, width = 0, height = 0;
  let textBarrier = null;
  function renderDots() {
    frame = 0;
    if (homeAtmosphere.hidden || document.hidden) return;
    dotsContext.clearRect(0, 0, width, height);
    dotsContext.fillStyle = "#dce4d9";
    let settling = false;
    for (const dot of points) {
      const dx = dot.x - pointer.x, dy = dot.y - pointer.y;
      const distance = Math.hypot(dx, dy);
      const influence = !reduceMotion.matches && distance < 135 ? Math.pow(1 - distance / 135, 2) * 14 : 0;
      const targetX = distance > 0 ? -dx / distance * influence : 0;
      const targetY = distance > 0 ? -dy / distance * influence : 0;
      dot.dx += (targetX - dot.dx) * 0.16;
      dot.dy += (targetY - dot.dy) * 0.16;
      if (Math.abs(targetX - dot.dx) + Math.abs(targetY - dot.dy) > 0.015) settling = true;
      const x = dot.x + dot.dx, y = dot.y + dot.dy;
      if (textBarrier) {
        const gapX = Math.max(textBarrier.left - x, 0, x - textBarrier.right);
        const gapY = Math.max(textBarrier.top - y, 0, y - textBarrier.bottom);
        const gap = Math.hypot(gapX, gapY);
        // Keep the complete dot outside the clear zone, with a soft approach.
        if (gap <= 2) continue;
        dotsContext.globalAlpha = Math.min(1, (gap - 2) / 24);
      }
      dotsContext.beginPath();
      dotsContext.arc(x, y, 1.25, 0, Math.PI * 2);
      dotsContext.fill();
    }
    dotsContext.globalAlpha = 1;
    if (settling) frame = requestAnimationFrame(renderDots);
  }
  function scheduleDots() {
    if (!frame && !homeAtmosphere.hidden && !document.hidden) frame = requestAnimationFrame(renderDots);
  }
  function sizeDots() {
    if (!homeAtmosphere.clientWidth || !homeAtmosphere.clientHeight) return;
    width = homeAtmosphere.clientWidth;
    height = homeAtmosphere.clientHeight;
    const homeBounds = homeAtmosphere.getBoundingClientRect();
    const textBounds = homeAtmosphere.querySelector(".hero-content").getBoundingClientRect();
    textBarrier = {
      left: textBounds.left - homeBounds.left - 16,
      right: textBounds.right - homeBounds.left + 16,
      top: textBounds.top - homeBounds.top - 16,
      bottom: textBounds.bottom - homeBounds.top + 16
    };
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    dotsCanvas.width = Math.round(width * scale);
    dotsCanvas.height = Math.round(height * scale);
    dotsContext.setTransform(scale, 0, 0, scale, 0, 0);
    points = [];
    for (let y = 16; y < height; y += 32) for (let x = 16; x < width; x += 32) {
      points.push({x, y, dx: 0, dy: 0});
    }
    scheduleDots();
  }
  homeAtmosphere.addEventListener("pointermove", event => {
    if (!finePointer.matches || reduceMotion.matches || event.pointerType === "touch") return;
    const rect = homeAtmosphere.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    scheduleDots();
  }, {passive: true});
  homeAtmosphere.addEventListener("pointerleave", () => {
    pointer.x = pointer.y = -1000;
    scheduleDots();
  });
  reduceMotion.addEventListener("change", () => {
    pointer.x = pointer.y = -1000;
    points.forEach(dot => { dot.dx = dot.dy = 0; });
    scheduleDots();
  });
  const dotsResize = new ResizeObserver(sizeDots);
  dotsResize.observe(homeAtmosphere);
  dotsResize.observe(homeAtmosphere.querySelector(".hero-content"));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else scheduleDots();
  });
  window.addEventListener("pagehide", () => { cancelAnimationFrame(frame); frame = 0; });
  sizeDots();
}

/* Deform the ink's internal wisps; the image itself stays fixed in place. */
const inkFilters = document.getElementById("inkFilters");
function syncInkDiffusion() {
  if (reduceMotion.matches || document.hidden || homeAtmosphere.hidden) inkFilters.pauseAnimations();
  else inkFilters.unpauseAnimations();
}
reduceMotion.addEventListener("change", syncInkDiffusion);
document.addEventListener("visibilitychange", syncInkDiffusion);
new MutationObserver(syncInkDiffusion).observe(homeAtmosphere, {attributes: true, attributeFilter: ["hidden"]});
window.addEventListener("pagehide", () => inkFilters.pauseAnimations());
window.addEventListener("pageshow", syncInkDiffusion);
syncInkDiffusion();

/* A small displacement field stirs only the ink near the mouse. */
const inkCursorMap = document.getElementById("inkCursorMap");
const flowCanvas = document.createElement("canvas");
flowCanvas.width = 96;
flowCanvas.height = 64;
const flowContext = flowCanvas.getContext("2d");
if (flowContext) {
  const field = flowContext.createImageData(96, 64);
  let flowX = -1000, flowY = -1000, flowEnergy = 0, flowFrame = 0, flowTime = 0;
  function paintCursorFlow(time = 0) {
    flowFrame = 0;
    if (time && time - flowTime < 33 && flowEnergy > 0.01) {
      flowFrame = requestAnimationFrame(paintCursorFlow);
      return;
    }
    flowTime = time;
    const width = homeAtmosphere.clientWidth + 160;
    const height = homeAtmosphere.clientHeight + 160;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 96; x++) {
      const index = (y * 96 + x) * 4;
      const dx = (x + 0.5) / 96 * width - flowX;
      const dy = (y + 0.5) / 64 * height - flowY;
      const falloff = Math.max(0, 1 - Math.hypot(dx, dy) / 180);
      const angle = falloff * falloff * flowEnergy * 0.35;
      const shiftX = dx * Math.cos(angle) - dy * Math.sin(angle) - dx;
      const shiftY = dx * Math.sin(angle) + dy * Math.cos(angle) - dy;
      field.data[index] = Math.round(128 + shiftX / 70 * 255);
      field.data[index + 1] = Math.round(128 + shiftY / 70 * 255);
      field.data[index + 2] = 128;
      field.data[index + 3] = 255;
    }
    flowContext.putImageData(field, 0, 0);
    inkCursorMap.setAttribute("href", flowCanvas.toDataURL());
    flowEnergy *= 0.94;
    if (flowEnergy > 0.01 && !reduceMotion.matches && !document.hidden && !homeAtmosphere.hidden) {
      flowFrame = requestAnimationFrame(paintCursorFlow);
    }
  }
  homeAtmosphere.addEventListener("pointermove", event => {
    if (reduceMotion.matches || event.pointerType === "touch") return;
    const rect = homeAtmosphere.getBoundingClientRect();
    flowX = event.clientX - rect.left + 80;
    flowY = event.clientY - rect.top + 80;
    flowEnergy = 1;
    if (!flowFrame) flowFrame = requestAnimationFrame(paintCursorFlow);
  }, {passive: true});
  function stopCursorFlow() {
    cancelAnimationFrame(flowFrame);
    flowFrame = 0;
    flowEnergy = 0;
    paintCursorFlow();
  }
  reduceMotion.addEventListener("change", stopCursorFlow);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopCursorFlow(); });
  new MutationObserver(() => { if (homeAtmosphere.hidden) stopCursorFlow(); }).observe(homeAtmosphere, {attributes: true, attributeFilter: ["hidden"]});
  window.addEventListener("pagehide", stopCursorFlow);
  paintCursorFlow();
}
