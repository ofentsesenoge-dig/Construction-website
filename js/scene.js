/* Gabosi OCC — 3D scenes (Three.js r128, global build)
 *  1. Hero: tower crane + building rising floor by floor
 *  2. Explorer: staged, explodable building model with groundwork, structure, envelope
 */
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = THREE;
  const C = { teal: 0x2ad4b8, soft: 0x86e0cb, navy: 0x1b2a3a, crane: 0xcfe9f2, amber: 0xffb02e, grid: 0x2a4558 };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- helpers ---------- */
  function pushBox(a, cx, cy, cz, sx, sy, sz) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const p = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach((e) => {
      a.push(p[e[0]][0], p[e[0]][1], p[e[0]][2], p[e[1]][0], p[e[1]][1], p[e[1]][2]);
    });
  }
  function segs(arr, color, opacity) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(arr, 3));
    return new T.LineSegments(g, new T.LineBasicMaterial({ color: color, transparent: true, opacity: opacity }));
  }
  function fillMesh(geo, color, opacity) {
    return new T.Mesh(geo, new T.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false }));
  }
  // lattice mast along +Y (w x d cross-section, h long, n bays)
  function lattice(w, d, h, n, color, opacity) {
    const v = [], hw = w / 2, hd = d / 2, sh = h / n;
    const c = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    for (let i = 0; i <= n; i++) {
      const y = i * sh;
      for (let k = 0; k < 4; k++) { const a = c[k], b = c[(k + 1) % 4]; v.push(a[0], y, a[1], b[0], y, b[1]); }
    }
    for (let k = 0; k < 4; k++) v.push(c[k][0], 0, c[k][1], c[k][0], h, c[k][1]);
    for (let i = 0; i < n; i++) {
      const y0 = i * sh, y1 = y0 + sh;
      for (let k = 0; k < 4; k++) {
        const a = c[k], b = c[(k + 1) % 4];
        if ((i + k) % 2 === 0) v.push(a[0], y0, a[1], b[0], y1, b[1]); else v.push(b[0], y0, b[1], a[0], y1, a[1]);
      }
    }
    return segs(v, color, opacity);
  }
  function label(text, color) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const x = cv.getContext('2d');
    x.font = '600 30px Consolas, monospace'; x.fillStyle = color || '#2ad4b8'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128, 34);
    const tex = new T.CanvasTexture(cv);
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    s.scale.set(3, 0.75, 1);
    return s;
  }
  function addGround(scene, size, opacity) {
    const g = new T.GridHelper(size, size, C.teal, C.grid);
    g.material.transparent = true; g.material.opacity = opacity;
    scene.add(g);
    return g;
  }
  function dust(scene, n, spread, height) {
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * spread; p[i * 3 + 1] = Math.random() * height; p[i * 3 + 2] = (Math.random() - 0.5) * spread; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3));
    const pts = new T.Points(g, new T.PointsMaterial({ color: C.teal, size: 0.09, transparent: true, opacity: 0.7, depthWrite: false }));
    scene.add(pts);
    return pts;
  }

  /* ---------- stage runner (resize, visibility, loop) ---------- */
  function run(canvas, build) {
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); }
    catch (e) { canvas.parentNode.classList.add('no-webgl'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(40, 1, 0.1, 300);
    const api = build(scene, camera, canvas);
    let visible = true, last = performance.now(), t = 0;
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (api.resize) api.resize(w, h, camera); else camera.updateProjectionMatrix();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    resize();
    if (window.IntersectionObserver) new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(canvas);
    function loop(now) {
      requestAnimationFrame(loop);
      if (!visible || document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000) * (reduce ? 0.25 : 1);
      last = now; t += dt;
      api.update(t, dt);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
  }

  /* =====================================================
     1. HERO
     ===================================================== */
  function hero(scene, camera) {
    scene.fog = new T.Fog(0x0c1823, 32, 78);
    addGround(scene, 70, 0.4);
    [13, 19, 26].forEach((r, i) => {
      const ring = new T.Mesh(new T.RingGeometry(r, r + 0.06, 128), new T.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0.35 - i * 0.08, side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; scene.add(ring);
    });
    const motes = dust(scene, 260, 50, 24);

    /* building */
    const FL = 12, W = 6, D = 4;
    const building = new T.Group(); building.position.set(3, 0, -1); scene.add(building);
    const floors = [];
    for (let i = 0; i < FL; i++) {
      const g = new T.Group(); g.position.y = i;
      const a = [];
      pushBox(a, 0, 0.06, 0, W, 0.12, D);
      for (let x = -3; x <= 3; x += 2) for (let z = -2; z <= 2; z += 2) pushBox(a, x, 0.62, z, 0.14, 1.0, 0.14);
      pushBox(a, 0, 0.5, 0, 1.2, 1, 1.2);
      g.add(segs(a, C.teal, 0.95));
      const slab = fillMesh(new T.BoxGeometry(W, 0.12, D), C.teal, 0.28); slab.position.y = 0.06; g.add(slab);
      const glass = fillMesh(new T.BoxGeometry(W, 0.86, D), C.soft, 0.07); glass.position.y = 0.57; g.add(glass);
      g.scale.y = 0.0001; g.visible = false;
      building.add(g); floors.push(g);
    }
    // scaffold footprint + site boundary
    const sb = [];
    pushBox(sb, 0, 0.01, 0, W + 3, 0.02, D + 3);
    building.add(segs(sb, C.teal, 0.35));

    /* neighbouring blueprint volumes */
    const extra = [];
    pushBox(extra, 11, 1.5, 6, 4, 3, 3); pushBox(extra, 11, 3.25, 6, 2, 0.5, 2);
    pushBox(extra, -10, 1, 7, 5, 2, 3); pushBox(extra, 12, 0.6, -8, 6, 1.2, 3);
    scene.add(segs(extra, C.crane, 0.28));
    // dashed road
    const road = [];
    for (let x = -34; x < 34; x += 2) road.push(x, 0.02, 11, x + 1, 0.02, 11);
    scene.add(segs(road, C.amber, 0.55));
    const kerb = [];
    pushBox(kerb, 0, 0.01, 11, 70, 0.02, 4);
    scene.add(segs(kerb, C.crane, 0.2));

    /* tower crane */
    const crane = new T.Group(); crane.position.set(-4.2, 0, 1); scene.add(crane);
    const MAST = 17;
    const mast = lattice(0.9, 0.9, MAST, 17, C.crane, 0.9); crane.add(mast);
    const base = []; pushBox(base, 0, 0.2, 0, 3.4, 0.4, 3.4); crane.add(segs(base, C.crane, 0.7));
    const slew = new T.Group(); slew.position.y = MAST; crane.add(slew);
    const jib = lattice(0.7, 0.7, 17, 17, C.crane, 0.95); jib.geometry.rotateZ(-Math.PI / 2); jib.position.set(-5, 0.35, 0); slew.add(jib);
    const apex = lattice(0.7, 0.7, 3.2, 3, C.crane, 0.9); apex.position.y = 0.7; slew.add(apex);
    const pend = [0, 3.9, 0, 11.5, 0.7, 0, 0, 3.9, 0, -4.2, 0.7, 0, 0, 3.9, 0, 6, 0.7, 0];
    slew.add(segs(pend, C.crane, 0.7));
    const cw = []; pushBox(cw, -4.2, -0.2, 0, 1.6, 1.0, 1.1);
    slew.add(segs(cw, C.amber, 0.95));
    const cab = []; pushBox(cab, 0.9, 0.3, 0.9, 1.0, 1.0, 0.9);
    slew.add(segs(cab, C.crane, 0.95));
    const beacon = new T.Mesh(new T.SphereGeometry(0.16, 12, 12), new T.MeshBasicMaterial({ color: C.amber }));
    beacon.position.set(0, 4.1, 0); slew.add(beacon);
    // trolley + hoist
    const trolley = new T.Group(); slew.add(trolley);
    const tb = []; pushBox(tb, 0, 0, 0, 0.7, 0.25, 0.9); trolley.add(segs(tb, C.amber, 1));
    const rope = new T.Mesh(new T.BoxGeometry(0.04, 1, 0.04), new T.MeshBasicMaterial({ color: C.crane, transparent: true, opacity: 0.8 }));
    trolley.add(rope);
    const hook = new T.Group(); trolley.add(hook);
    const hb = []; pushBox(hb, 0, 0, 0, 0.35, 0.3, 0.35); hook.add(segs(hb, C.amber, 1));
    const lb = []; pushBox(lb, 0, -0.9, 0, 1.6, 0.55, 0.9);
    const load = segs(lb, C.amber, 1); hook.add(load);
    const loadFill = fillMesh(new T.BoxGeometry(1.6, 0.55, 0.9), C.amber, 0.35); loadFill.position.y = -0.9; hook.add(loadFill);
    const sling = [0, -0.15, 0, -0.7, -0.62, 0, 0, -0.15, 0, 0.7, -0.62, 0];
    hook.add(segs(sling, C.amber, 0.8));

    /* HUD */
    const elLevel = document.getElementById('hud-level'), elH = document.getElementById('hud-height'), elS = document.getElementById('hud-status');
    let lastLevel = -1;

    /* camera */
    let mx = 0, my = 0, sx = 0, sy = 0, aspect = 1, compact = false;
    window.addEventListener('pointermove', (e) => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; });
    const target = new T.Vector3(0, 8, 0);
    const CYCLE = FL + 4.5;

    return {
      resize: function (w, h, cam) {
        aspect = w / h;
        compact = w < 700;
        cam.fov = compact ? 50 : 40;
        cam.updateProjectionMatrix();
        if (aspect > 1.25 && !compact) cam.setViewOffset(w, h, -w * 0.17, 0, w, h); else cam.clearViewOffset();
      },
      update: function (t) {
        // building progress
        const p = (t * 0.7) % CYCLE;
        let levels = 0;
        floors.forEach((f, i) => {
          let local = clamp(p - i, 0, 1);
          if (p > FL + 2.5) local = 1 - ease(clamp((p - FL - 2.5) / 2, 0, 1)); // wind back down
          f.visible = local > 0.001;
          f.scale.y = Math.max(0.0001, ease(local));
          if (local > 0.98) levels = i + 1;
        });
        const lv = Math.min(FL, levels);
        if (lv !== lastLevel && elLevel) {
          lastLevel = lv;
          elLevel.textContent = String(lv).padStart(2, '0');
          elH.textContent = (lv * 3.2).toFixed(1) + ' m';
          elS.textContent = lv >= FL ? 'Topping out' : 'Under construction';
        }
        // crane
        slew.rotation.y = 0.55 * Math.sin(t * 0.22) + 0.45;
        const tx = 6.8 + 3.2 * Math.sin(t * 0.45);
        trolley.position.set(tx, 0.1, 0);
        const drop = 5.5 + 3.5 * (0.5 + 0.5 * Math.sin(t * 0.63 + 1.2));
        rope.scale.y = drop; rope.position.y = -drop / 2;
        hook.position.y = -drop;
        beacon.material.color.setHex(Math.sin(t * 5) > 0 ? C.amber : 0x7a4c00);
        // camera: slow orbit + parallax
        sx += (mx - sx) * 0.04; sy += (my - sy) * 0.04;
        const th = 0.75 + t * 0.045 + sx * 0.7;
        const r = compact ? 46 : 34;
        camera.position.set(Math.sin(th) * r, 11 + sy * -6 + 4, Math.cos(th) * r);
        camera.lookAt(target);
        motes.rotation.y = t * 0.01;
      }
    };
  }

  /* =====================================================
     2. EXPLORER
     ===================================================== */
  function explorer(scene, camera, canvas) {
    scene.fog = new T.Fog(0x0a141e, 26, 60);
    addGround(scene, 40, 0.35);
    const FL = 8, W = 5, D = 5, FH = 1;
    const root = new T.Group(); scene.add(root);

    const stages = [0, 1, 2, 3, 4].map(() => {
      const g = new T.Group(); g.userData = { mats: [], a: 0, t: 0 }; root.add(g); return g;
    });
    function put(stage, obj, parent) {
      (parent || stage).add(obj);
      obj.traverse((o) => { if (o.material) { o.material.transparent = true; stage.userData.mats.push([o.material, o.material.opacity]); } });
      return obj;
    }

    /* 0 — plan & design: ghost volume, site boundary, dimensions */
    const s0 = stages[0];
    let a = [];
    pushBox(a, 0, FL * FH / 2, 0, W, FL * FH, D); put(s0, segs(a, 0xffffff, 0.32));
    a = []; pushBox(a, 0, 0.01, 0, W + 7, 0.02, D + 7); put(s0, segs(a, C.teal, 0.55));
    const dl = [];
    const zD = D / 2 + 1.6;
    dl.push(-W / 2, 0.02, zD, W / 2, 0.02, zD, -W / 2, 0.02, zD - 0.3, -W / 2, 0.02, zD + 0.3, W / 2, 0.02, zD - 0.3, W / 2, 0.02, zD + 0.3);
    const xD = W / 2 + 1.6;
    dl.push(xD, 0, D / 2, xD, FL * FH, D / 2, xD - 0.3, 0, D / 2, xD + 0.3, 0, D / 2, xD - 0.3, FL * FH, D / 2, xD + 0.3, FL * FH, D / 2);
    put(s0, segs(dl, C.amber, 0.9));
    const l1 = label('16.0 m', '#ffb02e'); l1.position.set(0, 0.7, zD + 0.1); put(s0, l1);
    const l2 = label('25.6 m', '#ffb02e'); l2.position.set(xD + 1.4, FL * FH / 2, D / 2); put(s0, l2);
    const l3 = label('SITE BOUNDARY', '#2ad4b8'); l3.position.set(-W / 2 - 3, 0.3, -D / 2 - 3.2); l3.scale.set(4.4, 1.1, 1); put(s0, l3);
    // grid axes
    a = [];
    for (let i = -1; i <= 1; i++) { a.push(i * 2.4, 0.01, -D / 2 - 2.2, i * 2.4, 0.01, D / 2 + 2.2); a.push(-W / 2 - 2.2, 0.01, i * 2.4, W / 2 + 2.2, 0.01, i * 2.4); }
    put(s0, segs(a, C.teal, 0.25));

    /* 1 — groundwork */
    const s1 = stages[1];
    a = []; pushBox(a, 0, -0.2, 0, W + 0.8, 0.4, D + 0.8); put(s1, segs(a, C.teal, 0.95));
    put(s1, (() => { const m = fillMesh(new T.BoxGeometry(W + 0.8, 0.4, D + 0.8), C.teal, 0.25); m.position.y = -0.2; return m; })());
    for (let x = -2; x <= 2; x += 2) for (let z = -2; z <= 2; z += 2) {
      const cyl = new T.CylinderGeometry(0.15, 0.15, 3.4, 8);
      const e = new T.LineSegments(new T.EdgesGeometry(cyl), new T.LineBasicMaterial({ color: C.soft, transparent: true, opacity: 0.8 }));
      e.position.set(x, -2.1, z); put(s1, e);
    }
    a = []; pushBox(a, 0, -2.0, 0, W + 8, 4, D + 8); put(s1, segs(a, 0x4d6a82, 0.5));
    put(s1, (() => { const m = fillMesh(new T.BoxGeometry(W + 8, 4, D + 8), 0x1b3a52, 0.28); m.position.y = -2.0; return m; })());

    /* 2 — structure (floor-by-floor so it can explode) */
    const s2 = stages[2], structFloors = [];
    for (let i = 0; i < FL; i++) {
      const g = new T.Group(); a = [];
      pushBox(a, 0, 0.07, 0, W, 0.14, D);
      for (let x = -2; x <= 2; x += 2) for (let z = -2; z <= 2; z += 2) pushBox(a, x, 0.57, z, 0.14, 0.86, 0.14);
      put(s2, segs(a, C.teal, 0.95), g);
      const sl = fillMesh(new T.BoxGeometry(W, 0.14, D), C.teal, 0.3); sl.position.y = 0.07; put(s2, sl, g);
      g.position.y = i * FH; put(s2, g); structFloors.push(g);
    }
    /* 3 — envelope */
    const s3 = stages[3], glassFloors = [];
    for (let i = 0; i < FL; i++) {
      const g = new T.Group();
      const gl = fillMesh(new T.BoxGeometry(W + 0.04, 0.86, D + 0.04), C.soft, 0.14); gl.position.y = 0.57; put(s3, gl, g);
      const mu = []; for (let k = -2; k <= 2; k++) { mu.push(k, 0.14, D / 2 + 0.03, k, 1, D / 2 + 0.03, k, 0.14, -D / 2 - 0.03, k, 1, -D / 2 - 0.03); }
      mu.push(-W / 2 - 0.03, 0.55, -D / 2, -W / 2 - 0.03, 0.55, D / 2, W / 2 + 0.03, 0.55, -D / 2, W / 2 + 0.03, 0.55, D / 2);
      put(s3, segs(mu, 0xffffff, 0.55), g);
      g.position.y = i * FH; put(s3, g); glassFloors.push(g);
    }
    const roof = new T.Group();
    a = []; pushBox(a, 0, 0.1, 0, W + 0.3, 0.2, D + 0.3); pushBox(a, 0, 0.5, 0, 1.6, 0.8, 1.4); pushBox(a, 1.6, 0.35, -1.2, 0.8, 0.5, 0.8);
    put(s3, segs(a, C.amber, 0.95), roof);
    const rf = fillMesh(new T.BoxGeometry(W + 0.3, 0.2, D + 0.3), C.teal, 0.35); rf.position.y = 0.1; put(s3, rf, roof);
    put(s3, roof);

    /* 4 — finish & handover */
    const s4 = stages[4];
    a = []; pushBox(a, 0, 0.03, 0, W + 7, 0.06, D + 7); put(s4, segs(a, C.teal, 0.9));
    put(s4, (() => { const m = fillMesh(new T.BoxGeometry(W + 7, 0.06, D + 7), C.teal, 0.14); m.position.y = 0.03; return m; })());
    [[-5.4, -5.2], [5.4, -5.2], [-5.4, 5.2], [5.4, 5.2], [-5.4, 0], [5.4, 0]].forEach((p) => {
      const cone = new T.ConeGeometry(0.7, 1.9, 8);
      const e = new T.LineSegments(new T.EdgesGeometry(cone), new T.LineBasicMaterial({ color: C.soft, transparent: true, opacity: 0.9 }));
      e.position.set(p[0], 1.0, p[1]); put(s4, e);
    });
    const lp = new Float32Array(FL * 14 * 3); let li = 0;
    for (let f = 0; f < FL; f++) for (let k = 0; k < 14; k++) {
      lp[li++] = (Math.random() - 0.5) * (W - 0.6); lp[li++] = f * FH + 0.5; lp[li++] = (Math.random() - 0.5) * (D - 0.6);
    }
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(lp, 3));
    const lights = new T.Points(lg, new T.PointsMaterial({ color: C.amber, size: 0.16, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false }));
    put(s4, lights);
    const ok = label('HANDOVER', '#2ad4b8'); ok.position.set(0, FL * FH + 1.8, 0); put(s4, ok);

    /* state + orbit */
    let stage = 0, explode = 0, ex = 0, theta = 0.7, phi = 0.9, dragging = false, px = 0, py = 0, idle = 0;
    canvas.addEventListener('pointerdown', (e) => { dragging = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      theta -= (e.clientX - px) * 0.008; phi = clamp(phi - (e.clientY - py) * 0.006, 0.25, 1.45);
      px = e.clientX; py = e.clientY; idle = 0;
    });
    const up = () => { dragging = false; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

    window.GabosiExplorer = {
      setStage: (n) => { stage = clamp(n | 0, 0, 4); },
      setExplode: (v) => { explode = clamp(v, 0, 1); }
    };
    const R = 21, tgt = new T.Vector3(0, 3.6, 0);

    return {
      resize: function (w, h, cam) { cam.fov = w < 700 ? 54 : 40; cam.updateProjectionMatrix(); },
      update: function (t, dt) {
        stages.forEach((g, i) => {
          const goal = i <= stage ? 1 : 0;
          g.userData.a += (goal - g.userData.a) * Math.min(1, dt * 6);
          g.visible = g.userData.a > 0.01;
          if (g.visible) g.userData.mats.forEach((m) => { m[0].opacity = m[1] * g.userData.a; });
        });
        // lift stage layers in a little as they appear
        ex += (explode - ex) * Math.min(1, dt * 6);
        const k = 1 + ex * 1.1;
        structFloors.forEach((g, i) => { g.position.y = i * FH * k; });
        glassFloors.forEach((g, i) => { g.position.y = i * FH * k + ex * 0.35; });
        roof.position.y = FL * FH * k + ex * 0.8;
        ok.position.y = FL * FH * k + 2.4;
        lights.position.y = 0;
        lights.material.opacity = 0.7 + 0.3 * Math.sin(t * 2.2);
        if (!dragging) { idle += dt; theta += dt * (idle > 0.1 ? 0.18 : 0); }
        camera.position.set(Math.sin(theta) * Math.sin(phi) * R, Math.cos(phi) * R + 2, Math.cos(theta) * Math.sin(phi) * R);
        tgt.y = 3.6 + ex * 3.5;
        camera.lookAt(tgt);
      }
    };
  }

  const hc = document.getElementById('hero-canvas');
  if (hc) run(hc, hero);
  const bc = document.getElementById('bp-canvas');
  if (bc) run(bc, explorer);
})();
