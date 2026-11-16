'use strict';

// Sidebar: a fixed column on wide screens, a drawer below 1000px. Highlights the current section.
(() => {
  const sidebar = document.querySelector('#sidebar');
  const button = document.querySelector('.menu-button');
  const backdrop = document.querySelector('.sidebar-backdrop');
  const drawer = window.matchMedia('(max-width: 1000px)');

  function setOpen(open) {
    sidebar.classList.toggle('open', open);
    backdrop.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.querySelector('.sr-only').textContent = open ? 'Close navigation' : 'Open navigation';
    document.body.classList.toggle('drawer-open', open);
    if (open) sidebar.querySelector('a').focus({ preventScroll: true });
  }

  button.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
  backdrop.addEventListener('click', () => setOpen(false));
  sidebar.addEventListener('click', event => { if (drawer.matches && event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !sidebar.classList.contains('open')) return;
    setOpen(false);
    button.focus();
  });
  drawer.addEventListener('change', () => setOpen(false));

  // Same-page section links only; look targets up on demand.
  const links = [...sidebar.querySelectorAll('ul a')].filter(link => link.hash && link.pathname === location.pathname);
  let frame = 0;
  function updateActive() {
    frame = 0;
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    let current = null;
    for (const link of links) {
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (target && (target.getBoundingClientRect().top <= 140 || atEnd)) current = link;
    }
    for (const link of links) {
      link.classList.toggle('active', link === current);
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  const schedule = () => { frame ||= requestAnimationFrame(updateActive); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  schedule();
})();
