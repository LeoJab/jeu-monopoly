// Interface : plateau, joueurs, panneau d'actions, file d'animations.
const $ = s => document.querySelector(s);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const G = { state: null, meId: null, local: false, host: true, send: () => {}, newGame: () => {}, quit: () => {} };

const UI = (() => {
  const FACE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const cells = [], tks = [];
  let moneyShown = {}, shown = {}, lastV = 0, lastPartie = null, queue = Promise.resolve(), built = false, rolling = false, hopPid = null, wasMine = false;

  function gridPos(i) {
    if (i === 0) return [11, 11];
    if (i < 10) return [11, 11 - i];
    if (i === 10) return [11, 1];
    if (i < 20) return [11 - (i - 10), 1];
    if (i === 20) return [1, 1];
    if (i < 30) return [1, 1 + (i - 20)];
    if (i === 30) return [1, 11];
    return [1 + (i - 30), 11];
  }
  function sideClass(i) {
    if ([0, 10, 20, 30].includes(i)) return 'corner';
    return i < 10 ? 'row-b' : i < 20 ? 'col-l' : i < 30 ? 'row-t' : 'col-r';
  }
  function cellBody(b) {
    const price = b.price ? '<div class="pr">' + b.price + ' €</div>' : (b.amount ? '<div class="pr">' + b.amount + ' €</div>' : '');
    const sub = b.sub ? '<div class="pr">' + b.sub + '</div>' : '';
    let ic = b.icon || '';
    if (b.t === 'rail') ic = '🚂'; else if (b.t === 'chance') ic = '❓'; else if (b.t === 'chest') ic = '📦';
    return (ic ? '<div class="ic">' + ic + '</div>' : '') + '<div class="nm">' + esc(b.name) + '</div>' + price + sub;
  }

  const PIPS = '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
  function dieHTML(id) { return '<div class="die" id="' + id + '" data-v="1">' + PIPS + '</div>'; }
  function setDie(el, v) { el.dataset.v = v; }

  function build() {
    const board = $('#board');
    BOARD.forEach((b, i) => {
      const el = document.createElement('div');
      const [r, c] = gridPos(i);
      el.className = 'sq ' + sideClass(i) + (b.t === 'chance' ? ' chance' : '');
      el.style.gridArea = r + ' / ' + c;
      el.innerHTML = (b.t === 'street' ? '<div class="band" style="background:' + GROUPS[b.g].color + '"></div>' : '') +
        '<div class="body">' + cellBody(b) + '</div><div class="owner" hidden></div>';
      el.addEventListener('click', () => Modals.prop(i));
      board.appendChild(el); cells.push(el);
      const tk = document.createElement('div'); tk.className = 'tks'; tk.style.gridArea = r + ' / ' + c; board.appendChild(tk); tks.push(tk);
    });
    const center = document.createElement('div');
    center.id = 'center';
    center.innerHTML =
      '<div class="deck ch">❓ CHANCE</div><div class="deck cc">📦 CAISSE DE COMMUNAUTÉ</div>' +
      '<h2 class="title"><span class="cd"></span>MOLOPONY</h2>' +
      '<img class="mascot" src="img/lenaic.png" alt="' + GAME.mascot + '">' +
      '<div class="dice">' + dieHTML('d1') + dieHTML('d2') + '</div><div class="dsum" id="dsum"></div>' +
      '<div class="bubble" id="bubble">Bienvenue !</div><div id="paybox"></div>';
    board.appendChild(center);
    built = true;
  }

  // ---------- Qui doit agir ----------
  function needs(s) {
    if (s.phase === 'auction') return Engine.auctionTurn(s);
    if (s.phase === 'debt') return s.debt.pid;
    if (s.phase === 'choice') return s.choice.pid;
    return s.players[s.turn].id;
  }
  function actor(s) { return G.local ? needs(s) : G.meId; }
  function viewer(s) { return G.local ? s.players[s.turn].id : G.meId; } // pour « mes terrains »

  // ---------- Rendu ----------
  function tokHTML(p, extra) {
    const t = TOKENS[p.tok % TOKENS.length];
    const inner = t.img ? '<img src="' + t.img + '" alt="">' : t.emoji;
    return '<div class="tok ' + (t.img ? 'chip ' : '') + (extra || '') + '" style="--c:' + p.color + '" title="' + esc(p.name) + '">' + inner + '</div>';
  }
  function renderBoard(s) {
    BOARD.forEach((b, i) => {
      const el = cells[i], pr = s.props[i];
      const ow = el.querySelector('.owner');
      if (pr) { ow.hidden = false; ow.style.setProperty('--oc', Engine.P(s, pr.o).color); el.style.setProperty('--oc', Engine.P(s, pr.o).color); } else ow.hidden = true;
      el.classList.toggle('owned', !!pr);
      el.classList.toggle('mort', !!(pr && pr.m));
      const cp = s.players[s.turn];
      el.classList.toggle('cur', !!cp && !cp.out && s.phase !== 'over' && shown[cp.id] === i);
      const band = el.querySelector('.band');
      if (band) band.innerHTML = pr && pr.h ? (pr.h === 5 ? '<span class="hs v"></span>' : '<span class="hs"></span>'.repeat(pr.h)) : '';
      const here = s.players.filter(p => !p.out && shown[p.id] === i);
      tks[i].dataset.n = here.length;
      tks[i].innerHTML = here.map(p => tokHTML(p, (p.id === G.meId ? 'me ' : '') + (p.id === hopPid ? 'hop' : ''))).join('');
    });
  }
  function avatarHTML(p) {
    if (p.avatar) return '<img class="av" style="--c:' + p.color + '" src="' + esc(p.avatar) + '" data-chadgang-id="' + esc(p.id) + '" alt="">';
    return '<div class="av tok big' + (TOKENS[p.tok % TOKENS.length].img ? ' chip' : '') + '" style="--c:' + p.color + '" data-chadgang-id="' + esc(p.id) + '">' + (TOKENS[p.tok % TOKENS.length].img ? '<img src="' + TOKENS[p.tok % TOKENS.length].img + '">' : TOKENS[p.tok % TOKENS.length].emoji) + '</div>';
  }
  function pipColor(b) { return b.t === 'street' ? GROUPS[b.g].color : b.t === 'rail' ? '#3a3a4a' : '#b9b9c9'; }
  function renderPlayers(s, animate) {
    $('#players').innerHTML = s.players.map((p, i) => {
      const turn = i === s.turn && !p.out && s.phase !== 'over';
      const mine = Object.keys(s.props).map(Number).filter(k => s.props[k].o === p.id).sort((x, y) => x - y);
      const pips = mine.map(k => '<i class="pip' + (s.props[k].m ? ' m' : '') + '" style="--pc:' + pipColor(BOARD[k]) + '" title="' + esc(BOARD[k].name) + '">' + (s.props[k].h ? (s.props[k].h === 5 ? '★' : s.props[k].h) : '') + '</i>').join('');
      const badges = (p.jail >= 0 ? '<span class="bd" title="À l\'Hôtel">🏨</span>' : '') + (p.jc.length ? '<span class="bd" title="Carte libération">🃏</span>' : '') + (turn ? '<span class="bd">🎲</span>' : '');
      return '<div class="pl' + (turn ? ' turn' : '') + (p.out ? ' out' : '') + (p.id === G.meId ? ' me' : '') + '" data-pid="' + esc(p.id) + '" style="--c:' + p.color + '">' +
        avatarHTML(p) + '<div class="info"><div class="n">' + '<span class="nm">' + esc(p.name) + '</span>' + (p.id === G.meId ? ' <span class="you">toi</span>' : '') + '</div>' +
        '<div class="m">' + (p.out ? '💀 Éliminé' : Engine.fmt(animate || moneyShown[p.id] == null ? p.money : moneyShown[p.id])) + '</div>' +
        (mine.length ? '<div class="pips">' + pips + '</div>' : '<div class="sub nopr">Aucun terrain</div>') + '</div>' +
        '<div class="badges">' + badges + '</div></div>';
    }).join('');
    document.querySelectorAll('#players .pl').forEach(el => el.addEventListener('click', () => Modals.mine(el.dataset.pid)));
    s.players.forEach(p => {
      const from = moneyShown[p.id]; moneyShown[p.id] = p.money;
      if (animate && from != null && from !== p.money && !p.out) countUp(p.id, from, p.money);
    });
  }
  function countUp(pid, from, to) {
    const el = document.querySelector('#players .pl[data-pid="' + pid + '"] .m'); if (!el) return;
    const t0 = performance.now(), dur = 700; el.classList.add(to > from ? 'up' : 'down');
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Engine.fmt(Math.round(from + (to - from) * e));
      if (k < 1) requestAnimationFrame(step); else el.classList.remove('up', 'down');
    })(t0);
  }
  function renderLog(s) {
    const L = $('#log'); L.innerHTML = s.log.map(l => '<div>' + esc(l) + '</div>').join(''); L.scrollTop = L.scrollHeight;
    $('#bubble').textContent = s.log[s.log.length - 1] || '';
  }
  function renderLastCard(s) {
    const el = $('#lastcard'), c = s.lastCard;
    if (!c) { el.innerHTML = '<div class="lc-title">🃏 Dernière carte</div><div class="lc-empty">Aucune carte tirée pour l\'instant.</div>'; el.dataset.n = ''; return; }
    const p = Engine.P(s, c.pid), isC = c.deck === 'chance';
    const fresh = el.dataset.n !== String(c.n); el.dataset.n = c.n;
    el.innerHTML = '<div class="lc-title">🃏 Dernière carte</div><div class="lc-card ' + (isC ? 'chance' : 'chest') + (fresh ? ' fresh' : '') + '">' +
      '<div class="lc-deck">' + (isC ? '❓ CHANCE' : '📦 CAISSE DE COMMUNAUTÉ') + '</div><div class="lc-txt">' + esc(c.txt) + '</div></div>' +
      '<div class="lc-who">Tombée sur <span class="pc-p" style="--c:' + p.color + '">' + esc(p.name) + '</span></div>';
  }
  function renderDice(s) {
    if (rolling) return;
    setDie($('#d1'), s.dice[0]); setDie($('#d2'), s.dice[1]);
    $('#dsum').textContent = s.dice[0] + s.dice[1] ? '= ' + (s.dice[0] + s.dice[1]) : '';
  }

  function actions(s) {
    const el = $('#actions');
    const need = needs(s), np = Engine.P(s, need), me = actor(s);
    const mine = G.local || need === G.meId, p = np;
    const inGame = G.local || s.players.some(x => x.id === G.meId);
    let h = '';
    $('#whoTurn').textContent = s.phase === 'over' ? '🏆 Partie terminée' : '🎲 Tour de ' + s.players[s.turn].name;
    const myTurn = !G.local && inGame && mine && s.phase !== 'over';
    try { document.title = myTurn ? '🎲 À toi de jouer ! · Molopony' : 'Molopony'; } catch (e) {}
    if (myTurn && !wasMine) { try { navigator.vibrate && navigator.vibrate(120); } catch (e) {} }
    wasMine = myTurn;
    const tb = s.phase === 'over' ? '' : '<div class="turnbar' + (myTurn ? ' mine' : '') + '" style="--c:' + np.color + '">' +
      (myTurn ? '🎲 À toi de jouer !' : (G.local ? '🎲 ' + esc(np.name) + ', à toi !' : '⏳ ' + esc(np.name))) + '</div>';

    if (s.phase === 'over') {
      const w = Engine.P(s, s.winner);
      h = '<div class="hint">👑 <b>' + esc(w.name) + '</b> a gagné la partie !</div><div class="btnrow">' +
        (G.host ? '<button class="btn go" data-x="newgame">Nouvelle partie</button>' : '<span class="hint">En attente de l\'hôte…</span>') +
        '<button class="btn alt" data-x="quit">Quitter</button></div>';
    } else if (!mine || !inGame) {
      h = '<div class="hint">⏳ ' + esc(np.name) + ' ' + ({ roll: 'va lancer les dés…', buy: 'hésite à acheter…', auction: 'réfléchit à son enchère…', debt: 'est dans le rouge !', choice: 'choisit…', end: 'termine son tour…' }[s.phase] || 'joue…') + '</div>';
      if (!inGame) h += '<div class="hint">👀 Tu regardes la partie.</div>';
    } else {
      switch (s.phase) {
        case 'roll':
          h = p.jail >= 0 ? '<div class="hint">🏨 À l\'Hôtel (' + p.jail + '/' + GAME.maxJailTurns + ') : fais un double ou paie.</div>' : '';
          h += '<button class="btn go" data-a="roll"><span class="di">🎲</span> LANCER LES DÉS <small class="kbd">Espace</small></button>';
          if (p.jail >= 0) h += '<div class="btnrow"><button class="btn" data-a="jailPay"' + (p.money < GAME.jailFine ? ' disabled' : '') + '>Payer ' + GAME.jailFine + ' €</button>' +
            (p.jc.length ? '<button class="btn" data-a="jailCard">🃏 Carte libération</button>' : '') + '</div>';
          break;
        case 'buy': {
          const b = BOARD[p.pos];
          h = '<div class="hint">Tu es sur <b>' + esc(b.name) + '</b> (' + b.price + ' €)</div><div class="btnrow">' +
            '<button class="btn go" data-a="buy"' + (p.money < b.price ? ' disabled' : '') + '>Acheter ' + b.price + ' €</button>' +
            '<button class="btn alt" data-a="decline">Enchères</button></div>';
          break;
        }
        case 'auction': {
          const a = s.auction;
          h = '<div class="hint">🔨 <b>' + esc(BOARD[a.idx].name) + '</b><br>Mise actuelle : ' + (a.lead ? Engine.fmt(a.bid) + ' (' + esc(Engine.P(s, a.lead).name) + ')' : 'aucune') + '</div><div class="bidrow">' +
            [10, 50, 100, 500].map(n => '<button class="btn sm" data-a="bid" data-n="' + (a.bid + n) + '"' + (a.bid + n > p.money ? ' disabled' : '') + '>+' + n + '</button>').join('') +
            '</div><button class="btn alt" data-a="pass">Se coucher</button>';
          break;
        }
        case 'debt':
          h = '<div class="hint">💸 Tu dois <b>' + Engine.fmt(s.debt.n) + '</b>' + (s.debt.to ? ' à ' + esc(Engine.P(s, s.debt.to).name) : ' à la banque') + ' (tu as ' + Engine.fmt(p.money) + ')</div>' +
            '<div class="btnrow"><button class="btn" data-x="mine">📜 Vendre / hypothéquer</button></div><div class="btnrow">' +
            '<button class="btn go" data-a="payDebt"' + (p.money < s.debt.n ? ' disabled' : '') + '>Payer</button>' +
            '<button class="btn bad" data-a="bankrupt">Faillite 💀</button></div>';
          break;
        case 'choice':
          h = '<div class="btnrow"><button class="btn go" data-a="choiceGain">Gagner ' + s.choice.n + ' €</button><button class="btn" data-a="choiceChance">Tirer Chance</button></div>';
          break;
        case 'end':
          h = '<div class="btnrow"><button class="btn go" data-a="end">' + (s.extra && p.jail < 0 ? '🎲 Rejouer (double !)' : 'Fin du tour') + '</button></div>';
          break;
        default: h = '<div class="hint">…</div>';
      }
    }
    el.innerHTML = tb + h;
    el.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
      FX.sound('turn'); const a = { a: b.dataset.a }; if (b.dataset.n) a.n = +b.dataset.n; act(a);
    }));
    el.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => {
      const x = b.dataset.x;
      if (x === 'mine') Modals.mine(viewer(s)); else if (x === 'newgame') G.newGame(); else if (x === 'quit') G.quit();
    }));
  }

  // Espace / Entrée : lancer les dés ou finir le tour (jamais acheter par accident)
  addEventListener('keydown', ev => {
    if (ev.key !== ' ' && ev.key !== 'Enter') return;
    const t = ev.target; if (t && /^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(t.tagName)) return;
    if (!$('#modal').hidden || $('#game').hidden) return;
    const b = document.querySelector('#actions [data-a="roll"], #actions [data-a="end"]');
    if (b && !b.disabled) { ev.preventDefault(); b.click(); }
  });

  function act(a) {
    const s = G.state; if (!s) return;
    G.send(a, actor(s));
  }

  function renderAll(s) {
    renderBoard(s); renderPlayers(s, true); renderLog(s); renderLastCard(s); renderDice(s); actions(s); Modals.rerender();
  }

  // ---------- Animations ----------
  function posEl(pid) { return document.querySelector('#players .pl[data-pid="' + pid + '"] .m'); }
  async function animateMove(e) {
    const s = G.state, step = e.fast ? 55 : 130;
    const n = (e.to - e.from + 40) % 40;
    if (e.dir < 0) {
      for (let k = 1; k <= 3; k++) { shown[e.pid] = (e.from - k + 40) % 40; renderBoard(s); FX.sound('step'); await wait(step); }
    } else {
      for (let k = 1; k <= n; k++) { shown[e.pid] = (e.from + k) % 40; hop(e.pid); renderBoard(s); FX.sound('step'); await wait(step); }
    }
    shown[e.pid] = e.to; hopPid = null; renderBoard(s);
    const cl = cells[e.to]; cl.classList.remove('land'); void cl.offsetWidth; cl.classList.add('land'); setTimeout(() => cl.classList.remove('land'), 700);
    const b = BOARD[e.to];
    if (['street', 'rail', 'util'].includes(b.t)) await wait(120);
  }
  function hop(pid) { hopPid = pid; }
  async function rollAnim(e) {
    rolling = true; const d1 = $('#d1'), d2 = $('#d2'), sum = $('#dsum');
    sum.textContent = ''; sum.classList.remove('pop');
    [d1, d2].forEach((d, i) => { d.classList.remove('land', 'dbl'); d.classList.add('roll'); d.style.setProperty('--dir', i ? 1 : -1); });
    FX.sound('roll');
    for (let k = 0; k < 12; k++) {
      setDie(d1, 1 + Math.floor(Math.random() * 6)); setDie(d2, 1 + Math.floor(Math.random() * 6)); await wait(60 + k * 12);
    }
    d1.classList.remove('roll'); d2.classList.remove('roll');
    setDie(d1, e.a); setDie(d2, e.b); rolling = false;
    [d1, d2].forEach(d => { void d.offsetWidth; d.classList.add('land'); if (e.a === e.b) d.classList.add('dbl'); });
    sum.textContent = '= ' + (e.a + e.b); void sum.offsetWidth; sum.classList.add('pop');
    if (e.a === e.b) { FX.banner('DOUBLE !', '#ffd426'); FX.confetti(40, null, null, 0.7); }
    await wait(450);
  }
  function plEl(pid) { return pid ? document.querySelector('#players .pl[data-pid="' + pid + '"]') : null; }
  function pulse(el, kf) { if (el && el.animate) el.animate(kf, { duration: 600, easing: 'ease-out' }); }
  async function payAnim(e, s) {
    const from = e.pid ? Engine.P(s, e.pid) : null, to = e.to ? Engine.P(s, e.to) : null;
    const who = (p, fb) => p ? '<span class="pc-p" style="--c:' + p.color + '">' + esc(p.name) + '</span>' : '<span class="pc-p bank">' + fb + '</span>';
    const gain = !from;
    const box = $('#paybox'); if (!box) return;
    box.innerHTML = '<div class="paycard ' + (gain ? 'gain' : 'loss') + '">' + (e.why ? '<div class="pc-why">' + esc(e.why) + '</div>' : '') +
      '<div class="pc-row">' + who(from, '🏦 Banque') + '<span class="pc-arrow">➜</span>' + who(to, '🏦 Banque') + '</div>' +
      '<div class="pc-n">' + (gain ? '+' : '−') + Engine.fmt(e.n) + '</div></div>';
    const fe = plEl(e.pid), te = plEl(e.to), mid = $('#center');
    FX.flyCoins(fe || mid, te || mid, Math.min(12, 3 + Math.floor(e.n / 60)), gain ? '💰' : '🪙');
    pulse(fe, [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)', background: '#ffb3b3' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }]);
    pulse(te, [{ transform: 'scale(1)' }, { transform: 'scale(1.06)', background: '#b9f5c8' }, { transform: 'scale(1)' }]);
    await wait(e.to && e.pid ? 1500 : 950);
    const c = box.firstChild; if (c) c.classList.add('out');
    await wait(220); box.innerHTML = '';
  }
  function cellCenter(i) { const r = cells[i].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }

  async function handle(e, s) {
    switch (e.k) {
      case 'start': FX.banner('C\'EST PARTI !', '#ffd426'); FX.confetti(120); FX.sound('go'); await wait(900); break;
      case 'dice': await rollAnim(e); break;
      case 'move': await animateMove(e); break;
      case 'go': FX.sound('go'); FX.rain('💰', 24); FX.floatText(posEl(e.pid), '+200 € 🎉', '#1fa855'); break;
      case 'cash': {
        const el = posEl(e.pid); if (!el) break;
        FX.floatText(el, (e.d > 0 ? '+' : '') + e.d + ' €', e.d > 0 ? '#1fa855' : '#e0262b');
        if (e.d > 0) { FX.sound('cash'); if (e.d >= 150) FX.burstAt(el, 25, .6); } else FX.sound('pay');
        break;
      }
      case 'pay': await payAnim(e, s); break;
      case 'rent': FX.sound('bad'); FX.rain('💥', 8); if (e.n >= 300) FX.shake(); break;
      case 'buy': {
        FX.sound('buy'); const [x, y] = cellCenter(e.idx); FX.confetti(60, x, y, .8);
        FX.banner('ACHETÉ !', Engine.P(s, e.pid).color === '#12102b' ? '#fff' : Engine.P(s, e.pid).color); await wait(450); break;
      }
      case 'build': {
        FX.sound('build'); const [x, y] = cellCenter(e.idx);
        if (e.h === 5) { FX.fireworks(5); FX.banner('VILLA ! 🏰', '#e0262b'); FX.shake(); } else FX.confetti(25, x, y, .5);
        break;
      }
      case 'card': await Modals.card(e); break;
      case 'jail': FX.sound('jail'); FX.flash('rgba(224,38,43,.7)'); FX.shake(); FX.banner('À L\'HÔTEL ! 🏨', '#ff6b6b'); await wait(1000); break;
      case 'park': FX.rain('🌳', 10); break;
      case 'auction': FX.banner('ENCHÈRES ! 🔨', '#ffd426'); FX.sound('card'); break;
      case 'bankrupt': FX.sound('bad'); FX.shake(); FX.rain('💀', 24); FX.banner('FAILLITE 💀', '#fff'); await wait(1200); break;
      case 'turn': FX.sound('turn'); break;
      case 'win': {
        const w = Engine.P(s, e.pid); FX.sound('win'); FX.fireworks(12); FX.confetti(200); FX.rain('👑', 20);
        FX.banner('👑 ' + w.name.toUpperCase() + ' GAGNE !', '#ffd426'); await wait(1500); break;
      }
    }
  }

  // ---------- Entrée principale ----------
  function update(s) {
    if (!built) build();
    const fresh = s.partie !== lastPartie;
    const quiet = fresh && s.v > 1 ? true : (!fresh && s.v <= lastV);
    const prevV = lastV;
    G.state = s;
    if (typeof Vote !== 'undefined') Vote.render(s);
    if (fresh) { shown = {}; moneyShown = {}; lastPartie = s.partie; Modals.close(); }
    s.players.forEach(p => { if (shown[p.id] == null) shown[p.id] = p.pos; });
    if (quiet && !fresh) { return; }
    lastV = s.v;
    renderPlayers(s); renderLog(s);
    const events = quiet ? [] : s.fx.slice();
    queue = queue.then(async () => {
      for (const e of events) { try { await handle(e, G.state); } catch (err) { console.error(err); } }
      const cur = G.state;
      cur.players.forEach(p => { shown[p.id] = p.pos; });
      renderAll(cur);
    });
    // état affiché tout de suite pour les boutons non animés
    renderBoard(s);
  }

  function reset() { moneyShown = {}; lastV = 0; lastPartie = null; shown = {}; }
  return { update, reset, needs, actor, viewer, renderAll };
})();
