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

// Subtle nav background intensification on scroll
const nav = document.querySelector('.nav');
if (nav) {
  const updateNav = () => {
    if (window.scrollY > 50) {
      nav.style.background = 'rgba(6, 24, 18, 0.85)';
    } else {
      nav.style.background = 'rgba(6, 24, 18, 0.6)';
    }
  };
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();
}

// Scroll-spy: highlight active section in nav (with aria-current for a11y)
const navLinks = [...document.querySelectorAll('.nav__links a')];
const sections = [...document.querySelectorAll('main section[id]')];
if (navLinks.length && sections.length && 'IntersectionObserver' in window) {
  const linkMap = new Map();
  navLinks.forEach((link) => {
    const id = link.getAttribute('href')?.replace('#', '');
    if (id) linkMap.set(id, link);
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

// Scroll progress bar
const progressEl = document.querySelector('.scroll-progress');
if (progressEl) {
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    progressEl.style.width = pct + '%';
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();
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
      answer: 'Arjun works on a fixed-income trading desk at Wells Fargo. He built a bond recommendation engine from the ground up: XGBoost learning-to-rank scoring about 4 million client-offering pairs daily, a KNN similar-bond search, and SHAP explainability surfaced through an LLM agent. It beat the single-model baseline by 58% on Recall@3 in offline evaluation and is piloting with the desk, projected to save millions in sales commissions. He also builds the desk’s P&L microservices: a replay-safe historical rerun REST API over Kafka and MongoDB, and a performance rework that cut end-to-end p95 latency by 66%.',
    },
    wimmg: {
      intent: 'project deep-dive',
      chunks: ['github › where-is-my-money-going › README', 'wimmg › pipeline › validator', 'wimmg › docs › DECISIONS'],
      answer: '"Where Is My Money Going?" is a LangGraph pipeline that runs entirely on a laptop, because the constraint came first: no financial data leaves the machine. Deterministic Python parsers turn Indian bank and credit-card statements into one record type, so the model never produces a number. A local Gemma 4 model then categorises each row under a JSON Schema, one agent finds the people in the ledger from two-way UPI flow, and a validator agent re-checks every tag the first pass was unsure about. Failed model calls return nothing rather than a plausible-looking default, which is the bug he talks about in the write-up. 158 backend and 10 frontend tests, ruff, mypy, ESLint and tsc green in CI.',
    },
    genai: {
      intent: 'skills · genai',
      chunks: ['experience › nl-mongo-agents', 'skills › ai-agentic', 'projects › local-llm'],
      answer: 'At work: LangGraph orchestrator and validator agents that turn plain questions into safe MongoDB queries, running hybrid BM25-plus-vector RAG over schema stores with tool access via MCP, behind guardrails that mask PII and block unsafe queries. That design took Top Innovator at Wells Fargo’s Innovation Pitch Day (top 4 of 600+) and became the basis of a live internal query assistant. He also owns the KNN-plus-SHAP LLM agent inside the bond engine now piloting with the desk. On the side: "Where Is My Money Going?", a fully local agentic pipeline with schema-constrained structured output, and a GPU dictation assistant.',
    },
    perf: {
      intent: 'impact · latency',
      chunks: ['pnl › p95-investigation', 'mongo › read-path-710-230', 'backup › batched-writes'],
      answer: 'Two he’d point at. He led a benchmarking investigation into slow P&L calculations and reworked request throttling and load distribution, cutting end-to-end p95 latency by 66%. Earlier, he rebuilt the real-time P&L read path on MongoDB with aggregation pipelines and compound indexes. P95 reads dropped from ~710ms to ~230ms with no loss of accuracy. Honorable mention: batched writes that raised end-of-day backup throughput by roughly 90%.',
    },
    pitch: {
      intent: 'the pitch',
      chunks: ['awards › top-achievers-2025', 'publication › supercomputing-2023', 'projects › finished-side-builds'],
      answer: 'He builds GenAI inside a regulated bank: agents, hybrid RAG, and guardrails that had to pass real risk review, not just demos. His ground-up recommendation engine scores about 4 million client-offering pairs daily and beat its baseline by 58% on Recall@3, all on top of years of high-throughput backend work in fixed-income trading. Wells Fargo put him in roughly the top 1% of employees (Top Achievers, 2025), he’s published in Springer’s Journal of Supercomputing, and he finishes what he starts on the side too. Also: the pipeline you just ran is how he thinks by default.',
    },
  };

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
    const CHUNK = 2;
    for (let i = 0; i < text.length; i += CHUNK) {
      if (token !== runToken) return;
      textSpan.textContent = text.slice(0, i + CHUNK);
      await new Promise((r) => setTimeout(r, 16));
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
    if (!await wait(reducedMotion ? 0 : 420, token)) return;
    edges[0].classList.remove('is-flowing'); edges[0].classList.add('is-done');
    stageNodes.orchestrator.classList.add('is-active');
    setStatus('orchestrator', 'routing intent…');
    if (!await wait(reducedMotion ? 0 : 650, token)) return;
    stageNodes.orchestrator.classList.remove('is-active');
    stageNodes.orchestrator.classList.add('is-done');
    setStatus('orchestrator', 'intent: ' + data.intent);

    edges[1].classList.add('is-flowing');
    if (!await wait(reducedMotion ? 0 : 420, token)) return;
    edges[1].classList.remove('is-flowing'); edges[1].classList.add('is-done');
    stageNodes.retriever.classList.add('is-active');
    setStatus('retriever', 'searching vector stores…');
    for (let i = 0; i < data.chunks.length; i++) {
      const chunk = document.createElement('span');
      chunk.className = 'ask__chunk';
      chunk.textContent = data.chunks[i];
      chunksEl.appendChild(chunk);
      requestAnimationFrame(() => requestAnimationFrame(() => chunk.classList.add('is-in')));
      if (!await wait(reducedMotion ? 0 : 260, token)) return;
    }
    if (!await wait(reducedMotion ? 0 : 240, token)) return;
    stageNodes.retriever.classList.remove('is-active');
    stageNodes.retriever.classList.add('is-done');
    setStatus('retriever', 'top-' + data.chunks.length + ' chunks');

    edges[2].classList.add('is-flowing');
    if (!await wait(reducedMotion ? 0 : 420, token)) return;
    edges[2].classList.remove('is-flowing'); edges[2].classList.add('is-done');
    stageNodes.validator.classList.add('is-active');
    setStatus('validator', 'grounding check…');
    if (!await wait(reducedMotion ? 0 : 700, token)) return;
    stageNodes.validator.classList.remove('is-active');
    stageNodes.validator.classList.add('is-done');
    setStatus('validator', 'grounded ✓');

    edges[3].classList.add('is-flowing');
    if (!await wait(reducedMotion ? 0 : 420, token)) return;
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
