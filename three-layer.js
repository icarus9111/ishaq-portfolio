/* three-layer.js: drop-in 3D layer for icarus9111.github.io/ishaq-portfolio
   Adds: (1) a neural-network scene behind the page (input -> model -> system),
         (2) 3D tilt on the portrait and project cards.
   It reads colors from your own CSS, so your color scheme is untouched.
   Add before </body>:  <script src="three-layer.js" defer></script>  */
(function () {
  'use strict';
  var CFG = {
    accentVars: ['--accent', '--primary', '--brand', '--color-accent', '--accent-color'],
    accentEl: 'h1 em, h1 i, h1 .accent',       // where the accent color is sampled
    tilt: 'img[alt*="Portrait"], [class*="card"]', // elements that get 3D tilt
    opacity: 0.55,                              // lower = quieter background
    three: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
  };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function css(el, p) { return getComputedStyle(el).getPropertyValue(p).trim(); }
  function opaque(c) { return c && !/rgba?\([^)]*,\s*0\)$/.test(c) && c !== 'transparent'; }
  function palette() {
    var root = document.documentElement, accent = '', i;
    for (i = 0; i < CFG.accentVars.length && !accent; i++) accent = css(root, CFG.accentVars[i]);
    if (!accent) { var e = document.querySelector(CFG.accentEl); if (e) accent = css(e, 'color') || getComputedStyle(e).color; }
    if (!opaque(accent)) { var a = document.querySelector('a[href="#projects"], a'); accent = a ? getComputedStyle(a).color : '#888'; }
    var text = getComputedStyle(document.body).color;
    return { accent: accent, text: text };
  }

  function boot() {
    var THREE = window.THREE; if (!THREE) return;
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none';
    document.body.appendChild(canvas);
    var R;
    try { R = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true }); }
    catch (e) { canvas.remove(); return; }
    var small = innerWidth < 800;
    R.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
    var scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, .1, 100);
    cam.position.z = 12;
    var world = new THREE.Group(); scene.add(world);

    // nodes in three columns: input, model, system
    var cols = small ? [4, 6, 4] : [6, 9, 6], xs = [-5, 0, 5], nodes = [], layers = [];
    cols.forEach(function (n, c) {
      var L = [];
      for (var i = 0; i < n; i++) {
        var p = new THREE.Vector3(xs[c] + (Math.random() - .5) * 1.2, (i / (n - 1) - .5) * 6 + (Math.random() - .5) * .8, (Math.random() - .5) * 3);
        L.push(p); nodes.push(p);
      }
      layers.push(L);
    });
    var edges = [];
    for (var l = 0; l < 2; l++) layers[l].forEach(function (a) { layers[l + 1].forEach(function (b) { edges.push([a, b]); }); });

    var np = new Float32Array(nodes.length * 3);
    nodes.forEach(function (p, i) { np.set([p.x, p.y, p.z], i * 3); });
    var nGeo = new THREE.BufferGeometry(); nGeo.setAttribute('position', new THREE.BufferAttribute(np, 3));
    var nMat = new THREE.PointsMaterial({ size: .22, transparent: true, opacity: CFG.opacity + .3, depthWrite: false });
    world.add(new THREE.Points(nGeo, nMat));

    var lp = new Float32Array(edges.length * 6);
    edges.forEach(function (e, i) { lp.set([e[0].x, e[0].y, e[0].z, e[1].x, e[1].y, e[1].z], i * 6); });
    var lGeo = new THREE.BufferGeometry(); lGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    var lMat = new THREE.LineBasicMaterial({ transparent: true, opacity: CFG.opacity * .35, depthWrite: false });
    world.add(new THREE.LineSegments(lGeo, lMat));

    // signal pulses travelling along edges
    var pulses = [], PN = small ? 12 : 26, pp = new Float32Array(PN * 3);
    for (var k = 0; k < PN; k++) pulses.push({ e: edges[(Math.random() * edges.length) | 0], t: Math.random(), s: .004 + Math.random() * .006 });
    var pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    var pMat = new THREE.PointsMaterial({ size: .38, transparent: true, opacity: .95, depthWrite: false });
    world.add(new THREE.Points(pGeo, pMat));

    function recolor() {
      var P = palette(), a = new THREE.Color(P.accent), t = new THREE.Color(P.text);
      nMat.color.copy(a); pMat.color.copy(a); lMat.color.copy(a).lerp(t, .45);
    }
    recolor();
    // re-read colors when the theme toggle changes attributes/classes
    new MutationObserver(function () { setTimeout(recolor, 60); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    new MutationObserver(function () { setTimeout(recolor, 60); })
      .observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    function size() { R.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
    addEventListener('resize', size); size();
    var tx = 0, ty = 0, mx = 0, my = 0, sy = 0;
    addEventListener('pointermove', function (e) { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; });
    addEventListener('scroll', function () { sy = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight); }, { passive: true });

    var t0 = performance.now(), run = true;
    document.addEventListener('visibilitychange', function () { run = !document.hidden; if (run) frame(); });
    function frame() {
      if (!run) return;
      var t = (performance.now() - t0) / 1000;
      mx += (tx - mx) * .05; my += (ty - my) * .05;
      world.rotation.y = mx * .35 + sy * Math.PI * 1.1 + Math.sin(t * .2) * .08;
      world.rotation.x = my * .2 + sy * .5;
      world.position.y = sy * 2.5 + Math.sin(t * .5) * .12;
      if (!reduce) pulses.forEach(function (p, i) {
        p.t += p.s; if (p.t >= 1) { p.t = 0; p.e = edges[(Math.random() * edges.length) | 0]; }
        var a = p.e[0], b = p.e[1];
        pp[i * 3] = a.x + (b.x - a.x) * p.t; pp[i * 3 + 1] = a.y + (b.y - a.y) * p.t; pp[i * 3 + 2] = a.z + (b.z - a.z) * p.t;
      });
      pGeo.attributes.position.needsUpdate = true;
      R.render(scene, cam);
      if (!reduce) requestAnimationFrame(frame);
    }
    frame();
  }

  // 3D tilt using the independent `rotate` property, so it never clashes with your own transforms
  function tilt() {
    if (reduce || matchMedia('(hover: none)').matches) return;
    document.querySelectorAll(CFG.tilt).forEach(function (el) {
      if (el.__t) return; el.__t = 1;
      el.parentElement.style.perspective = '900px';
      el.style.transition = (el.style.transition ? el.style.transition + ',' : '') + 'rotate .25s ease-out';
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.rotate = (-y).toFixed(3) + ' ' + x.toFixed(3) + ' 0 ' + (Math.hypot(x, y) * 16).toFixed(1) + 'deg';
      });
      el.addEventListener('pointerleave', function () { el.style.rotate = 'none'; });
    });
  }

  function start() {
    tilt(); setTimeout(tilt, 1500); // second pass catches cards rendered by JS
    if (window.THREE) return boot();
    var s = document.createElement('script'); s.src = CFG.three; s.onload = boot; document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
