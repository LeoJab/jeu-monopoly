// Effets spéciaux : sons (WebAudio), confettis, feux d'artifice, pluie d'emojis, secousses, bannières.
const FX = (() => {
  let muted = false, actx = null;
  try { muted = localStorage.getItem('molopony_mute') === '1'; } catch (e) {}

  function ctx() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type, vol, delay, slide) {
    const c = ctx(); if (!c || muted) return;
    const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const SOUNDS = {
    roll: () => { for (let i = 0; i < 6; i++) tone(200 + Math.random() * 400, 0.06, 'square', 0.05, i * 0.07); },
    step: () => tone(520, 0.05, 'triangle', 0.06),
    cash: () => { tone(880, 0.08, 'square', 0.06); tone(1320, 0.14, 'square', 0.06, 0.08); },
    pay: () => { tone(400, 0.12, 'sawtooth', 0.06, 0, 200); },
    buy: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.07, i * 0.08)); },
    card: () => { tone(660, 0.1, 'triangle', 0.08); tone(990, 0.2, 'triangle', 0.08, 0.1); },
    jail: () => { tone(300, 0.25, 'sawtooth', 0.09, 0, 120); tone(300, 0.25, 'sawtooth', 0.09, 0.3, 120); },
    go: () => { [784, 988, 1175].forEach((f, i) => tone(f, 0.12, 'triangle', 0.08, i * 0.07)); },
    build: () => { tone(180, 0.08, 'square', 0.1); tone(240, 0.1, 'square', 0.1, 0.1); },
    bad: () => tone(150, 0.3, 'sawtooth', 0.09, 0, 60),
    turn: () => tone(740, 0.1, 'triangle', 0.06),
    win: () => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, 'square', 0.08, i * 0.13)); },
  };
  function sound(n) { try { if (SOUNDS[n]) SOUNDS[n](); } catch (e) {} }
  function toggleMute() { muted = !muted; try { localStorage.setItem('molopony_mute', muted ? '1' : '0'); } catch (e) {} return muted; }

  // ----- Particules -----
  const cv = document.getElementById('fx'), g = cv.getContext('2d');
  let parts = [], running = false;
  function resize() { cv.width = innerWidth; cv.height = innerHeight; }
  addEventListener('resize', resize); resize();

  const COLORS = ['#ffd426', '#e0262b', '#2433f2', '#1fa855', '#e0489a', '#f7931e', '#3ff0c9', '#fff'];
  function add(p) { parts.push(p); if (!running) { running = true; requestAnimationFrame(loop); } }
  function loop() {
    g.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => p.life > 0);
    parts.forEach(p => {
      p.life--; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vx *= p.drag;
      g.save(); g.globalAlpha = Math.min(1, p.life / 25); g.translate(p.x, p.y); g.rotate(p.r);
      if (p.emoji) { g.font = p.size + 'px serif'; g.fillText(p.emoji, 0, 0); }
      else if (p.spark) { g.fillStyle = p.c; g.beginPath(); g.arc(0, 0, p.size, 0, 7); g.fill(); }
      else { g.fillStyle = p.c; g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
      g.restore();
    });
    if (parts.length) requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, cv.width, cv.height); }
  }
  function confetti(n, x, y, power) {
    x = x == null ? cv.width / 2 : x; y = y == null ? cv.height * 0.35 : y; power = power || 1;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (3 + Math.random() * 9) * power;
      add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, g: 0.22, drag: 0.99, r: 0, vr: (Math.random() - .5) * .4,
        size: 7 + Math.random() * 8, c: COLORS[i % COLORS.length], life: 90 + Math.random() * 60 });
    }
  }
  function rain(emoji, n) {
    for (let i = 0; i < (n || 30); i++) {
      add({ x: Math.random() * cv.width, y: -30 - Math.random() * 300, vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 3,
        g: 0.05, drag: 1, r: 0, vr: (Math.random() - .5) * .2, size: 26 + Math.random() * 20, emoji, life: 170 });
    }
  }
  function firework(x, y) {
    const c = COLORS[Math.floor(Math.random() * COLORS.length)];
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 6;
      add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.08, drag: 0.985, r: 0, vr: 0, size: 2 + Math.random() * 3, c, spark: 1, life: 60 + Math.random() * 40 });
    }
  }
  function fireworks(count) {
    for (let i = 0; i < (count || 8); i++) setTimeout(() => {
      firework(cv.width * (0.15 + Math.random() * 0.7), cv.height * (0.15 + Math.random() * 0.4)); sound('buy');
    }, i * 380);
  }
  function burstAt(el, n, power) {
    if (!el) return confetti(n, null, null, power);
    const r = el.getBoundingClientRect(); confetti(n, r.left + r.width / 2, r.top + r.height / 2, power);
  }

  // ----- Effets d'écran -----
  function shake() { document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); }
  function flash(color) {
    const f = document.getElementById('flash'); f.style.background = color; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  }
  function banner(text, color) {
    const b = document.getElementById('banner'); b.textContent = text; b.style.color = color || '#fff';
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  }
  function floatText(el, text, color) {
    const d = document.createElement('div'); d.className = 'float'; d.textContent = text; d.style.color = color;
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
    d.style.left = (r.left + r.width / 2 - 20) + 'px'; d.style.top = r.top + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 1500);
  }

  // Pièces qui volent d'un élément à un autre (paiements)
  function flyCoins(from, to, n, emoji) {
    const a = from ? from.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const b = to ? to.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div'); c.className = 'coin'; c.textContent = emoji || '🪙';
      c.style.left = x0 + 'px'; c.style.top = y0 + 'px'; document.body.appendChild(c);
      const mx = (x0 + x1) / 2 + (Math.random() - .5) * 160, my = Math.min(y0, y1) - 40 - Math.random() * 90;
      const an = c.animate([
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
        { transform: 'translate(' + (mx - x0 - 14) + 'px,' + (my - y0 - 14) + 'px) scale(1.2) rotate(180deg)', opacity: 1, offset: .45 },
        { transform: 'translate(' + (x1 - x0 - 14) + 'px,' + (y1 - y0 - 14) + 'px) scale(.6) rotate(360deg)', opacity: .9 }
      ], { duration: 700 + Math.random() * 300, delay: i * 70, easing: 'ease-in-out', fill: 'both' });
      an.onfinish = () => c.remove();
    }
  }
  return { flyCoins, sound, toggleMute, isMuted: () => muted, confetti, rain, fireworks, burstAt, shake, flash, banner, floatText };
})();
