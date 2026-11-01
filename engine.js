// Moteur de règles. Pur : aucune dépendance au DOM ni au réseau.
// Seul l'hôte (ou le mode même écran) appelle Engine.act(). L'état complet est ensuite diffusé.
const Engine = (() => {
  const P = (s, id) => s.players.find(p => p.id === id);
  const cur = s => s.players[s.turn];
  const rnd = n => Math.floor(Math.random() * n);
  const alive = s => s.players.filter(p => !p.out);
  const fmt = n => n.toLocaleString('fr-FR') + ' €';

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function log(s, txt) { s.log.push(txt); if (s.log.length > 25) s.log.shift(); }
  function fx(s, e) { s.fx.push(e); }

  function newGame(list, partie) {
    return {
      v: 1, partie, turn: 0, phase: 'roll', dice: [1, 1], dbl: 0, extra: false,
      players: list.map((p, i) => ({
        id: p.id, name: p.name, avatar: p.avatar || null, tok: p.tok != null ? p.tok : i,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
        money: GAME.startMoney, pos: 0, jail: -1, jc: [], out: false,
      })),
      props: {}, decks: {
        chance: shuffle(CHANCE.map((_, i) => i)), chest: shuffle(CHEST.map((_, i) => i)),
      },
      debt: null, auction: null, choice: null, vote: null, pendingMove: 0, winner: null,
      log: ['La partie commence !'], fx: [{ k: 'start' }],
    };
  }

  // ---------- Aides ----------
  const groupIdx = g => BOARD.map((b, i) => (b.g === g ? i : -1)).filter(i => i >= 0);
  const owns = (s, pid, g) => groupIdx(g).every(i => s.props[i] && s.props[i].o === pid);
  const countOwned = (s, pid, t) =>
    BOARD.reduce((n, b, i) => n + (b.t === t && s.props[i] && s.props[i].o === pid ? 1 : 0), 0);
  function housesUsed(s) {
    let h = 0, v = 0;
    Object.values(s.props).forEach(p => { if (p.h === 5) v++; else h += p.h; });
    return { h, v };
  }
  function rentOf(s, idx, sum) {
    const b = BOARD[idx], p = s.props[idx];
    if (b.t === 'street') return p.h > 0 ? b.rent[p.h] : (owns(s, p.o, b.g) ? b.rent[0] * 2 : b.rent[0]);
    if (b.t === 'rail') return 25 * Math.pow(2, countOwned(s, p.o, 'rail') - 1);
    return sum * (countOwned(s, p.o, 'util') === 2 ? 10 : 4);
  }
  function netWorth(s, p) {
    let w = p.money;
    Object.entries(s.props).forEach(([i, pr]) => {
      if (pr.o !== p.id) return;
      const b = BOARD[i];
      w += pr.m ? b.price / 2 : b.price;
      if (b.g) w += pr.h * GROUPS[b.g].house;
    });
    return w;
  }

  // ---------- Argent ----------
  function salary(s, p) {
    p.money += GAME.salary; fx(s, { k: 'go', pid: p.id }); fx(s, { k: 'cash', pid: p.id, d: GAME.salary });
    log(s, p.name + ' passe par Départ : +' + fmt(GAME.salary));
  }
  // Retourne true si payé, sinon passe en phase "debt"
  function charge(s, pid, n, to) {
    const p = P(s, pid);
    if (p.money >= n) {
      p.money -= n; fx(s, { k: 'cash', pid, d: -n });
      if (to) { P(s, to).money += n; fx(s, { k: 'cash', pid: to, d: n }); }
      return true;
    }
    s.debt = { pid, n, to: to || null }; s.phase = 'debt';
    log(s, p.name + ' doit ' + fmt(n) + ' mais n\'a pas assez : vendez, hypothéquez ou faillite !');
    return false;
  }

  // ---------- Déplacements ----------
  function moveBy(s, p, steps) {
    const from = p.pos;
    if (from + steps >= 40) salary(s, p);
    p.pos = (from + steps) % 40;
    fx(s, { k: 'move', pid: p.id, from, to: p.pos, dir: 1 });
    land(s, p.id);
  }
  function moveTo(s, p, to, collect) {
    const from = p.pos;
    if (collect && to < from) salary(s, p);
    p.pos = to;
    fx(s, { k: 'move', pid: p.id, from, to, dir: 1, fast: true });
    land(s, p.id);
  }
  function sendJail(s, pid) {
    const p = P(s, pid), from = p.pos;
    p.pos = POS.jail; p.jail = 0; s.extra = false; s.dbl = 0;
    fx(s, { k: 'move', pid, from, to: POS.jail, dir: 1, fast: true });
    fx(s, { k: 'jail', pid });
    log(s, p.name + ' file à l\'Hôtel 🏨');
    s.phase = 'end';
  }

  function land(s, pid) {
    const p = P(s, pid), b = BOARD[p.pos];
    s.phase = 'moving';
    switch (b.t) {
      case 'street': case 'rail': case 'util': {
        const pr = s.props[p.pos];
        if (!pr) { s.phase = 'buy'; }
        else if (pr.o !== pid && !pr.m) {
          const r = rentOf(s, p.pos, s.dice[0] + s.dice[1]);
          log(s, p.name + ' paie ' + fmt(r) + ' de loyer à ' + P(s, pr.o).name);
          fx(s, { k: 'rent', pid, to: pr.o, n: r });
          charge(s, pid, r, pr.o);
        }
        break;
      }
      case 'tax': log(s, p.name + ' paie ' + b.name + ' : ' + fmt(b.amount)); charge(s, pid, b.amount, null); break;
      case 'gojail': sendJail(s, pid); break;
      case 'chance': draw(s, pid, 'chance'); break;
      case 'chest': draw(s, pid, 'chest'); break;
      case 'park': fx(s, { k: 'park', pid }); break;
    }
    if (s.phase === 'moving') s.phase = 'end';
  }

  function draw(s, pid, deck) {
    const p = P(s, pid), idx = s.decks[deck].shift();
    const c = (deck === 'chance' ? CHANCE : CHEST)[idx];
    const keep = c.a === 'jailcard';
    if (!keep) s.decks[deck].push(idx);
    fx(s, { k: 'card', deck, txt: c.txt, pid });
    log(s, p.name + ' (' + (deck === 'chance' ? 'Chance' : 'Caisse') + ') : ' + c.txt);
    switch (c.a) {
      case 'goto': moveTo(s, p, c.to, c.collect); break;
      case 'move': {
        const from = p.pos; p.pos = (p.pos + 40 + c.n) % 40;
        fx(s, { k: 'move', pid, from, to: p.pos, dir: -1 }); land(s, pid); break;
      }
      case 'jail': sendJail(s, pid); break;
      case 'jailcard': p.jc.push(deck + ':' + idx); break;
      case 'gain': p.money += c.n; fx(s, { k: 'cash', pid, d: c.n }); break;
      case 'pay': charge(s, pid, c.n, null); break;
      case 'repair': {
        let h = 0, v = 0;
        Object.entries(s.props).forEach(([, pr]) => { if (pr.o === pid) { if (pr.h === 5) v++; else h += pr.h; } });
        const cost = h * c.house + v * c.villa;
        if (cost > 0) charge(s, pid, cost, null); else log(s, 'Aucun bâtiment : rien à payer.');
        break;
      }
      case 'birthday':
        s.players.forEach(o => {
          if (o.out || o.id === pid) return;
          const n = Math.min(o.money, c.n); o.money -= n; p.money += n;
          fx(s, { k: 'cash', pid: o.id, d: -n }); fx(s, { k: 'cash', pid, d: n });
        });
        break;
      case 'gainOrChance': s.choice = { pid, n: c.n }; s.phase = 'choice'; break;
    }
  }

  // ---------- Enchères ----------
  function startAuction(s, idx) {
    const order = alive(s).map(p => p.id);
    s.auction = { idx, bid: 0, lead: null, order, i: Math.max(0, order.indexOf(cur(s).id)), passed: [] };
    s.phase = 'auction';
    log(s, 'Enchères pour ' + BOARD[idx].name + ' !');
    fx(s, { k: 'auction' });
  }
  function auctionTurn(s) { const a = s.auction; return a ? a.order[a.i] : null; }
  function auctionNext(s, advance) {
    const a = s.auction;
    if (advance === undefined) advance = true;
    const others = a.order.filter(id => !a.passed.includes(id) && id !== a.lead);
    if (a.lead && others.length === 0) {
      const w = P(s, a.lead); w.money -= a.bid;
      s.props[a.idx] = { o: w.id, h: 0, m: 0 };
      fx(s, { k: 'buy', pid: w.id, idx: a.idx }); fx(s, { k: 'cash', pid: w.id, d: -a.bid });
      log(s, w.name + ' remporte ' + BOARD[a.idx].name + ' pour ' + fmt(a.bid));
      s.auction = null; s.phase = 'end'; return;
    }
    if (!a.lead && others.length === 0) {
      log(s, 'Personne ne veut de ' + BOARD[a.idx].name + '.'); s.auction = null; s.phase = 'end'; return;
    }
    if (!advance) return;
    for (let k = 1; k <= a.order.length; k++) {
      const j = (a.i + k) % a.order.length, id = a.order[j];
      if (!a.passed.includes(id) && id !== a.lead) { a.i = j; return; }
    }
  }

  // ---------- Construction ----------
  function canBuild(s, pid, idx) {
    const b = BOARD[idx], pr = s.props[idx];
    if (b.t !== 'street' || !pr || pr.o !== pid) return 'Pas à vous';
    if (!owns(s, pid, b.g)) return 'Il faut tout le groupe ' + GROUPS[b.g].name;
    const grp = groupIdx(b.g);
    if (grp.some(i => s.props[i].m)) return 'Une propriété du groupe est hypothéquée';
    if (pr.h >= 5) return 'Déjà une villa';
    if (grp.some(i => s.props[i].h < pr.h)) return 'Construisez de façon équilibrée';
    const u = housesUsed(s);
    if (pr.h === 4 && u.v >= GAME.hotelStock) return 'Plus de villas en stock';
    if (pr.h < 4 && u.h >= GAME.houseStock) return 'Plus de maisons en stock';
    if (P(s, pid).money < GROUPS[b.g].house) return 'Pas assez d\'argent';
    return null;
  }
  function canSell(s, pid, idx) {
    const b = BOARD[idx], pr = s.props[idx];
    if (b.t !== 'street' || !pr || pr.o !== pid || pr.h === 0) return 'Rien à vendre';
    if (groupIdx(b.g).some(i => s.props[i].h > pr.h)) return 'Vendez d\'abord les plus hautes';
    if (pr.h === 5 && housesUsed(s).h + 4 > GAME.houseStock) return 'Pas assez de maisons en stock';
    return null;
  }
  function unmortgageCost(idx) { return Math.ceil(BOARD[idx].price / 2 * (1 + GAME.mortgageInterest)); }

  // ---------- Faillite ----------
  function bankrupt(s, pid, to) {
    const p = P(s, pid);
    Object.entries(s.props).forEach(([i, pr]) => {
      if (pr.o !== pid) return;
      pr.h = 0;
      if (to) pr.o = to; else delete s.props[i];
    });
    if (to) { P(s, to).money += p.money; p.jc.forEach(c => P(s, to).jc.push(c)); }
    else p.jc.forEach(c => { const [d, i] = c.split(':'); s.decks[d].push(+i); });
    p.jc = []; p.money = 0; p.out = true; s.pendingMove = 0;
    if (s.debt && s.debt.pid === pid) s.debt = null;
    if (s.choice && s.choice.pid === pid) s.choice = null;
    fx(s, { k: 'bankrupt', pid });
    log(s, p.name + ' est en faillite 💀');
    const left = alive(s);
    if (left.length === 1) {
      s.phase = 'over'; s.winner = left[0].id; s.auction = null;
      fx(s, { k: 'win', pid: s.winner }); log(s, left[0].name + ' remporte la partie ! 👑');
    } else if (cur(s).id === pid) { s.auction = null; nextTurn(s); }
  }

  function nextTurn(s) {
    s.dbl = 0; s.extra = false;
    do { s.turn = (s.turn + 1) % s.players.length; } while (cur(s).out);
    s.phase = 'roll'; fx(s, { k: 'turn', pid: cur(s).id });
  }

  function doForfeit(s, pid) {
    const au = s.auction, wasTurn = au && auctionTurn(s) === pid;
    if (au && cur(s).id !== pid) {
      if (!au.passed.includes(pid)) au.passed.push(pid);
      if (au.lead === pid) { au.lead = null; au.bid = 0; }
    }
    bankrupt(s, pid, null);
    if (s.auction && s.phase === 'auction') { auctionNext(s, false); if (s.auction && wasTurn) auctionNext(s, true); }
  }

  // Vote d'exclusion : majorité stricte des votants pour exclure ; sinon le joueur reste.
  function resolveVote(s, force) {
    const v = s.vote; if (!v) return;
    const n = v.voters.length, tg = P(s, v.target);
    let kick = null;
    if (v.yes.length * 2 > n) kick = true;
    else if (v.no.length * 2 >= n) kick = false;
    else if (force) kick = v.yes.length > v.no.length;
    if (kick === null) return;
    s.vote = null;
    if (kick && !tg.out) { log(s, tg.name + ' est exclu par vote 🚪'); doForfeit(s, tg.id); }
    else log(s, 'Vote terminé : ' + tg.name + ' reste dans la partie.');
  }

  // ---------- Actions ----------
  // Retourne null si OK, sinon un message d'erreur.
  function act(s, pid, a) {
    if (s.phase === 'over') return 'Partie terminée';
    s.fx = [];
    const p = P(s, pid), me = cur(s), mine = me && me.id === pid;
    if (!p || p.out) return 'Joueur absent';
    const ph = s.phase;
    let err = null;

    switch (a.a) {
      case 'roll': {
        if (!mine || ph !== 'roll') return 'Pas votre tour';
        const d = [1 + rnd(6), 1 + rnd(6)], dbl = d[0] === d[1], sum = d[0] + d[1];
        s.dice = d; fx(s, { k: 'dice', a: d[0], b: d[1], pid });
        if (p.jail >= 0) {
          if (dbl) { p.jail = -1; s.extra = false; log(s, p.name + ' sort de l\'Hôtel avec un double !'); moveBy(s, p, sum); }
          else {
            p.jail++;
            if (p.jail >= GAME.maxJailTurns) {
              log(s, p.name + ' paie ' + fmt(GAME.jailFine) + ' pour quitter l\'Hôtel'); p.jail = -1; s.extra = false;
              if (charge(s, pid, GAME.jailFine, null)) moveBy(s, p, sum); else s.pendingMove = sum;
            } else { log(s, p.name + ' reste à l\'Hôtel (' + p.jail + '/' + GAME.maxJailTurns + ')'); s.phase = 'end'; s.extra = false; }
          }
        } else {
          s.dbl = dbl ? s.dbl + 1 : 0;
          if (s.dbl >= 3) { log(s, p.name + ' fait 3 doubles : direction l\'Hôtel !'); sendJail(s, pid); }
          else { s.extra = dbl; log(s, p.name + ' fait ' + d[0] + ' + ' + d[1] + (dbl ? ' (double !)' : '')); moveBy(s, p, sum); }
        }
        break;
      }
      case 'jailPay':
        if (!mine || ph !== 'roll' || p.jail < 0) return 'Impossible';
        if (p.money < GAME.jailFine) return 'Pas assez d\'argent';
        p.money -= GAME.jailFine; p.jail = -1; fx(s, { k: 'cash', pid, d: -GAME.jailFine });
        log(s, p.name + ' paie ' + fmt(GAME.jailFine) + ' et sort de l\'Hôtel'); break;
      case 'jailCard': {
        if (!mine || ph !== 'roll' || p.jail < 0 || !p.jc.length) return 'Impossible';
        const [d, i] = p.jc.shift().split(':'); s.decks[d].push(+i); p.jail = -1;
        log(s, p.name + ' utilise sa carte « libéré de l\'Hôtel »'); break;
      }
      case 'buy': {
        if (!mine || ph !== 'buy') return 'Impossible';
        const b = BOARD[p.pos];
        if (p.money < b.price) return 'Pas assez d\'argent';
        p.money -= b.price; s.props[p.pos] = { o: pid, h: 0, m: 0 }; s.phase = 'end';
        fx(s, { k: 'buy', pid, idx: p.pos }); fx(s, { k: 'cash', pid, d: -b.price });
        log(s, p.name + ' achète ' + b.name + ' (' + fmt(b.price) + ')'); break;
      }
      case 'decline': if (!mine || ph !== 'buy') return 'Impossible'; startAuction(s, p.pos); break;
      case 'bid': {
        if (ph !== 'auction' || auctionTurn(s) !== pid) return 'Pas votre tour d\'enchérir';
        const n = Math.floor(+a.n);
        if (!(n > s.auction.bid)) return 'Enchère trop basse';
        if (n > p.money) return 'Pas assez d\'argent';
        s.auction.bid = n; s.auction.lead = pid; log(s, p.name + ' enchérit ' + fmt(n)); auctionNext(s); break;
      }
      case 'pass':
        if (ph !== 'auction' || auctionTurn(s) !== pid) return 'Pas votre tour d\'enchérir';
        s.auction.passed.push(pid); log(s, p.name + ' se couche'); auctionNext(s); break;
      case 'choiceGain':
        if (ph !== 'choice' || s.choice.pid !== pid) return 'Impossible';
        p.money += s.choice.n; fx(s, { k: 'cash', pid, d: s.choice.n }); s.choice = null; s.phase = 'end'; break;
      case 'choiceChance':
        if (ph !== 'choice' || s.choice.pid !== pid) return 'Impossible';
        s.choice = null; s.phase = 'moving'; draw(s, pid, 'chance'); if (s.phase === 'moving') s.phase = 'end'; break;
      case 'build':
        if (!mine || !['roll', 'end'].includes(ph)) return 'Pas maintenant';
        if ((err = canBuild(s, pid, a.i))) return err;
        p.money -= GROUPS[BOARD[a.i].g].house; s.props[a.i].h++;
        fx(s, { k: 'build', pid, idx: a.i, h: s.props[a.i].h }); fx(s, { k: 'cash', pid, d: -GROUPS[BOARD[a.i].g].house });
        log(s, p.name + ' construit sur ' + BOARD[a.i].name + (s.props[a.i].h === 5 ? ' : VILLA ! 🏰' : '')); break;
      case 'sell': {
        if (!mine || !['roll', 'end', 'debt'].includes(ph)) return 'Pas maintenant';
        if ((err = canSell(s, pid, a.i))) return err;
        const g = GROUPS[BOARD[a.i].g].house / 2; p.money += g; s.props[a.i].h--;
        fx(s, { k: 'cash', pid, d: g }); log(s, p.name + ' vend un bâtiment sur ' + BOARD[a.i].name); break;
      }
      case 'mortgage': {
        if (!mine || !['roll', 'end', 'debt'].includes(ph)) return 'Pas maintenant';
        const pr = s.props[a.i], b = BOARD[a.i];
        if (!pr || pr.o !== pid || pr.m) return 'Impossible';
        if (b.g && groupIdx(b.g).some(i => s.props[i] && s.props[i].h > 0)) return 'Vendez d\'abord les bâtiments du groupe';
        pr.m = 1; p.money += b.price / 2; fx(s, { k: 'cash', pid, d: b.price / 2 });
        log(s, p.name + ' hypothèque ' + b.name); break;
      }
      case 'unmortgage': {
        if (!mine || !['roll', 'end', 'debt'].includes(ph)) return 'Pas maintenant';
        const pr = s.props[a.i];
        if (!pr || pr.o !== pid || !pr.m) return 'Impossible';
        const c = unmortgageCost(a.i);
        if (p.money < c) return 'Pas assez d\'argent';
        pr.m = 0; p.money -= c; fx(s, { k: 'cash', pid, d: -c }); log(s, p.name + ' lève l\'hypothèque de ' + BOARD[a.i].name); break;
      }
      case 'payDebt': {
        if (ph !== 'debt' || s.debt.pid !== pid) return 'Impossible';
        if (p.money < s.debt.n) return 'Toujours pas assez d\'argent';
        const d = s.debt; s.debt = null; charge(s, pid, d.n, d.to);
        if (s.pendingMove) { const m = s.pendingMove; s.pendingMove = 0; moveBy(s, p, m); } else s.phase = 'end';
        break;
      }
      case 'bankrupt':
        if (ph !== 'debt' || s.debt.pid !== pid) return 'Impossible';
        bankrupt(s, pid, s.debt.to); break;
      case 'forfeit': { // départ d'un joueur (appelé par l'hôte)
        if (p.out) return null;
        doForfeit(s, pid);
        break;
      }
      case 'votestart': { // lancé par l'hôte quand un joueur est déconnecté depuis trop longtemps
        const t = P(s, a.target);
        if (s.vote || !t || t.out || t.id === pid) return 'Vote impossible';
        const voters = (a.voters || []).filter(id => id !== t.id && P(s, id) && !P(s, id).out);
        if (!voters.length) return 'Personne pour voter';
        s.vote = { target: t.id, voters, yes: [], no: [] };
        log(s, '🗳️ Vote : exclure ' + t.name + ' (déconnecté) ?');
        break;
      }
      case 'vote': {
        const v = s.vote;
        if (!v || !v.voters.includes(pid) || v.yes.includes(pid) || v.no.includes(pid)) return 'Vote impossible';
        (a.yes ? v.yes : v.no).push(pid);
        resolveVote(s, false);
        break;
      }
      case 'votecancel': // la cible est revenue
        if (!s.vote) return null;
        log(s, P(s, s.vote.target).name + ' est de retour, vote annulé.'); s.vote = null; break;
      case 'voteend': // délai du vote écoulé
        if (!s.vote) return null;
        resolveVote(s, true); break;
      case 'end':
        if (!mine || ph !== 'end') return 'Pas maintenant';
        if (s.extra && p.jail < 0) { s.extra = false; s.phase = 'roll'; fx(s, { k: 'turn', pid }); log(s, p.name + ' rejoue (double)'); }
        else nextTurn(s);
        break;
      default: return 'Action inconnue';
    }
    s.v++;
    return null;
  }

  return { newGame, act, rentOf, canBuild, canSell, unmortgageCost, netWorth, groupIdx, owns, housesUsed, alive, fmt, P, cur, auctionTurn };
})();
