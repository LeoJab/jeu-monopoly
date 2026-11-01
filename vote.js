// Vote d'exclusion d'un joueur déconnecté : bandeau affiché à tous les joueurs.
const Vote = (function () {
  function el() {
    let d = document.getElementById('vote');
    if (!d) { d = document.createElement('div'); d.id = 'vote'; d.hidden = true; document.body.appendChild(d); }
    return d;
  }
  function render(s) {
    const d = el(), v = s && s.vote;
    if (!v || s.phase === 'over') { d.hidden = true; d.innerHTML = ''; return; }
    const t = s.players.find(p => p.id === v.target);
    const me = G.meId, can = v.voters.includes(me) && !v.yes.includes(me) && !v.no.includes(me);
    const n = v.voters.length;
    let h = '<b>🗳️ ' + esc(t ? t.name : '?') + ' est déconnecté</b><span>Exclure ce joueur de la partie ? (' + v.yes.length + ' oui · ' + v.no.length + ' non · ' + n + ' votant' + (n > 1 ? 's' : '') + ')</span>';
    if (can) h += '<div class="row"><button class="btn sm bad" data-v="1">Exclure</button><button class="btn sm go" data-v="0">Attendre</button></div>';
    else if (v.voters.includes(me)) h += '<span>Vote enregistré ✔</span>';
    else h += '<span>Les autres joueurs votent…</span>';
    d.innerHTML = h; d.hidden = false;
    d.querySelectorAll('[data-v]').forEach(b => b.onclick = () => G.send({ a: 'vote', yes: b.dataset.v === '1' }));
  }
  return { render };
})();
