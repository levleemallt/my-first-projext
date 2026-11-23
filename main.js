/* Black Hole Productions — interactive black hole + UI motion */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;

  /* ================= WebGL black hole ================= */
  const canvas = document.getElementById('bh');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });

  const vert = `
    attribute vec2 p;
    void main(){ gl_Position = vec4(p, 0.0, 1.0); }
  `;

  const frag = `
    precision highp float;
    uniform vec2  uRes;
    uniform float uTime;
    uniform float uScale;   // event-horizon radius (fraction of min screen side)
    uniform vec2  uOffset;  // hole centre offset
    uniform float uTilt;    // disk inclination (0 = edge-on)
    uniform vec2  uMouse;   // -1..1
    uniform float uSpeed;   // scroll velocity boost

    float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
    }
    float fbm(vec2 p){
      float v = 0.0, a = 0.5;
      for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.03 + 1.7; a *= 0.5; }
      return v;
    }
    mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

    vec3 stars(vec2 p){
      vec3 col = vec3(0.0);
      for(int i=0;i<3;i++){
        float fi = float(i);
        float sc = 18.0 + fi*26.0;
        vec2 g = p*sc + fi*13.1;
        vec2 id = floor(g);
        vec2 f = fract(g) - 0.5;
        float h = hash(id);
        if(h > 0.86){
          vec2 o = vec2(hash(id+3.1), hash(id+7.7)) - 0.5;
          float d = length(f - o*0.7);
          float tw = 0.55 + 0.45*sin(uTime*(1.0+h*3.0) + h*80.0);
          vec3 tint = mix(vec3(1.0,0.82,0.65), vec3(0.7,0.8,1.0), hash(id+5.3));
          col += tint * smoothstep(0.09, 0.0, d) * tw * (0.5 + (h-0.86)*8.0) / (1.0+fi*0.6);
        }
      }
      return col;
    }

    vec3 nebula(vec2 p){
      float n = fbm(p*1.3 + vec2(uTime*0.01, 0.0));
      float m = fbm(p*2.4 - vec2(0.0, uTime*0.015) + n);
      vec3 c = mix(vec3(0.20,0.05,0.35), vec3(0.55,0.12,0.05), m);
      return c * pow(n, 3.0) * 0.55;
    }

    // accretion disk sample in disk-plane coordinates (units of rs)
    vec3 diskColor(vec2 dp, float t){
      float dr = length(dp);
      float inner = 1.6, outer = 6.5;
      if(dr < inner*0.8 || dr > outer*1.2) return vec3(0.0);
      float omega = t * 1.6 / pow(dr, 1.5);           // Keplerian-ish spin
      vec2 q = rot(omega) * dp;
      float n = fbm(q*1.6) * 0.65 + fbm(q*5.0 + 3.0)*0.45;
      float streaks = 0.6 + 0.4*sin(dr*9.0 - n*6.0);
      float prof = smoothstep(inner*0.85, inner*1.15, dr) * smoothstep(outer, inner*1.6, dr);
      float heat = pow(inner/dr, 1.6);
      // relativistic beaming: approaching side brighter
      float beam = 1.0 - 0.7 * (dp.x / max(dr, 1e-3));
      beam = max(beam, 0.15);
      vec3 hot  = vec3(1.0, 0.96, 0.88);
      vec3 warm = vec3(1.0, 0.55, 0.16);
      vec3 cool = vec3(0.55, 0.08, 0.02);
      vec3 c = mix(cool, warm, smoothstep(0.0, 0.5, heat));
      c = mix(c, hot, smoothstep(0.55, 1.0, heat));
      return c * prof * heat * n * streaks * beam * 3.2;
    }

    void main(){
      float m = min(uRes.x, uRes.y);
      vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / m;
      vec2 par = uMouse * 0.025;
      vec2 p = uv - uOffset - par;
      float rs = uScale;
      float r = length(p);
      float t = uTime * (1.0 + uSpeed);

      // ---- gravitational lensing of the background
      vec2 dir = p / max(r, 1e-4);
      float bend = rs*rs*1.5 / max(r, 1e-4);
      vec2 lp = p - dir*bend;
      vec2 bgp = lp + uOffset*0.3 + par*2.0;
      vec3 col = stars(bgp) + nebula(bgp*0.8);
      // star streaks when scrolling fast
      col += stars(bgp + dir*uSpeed*0.02) * uSpeed * 0.6;

      // ---- disk plane coordinates (tilted)
      float tilt = max(uTilt, 0.06);
      vec2 pr = rot(-0.18) * p;                       // slight roll
      vec2 dp = vec2(pr.x, pr.y / tilt) / rs;

      // ---- lensed image of the far side of the disk (arcs over/under the hole)
      float rr = r / rs;
      if(rr > 1.0){
        float ringR = 1.0 + 0.55*(1.0-tilt);
        float w = 0.22 + 0.2*tilt;
        float arc = exp(-pow((rr - ringR)/w, 2.0));
        vec2 ap = vec2(pr.x, pr.y) / rs;
        vec2 fakeDp = normalize(ap + 1e-4) * (1.7 + (rr-1.0)*2.2);
        vec3 lensed = diskColor(fakeDp, t);
        float upper = smoothstep(-0.2, 0.6, pr.y/ (r+1e-4));
        col += lensed * arc * (0.55 + 0.6*upper);
      }

      // ---- photon ring
      float pr1 = exp(-pow((rr - 1.04)/0.035, 2.0));
      float pr2 = exp(-pow((rr - 1.12)/0.10, 2.0));
      float flick = 0.8 + 0.2*fbm(dir*4.0 + t*0.5);
      col += vec3(1.0, 0.85, 0.65) * (pr1*1.6 + pr2*0.35) * flick;

      // ---- event horizon
      col *= smoothstep(0.985, 1.01, rr);

      // ---- near side of the disk (in front of the hole)
      vec3 disk = diskColor(dp, t);
      float front = step(pr.y, 0.0);
      float behindVisible = smoothstep(1.0, 1.05, rr);
      col += disk * mix(behindVisible, 1.0, front);

      // ---- glow (outside the horizon only)
      float outside = smoothstep(0.98, 1.1, rr);
      col += vec3(1.0, 0.45, 0.15) * 0.05 * rs / max(r, rs) * outside;
      col += vec3(0.5, 0.25, 1.0) * 0.015 * smoothstep(1.4, 0.0, length(uv)) * outside;

      // tonemap + vignette
      col = 1.0 - exp(-col * 1.25);
      col *= smoothstep(1.35, 0.25, length(uv*vec2(0.9, 1.1)));
      col = pow(col, vec3(0.92));
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  let uniforms = null;
  if (gl) {
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vert);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    const prog = gl.createProgram();
    if (vs && fs) {
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        uniforms = {};
        ['uRes', 'uTime', 'uScale', 'uOffset', 'uTilt', 'uMouse', 'uSpeed'].forEach(n => uniforms[n] = gl.getUniformLocation(prog, n));
      }
    }
  }

  // Resolution: cap total pixels to keep it smooth everywhere
  let quality = 1;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    const maxPx = (isTouch ? 0.7 : 1.6) * 1e6 * quality;
    const s = Math.min(dpr, Math.sqrt(maxPx / (w * h)));
    canvas.width = Math.round(w * s);
    canvas.height = Math.round(h * s);
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    measureSections();
  }

  /* ================= Scroll-driven black hole state ================= */
  const sections = [...document.querySelectorAll('[data-bh]')];
  let anchors = [];
  function measureSections() {
    const vh = window.innerHeight;
    const maxScroll = document.documentElement.scrollHeight - vh;
    anchors = sections.map((el, i) => {
      const v = el.dataset.bh.split(',').map(Number);
      let at = el.offsetTop + el.offsetHeight / 2 - vh / 2;
      if (i === 0) at = 0;
      if (i === sections.length - 1) at = maxScroll;
      return { at: Math.max(0, Math.min(at, maxScroll)), scale: v[0], x: v[1], y: v[2], tilt: v[3] };
    });
  }
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function targetState(y) {
    if (!anchors.length) return { scale: .2, x: 0, y: 0, tilt: .2 };
    if (y <= anchors[0].at) return anchors[0];
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      if (y <= b.at) {
        const t = ease((y - a.at) / Math.max(1, b.at - a.at));
        return { scale: a.scale + (b.scale - a.scale) * t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tilt: a.tilt + (b.tilt - a.tilt) * t };
      }
    }
    return anchors[anchors.length - 1];
  }

  const state = { scale: .02, x: 0, y: 0, tilt: .22 };   // starts tiny → grows in on load
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let lastScroll = window.scrollY, speed = 0, time = 0, last = performance.now();
  let frames = 0, fpsT = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, .05);
    last = now;

    const sy = window.scrollY;
    const v = Math.abs(sy - lastScroll) / Math.max(dt, 1e-3);
    lastScroll = sy;
    speed += (Math.min(v / 1500, 2.5) - speed) * .08;

    const tgt = targetState(sy);
    const portrait = window.innerWidth < window.innerHeight;
    const xMul = portrait ? .25 : 1;
    const k = 1 - Math.pow(.02, dt);
    state.scale += (tgt.scale - state.scale) * k;
    state.x += (tgt.x * xMul - state.x) * k;
    state.y += (tgt.y - state.y) * k;
    state.tilt += (tgt.tilt - state.tilt) * k;

    mouse.x += (mouse.tx - mouse.x) * .05;
    mouse.y += (mouse.ty - mouse.y) * .05;

    time += dt * (reduceMotion ? 0 : 1);

    if (uniforms) {
      gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
      gl.uniform1f(uniforms.uTime, time + 20);
      gl.uniform1f(uniforms.uScale, state.scale);
      gl.uniform2f(uniforms.uOffset, state.x, state.y);
      gl.uniform1f(uniforms.uTilt, state.tilt);
      gl.uniform2f(uniforms.uMouse, mouse.x, mouse.y);
      gl.uniform1f(uniforms.uSpeed, reduceMotion ? 0 : speed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // adaptive quality: drop resolution if slow
    frames++; fpsT += dt;
    if (fpsT > 2) {
      const fps = frames / fpsT;
      if (fps < 40 && quality > .35) { quality *= .7; resize(); }
      frames = 0; fpsT = 0;
    }

    document.documentElement.style.setProperty('--scroll', sy);
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('load', measureSections);
  window.addEventListener('pointermove', e => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
  });
  resize();
  requestAnimationFrame(frame);

  /* ================= Loader + hero letters ================= */
  document.querySelectorAll('.split').forEach(el => {
    const txt = el.textContent;
    el.textContent = '';
    [...txt].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', i + (el.classList.contains('split--outline') ? 5 : 0));
      s.textContent = c;
      el.appendChild(s);
    });
  });
  const finishLoad = () => {
    document.getElementById('loader').classList.add('is-done');
    document.body.classList.add('is-loaded');
    document.querySelectorAll('.hero .reveal').forEach((el, i) => {
      el.style.setProperty('--d', (1.1 + i * .15) + 's');
      el.classList.add('is-in');
    });
  };
  if (document.readyState === 'complete') setTimeout(finishLoad, 600);
  else window.addEventListener('load', () => setTimeout(finishLoad, 600));
  setTimeout(finishLoad, 3500); // safety net

  /* ================= Reveal on scroll ================= */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
        const num = e.target.querySelector('[data-count]');
        if (num) countUp(num);
      }
    });
  }, { threshold: .15, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.section .reveal').forEach(el => {
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    el.style.setProperty('--d', (sibs.indexOf(el) * .1) + 's');
    io.observe(el);
  });

  function countUp(el) {
    const end = +el.dataset.count, dur = 1800, t0 = performance.now();
    if (end === 0) { el.textContent = '0'; return; }
    const step = now => {
      const t = Math.min((now - t0) / dur, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - t, 4)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ================= Nav ================= */
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  document.getElementById('year').textContent = new Date().getFullYear();

  if (isTouch || reduceMotion) return;

  /* ================= Cursor ================= */
  const cursor = document.getElementById('cursor');
  let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
  window.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; });
  (function loop() {
    cx += (tx - cx) * .2; cy += (ty - cy) * .2;
    cursor.style.transform = `translate(${cx}px, ${cy}px)`;
    requestAnimationFrame(loop);
  })();
  document.querySelectorAll('a, button, [data-tilt]').forEach(el => {
    el.addEventListener('pointerenter', () => cursor.classList.add('is-hover'));
    el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover'));
  });

  /* ================= Magnetic buttons ================= */
  document.querySelectorAll('[data-magnetic]').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * .3}px, ${y * .4}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  /* ================= 3D tilt cards ================= */
  document.querySelectorAll('[data-tilt]').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', px * 100 + '%');
      el.style.setProperty('--my', py * 100 + '%');
      el.style.transform = `rotateY(${(px - .5) * 14}deg) rotateX(${(.5 - py) * 12}deg) translateZ(10px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
})();
