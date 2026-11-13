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
