/* Gabosi OCC — UI behaviour */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------- header ---------- */
  const header = $('#header');
  const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 40);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  const burger = $('#burger'), nav = $('#nav');
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
    if (open) header.classList.add('is-solid');
    else onScroll();
  });
  $$('a', nav).forEach((a) => a.addEventListener('click', () => { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }));

  // active nav link
  const links = $$('.nav a');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((l) => { const s = $(l.getAttribute('href')); if (s) spy.observe(s); });
  }

  /* ---------- reveal + counters ---------- */
  function countUp(el) {
    const end = +el.dataset.count, t0 = performance.now(), dur = 1200;
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }
  const reveals = $$('.reveal');
  reveals.forEach((el, i) => { el.style.setProperty('--d', (i % 4) * 0.08 + 's'); });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        $$('[data-count]', e.target).forEach(countUp);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
    $$('[data-count]').forEach(countUp);
  }

  /* ---------- service filters ---------- */
  const chips = $$('.chip'), cards = $$('.card');
  chips.forEach((chip) => chip.addEventListener('click', () => {
    chips.forEach((c) => c.classList.toggle('is-active', c === chip));
    const f = chip.dataset.filter;
    cards.forEach((card) => {
      const show = f === 'all' || card.dataset.cat.split(' ').indexOf(f) > -1;
      card.classList.toggle('is-hidden', !show);
      if (show) card.classList.add('in');
    });
  }));

  // 3D tilt on cards (fine pointers only)
  if (window.matchMedia('(hover: hover)').matches) {
    cards.forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(900px) rotateX(' + (-y * 5) + 'deg) rotateY(' + (x * 6) + 'deg) translateY(-4px)';
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- isometric SVG diagrams ---------- */
  const TONES = {
    teal: ['#8af0dc', '#2ad4b8', '#16967f'],
    navy: ['#4a627a', '#2b4057', '#1b2a3a'],
    light: ['#ffffff', '#dfe8ee', '#b4c4d1'],
    amber: ['#ffd27a', '#ffb02e', '#c9810a'],
    grey: ['#c3ccd4', '#9ba7b2', '#76838f']
  };
  // box: [x, y, z, w, d, h, tone]
  function iso(boxes) {
    const s = 16, c = Math.cos(Math.PI / 6), n = 0.5;
    const P = (x, y, z) => [(x - y) * c * s, (x + y) * n * s - z * s];
    const list = boxes.slice().sort((a, b) => (a[0] + a[1] + a[2] * 0.01) - (b[0] + b[1] + b[2] * 0.01) || a[2] - b[2]);
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, out = '';
    const poly = (pts, fill) => {
      pts.forEach((p) => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
      return '<polygon points="' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '" fill="' + fill + '" stroke="#0c1823" stroke-opacity=".28" stroke-width=".8" stroke-linejoin="round"/>';
    };
    list.forEach((b) => {
      const x = b[0], y = b[1], z = b[2], w = b[3], d = b[4], h = b[5], t = TONES[b[6] || 'teal'];
      out += poly([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], t[1]);
      out += poly([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], t[2]);
      out += poly([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], t[0]);
    });
    const pad = 10;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2].join(' ') + '">' + out + '</svg>';
  }
  const MODELS = {
    build: [[0, 0, 0, 5, 5, 0.5, 'grey'], [0.5, 0.5, 0.5, 2, 2, 3, 'light'], [2.5, 0.5, 0.5, 2, 2, 2, 'teal'], [0.5, 2.7, 0.5, 4, 1.8, 1.2, 'navy'], [2.5, 0.5, 2.5, 2, 2, 1.8, 'light']],
    arch: [[0, 0, 0, 5, 4, 0.3, 'light'], [0, 0, 0.3, 5, 0.3, 1.4, 'teal'], [0, 3.7, 0.3, 5, 0.3, 1.4, 'teal'], [0, 0, 0.3, 0.3, 4, 1.4, 'teal'], [4.7, 0, 0.3, 0.3, 4, 1.4, 'teal'], [2.2, 0.3, 0.3, 0.25, 2, 1.4, 'navy'], [2.2, 2.6, 0.3, 0.25, 1.1, 1.4, 'navy'], [0.5, 1.8, 0.3, 1.7, 0.25, 1.4, 'amber']],
    pm: [[0, 0, 0, 1.5, 1.5, 1, 'navy'], [1.6, 0, 0, 1.5, 1.5, 2, 'teal'], [3.2, 0, 0, 1.5, 1.5, 3, 'teal'], [4.8, 0, 0, 1.5, 1.5, 4.2, 'amber'], [0, 2.4, 0, 6.3, 0.5, 0.25, 'grey']],
    qs: [[0, 0, 0, 5.5, 4, 0.3, 'grey'], [0.4, 0.4, 0.3, 1, 1, 1.4, 'navy'], [1.8, 0.4, 0.3, 1, 1, 2.4, 'teal'], [3.2, 0.4, 0.3, 1, 1, 3.4, 'teal'], [4.5, 0.4, 0.3, 0.8, 1, 4.2, 'amber'], [0.4, 2.2, 0.3, 4.8, 1.2, 0.5, 'light']],
    pit: [[0, 0, 0, 6, 6, 0.4, 'grey'], [0, 0, 0.4, 6, 1, 0.8, 'navy'], [0, 5, 0.4, 6, 1, 0.8, 'navy'], [0, 1, 0.4, 1, 4, 0.8, 'navy'], [5, 1, 0.4, 1, 4, 0.8, 'navy'], [1, 1, 0.4, 4, 0.8, 0.4, 'teal'], [1, 4.2, 0.4, 4, 0.8, 0.4, 'teal'], [4.2, 1.8, 0.4, 0.8, 2.4, 0.4, 'teal'], [1, 1.8, 0.4, 0.8, 2.4, 0.4, 'teal'], [2.2, 2.2, 0.4, 1.6, 1.6, 0.5, 'amber']],
    supply: [[0, 0, 0, 2, 2, 1.6, 'amber'], [2.1, 0, 0, 2, 2, 1.6, 'light'], [0, 2.1, 0, 2, 2, 1.6, 'teal'], [2.1, 2.1, 0, 2, 2, 1, 'navy'], [0.3, 0.3, 1.6, 1.4, 1.4, 1.2, 'teal'], [2.4, 0.3, 1.6, 1.4, 1.4, 1, 'amber']],
    infra: [[0, 0, 0, 6, 3, 0.4, 'grey'], [0.5, 0.5, 0.4, 0.9, 0.9, 4, 'navy'], [4.6, 0.5, 0.4, 0.9, 0.9, 4, 'navy'], [0, 0.3, 4.4, 6, 1.4, 0.5, 'teal'], [0.5, 1.9, 0.4, 5, 1, 0.8, 'light'], [2.4, 0.5, 0.4, 1.2, 0.9, 1.6, 'amber']],
    mine: [[0, 0, 0, 8, 8, 0.5, 'grey'], [0, 0, 0.5, 8, 1.6, 1, 'navy'], [0, 6.4, 0.5, 8, 1.6, 1, 'navy'], [0, 1.6, 0.5, 1.6, 4.8, 1, 'navy'], [6.4, 1.6, 0.5, 1.6, 4.8, 1, 'navy'], [1.6, 1.6, 0.5, 4.8, 1.2, 0.6, 'teal'], [1.6, 5.2, 0.5, 4.8, 1.2, 0.6, 'teal'], [1.6, 2.8, 0.5, 1.2, 2.4, 0.6, 'teal'], [5.2, 2.8, 0.5, 1.2, 2.4, 0.6, 'teal'], [3, 3, 0.5, 2, 2, 0.4, 'light'], [3.3, 3.3, 0.9, 1.4, 1.4, 1.6, 'amber'], [6.2, 0.2, 1.5, 0.7, 0.7, 3.2, 'amber'], [0.4, 6.8, 1.5, 0.7, 0.7, 2.2, 'light']]
  };
  $$('[data-iso]').forEach((el) => { const m = MODELS[el.dataset.iso]; if (m) el.innerHTML = iso(m); });

  /* ---------- 3D explorer controls ---------- */
  const STAGES = [
    ['Stage 01 · Plan & design', 'Architectural planning, feasibility studies and preliminary cost estimates set a firm foundation before a single sod is turned.'],
    ['Stage 02 · Groundwork', 'Earthworks, piling and footings: civil and structural works built to specification, with quality inspections from day one.'],
    ['Stage 03 · Structure', 'The concrete and structural frame rises level by level, tracked against programme with progress monitoring and reporting.'],
    ['Stage 04 · Envelope', 'Facade, glazing and roof close the building in, while valuations and payment certification keep costs under control.'],
    ['Stage 05 · Finish & handover', 'Services, landscaping and snagging complete the works, followed by variation assessment and final accounts.']
  ];
  const stageBtns = $$('.stage'), detail = $('#stage-detail');
  function setStage(n) {
    stageBtns.forEach((b, i) => b.classList.toggle('is-active', i === n));
    detail.innerHTML = '<b>' + STAGES[n][0] + '</b><p>' + STAGES[n][1] + '</p>';
    if (window.GabosiExplorer) window.GabosiExplorer.setStage(n);
  }
  stageBtns.forEach((b, i) => b.addEventListener('click', () => { setStage(i); auto = false; }));
  $('#explode').addEventListener('input', (e) => { if (window.GabosiExplorer) window.GabosiExplorer.setExplode(e.target.value / 100); });
  setStage(0);

  // gentle autoplay through the stages until the visitor takes control
  let auto = true, cur = 0;
  const viewer = $('.viewer');
  if (viewer && 'IntersectionObserver' in window) {
    let onScreen = false;
    new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }, { threshold: 0.4 }).observe(viewer);
    setInterval(() => { if (auto && onScreen) { cur = (cur + 1) % 5; setStage(cur); } }, 2600);
    viewer.addEventListener('pointerdown', () => { auto = false; });
  }

  /* ---------- contact form (mailto) ---------- */
  const form = $('#contact-form'), note = $('#form-note');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    $$('input[required], textarea[required]', form).forEach((f) => {
      const bad = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
      f.classList.toggle('invalid', bad); if (bad) ok = false;
    });
    if (!ok) { note.textContent = 'Please complete the highlighted fields.'; return; }
    const d = new FormData(form);
    const body = 'Name: ' + d.get('name') + '\nPhone: ' + (d.get('phone') || '-') + '\nEmail: ' + d.get('email') + '\nService: ' + d.get('service') + '\n\n' + d.get('message');
    window.location.href = 'mailto:gabosiocc@gmail.com?subject=' + encodeURIComponent('Website enquiry: ' + d.get('service')) + '&body=' + encodeURIComponent(body);
    note.textContent = 'Thank you! Your email app should now open with your enquiry.';
  });

  $('#year').textContent = new Date().getFullYear();
})();
