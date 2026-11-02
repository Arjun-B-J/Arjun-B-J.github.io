// Reveal-on-scroll via IntersectionObserver
const reveals = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -8% 0px' }
  );
  reveals.forEach((el) => io.observe(el));
} else {
  // Fallback: just show everything
  reveals.forEach((el) => el.classList.add('in-view'));
}

// Hero items reveal immediately on load (don't wait for scroll)
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.hero .reveal').forEach((el) => {
    el.classList.add('in-view');
  });
});

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ===== Navigation =====
// Sticky bar, mobile drawer, scroll-spy, progress bar and back-to-top. All the
// scroll-driven parts share one rAF-throttled handler; they used to be three
// separate scroll listeners each reading layout on every event.
const nav = document.querySelector('.nav');
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const progressEl = document.querySelector('.scroll-progress');
const toTopEl = document.querySelector('.to-top');
let navIsOpen = false;
// Hiding is a response to the *user* scrolling down, not to the page scrolling
// itself. Without the distinction, following a nav link slides the bar away the
// instant it was used, because the smooth scroll it triggers looks identical to
// a downward flick. The hold ends the moment a real input arrives — timing it
// instead was fragile, since any jank longer than the window broke the hold.
let navHold = false;
let navHoldTimer = null;
const holdNav = () => {
  navHold = true;
  clearTimeout(navHoldTimer);
  navHoldTimer = setTimeout(() => { navHold = false; }, 3000);
};
const releaseNavHold = () => {
  navHold = false;
  clearTimeout(navHoldTimer);
};
// touchstart on the link itself lands before its click, so the hold still wins.
['wheel', 'touchstart', 'keydown'].forEach((type) => {
  window.addEventListener(type, releaseNavHold, { passive: true });
});

// Publish the bar's real height: the drawer hangs off the bottom of it and
// anchor jumps have to clear it, and both go wrong if the contents ever wrap.
const syncNavHeight = () => {
  if (nav) document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');
};
syncNavHeight();
window.addEventListener('resize', syncNavHeight, { passive: true });

if (nav && navToggle && navMenu) {
  const mainEl = document.getElementById('main');

  const setNav = (open) => {
    navIsOpen = open;
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    // The drawer covers the page but does not trap focus on its own; inert
    // keeps Tab inside it instead of walking the page hidden behind it.
    if (mainEl) mainEl.inert = open;
    if (open) nav.classList.remove('is-hidden');
  };

  navToggle.addEventListener('click', () => setNav(!navIsOpen));
  // Following a link is the whole point of the drawer, so it closes behind you.
  navMenu.addEventListener('click', (e) => {
    if (!e.target.closest('a')) return;
    setNav(false);
    holdNav();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navIsOpen) {
      setNav(false);
      navToggle.focus();
    }
  });
  // Past the breakpoint the links are visible anyway — drop the scroll lock.
  window.matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
    if (e.matches && navIsOpen) setNav(false);
  });
  // Tabbing into a bar that has scrolled itself away has to bring it back — and
  // it has to stay back. Focusing something inside an off-screen fixed element
  // makes the browser scroll the document to reveal it and then scroll back,
  // and that return leg is downward, which without the hold re-hides the bar
  // the moment a keyboard user reached it.
  nav.addEventListener('focusin', () => {
    nav.classList.remove('is-hidden');
    holdNav();
  });
}

let lastScrollY = window.scrollY;
let scrollQueued = false;
const NAV_HIDE_AFTER = 420;

const onScrollFrame = () => {
  scrollQueued = false;
  const y = window.scrollY;

  if (nav) {
    nav.classList.toggle('is-scrolled', y > 24);
    const delta = y - lastScrollY;
    // A deadzone: without it, trackpad jitter and rubber-banding flip the bar
    // in and out. lastScrollY only moves once the reading passes the deadzone,
    // so slow scrolling accumulates instead of being discarded frame by frame.
    if (Math.abs(delta) > 6) {
      if (!navIsOpen && !navHold && delta > 0 && y > NAV_HIDE_AFTER) nav.classList.add('is-hidden');
      else if (delta < 0 || navHold) nav.classList.remove('is-hidden');
      lastScrollY = y;
    }
    if (y <= NAV_HIDE_AFTER) {
      nav.classList.remove('is-hidden');
      lastScrollY = y;
    }
  }

  if (progressEl) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progressEl.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
  }

  if (toTopEl) toTopEl.classList.toggle('is-visible', y > window.innerHeight * 1.2);
};

const queueScroll = () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(onScrollFrame);
};

window.addEventListener('scroll', queueScroll, { passive: true });
window.addEventListener('resize', queueScroll, { passive: true });
onScrollFrame();

const heroEl = document.querySelector('.hero');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none)').matches;

// ===== 3D agent-graph hero =====
// Hand-rolled perspective projection: particles drift in a 3D box, the cloud
// slowly rotates, nearby particles link up, and the cursor pulls the graph.
const heroNet = document.getElementById('hero-net');
if (heroNet && heroEl) {
  const nctx = heroNet.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
  const COUNT = isTouch ? 60 : 130;
  // Particles live in a roughly cubic world of half-extent R. The camera sits
  // at distance CAM > R*sqrt(2), so the projected depth (CAM + rz) is ALWAYS
  // positive — no divide-by-zero, no negative scale, no negative arc radius.
  const R = 230;
  const CAM = 560;
  const LINK = 150, LINK2 = LINK * LINK;
  let W = 0, H = 0, cx = 0, cy = 0, spreadX = 1, spreadY = 1;
  let particles = [];
  let angle = 0;
  let mouseX = -9999, mouseY = -9999;
  let rafId = null;
  let heroVisible = true;
  const proj = [];

  const spawn = () => {
    particles = [];
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: (Math.random() * 2 - 1) * R,
        y: (Math.random() * 2 - 1) * R,
        z: (Math.random() * 2 - 1) * R,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        vz: (Math.random() - 0.5) * 0.5,
        hub: Math.random() < 0.1,
      });
    }
  };

  const resize = () => {
    const prevW = W;
    W = heroEl.clientWidth || window.innerWidth;
    H = heroEl.clientHeight || window.innerHeight;
    cx = W / 2;
    cy = H / 2;
    // Scale the projected cloud to comfortably overfill the hero
    spreadX = (W * 0.58) / R;
    spreadY = (H * 0.58) / R;
    heroNet.width = W * dpr;
    heroNet.height = H * dpr;
    nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (Math.abs(W - prevW) > 80 || !particles.length) spawn();
  };

  const draw = (staticFrame) => {
    nctx.clearRect(0, 0, W, H);
    const parallax = staticFrame ? 0 : window.scrollY * 0.28;
    const sinA = Math.sin(angle), cosA = Math.cos(angle);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
      if (p.x < -R) p.x = R; else if (p.x > R) p.x = -R;
      if (p.y < -R) p.y = R; else if (p.y > R) p.y = -R;
      if (p.z < -R) p.z = R; else if (p.z > R) p.z = -R;

      const rx = p.x * cosA + p.z * sinA;
      const rz = -p.x * sinA + p.z * cosA;
      const s = CAM / (CAM + rz); // CAM > R*sqrt(2) => denominator always > 0
      proj[i] = {
        px: cx + rx * s * spreadX,
        py: cy + p.y * s * spreadY - parallax,
        s: s,
      };

      // Gentle pull toward the cursor (screen-space, mapped back to world)
      const dmx = mouseX - proj[i].px, dmy = mouseY - proj[i].py;
      if (dmx * dmx + dmy * dmy < 22500) {
        p.x += (dmx / (s * spreadX)) * 0.02;
        p.y += (dmy / (s * spreadY)) * 0.02;
      }
    }

    nctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i], pa = proj[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < LINK2) {
          const pb = proj[j];
          const alpha = (1 - Math.sqrt(d2) / LINK) * 0.32 * Math.min(pa.s, pb.s);
          nctx.strokeStyle = 'rgba(52, 211, 153, ' + Math.max(0, alpha).toFixed(3) + ')';
          nctx.beginPath();
          nctx.moveTo(pa.px, pa.py);
          nctx.lineTo(pb.px, pb.py);
          nctx.stroke();
        }
      }
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i], pr = proj[i];
      const dmx = mouseX - pr.px, dmy = mouseY - pr.py;
      const dm2 = dmx * dmx + dmy * dmy;
      if (dm2 < 19600) {
        const alpha = (1 - Math.sqrt(dm2) / 140) * 0.5;
        nctx.strokeStyle = 'rgba(34, 211, 238, ' + Math.max(0, alpha).toFixed(3) + ')';
        nctx.beginPath();
        nctx.moveTo(pr.px, pr.py);
        nctx.lineTo(mouseX, mouseY);
        nctx.stroke();
      }
      const depth = Math.max(0.15, Math.min(1, pr.s - 0.2));
      nctx.fillStyle = p.hub
        ? 'rgba(34, 211, 238, ' + (0.9 * depth).toFixed(3) + ')'
        : 'rgba(52, 211, 153, ' + (0.85 * depth).toFixed(3) + ')';
      const radius = Math.max(0.4, (p.hub ? 2.6 : 1.5) * pr.s);
      nctx.beginPath();
      nctx.arc(pr.px, pr.py, radius, 0, 6.2832);
      nctx.fill();
    }
  };

  const tick = () => {
    // Schedule the next frame FIRST so a single bad frame can never kill the loop
    rafId = requestAnimationFrame(tick);
    angle += 0.0011;
    if (angle > 6.283185) angle -= 6.283185;
    try {
      draw(false);
      heroNet.style.opacity = Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.9));
    } catch (e) { /* never let one frame stop the animation */ }
  };

  const start = () => { if (rafId === null && heroVisible && !document.hidden) tick(); };
  const stop = () => { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } };

  resize();
  window.addEventListener('resize', resize, { passive: true });

  if (reducedMotion) {
    draw(true); // one static frame — texture without motion, no scroll offset
  } else {
    if (!isTouch) {
      heroEl.addEventListener('mousemove', (e) => {
        const r = heroNet.getBoundingClientRect();
        mouseX = e.clientX - r.left;
        mouseY = e.clientY - r.top;
      }, { passive: true });
      heroEl.addEventListener('mouseleave', () => { mouseX = -9999; mouseY = -9999; }, { passive: true });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        heroVisible = entries[0].isIntersecting;
        heroVisible ? start() : stop();
      }).observe(heroEl);
    }
    document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
    start();
  }
}

// ===== Magnetic hero buttons =====
if (!isTouch && !reducedMotion) {
  document.querySelectorAll('.hero .btn').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      btn.style.translate = (dx * 0.16) + 'px ' + (dy * 0.28) + 'px';
    }, { passive: true });
    btn.addEventListener('mouseleave', () => { btn.style.translate = '0px 0px'; }, { passive: true });
  });
}

// ===== View router =====
// The page used to be one 23-screen scroll, which nobody reads to the end of.
// Each destination is now its own view and the nav switches between them.
// Everything stays in the DOM and only visibility toggles, so crawlers still
// see the whole site and Ctrl+F still finds all of it -- this is a router, not
// a content cut. The hash is the source of truth, which keeps deep links,
// bookmarks and the browser's own back button working for free.
const views = [...document.querySelectorAll('.view')];
if (views.length) {
  const viewLinks = [...document.querySelectorAll('[data-view-link]')];
  const DEFAULT_VIEW = 'home';
  const known = new Set(views.map((v) => v.dataset.view));

  const showView = (name, { scroll = true } = {}) => {
    if (!known.has(name)) name = DEFAULT_VIEW;
    views.forEach((v) => v.classList.toggle('is-active', v.dataset.view === name));
    viewLinks.forEach((a) => {
      const on = a.dataset.viewLink === name;
      a.classList.toggle('is-active', on);
      // aria-current is what actually tells a screen reader which of the six
      // destinations you are on; the colour change alone says nothing.
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = name === DEFAULT_VIEW
      ? 'Arjun Bindu Jayachandran · Senior Software Engineer'
      : name.charAt(0).toUpperCase() + name.slice(1).replace('skills', 'Skills & Awards')
        + ' · Arjun Bindu Jayachandran';
    // A switched view is a new page as far as the reader is concerned, so it
    // starts at the top. Re-running the reveal pass matters because those
    // elements were display:none when their observer first fired, so every one
    // of them measured as out-of-view and would otherwise stay invisible.
    if (scroll) window.scrollTo({ top: 0, behavior: 'auto' });
    document.querySelectorAll('.view.is-active .reveal').forEach((el) => el.classList.add('in-view'));
  };

  const fromHash = () => (location.hash || '').replace(/^#/, '') || DEFAULT_VIEW;
  showView(fromHash(), { scroll: false });
  window.addEventListener('hashchange', () => showView(fromHash()));

  // Any in-page link routes, including the hero's "See my work" button.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = a.getAttribute('href').slice(1);
    if (!known.has(target)) return;
    e.preventDefault();
    if (fromHash() === target) showView(target);
    else location.hash = target;
  });
}

// ===== Projects carousel =====
// One project at a time. The track is a native scroll-snap strip, so swiping on
// a phone works for free; the buttons, dots and arrow keys only move it.
(() => {
  const deck = document.querySelector('.deck');
  if (!deck) return;

  const track = deck.querySelector('.deck__track');
  const slides = [...deck.querySelectorAll('.slide')];
  const prevBtn = deck.querySelector('[data-deck="prev"]');
  const nextBtn = deck.querySelector('[data-deck="next"]');
  const nextLabel = deck.querySelector('.deck__next-label');
  const nextName = deck.querySelector('.deck__next-name');
  const dotsEl = deck.querySelector('.deck__dots');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const titles = slides.map((s) => s.querySelector('.slide__title').textContent.trim());
  let current = 0;

  const dots = titles.map((title, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'deck__dot';
    dot.setAttribute('aria-label', 'Project ' + (i + 1) + ': ' + title);
    dot.addEventListener('click', () => go(i));
    dotsEl.append(dot);
    return dot;
  });

  // Where the track must sit for a slide to be centred. Transforms do not touch
  // offsetLeft, so the shrunken neighbours cannot throw this off.
  const leftOf = (slide) => slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;

  // The buttons answer at once rather than waiting for the scroll to land, so
  // two quick clicks move two projects. While the track glides, sync stands down:
  // it would otherwise read the slide being left as the nearest one.
  let gliding = null;
  const go = (i) => {
    current = i;
    paint();
    clearTimeout(gliding);
    gliding = setTimeout(landed, 1500);
    track.scrollTo({ left: leftOf(slides[i]), behavior: reduced ? 'auto' : 'smooth' });
  };

  // scrollend is the real signal; the timer covers browsers without it and the
  // case where the track was already in place, which fires nothing at all.
  const landed = () => {
    clearTimeout(gliding);
    gliding = null;
    sync();
  };
  track.addEventListener('scrollend', landed);

  const paint = () => {
    slides.forEach((slide, i) => {
      const on = i === current;
      slide.classList.toggle('is-current', on);
      slide.setAttribute('aria-hidden', on ? 'false' : 'true');
      // The neighbours peek in, but only the centred card is a tab stop.
      const link = slide.querySelector('.slide__title a');
      if (link) link.tabIndex = on ? 0 : -1;
    });
    dots.forEach((dot, i) => {
      if (i === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    prevBtn.disabled = current === 0;
    const last = current === slides.length - 1;
    nextLabel.textContent = last ? 'Back to start' : 'Next';
    nextName.textContent = last ? '' : ': ' + titles[current + 1];
    nextBtn.setAttribute('aria-label', last ? 'Back to first project' : 'Next project: ' + titles[current + 1]);
  };

  const sync = () => {
    if (gliding) return;
    const left = track.scrollLeft;
    let nearest = 0;
    let best = Infinity;
    slides.forEach((slide, i) => {
      const gap = Math.abs(leftOf(slide) - left);
      if (gap < best) { best = gap; nearest = i; }
    });
    if (nearest !== current) {
      current = nearest;
      paint();
    }
  };

  let queued = false;
  track.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  }, { passive: true });

  // The view is display:none until opened, so nothing can be measured before
  // then. This also keeps the card centred across a resize.
  new ResizeObserver(() => {
    if (!track.clientWidth) return;
    track.scrollTo({ left: leftOf(slides[current]), behavior: 'auto' });
  }).observe(track);

  prevBtn.addEventListener('click', () => go(Math.max(0, current - 1)));
  nextBtn.addEventListener('click', () => go(current === slides.length - 1 ? 0 : current + 1));

  // A card peeking in from the side moves into place first. Only the centred
  // one opens GitHub.
  track.addEventListener('click', (e) => {
    const slide = e.target.closest('.slide');
    if (!slide) return;
    const i = slides.indexOf(slide);
    if (i === current) return;
    e.preventDefault();
    go(i);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (!deck.closest('.view').classList.contains('is-active')) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' && current < slides.length - 1) go(current + 1);
    if (e.key === 'ArrowLeft' && current > 0) go(current - 1);
  });

  paint();
})();

// "Back to top" used an in-page #top link, which the view router read as an
// unknown view and sent the reader Home. Scroll instead.
document.querySelector('.to-top')?.addEventListener('click', (e) => {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
