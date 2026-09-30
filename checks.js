// Vérifications automatiques de Carlito Fighter, à lancer dans la page ouverte avec ?debug :
//   const src = await fetch('/__checks.js', { cache: 'no-store' }).then((r) => r.text()); await (0, eval)(src)
// (copie ce fichier dans public/__checks.js le temps du test, il est dans le .gitignore). Durée : ~15 s.
(async () => {
  const h = window.__hb, results = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const check = async (name, fn) => { try { const d = await fn(); results.push({ name, ok: d === true || d === undefined, d }); } catch (e) { results.push({ name, ok: false, d: String(e) }); } };
  const match = (a, b, ai) => {
    h.start(a, b, { ai }); let n = 0, nan = false;
    while (h.info().state !== 'end' && n++ < 20000) { h.run(1); if (h.players().some((p) => !isFinite(p.x + p.y + p.hp))) nan = true; }
    const w = h.info().wins; return { win: w[0] === w[1] ? -1 : w[0] > w[1] ? 0 : 1, nan, ended: h.info().state === 'end' };
  };

  await check('poing touche à portée, pas de loin', () => {
    h.start(0, 3); h.players()[1].x = h.players()[0].x + 70; h.press(0, 'p'); h.run(10); h.releaseAll();
    const near = h.players()[1].hp < h.chars[3].hp;
    h.start(0, 3); h.press(0, 'p'); h.run(10); h.releaseAll();
    return near && h.players()[1].hp === h.chars[3].hp || 'near ' + near;
  });
  await check('parade en reculant (debout) et balayette parée accroupi seulement', () => {
    h.start(0, 3); const [a, b] = h.players(); b.x = a.x + 80;
    h.press(1, 'right'); h.press(0, 'k'); h.run(14); h.releaseAll();
    const blocked = b.hp === h.chars[3].hp;
    h.start(0, 3); h.players()[1].x = h.players()[0].x + 80; h.press(1, 'right'); h.press(0, 'down'); h.press(0, 'k'); h.run(14); h.releaseAll();
    const lowHits = h.players()[1].hp < h.chars[3].hp;
    return blocked && lowHits || { blocked, lowHits };
  });
  await check('chaque spécial se lance et respecte son temps de recharge', () => {
    const bad = [];
    for (let k = 0; k < 6; k++) {
      h.start(k, 0); h.press(0, 's'); h.run(2);
      if (h.players()[0].move !== h.chars[k].sp) bad.push(h.chars[k].name);
      h.run(20); h.releaseAll(); h.press(0, 's'); h.run(2); h.releaseAll();
      if (h.players()[0].cd === 0) bad.push(h.chars[k].name + ' cd');
    }
    return !bad.length || bad;
  });
  await check('K.O. puis manche suivante, 2 manches gagnantes', () => {
    h.start(0, 3); h.setHp(1, 0.5); h.players()[1].x = h.players()[0].x + 70; h.press(0, 'p'); h.run(10); h.releaseAll();
    const ko = h.info().state === 'ko' && h.info().wins[0] === 1;
    h.run(200); const r2 = h.info().state === 'intro' && h.info().round === 2;
    h.run(130); h.setHp(1, 0.5); h.players()[1].x = h.players()[0].x + 70; h.press(0, 'p'); h.run(10); h.releaseAll(); h.run(200);
    return ko && r2 && h.info().state === 'end' || h.info();
  });
  await check('temps écoulé : le plus en vie gagne la manche', () => {
    h.start(0, 3); h.setHp(0, 50); h.setTime(0.01); h.run(2); return h.info().koMsg === 'TEMPS !' && h.info().roundWin === 1 || h.info();
  });
  await check('IA : difficile > moyen > facile, pas de NaN, matchs finis', () => {
    let hm = 0, me = 0, bad = 0;
    for (let g = 0; g < 8; g++) {
      const s = g % 2, a = g % 6, b = (g + 2) % 6;
      const r1 = match(a, b, s ? [1, 2] : [2, 1]); if (r1.win === (s ? 1 : 0)) hm++; if (r1.nan || !r1.ended) bad++;
      const r2 = match(a, b, s ? [0, 1] : [1, 0]); if (r2.win === (s ? 1 : 0)) me++; if (r2.nan || !r2.ended) bad++;
    }
    return hm >= 6 && me >= 6 && !bad || { hm, me, bad };
  });
  await check('IA difficile bat un joueur immobile', () => match(0, 3, [null, 2]).win === 1);
  await check('en ligne : hôte, commandes de l’invité, départ', async () => {
    h.toMenu(); h.chooseMenu(4); h.tap(h.consts.W / 2, 222); await sleep(300);
    const g = new WebSocket('ws://' + location.host + '/ws'); let snaps = 0;
    g.onmessage = (e) => { if (JSON.parse(e.data).t === 's') snaps++; };
    await new Promise((r) => { g.onopen = r; });
    g.send(JSON.stringify({ t: 'find', head: 3 })); await sleep(400);
    h.run(300); g.send(JSON.stringify({ t: 'in', x: 0, y: 0, p: 1, k: 0, s: 0, u: 0 })); await sleep(150); h.run(2);
    const move = h.players()[1].move;
    g.close(); await sleep(300); h.run(1);
    return move === 'punch' && snaps > 50 && h.info().endNote === 'Ton adversaire est parti' || { move, snaps, info: h.info() };
  });
  h.toMenu();
  return { total: results.length, echecs: results.filter((r) => !r.ok).length, results };
})();
