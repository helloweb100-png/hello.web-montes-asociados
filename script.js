/* ==========================================================================
   g. Montes & Asociados | Gestoría Vehicular
   JS sin dependencias obligatorias. Lenis (scroll suave) es opcional:
   si no carga, el sitio usa scroll nativo. Sin listeners de "scroll":
   todo se resuelve con IntersectionObserver, CSS scroll-driven y rAF.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- Utilidades ---------- */
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOutExpo = t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const WA_NUMBER = '523319786727';
  const waUrl = text => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
  const navH = () => parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 64;

  let lenis = null;
  let closeMenu = () => {};
  let heroVisible = true;

  /* ---------- Scroll suave (Lenis, mejora progresiva) ---------- */
  function initSmoothScroll() {
    if (reduce || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({
      duration: 1.25,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4
    });
    const raf = time => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);

    // Barra de progreso: respaldo si el navegador no soporta scroll-driven animations
    if (!(window.CSS && CSS.supports('animation-timeline: scroll()'))) {
      const bar = $('.progress');
      if (bar) lenis.on('scroll', ({ progress }) => { bar.style.transform = `scaleX(${clamp(progress, 0, 1)})`; });
    }
  }

  function scrollToTarget(el, immediate) {
    const offset = el.id === 'inicio' ? 0 : -(navH() - 1);
    if (lenis) lenis.scrollTo(el, { offset, immediate: !!immediate, duration: 1.6 });
    else el.scrollIntoView({ behavior: reduce || immediate ? 'auto' : 'smooth', block: 'start' });
  }

  function initAnchors() {
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      scrollToTarget(target);
      history.pushState(null, '', id);
    });
  }

  /* ---------- Menú móvil ---------- */
  function initMenu() {
    const burger = $('#burger');
    const menu = $('#menu');
    if (!burger || !menu) return;
    const set = open => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      root.classList.toggle('menu-open', open);
      if (lenis) { open ? lenis.stop() : lenis.start(); }
      else root.style.overflow = open ? 'hidden' : '';
    };
    closeMenu = () => { if (burger.getAttribute('aria-expanded') === 'true') set(false); };
    burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
    addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    matchMedia('(min-width: 1100px)').addEventListener('change', e => { if (e.matches) closeMenu(); });
  }

  /* ---------- Navegación: estado "stuck" y sección activa ---------- */
  function initNav() {
    const nav = $('#nav');
    const sentinel = $('#top-sentinel');
    if (nav && sentinel && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => nav.classList.toggle('is-stuck', !e.isIntersecting)).observe(sentinel);
    }
    const links = $$('.nav__links a');
    const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    if (!('IntersectionObserver' in window)) return;
    const spy = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        links.forEach(l => l.removeAttribute('aria-current'));
        const a = map.get(en.target.id);
        if (a) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['inicio', 'servicios', 'peritaje', 'tarifas', 'proceso', 'garantia', 'faq', 'contacto']
      .forEach(id => { const s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ---------- Preloader ---------- */
  function runLoader() {
    return new Promise(resolve => {
      const el = $('#loader');
      if (!el) { root.classList.remove('is-loading'); root.classList.add('is-ready'); resolve(); return; }

      const NS = 'http://www.w3.org/2000/svg';
      const N = 60;
      const ticksG = $('.ld-ticks', el);
      const ticks = [];
      for (let i = 0; i < N; i++) {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', 100); l.setAttribute('x2', 100);
        l.setAttribute('y1', i % 5 === 0 ? 7 : 12); l.setAttribute('y2', 22);
        l.setAttribute('transform', `rotate(${(i * 360) / N} 100 100)`);
        ticksG.appendChild(l); ticks.push(l);
      }
      const num = $('.ld-pct b', el);
      const status = $('.ld-status', el);
      const msgs = [[0, 'Iniciando sistema'], [24, 'Cargando identificadores'], [52, 'Sincronizando tarifas'], [80, 'Verificando documentos'], [100, 'Listo']];

      const MIN = reduce ? 450 : 2500;
      let ready = false;
      const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r, { once: true }));
      Promise.all([loaded, document.fonts ? document.fonts.ready : Promise.resolve()]).then(() => { ready = true; });

      const t0 = performance.now();
      let shown = 0, lit = 0, msgI = -1, done = false;

      const finish = () => {
        if (done) return;
        done = true;
        num.textContent = '100';
        status.textContent = 'Listo';
        setTimeout(() => {
          el.classList.add('is-done');
          root.classList.remove('is-loading');
          setTimeout(() => root.classList.add('is-ready'), reduce ? 0 : 350);
          setTimeout(() => { el.remove(); resolve(); }, reduce ? 50 : 1250);
        }, reduce ? 0 : 420);
      };

      const frame = now => {
        if (done) return;
        const t = clamp((now - t0) / MIN, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const target = ready && t >= 1 ? 100 : eased * 92;
        shown += (target - shown) * 0.12;
        if (target === 100 && shown > 99.4) shown = 100;

        const p = Math.round(shown);
        num.textContent = p;
        const on = Math.floor((p / 100) * N);
        if (on !== lit) { ticks.forEach((tk, i) => tk.classList.toggle('on', i < on)); lit = on; }
        let k = 0;
        msgs.forEach((m, i) => { if (p >= m[0]) k = i; });
        if (k !== msgI) { msgI = k; status.textContent = msgs[k][1]; }

        if (shown >= 100) { finish(); return; }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      setTimeout(finish, 9000); // salvavidas
    });
  }

  /* ---------- Títulos: reveal palabra por palabra ---------- */
  function splitWords(el) {
    el.setAttribute('aria-label', el.textContent.trim());
    let i = 0;
    const wrap = node => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          const wi = document.createElement('span'); wi.className = 'wi';
          wi.style.setProperty('--i', i++); wi.textContent = part;
          w.appendChild(wi); frag.appendChild(w);
        });
        node.replaceWith(frag);
      } else if (node.nodeType === 1) {
        Array.from(node.childNodes).forEach(wrap);
      }
    };
    Array.from(el.childNodes).forEach(wrap);
  }

  function initReveal() {
    const els = $$('[data-reveal], [data-split]');
    if (!('IntersectionObserver' in window) || reduce) { els.forEach(e => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries, o) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        o.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
  }

  /* ---------- Contadores ---------- */
  function initCounters() {
    $$('[data-count]').forEach(el => {
      const to = Number(el.dataset.count);
      const pre = el.dataset.prefix || '';
      const suf = el.dataset.suffix || '';
      const fmt = v => pre + Math.round(v).toLocaleString('es-MX') + suf;
      if (reduce || !('IntersectionObserver' in window)) { el.textContent = fmt(to); return; }
      const io = new IntersectionObserver(([en], o) => {
        if (!en.isIntersecting) return;
        o.disconnect();
        const t0 = performance.now(), D = 1900;
        const step = n => {
          const k = clamp((n - t0) / D, 0, 1);
          el.textContent = fmt(to * easeOutExpo(k));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, { threshold: 0.6 });
      io.observe(el);
    });
  }

  /* ---------- Efecto de descifrado (VIN / lecturas) ---------- */
  const CH = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  function scramble(el, text) {
    cancelAnimationFrame(el._raf);
    if (reduce) { el.textContent = text; return; }
    const D = 750, t0 = performance.now();
    const step = now => {
      const k = clamp((now - t0) / D, 0, 1);
      const n = Math.floor(k * text.length);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        out += i < n || c === ' ' || c === '-' ? c : CH[(Math.random() * CH.length) | 0];
      }
      el.textContent = out;
      if (k < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  }

  /* ---------- Hero: palabra rotativa, placa, lectura ---------- */
  function flipPlate(plate, textEl, text) {
    plate.classList.remove('is-flip'); void plate.offsetWidth; plate.classList.add('is-flip');
    setTimeout(() => { textEl.textContent = text; }, 300);
    setTimeout(() => plate.classList.remove('is-flip'), 780);
  }

  function initHero() {
    const hero = $('.hero');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }, { threshold: 0.05 }).observe(hero);
    }
    if (reduce) return;

    // Palabra rotativa
    const box = $('[data-rot]');
    if (box) {
      const words = $$('.rot__w', box);
      let i = 0;
      setInterval(() => {
        if (document.hidden || !heroVisible) return;
        const cur = words[i];
        i = (i + 1) % words.length;
        const next = words[i];
        cur.classList.remove('is-on'); cur.classList.add('is-out');
        next.classList.remove('is-out');
        requestAnimationFrame(() => next.classList.add('is-on'));
        setTimeout(() => cur.classList.remove('is-out'), 950);
      }, 2800);
    }

    // Placa: recorre los estados atendidos
    const plate = $('[data-plate]');
    if (plate) {
      const st = $('[data-plate-state]', plate);
      const states = ['Michoacán', 'Chiapas', 'Oaxaca', 'Guerrero', 'Edomex', 'Morelos', 'Veracruz', 'Jalisco'];
      let i = 0;
      setInterval(() => {
        if (document.hidden || !heroVisible) return;
        i = (i + 1) % states.length;
        flipPlate(plate, st, states[i]);
      }, 3200);
    }

    // Lectura sincronizada con la barra (3.6 s)
    const read = $('[data-read]');
    if (read) {
      const lines = ['Leyendo placa', 'Cotejando datos', 'Verificación lista'];
      let i = 0;
      setInterval(() => {
        if (document.hidden || !heroVisible) return;
        i = (i + 1) % lines.length;
        read.style.opacity = '0';
        setTimeout(() => { read.textContent = lines[i]; read.style.opacity = '1'; }, 260);
      }, 3600);
    }
  }

  /* ---------- Hero: inclinación sutil con el puntero ---------- */
  function initTilt() {
    if (!finePointer || reduce) return;
    const fig = $('[data-tilt]');
    if (!fig) return;
    let raf = 0;
    fig.addEventListener('pointermove', e => {
      const r = fig.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        fig.style.setProperty('--ty', (x * 6).toFixed(2) + 'deg');
        fig.style.setProperty('--tx', (-y * 6).toFixed(2) + 'deg');
        fig.style.setProperty('--px', (x * -16).toFixed(1) + 'px');
        fig.style.setProperty('--py', (y * -12).toFixed(1) + 'px');
      });
    });
    fig.addEventListener('pointerleave', () => ['--tx', '--ty', '--px', '--py'].forEach(v => fig.style.removeProperty(v)));
  }

  /* ---------- Hero: red de partículas (canvas) ---------- */
  function initNetwork() {
    const cv = $('#net');
    const hero = $('.hero');
    if (!cv || !hero) return;
    const ctx = cv.getContext('2d');
    const LINK = 150;
    let W = 0, H = 0, pts = [], raf = 0, running = false;
    const mouse = { x: -1e4, y: -1e4 };

    const resize = () => {
      const r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = clamp(Math.round((W * H) / 16000), 26, 84);
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.36, vy: (Math.random() - 0.5) * 0.36,
        r: Math.random() * 1.2 + 0.8
      }));
      if (reduce) draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (!reduce) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
          if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
          const mx = p.x - mouse.x, my = p.y - mouse.y, md = mx * mx + my * my;
          if (md < 24000) {
            const d = Math.sqrt(md) || 1, f = (1 - d / 155) * 0.7;
            p.x += (mx / d) * f; p.y += (my / d) * f;
          }
        }
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const a = (1 - Math.sqrt(d2) / LINK) * 0.3;
            ctx.strokeStyle = `rgba(27,43,208,${a.toFixed(3)})`;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        // enlace con el puntero
        const ex = p.x - mouse.x, ey = p.y - mouse.y, ed = ex * ex + ey * ey;
        if (ed < 38000) {
          const a = (1 - Math.sqrt(ed) / 195) * 0.5;
          ctx.strokeStyle = `rgba(11,23,179,${a.toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(11,23,179,.6)';
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
    };

    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    const start = () => { if (running || reduce) return; running = true; raf = requestAnimationFrame(loop); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero); else addEventListener('resize', resize);
    resize();

    if (finePointer) {
      hero.addEventListener('pointermove', e => {
        const r = cv.getBoundingClientRect();
        mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      });
      hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop()), { threshold: 0 }).observe(hero);
    } else start();
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : heroVisible && start()));
  }

  /* ---------- Efectos de puntero: foco en tarjetas y botones magnéticos ---------- */
  function initPointerFx() {
    if (!finePointer) return;
    $$('[data-spot]').forEach(c => {
      c.addEventListener('pointermove', e => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', e.clientX - r.left + 'px');
        c.style.setProperty('--my', e.clientY - r.top + 'px');
      });
    });
    if (reduce) return;
    $$('[data-mag]').forEach(b => {
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) / r.width;
        const y = (e.clientY - (r.top + r.height / 2)) / r.height;
        b.style.transform = `translate(${(x * 10).toFixed(1)}px, ${(y * 8).toFixed(1)}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  }

  /* ---------- Marquee de cobertura ---------- */
  function initMarquee() {
    const m = $('[data-marq]');
    if (!m) return;
    const track = $('.marq__track', m);
    const set = $('.marq__set', m);
    if (!track || !set) return;
    const build = () => {
      $$('.marq__set[data-clone]', track).forEach(c => c.remove());
      const w = set.getBoundingClientRect().width;
      if (!w) return;
      const copies = Math.ceil(window.innerWidth / w) + 1;
      for (let i = 0; i < copies; i++) {
        const c = set.cloneNode(true);
        c.setAttribute('aria-hidden', 'true'); c.setAttribute('data-clone', '');
        track.appendChild(c);
      }
      track.style.setProperty('--set-w', w + 'px');
      track.style.setProperty('--marq-dur', Math.max(20, w / 42) + 's');
    };
    build();
    let t;
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 200); });
    if (document.fonts) document.fonts.ready.then(build);
  }

  /* ---------- Peritaje interactivo ---------- */
  function initPeritaje() {
    const sec = $('[data-peri]');
    if (!sec) return;
    const tabs = $$('.pi', sec);
    const ret = $('.pm__ret', sec);
    const tag = $('[data-peri-tag]', sec);
    const code = $('[data-peri-code]', sec);
    const panel = $('#peri-panel', sec);
    let cur = 0, manual = false;

    const select = (i, user) => {
      cur = i;
      tabs.forEach((t, k) => {
        const on = k === i;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      const t = tabs[i];
      ret.style.setProperty('--rx', t.dataset.x);
      ret.style.setProperty('--ry', t.dataset.y);
      ret.classList.toggle('is-left', Number(t.dataset.x) > 55);
      tag.textContent = $('.pi__t', t).textContent;
      scramble(code, t.dataset.code);
      panel.setAttribute('aria-labelledby', t.id);
      if (user) { manual = true; sec.classList.add('is-manual'); }
    };

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i, true));
      t.addEventListener('keydown', e => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        let n = null;
        if (e.key in keys) n = (i + keys[e.key] + tabs.length) % tabs.length;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault(); select(n, true); tabs[n].focus();
      });
      // El autoavance se dispara al terminar la barra de progreso (CSS)
      t.addEventListener('animationend', e => {
        if (e.animationName === 'pibar' && !manual) select((cur + 1) % tabs.length);
      });
    });

    // Pausa mientras la sección no es visible
    sec.classList.add('is-hold');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => sec.classList.toggle('is-hold', !e.isIntersecting), { threshold: 0.25 }).observe(sec);
    } else sec.classList.remove('is-hold');
    if (reduce) { manual = true; sec.classList.add('is-manual'); }
  }

  /* ---------- Tarifas: configurador ---------- */
  function initRates() {
    const wrap = $('[data-tar]');
    if (!wrap) return;
    const seg = $('.seg', wrap);
    const segBtns = $$('.seg__b', seg);
    const panels = { auto: $('#rates-auto'), moto: $('#rates-moto') };
    const imgs = $$('.prev__img', wrap);
    const plate = $('[data-plate-prev]', wrap);
    const stEl = $('[data-prev-state]', wrap);
    const typeEl = $('[data-prev-type]', wrap);
    const nameEl = $('[data-prev-name]', wrap);
    const priceEl = $('[data-prev-price]', wrap);
    const cta = $('[data-prev-cta]', wrap);
    const fmt = n => '$' + n.toLocaleString('es-MX');
    let type = 'auto', price = 6100, raf = 0, stateName = '';

    const tween = (from, to) => {
      cancelAnimationFrame(raf);
      if (reduce) { priceEl.textContent = fmt(to); return; }
      const t0 = performance.now(), D = 700;
      const step = n => {
        const k = clamp((n - t0) / D, 0, 1);
        priceEl.textContent = fmt(Math.round(from + (to - from) * easeOutExpo(k)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const update = animate => {
      const inp = $('input:checked', panels[type]);
      const p = Number(inp.dataset.price);
      $$('.rate', panels[type]).forEach(l => l.classList.toggle('is-on', l.contains(inp)));
      typeEl.textContent = type === 'auto' ? 'Emplacamiento de auto' : 'Emplacamiento de motocicleta';
      nameEl.textContent = inp.value;
      if (animate) { tween(price, p); } else priceEl.textContent = fmt(p);
      if (animate && inp.dataset.plate !== stateName) flipPlate(plate, stEl, inp.dataset.plate); else stEl.textContent = inp.dataset.plate;
      stateName = inp.dataset.plate;
      price = p;
      cta.href = waUrl(`Hola, quiero cotizar el emplacamiento de mi ${type === 'auto' ? 'auto' : 'motocicleta'} en ${inp.value}. Tarifa de referencia: ${fmt(p)} MXN.`);
    };

    const setType = (t, focus) => {
      if (!panels[t]) return;
      type = t;
      seg.dataset.active = t;
      segBtns.forEach(b => {
        const on = b.dataset.type === t;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      Object.entries(panels).forEach(([k, el]) => { el.hidden = k !== t; });
      imgs.forEach(im => im.classList.toggle('is-on', im.dataset.type === t));
      update(true);
    };

    segBtns.forEach((b, i) => {
      b.addEventListener('click', () => setType(b.dataset.type));
      b.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setType(segBtns[(i + 1) % segBtns.length].dataset.type, true);
        }
      });
    });
    wrap.addEventListener('change', e => { if (e.target.matches('input[type="radio"]')) update(true); });
    $$('[data-goto-type]').forEach(a => a.addEventListener('click', () => setType(a.dataset.gotoType)));

    update(false);
  }

  /* ---------- Proceso: línea de progreso por pasos ---------- */
  function initSteps() {
    const box = $('[data-steps]');
    if (!box) return;
    const steps = $$('.step', box);
    let centers = [];

    const measure = () => {
      centers = steps.map(s => { const n = $('.step__n', s); return s.offsetTop + n.offsetTop + n.offsetHeight / 2; });
      box.style.setProperty('--rail-top', centers[0] + 'px');
      box.style.setProperty('--rail-h', centers[centers.length - 1] - centers[0] + 'px');
      const active = Math.max(0, steps.findIndex(s => s.classList.contains('is-active')));
      box.style.setProperty('--fill', centers[active] - centers[0] + 'px');
    };
    const setActive = i => {
      steps.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.classList.toggle('is-done', k < i); });
      box.style.setProperty('--fill', centers[i] - centers[0] + 'px');
    };

    measure();
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(box); else addEventListener('resize', measure);
    if (document.fonts) document.fonts.ready.then(measure);

    if (!('IntersectionObserver' in window) || reduce) { steps.forEach(s => s.classList.add('is-done')); return; }
    // 0 = debajo de la banda, 1 = dentro, 2 = ya pasó
    const state = steps.map(() => 0);
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        const i = steps.indexOf(en.target);
        const above = en.rootBounds ? en.boundingClientRect.top < en.rootBounds.top : false;
        state[i] = en.isIntersecting ? 1 : above ? 2 : 0;
      });
      let a = state.lastIndexOf(1);
      if (a < 0) a = state.lastIndexOf(2);
      setActive(Math.max(0, a));
    }, { rootMargin: '-42% 0px -48% 0px' });
    steps.forEach(s => io.observe(s));
  }

  /* ---------- FAQ ---------- */
  function initFaq() {
    const list = $('[data-faq]');
    if (!list) return;
    list.addEventListener('click', e => {
      const b = e.target.closest('.qa__b');
      if (!b) return;
      const item = b.closest('.qa');
      const open = !item.classList.contains('is-open');
      $$('.qa', list).forEach(q => {
        const o = q === item ? open : false;
        q.classList.toggle('is-open', o);
        $('.qa__b', q).setAttribute('aria-expanded', String(o));
      });
    });
  }

  /* ---------- Formulario: validación y envío a WhatsApp ---------- */
  function initForm() {
    const form = $('#quote-form');
    if (!form) return;
    const status = $('#form-status');
    const f = { name: $('#f-name'), tel: $('#f-tel'), svc: $('#f-svc'), state: $('#f-state'), msg: $('#f-msg') };
    const hint = status.textContent;

    const err = (el, msg) => {
      const out = $('#' + el.getAttribute('aria-describedby'));
      if (msg) { el.setAttribute('aria-invalid', 'true'); if (out) out.textContent = msg; }
      else { el.removeAttribute('aria-invalid'); if (out) out.textContent = ''; }
      return !msg;
    };
    const digits = () => f.tel.value.replace(/\D/g, '').replace(/^52(?=\d{10}$)/, '');
    const checks = {
      name: () => err(f.name, f.name.value.trim().length >= 3 ? '' : 'Escribe tu nombre completo.'),
      tel:  () => err(f.tel, digits().length === 10 ? '' : 'Ingresa tu WhatsApp a 10 dígitos.'),
      svc:  () => err(f.svc, f.svc.value ? '' : 'Selecciona el trámite que necesitas.')
    };

    // Formato de teléfono mientras se escribe
    f.tel.addEventListener('input', () => {
      const d = f.tel.value.replace(/\D/g, '').slice(0, 10);
      f.tel.value = d.replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (m, a, b, c) => [a, b, c].filter(Boolean).join(' '));
    });
    Object.entries(checks).forEach(([k, fn]) => {
      f[k].addEventListener('blur', fn);
      f[k].addEventListener('input', () => { if (f[k].getAttribute('aria-invalid')) fn(); });
      f[k].addEventListener('change', () => { if (f[k].getAttribute('aria-invalid')) fn(); });
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const results = Object.values(checks).map(fn => fn());
      if (results.includes(false)) {
        const bad = [f.name, f.tel, f.svc].find(el => el.getAttribute('aria-invalid'));
        if (bad) bad.focus();
        status.classList.remove('is-ok'); status.textContent = 'Revisa los campos marcados para continuar.';
        return;
      }
      const lines = [
        `Hola, soy ${f.name.value.trim()}. Quiero cotizar: ${f.svc.value}${f.state.value ? ' (estado de interés: ' + f.state.value + ')' : ''}.`,
        f.msg.value.trim() ? `Detalles: ${f.msg.value.trim()}` : '',
        `Mi WhatsApp: ${f.tel.value.trim()}.`
      ].filter(Boolean);
      const url = waUrl(lines.join('\n'));
      status.classList.add('is-ok'); status.textContent = 'Abriendo WhatsApp con tu solicitud...';
      const w = window.open(url, '_blank', 'noopener');
      if (!w) window.location.href = url; // si el navegador bloquea la ventana
      setTimeout(() => { status.classList.remove('is-ok'); status.textContent = hint; }, 6000);
    });
  }

  /* ---------- WhatsApp flotante: aviso una sola vez ---------- */
  function initWaTip() {
    const wa = $('.wa');
    if (!wa || reduce) return;
    setTimeout(() => {
      wa.classList.add('is-tip');
      setTimeout(() => wa.classList.remove('is-tip'), 5500);
    }, 7000);
  }

  /* ---------- Arranque ---------- */
  function boot() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    $$('[data-year]').forEach(e => { e.textContent = new Date().getFullYear(); });
    $$('[data-split]').forEach(splitWords);

    initMenu();
    initAnchors();
    initNav();
    initMarquee();
    initPeritaje();
    initRates();
    initSteps();
    initFaq();
    initForm();
    initPointerFx();

    runLoader().then(() => {
      initSmoothScroll();
      initHero();
      initTilt();
      initNetwork();
      initReveal();
      initCounters();
      initWaTip();
      if (location.hash && $(location.hash)) scrollToTarget($(location.hash), true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
