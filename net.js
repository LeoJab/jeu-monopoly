// Réseau (salles ChadGang), mode même écran, classement. L'hôte (1er de la salle) fait foi.
(function () {
  const hasSDK = !!window.ChadGang;
  let salle = null, code = null, hello = {}, myTok = 0, roster = [], absent = {}, reported = null, toastT = null;
  let myName = 'Joueur', myAvatar = null;
  const LS = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const LSset = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  function err(msg) { $('#lobbyErr').textContent = msg || ''; if (msg && G.state) { FX.sound('bad'); FX.floatText(null, msg, '#e0262b'); } }
  function show(id) { ['#lobby', '#game'].forEach(x => $(x).hidden = x !== id); }

  // ---------- Démarrage ----------
  async function init() {
    myName = LS('molopony_pseudo') || 'Joueur';
    if (hasSDK) {
      try {
        const me = await ChadGang.me();
        if (me) { myName = me.name || myName; myAvatar = me.avatar || null; G.meId = me.id; }
      } catch (e) {}
    }
    $('#pseudo').value = myName;
    if (!hasSDK) { $('#tabOnline').disabled = true; switchTab('local'); $('#lobbyErr').textContent = ''; }
    const room = hasSDK && ChadGang.room && ChadGang.room();
    if (room) { $('#code').value = room.toUpperCase(); joinRoom(room, false); }
    else $('#code').value = LS('molopony_code') || '';
  }

  function switchTab(t) {
    $('#paneOnline').hidden = t !== 'online'; $('#paneLocal').hidden = t !== 'local';
    $('#tabOnline').classList.toggle('on', t === 'online'); $('#tabLocal').classList.toggle('on', t === 'local');
    $('#tabOnline').classList.toggle('alt', t !== 'online'); $('#tabLocal').classList.toggle('alt', t !== 'local');
    if (t === 'local') renderLocalList();
  }
  $('#tabOnline').onclick = () => switchTab('online');
  $('#tabLocal').onclick = () => switchTab('local');

  // ---------- Même écran ----------
  let localNames = ['Joueur 1', 'Joueur 2'];
  function renderLocalList() {
    $('#localList').innerHTML = localNames.map((n, i) =>
      '<div class="pitem"><div class="tok big' + (TOKENS[i].img ? ' chip' : '') + '" style="--c:' + PLAYER_COLORS[i] + '">' + (TOKENS[i].img ? '<img src="' + TOKENS[i].img + '">' : TOKENS[i].emoji) + '</div>' +
      '<input type="text" maxlength="16" data-i="' + i + '" value="' + esc(n) + '">' +
      (localNames.length > 2 ? '<button class="btn sm bad" data-del="' + i + '">✕</button>' : '') + '</div>').join('');
    $('#localList').querySelectorAll('input').forEach(inp => inp.oninput = () => { localNames[+inp.dataset.i] = inp.value; });
    $('#localList').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { localNames.splice(+b.dataset.del, 1); renderLocalList(); });
    $('#btnAddLocal').disabled = localNames.length >= 8;
  }
  $('#btnAddLocal').onclick = () => { if (localNames.length < 8) { localNames.push('Joueur ' + (localNames.length + 1)); renderLocalList(); } };
  $('#btnStartLocal').onclick = () => {
    const list = localNames.map((n, i) => ({ id: 'L' + i, name: (n || '').trim() || 'Joueur ' + (i + 1), tok: i }));
    G.local = true; G.meId = null; G.host = true;
    startState(Engine.newGame(list, 'LOCAL-' + Date.now().toString(36)));
  };

  // ---------- Salles en ligne ----------
  $('#btnCreate').onclick = () => {
    const c = ($('#code').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || randomCode();
    joinRoom(c, true);
  };
  $('#btnJoin').onclick = () => {
    const c = ($('#code').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!c) return err('Entre le code de la salle.');
    joinRoom(c, false);
  };
  function randomCode() { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 4; i++) c += a[Math.floor(Math.random() * a.length)]; return c; }

  function joinRoom(c, create) {
    if (salle) return;
    code = c.toUpperCase(); myName = ($('#pseudo').value || myName).trim().slice(0, 20) || myName;
    LSset('molopony_pseudo', myName); LSset('molopony_code', code);
    G.local = false;
    salle = ChadGang.join(code, { create });
    salle.on('error', m => { err(String(m || 'Salle introuvable ou pleine.')); salle = null; });
    salle.on('ready', info => {
      G.meId = info.me; roster = info.players || []; refreshHost();
      showRoom();
      sendHello();
      if (info.last && info.last.t === 'state') onState(info.last.s);
    });
    salle.on('players', list => { roster = list; refreshHost(); sendHello(); refreshRoom(); watchAbsent(); });
    salle.on('message', (d, from) => onMessage(d, from));
  }
  function refreshHost() { G.host = roster.length > 0 && roster[0].id === G.meId; }
  function sendHello() {
    if (!salle) return;
    salle.send({ t: 'hello', name: myName, avatar: myAvatar, tok: myTok });
  }

  function showRoom() {
    $('#menu').hidden = true; $('#room').hidden = false; $('#roomCode').textContent = code; show('#lobby');
    refreshRoom();
  }
  function refreshRoom() {
    if (!salle || $('#room').hidden) return;
    const used = {};
    roster.forEach(p => { const h = hello[p.id]; if (h && h.tok != null && p.id !== G.meId) used[h.tok] = true; });
    $('#roomList').innerHTML = roster.map((p, i) => {
      const h = hello[p.id] || {}, name = h.name || p.name;
      const tok = p.id === G.meId ? myTok : (h.tok != null ? h.tok : i);
      const t = TOKENS[tok % TOKENS.length];
      return '<div class="pitem"><div class="tok big' + (t.img ? ' chip' : '') + '" style="--c:' + PLAYER_COLORS[i % 8] + '" data-chadgang-id="' + esc(p.id) + '">' +
        (t.img ? '<img src="' + t.img + '">' : t.emoji) + '</div><span class="nm">' + esc(name) + (i === 0 ? ' 👑 hôte' : '') + (p.id === G.meId ? ' (toi)' : '') + '</span></div>';
    }).join('') +
      '<div class="sub">Ton pion :</div><div class="tokpick">' + TOKENS.map((t, i) =>
        '<button data-t="' + i + '" class="' + (i === myTok ? 'on' : '') + '" title="' + esc(t.name) + '"' + (used[i] ? ' disabled' : '') + '>' +
        (t.img ? '<img src="' + t.img + '">' : t.emoji) + '</button>').join('') + '</div>';
    $('#roomList').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { myTok = +b.dataset.t; sendHello(); refreshRoom(); });
    $('#btnStart').hidden = !G.host;
    $('#btnStart').disabled = roster.length < 2;
    $('#roomHint').textContent = G.host ? (roster.length < 2 ? 'Attends au moins un ami…' : 'Tout le monde est là ? Lance !') : 'L\'hôte lancera la partie.';
  }
  $('#btnLeave').onclick = leave;
  function leave() {
    if (salle) { try { salle.leave(); } catch (e) {} salle = null; }
    G.state = null; G.local = false; hello = {}; roster = []; reported = null; refused = {}; UI.reset();
    $('#menu').hidden = false; $('#room').hidden = true; show('#lobby');
    if (!hasSDK) switchTab('local');
  }
  G.quit = leave;

  $('#btnStart').onclick = () => {
    if (!G.host || roster.length < 2) return;
    const used = new Set(), list = roster.map((p, i) => {
      const h = hello[p.id] || {};
      let tok = p.id === G.meId ? myTok : (h.tok != null ? h.tok : i);
      if (used.has(tok)) tok = TOKENS.findIndex((_, k) => !used.has(k));
      used.add(tok);
      return { id: p.id, name: (h.name || p.name), avatar: h.avatar || null, tok };
    });
    startState(Engine.newGame(list, code + '-' + Date.now().toString(36)));
  };
  G.newGame = () => {
    if (G.local) { const l = G.state.players.map((p, i) => ({ id: p.id, name: p.name, tok: p.tok })); startState(Engine.newGame(l, 'LOCAL-' + Date.now().toString(36))); return; }
    if (!G.host) return;
    const l = G.state.players.filter(p => roster.some(r => r.id === p.id)).map(p => ({ id: p.id, name: p.name, avatar: p.avatar, tok: p.tok }));
    if (l.length < 2) return err('Il faut au moins 2 joueurs.');
    reported = null; startState(Engine.newGame(l, code + '-' + Date.now().toString(36)));
  };

  // ---------- État de partie ----------
  function startState(s) { show('#game'); broadcast(s); onState(s); }
  function broadcast(s) { if (salle) salle.send({ t: 'state', s }, { keep: true }); }
  function onState(s) {
    if (!s || !s.players) return;
    const cur = G.state;
    if (cur && cur.partie === s.partie && s.v <= cur.v) return;
    show('#game');
    UI.update(s);
    maybeReport(s);
    watchAbsent();
  }

  // Envoi d'une action (joueur local ou à distance)
  G.send = (a, pid) => {
    const s = G.state; if (!s) return;
    if (G.local || G.host) {
      const e = Engine.act(s, G.local ? pid : G.meId, a);
      if (e) { err(e); return; }
      if (!G.local) broadcast(s);
      UI.update(s);
      maybeReport(s);
    } else if (salle) salle.send({ t: 'act', a });
  };

  function onMessage(d, from) {
    if (!d || !d.t) return;
    if (d.t === 'hello') { hello[from.id] = d; refreshRoom(); }
    else if (d.t === 'state') { if (from.id !== G.meId) onState(d.s); }
    else if (d.t === 'act') {
      if (!G.host || !G.state) return;
      if (!d.a || ['votestart', 'votecancel', 'forfeit'].includes(d.a.a)) return;
      const e = Engine.act(G.state, from.id, d.a);
      if (e) { salle.send({ t: 'err', to: from.id, msg: e }); return; }
      broadcast(G.state); UI.update(G.state); maybeReport(G.state);
    } else if (d.t === 'err') { if (d.to === G.meId) err(d.msg); }
  }

  // Joueurs absents : au bout de 1 min, l'hôte lance un vote d'exclusion (les autres joueurs décident)
  const ABSENT_MS = 60000;
  let refused = {};
  const hostHere = () => G.state.players.filter(p => !p.out && roster.some(r => r.id === p.id));
  function hostAct(a) {
    const who = hostHere()[0]; if (!who) return;
    if (!Engine.act(G.state, who.id, a)) { broadcast(G.state); UI.update(G.state); maybeReport(G.state); }
  }
  function watchAbsent() {
    if (!G.host || !G.state || G.local || G.state.phase === 'over') return;
    const s = G.state;
    s.players.forEach(p => {
      if (p.out) return;
      const here = roster.some(r => r.id === p.id);
      if (here) {
        clearTimeout(absent[p.id]); delete absent[p.id]; delete refused[p.id];
        if (s.vote && s.vote.target === p.id) hostAct({ a: 'votecancel' });
      } else if (!absent[p.id] && !refused[p.id]) absent[p.id] = setTimeout(() => {
        delete absent[p.id];
        const st = G.state;
        if (!G.host || !st || st.vote || st.phase === 'over' || roster.some(r => r.id === p.id)) return;
        const voters = hostHere().map(x => x.id);
        if (voters.length) hostAct({ a: 'votestart', target: p.id, voters });
        refused[p.id] = true; // un seul vote par absence
      }, ABSENT_MS);
    });
  }

  // Classement all time : chaque joueur déclare SON résultat une seule fois
  function maybeReport(s) {
    if (G.local || s.phase !== 'over' || reported === s.partie) return;
    const me = s.players.find(p => p.id === G.meId);
    if (!me) return;
    reported = s.partie;
    if (window.ChadGang && ChadGang.finPartie) {
      ChadGang.finPartie({ gagne: s.winner === me.id, partie: String(s.partie).slice(0, 64), score: Math.round(Engine.netWorth(s, me)) }).catch(() => {});
    }
  }

  // ---------- Divers ----------
  $('#btnSound').onclick = () => { $('#btnSound').textContent = FX.toggleMute() ? '🔇' : '🔊'; };
  $('#btnSound').textContent = FX.isMuted() ? '🔇' : '🔊';
  $('#btnMine').onclick = () => { if (G.state) Modals.mine(UI.viewer(G.state) || G.state.players[0].id); };
  addEventListener('click', () => { try { FX.sound('turn'); } catch (e) {} }, { once: true });

  init();
})();
