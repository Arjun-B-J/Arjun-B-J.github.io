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
