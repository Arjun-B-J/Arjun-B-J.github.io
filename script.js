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

// Scroll-spy: highlight active section in nav (with aria-current for a11y)
const navLinks = [...document.querySelectorAll('.nav__links a')];
const sections = [...document.querySelectorAll('main section[id]')];
if (navLinks.length && sections.length && 'IntersectionObserver' in window) {
  // One link can stand for several sections. Education has no bar of its own,
  // so it lights up Skills rather than leaving the previous link stale — which
  // is what the whole unlisted third of the page used to do.
  const linkMap = new Map();
  navLinks.forEach((link) => {
    const ids = (link.dataset.spy || link.getAttribute('href').replace('#', '')).trim().split(/\s+/);
    ids.forEach((id) => { if (id) linkMap.set(id, link); });
  });
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = linkMap.get(entry.target.id);
        if (!link || !entry.isIntersecting) return;
        navLinks.forEach((l) => {
          l.classList.remove('is-active');
          l.removeAttribute('aria-current');
        });
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'true');
      });
    },
    { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
  );
  sections.forEach((s) => spy.observe(s));
}

// Hero cursor-follow spotlight (skipped on touch + reduced-motion)
const heroEl = document.querySelector('.hero');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none)').matches;
if (heroEl && !reducedMotion && !isTouch) {
  heroEl.addEventListener('mousemove', (e) => {
    const r = heroEl.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    heroEl.style.setProperty('--cx', x + '%');
    heroEl.style.setProperty('--cy', y + '%');
  }, { passive: true });
}

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

// ===== Hero name decode effect =====
const scrambleEls = document.querySelectorAll('[data-scramble]');
if (scrambleEls.length && !reducedMotion) {
  const POOL = '!<>-_\\/[]{}=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  scrambleEls.forEach((el) => {
    const original = el.textContent;
    const total = Math.max(20, original.length * 3);
    // Pin the span's width so random glyph widths can't reflow the heading
    const w = el.offsetWidth;
    if (w) {
      el.style.display = 'inline-block';
      el.style.width = w + 'px';
      el.style.whiteSpace = 'nowrap';
    }
    let frame = 0;
    const tick = () => {
      frame++;
      const settled = Math.floor((frame / total) * original.length);
      if (settled >= original.length) {
        el.textContent = original;
        el.style.display = '';
        el.style.width = '';
        el.style.whiteSpace = '';
        return;
      }
      let out = '';
      for (let i = 0; i < original.length; i++) {
        const ch = original[i];
        out += (ch === ' ' || i < settled) ? ch : POOL[(Math.random() * POOL.length) | 0];
      }
      el.textContent = out;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// ===== Progressive disclosure on long experience lists =====
// Seven bullets under one role is a wall nobody reads. The strongest three stay
// up, the rest are one tap away. Purely additive: with JS off, everything shows.
// This runs before the metric count-up so collapsed numbers are not observed
// while visible and then hidden mid-animation.
const VISIBLE_BULLETS = 3;
document.querySelectorAll('.timeline__content .bullet-list').forEach((list, i) => {
  const items = [...list.children];
  // Only worth a control if it hides more than a single line.
  if (items.length <= VISIBLE_BULLETS + 1) return;

  const rest = items.slice(VISIBLE_BULLETS);
  rest.forEach((li) => { li.hidden = true; });

  if (!list.id) list.id = 'bullets-' + (i + 1);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'more-toggle';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', list.id);

  const label = document.createElement('span');
  label.textContent = 'Show ' + rest.length + ' more';
  const icon = document.createElement('span');
  icon.className = 'more-toggle__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '⌄';
  btn.append(label, icon);
  list.after(btn);

  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    rest.forEach((li) => { li.hidden = isOpen; });
    btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    label.textContent = isOpen ? 'Show ' + rest.length + ' more' : 'Show less';
    // Collapsing can leave the button above the viewport; follow it back.
    if (isOpen) btn.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
  });
});

// ===== Metric count-up on scroll into view =====
const metricEls = document.querySelectorAll('.metric');
if (metricEls.length && !reducedMotion && 'IntersectionObserver' in window) {
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const animateMetric = (el) => {
    const original = el.textContent;
    const parts = original.split(/(\d[\d,]*)/);
    if (parts.length < 2) return;
    const duration = 1100;
    let startTs = null;
    const step = (ts) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const e = easeOut(p);
      if (p >= 1) { el.textContent = original; return; }
      el.textContent = parts.map((part) => {
        if (/^\d/.test(part)) {
          return String(Math.round(parseFloat(part.replace(/,/g, '')) * e));
        }
        return part;
      }).join('');
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const mio = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateMetric(entry.target);
        mio.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });
  metricEls.forEach((el) => mio.observe(el));
}

// ===== Cursor spotlight on cards =====
if (!isTouch && !reducedMotion) {
  document.querySelectorAll('.card, .award, .skill-tier, .fact').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  });
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

// ===== Timeline line draw-in =====
const timelineEl = document.querySelector('.timeline');
if (timelineEl) {
  if ('IntersectionObserver' in window) {
    const tio = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        timelineEl.classList.add('is-drawn');
        tio.disconnect();
      }
    }, { threshold: 0.05 });
    tio.observe(timelineEl);
  } else {
    timelineEl.classList.add('is-drawn');
  }
}

// ===== Ask my portfolio (scripted agent pipeline) =====
const askSection = document.getElementById('ask');
if (askSection) {
  const ASK_DATA = {
    wf: {
      intent: 'experience',
      chunks: ['resume › experience › senior-swe', 'bond-engine › ltr-models', 'pnl › replay-reruns'],
      answer: 'I work on a fixed-income trading desk at Wells Fargo. I built its bond recommendation engine from the ground up: XGBoost learning-to-rank over about 4 million client-offering pairs a day, a KNN similar-bond search, and SHAP explanations surfaced through an LLM agent. It is piloting with the desk. I also own the desk’s P&L microservices — a replay-safe historical rerun API over Kafka and MongoDB, and a rework that cut end-to-end p95 latency by 66%.',
    },
    wimmg: {
      intent: 'project deep-dive',
      chunks: ['github › where-is-my-money-going › README', 'wimmg › pipeline › validator', 'wimmg › docs › DECISIONS'],
      answer: 'It is a LangGraph pipeline that runs entirely on my laptop, because the constraint came first: no financial data leaves the machine. Deterministic Python parsers turn statements into one record type, so the model never produces a number — a local Gemma 4 model only labels rows that code already extracted. One agent finds the people in the ledger from two-way UPI flow, a validator re-checks every uncertain tag, and failed model calls now return nothing instead of a plausible-looking default. That last one was my own bug, and it is the story I would tell in an interview.',
    },
    genai: {
      intent: 'skills · genai',
      chunks: ['experience › nl-mongo-agents', 'skills › ai-agentic', 'projects › local-llm'],
      answer: 'At work: LangGraph orchestrator and validator agents that turn plain questions into safe MongoDB queries, hybrid BM25-plus-vector RAG over schema stores, tool access via MCP, and guardrails that mask PII and block unsafe queries. It won Top Innovator at our Innovation Pitch Day (top 4 of 600+) and became a live internal assistant. I also own the KNN-plus-SHAP agent inside the bond engine. On the side: "Where Is My Money Going?", fully local, schema-constrained structured output throughout.',
    },
    perf: {
      intent: 'impact · latency',
      chunks: ['pnl › p95-investigation', 'mongo › read-path-710-230', 'backup › batched-writes'],
      answer: 'Two I would point at. I benchmarked every Spring Boot and Camel route behind slow P&L calculations, then reworked throttling and load distribution: end-to-end p95 latency down 66%. Earlier I rebuilt the real-time P&L read path on MongoDB with aggregation pipelines and compound indexes, taking p95 reads from about 710ms to 230ms with no loss of accuracy. Honorable mention: batching a backup service’s writes lifted end-of-day throughput by roughly 90%.',
    },
    pitch: {
      intent: 'the pitch',
      chunks: ['awards › top-achievers-2025', 'publication › supercomputing-2023', 'projects › finished-side-builds'],
      answer: 'I ship GenAI inside a regulated bank: agents, hybrid RAG and guardrails that had to pass real risk review, not just a demo. My recommendation engine scores about 4 million pairs daily, on top of years of high-throughput backend work on a trading desk. Wells Fargo put me in roughly the top 1% of employees in 2025, I am published in Springer’s Journal of Supercomputing, and I finish what I start on the side too. Also: the pipeline you just watched is how I think by default.',
    },
  };

  // Timings. This has to read as a pipeline without making anyone wait for it:
  // a full run now lands in under three seconds, where it used to take nearly
  // nine before the answer finished writing itself out.
  const EDGE_MS = 190;
  const THINK_MS = 300;
  const CHUNK_MS = 120;

  const chips = [...askSection.querySelectorAll('.chip')];
  const stageNodes = {};
  askSection.querySelectorAll('.pipe__node').forEach((n) => { stageNodes[n.dataset.stage] = n; });
  const edges = [...askSection.querySelectorAll('.pipe__edge')];
  const chunksEl = askSection.querySelector('.ask__chunks');
  const answerEl = document.getElementById('ask-text');
  let runToken = 0;
  let hasRun = false;

  const setStatus = (stage, text) => {
    const el = stageNodes[stage] && stageNodes[stage].querySelector('.pipe__status');
    if (el) el.textContent = text;
  };
  const wait = (ms, token) => new Promise((resolve) => setTimeout(() => resolve(token === runToken), ms));

  const resetPipeline = () => {
    edges.forEach((e) => e.classList.remove('is-flowing', 'is-done'));
    Object.keys(stageNodes).forEach((k) => {
      stageNodes[k].classList.remove('is-active', 'is-done');
      setStatus(k, k === 'query' ? 'pick a question' : 'idle');
    });
    chunksEl.innerHTML = '';
  };

  const typeAnswer = async (text, token) => {
    if (reducedMotion) { answerEl.textContent = text; return; }
    answerEl.textContent = '';
    const textSpan = document.createElement('span');
    const caret = document.createElement('span');
    caret.className = 'caret';
    answerEl.append(textSpan, caret);
    const CHUNK = 5;
    for (let i = 0; i < text.length; i += CHUNK) {
      if (token !== runToken) return;
      textSpan.textContent = text.slice(0, i + CHUNK);
      await new Promise((r) => setTimeout(r, 11));
    }
    if (token === runToken) { caret.remove(); answerEl.textContent = text; }
  };

  const runPipeline = async (key) => {
    const data = ASK_DATA[key];
    if (!data) return;
    hasRun = true;
    const token = ++runToken;
    resetPipeline();
    chips.forEach((c) => {
      c.classList.toggle('is-selected', c.dataset.q === key);
      c.setAttribute('aria-pressed', c.dataset.q === key ? 'true' : 'false');
    });
    answerEl.textContent = '…';

    stageNodes.query.classList.add('is-done');
    setStatus('query', 'received ✓');

    edges[0].classList.add('is-flowing');
    if (!await wait(reducedMotion ? 0 : EDGE_MS, token)) return;
    edges[0].classList.remove('is-flowing'); edges[0].classList.add('is-done');
    stageNodes.orchestrator.classList.add('is-active');
    setStatus('orchestrator', 'routing intent…');
    if (!await wait(reducedMotion ? 0 : THINK_MS, token)) return;
    stageNodes.orchestrator.classList.remove('is-active');
    stageNodes.orchestrator.classList.add('is-done');
    setStatus('orchestrator', 'intent: ' + data.intent);

    edges[1].classList.add('is-flowing');
    if (!await wait(reducedMotion ? 0 : EDGE_MS, token)) return;
    edges[1].classList.remove('is-flowing'); edges[1].classList.add('is-done');
    stageNodes.retriever.classList.add('is-active');
    setStatus('retriever', 'searching vector stores…');
    for (let i = 0; i < data.chunks.length; i++) {
      const chunk = document.createElement('span');
      chunk.className = 'ask__chunk';
      chunk.textContent = data.chunks[i];
      chunksEl.appendChild(chunk);
      requestAnimationFrame(() => requestAnimationFrame(() => chunk.classList.add('is-in')));
      if (!await wait(reducedMotion ? 0 : CHUNK_MS, token)) return;
    }
    if (!await wait(reducedMotion ? 0 : 110, token)) return;
    stageNodes.retriever.classList.remove('is-active');
    stageNodes.retriever.classList.add('is-done');
    setStatus('retriever', 'top-' + data.chunks.length + ' chunks');

    edges[2].classList.add('is-flowing');
    if (!await wait(reducedMotion ? 0 : EDGE_MS, token)) return;
    edges[2].classList.remove('is-flowing'); edges[2].classList.add('is-done');
    stageNodes.validator.classList.add('is-active');
    setStatus('validator', 'grounding check…');
    if (!await wait(reducedMotion ? 0 : THINK_MS, token)) return;
    stageNodes.validator.classList.remove('is-active');
    stageNodes.validator.classList.add('is-done');
    setStatus('validator', 'grounded ✓');

    edges[3].classList.add('is-flowing');
    if (!await wait(reducedMotion ? 0 : EDGE_MS, token)) return;
    edges[3].classList.remove('is-flowing'); edges[3].classList.add('is-done');
    stageNodes.answer.classList.add('is-active');
    setStatus('answer', 'writing…');
    await typeAnswer(data.answer, token);
    if (token !== runToken) return;
    stageNodes.answer.classList.remove('is-active');
    stageNodes.answer.classList.add('is-done');
    setStatus('answer', 'complete ✓');
  };

  chips.forEach((chip) => {
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => runPipeline(chip.dataset.q));
  });

  // Auto-demo once when the section scrolls into view
  if ('IntersectionObserver' in window && !reducedMotion) {
    const aio = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        aio.disconnect();
        if (!hasRun) runPipeline('wf');
      }
    }, { threshold: 0.55 });
    aio.observe(askSection.querySelector('.pipe'));
  }
}
