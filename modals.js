// Fenêtres : fiche de terrain, mes terrains, cartes Chance / Caisse de communauté.
const Modals = (() => {
  let fn = null, cardTimer = null;
  const box = () => $('#modal');

  function close() { fn = null; const m = box(); m.hidden = true; m.innerHTML = ''; }
  function render() {
    if (!fn) return;
    const m = box(); m.hidden = false;
    m.innerHTML = '<div class="mbox">' + fn() + '<div class="btnrow" style="margin-top:10px"><button class="btn alt" data-close>Fermer</button></div></div>';
    m.onclick = e => { if (e.target === m) close(); };
    m.querySelector('[data-close]').onclick = close;
    m.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const s = G.state, a = { a: b.dataset.a, i: +b.dataset.i };
      FX.sound(b.dataset.a === 'build' ? 'build' : 'turn');
      G.send(a, UI.viewer(s));
    });
    m.querySelectorAll('[data-prop]').forEach(b => b.onclick = () => prop(+b.dataset.prop));
  }
  function show(f) { fn = f; render(); }
  function rerender() { if (fn) render(); }

  // Boutons de gestion d'un terrain pour le joueur qui regarde
  function manage(s, i) {
    const b = BOARD[i], pr = s.props[i], vid = UI.viewer(s);
    if (!pr || pr.o !== vid || !vid) return '';
    const cur = s.players[s.turn].id === vid;
    if (!cur || !['roll', 'end', 'debt'].includes(s.phase)) return '<p class="sub">Tu pourras gérer ce terrain pendant ton tour.</p>';
    let h = '<div class="btnrow" style="margin-top:8px">';
    if (b.t === 'street' && s.phase !== 'debt') {
      const e = Engine.canBuild(s, vid, i);
      h += '<button class="btn sm go" data-a="build" data-i="' + i + '"' + (e ? ' disabled title="' + esc(e) + '"' : '') + '>🏠 Construire (' + GROUPS[b.g].house + ' €)</button>';
    }
    if (b.t === 'street') {
      const e = Engine.canSell(s, vid, i);
      h += '<button class="btn sm" data-a="sell" data-i="' + i + '"' + (e ? ' disabled title="' + esc(e) + '"' : '') + '>Vendre bâtiment</button>';
    }
    h += pr.m ? '<button class="btn sm alt" data-a="unmortgage" data-i="' + i + '">Lever hypothèque (' + Engine.unmortgageCost(i) + ' €)</button>'
              : '<button class="btn sm alt" data-a="mortgage" data-i="' + i + '">Hypothéquer (+' + (b.price / 2) + ' €)</button>';
    h += '</div>';
    if (b.t === 'street') { const e = Engine.canBuild(s, vid, i); if (e) h += '<p class="sub">Construire : ' + esc(e) + '</p>'; }
    return h;
  }

  function propHTML(i) {
    const s = G.state, b = BOARD[i], pr = s.props[i];
    const col = b.g ? GROUPS[b.g].color : '#fff3b0';
    let rows = '', title = b.name;
    if (b.t === 'street') {
      const L = ['Loyer', 'Avec 1 maison', 'Avec 2 maisons', 'Avec 3 maisons', 'Avec 4 maisons', 'Avec une villa'];
      rows = b.rent.map((r, k) => '<tr><td>' + L[k] + '</td><td>' + r + ' €</td></tr>').join('') +
        '<tr><td>Groupe complet (sans bâtiment)</td><td>×2</td></tr>' +
        '<tr><td>Prix d\'une maison</td><td>' + GROUPS[b.g].house + ' €</td></tr>';
    } else if (b.t === 'rail') {
      rows = '<tr><td>1 gare</td><td>25 €</td></tr><tr><td>2 gares</td><td>50 €</td></tr><tr><td>3 gares</td><td>100 €</td></tr><tr><td>4 gares</td><td>200 €</td></tr>';
    } else if (b.t === 'util') {
      rows = '<tr><td>1 compagnie</td><td>4 × dés</td></tr><tr><td>2 compagnies</td><td>10 × dés</td></tr>';
    } else {
      const d = { go: 'Recevez ' + GAME.salary + ' € en passant.', jail: 'Simple visite, ou prison : sortie avec un double, ' + GAME.jailFine + ' € ou une carte.',
        park: 'Rien à faire, profitez de la pause.', gojail: 'Direction l\'Hôtel (la prison) !', tax: 'Payez ' + (b.amount || 0) + ' €.',
        chance: 'Tirez une carte Chance.', chest: 'Tirez une carte Caisse de communauté.' }[b.t];
      return '<div class="tcard"><div class="head" style="background:' + col + '">' + (b.icon || '') + ' ' + esc(title) + '</div><p style="padding:8px 10px;margin:0">' + d + '</p></div>';
    }
    if (b.price) rows += '<tr><td>Prix</td><td>' + b.price + ' €</td></tr><tr><td>Hypothèque</td><td>' + b.price / 2 + ' €</td></tr>';
    const head = b.g ? 'color:' + (['yellow', 'lblue'].includes(b.g) ? '#12102b' : '#fff') : '';
    let owner = pr ? '<p class="sub">Propriétaire : <b>' + esc(Engine.P(s, pr.o).name) + '</b>' + (pr.m ? ' (hypothéquée)' : '') +
      (pr.h ? ' · ' + (pr.h === 5 ? 'villa' : pr.h + ' maison' + (pr.h > 1 ? 's' : '')) : '') + '</p>' : '<p class="sub">Libre</p>';
    return '<div class="tcard"><div class="head" style="background:' + col + ';' + head + '">' + (b.icon || '') + ' ' + esc(title) + '</div><table>' + rows + '</table></div>' + owner + manage(s, i);
  }
  function prop(i) { show(() => propHTML(i)); }

  function mine(pid) {
    show(() => {
      const s = G.state, p = Engine.P(s, pid);
      if (!p) return '<p>Joueur inconnu.</p>';
      const idxs = Object.keys(s.props).map(Number).filter(i => s.props[i].o === pid).sort((a, b) => a - b);
      let h = '<h3>' + esc(p.name) + ' · ' + Engine.fmt(p.money) + '</h3><p class="sub">Fortune totale : ' + Engine.fmt(Engine.netWorth(s, p)) +
        (p.jc.length ? ' · 🃏 ×' + p.jc.length : '') + '</p><div class="mylist">';
      if (!idxs.length) h += '<p class="sub">Aucun terrain pour l\'instant.</p>';
      idxs.forEach(i => {
        const b = BOARD[i], pr = s.props[i];
        const c = b.g ? GROUPS[b.g].color : '#ddd';
        h += '<div class="myp"><span class="dot" style="background:' + c + '"></span><span class="nm" data-prop="' + i + '">' + esc(b.name) +
          (pr.m ? ' 🔒' : '') + (pr.h ? ' ' + (pr.h === 5 ? '🏰' : '🏠'.repeat(pr.h)) : '') + '</span></div>' + manage(s, i);
      });
      return h + '</div>';
    });
  }

  function card(e) {
    return new Promise(res => {
      const s = G.state, p = Engine.P(s, e.pid), m = box();
      fn = null; clearTimeout(cardTimer);
      m.hidden = false;
      m.innerHTML = '<div class="mbox"><div class="cardflip"><div class="cardface ' + e.deck + '"><b>' +
        (e.deck === 'chance' ? '❓ CHANCE' : '📦 CAISSE DE COMMUNAUTÉ') + '</b><img src="img/lenaic.png" alt=""><div>' +
        esc(e.txt) + '</div><small>' + esc(p ? p.name : '') + '</small></div></div></div>';
      FX.sound('card');
      const done = () => { clearTimeout(cardTimer); m.onclick = null; close(); res(); };
      cardTimer = setTimeout(done, 3200); m.onclick = done;
    });
  }

  return { prop, mine, card, close, rerender };
})();
