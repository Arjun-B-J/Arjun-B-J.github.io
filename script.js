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
      nav.style.background = 'rgba(10, 14, 26, 0.85)';
    } else {
      nav.style.background = 'rgba(10, 14, 26, 0.6)';
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
