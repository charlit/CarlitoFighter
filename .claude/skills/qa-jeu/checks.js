// Vérifications automatiques de Carlito Fighter, à lancer dans la page ouverte avec ?debug :
//   const src = await fetch('/__checks.js', { cache: 'no-store' }).then((r) => r.text()); await (0, eval)(src)
// (copie ce fichier dans public/__checks.js le temps du test, il est dans le .gitignore). Durée : ~15 s.
// Mode d'emploi complet : SKILL.md à côté.
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
      h.start(k, k ? 0 : 1); h.press(0, 's'); h.run(2);
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
  await check('menu : AVENTURE puis une page pour la difficulté (clavier et doigt)', () => {
    const bad = [];
    h.toMenu(); h.key('Enter'); // 1re pastille = AVENTURE
    if (h.info().state !== 'level') bad.push('clavier : ' + h.info().state);
    h.key('ArrowDown'); h.key('Enter');
    if (h.info().state !== 'select' || h.info().aiLevel !== 2 || h.info().mode !== 'ai') bad.push('clavier difficile : ' + JSON.stringify(h.info()));
    h.toMenu(); h.tap(h.consts.W / 2, 190); // pastille AVENTURE
    if (h.info().state !== 'level') bad.push('doigt : ' + h.info().state);
    h.tap(h.consts.W / 2, 190); // pastille FACILE
    if (h.info().state !== 'select' || h.info().aiLevel !== 0) bad.push('doigt facile');
    h.toMenu(); h.chooseMenu(0); h.key('Escape'); if (h.info().state !== 'menu') bad.push('échap');
    if (h.menu.some((m) => m.mode === 'local')) bad.push('2 joueurs encore au menu');
    return !bad.length || bad;
  });
  await check('aventure : Le Boss pas jouable, 4 persos puis Le Boss, on avance en gagnant', () => {
    const B = h.boss, bad = [];
    h.toMenu(); h.chooseMenu(0); h.chooseLevel(1);
    for (let n = 0; n < 12; n++) { h.key(n % 3 ? 'ArrowRight' : 'ArrowDown'); if (h.info().pick[0] === B) bad.push('clavier'); }
    h.pickable.forEach((_, j) => { h.toMenu(); h.chooseMenu(0); h.chooseLevel(1); const g = h.gridPos(j); h.tap(g.x, g.y); if (h.info().pick[0] === B) bad.push('doigt'); });
    const { ladder, pick } = h.info();
    if (ladder.length !== 5 || ladder[4] !== B || ladder.includes(pick[0]) || new Set(ladder).size !== 5) bad.push('parcours ' + ladder);
    // gagner les 5 combats : adversaire suivant à chaque fois, puis retour au menu
    for (let f = 0; f < 5; f++) {
      h.run(300); if (h.info().pick[1] !== ladder[f]) bad.push('adversaire ' + f);
      for (let r = 0; r < 2; r++) { h.run(130); h.setHp(1, 0); h.run(2); h.run(200); }
      if (h.info().state !== 'end') { bad.push('fin ' + f + ' ' + h.info().state); break; }
      h.run(70); h.key('Enter');
    }
    if (h.info().state !== 'register') bad.push('après le Boss : ' + h.info().state);
    h.key('Escape'); if (h.info().state !== 'menu') bad.push('échap inscription');
    return !bad.length || bad;
  });
  await check('tableau d’honneur : on s’inscrit après Le Boss, le serveur trie et refuse le n’importe quoi', async () => {
    const bad = [], post = (b) => fetch('/api/champions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    // saisie du nom après la victoire contre Le Boss (2 défaites dans l'aventure)
    h.toMenu(); h.chooseMenu(0); h.chooseLevel(2); h.tap(h.gridPos(0).x, h.gridPos(0).y);
    for (let f = 0; f < 5; f++) {
      if (f === 0) for (let l = 0; l < 2; l++) { h.run(300); for (let r = 0; r < 2; r++) { h.run(130); h.setHp(0, 0); h.run(2); h.run(200); } h.run(70); h.key('Enter'); }
      h.run(300); for (let r = 0; r < 2; r++) { h.run(130); h.setHp(1, 0); h.run(2); h.run(200); } h.run(70); h.key('Enter');
    }
    const form = document.getElementById('reg');
    if (h.info().state !== 'register' || form.hidden) bad.push('pas de saisie : ' + h.info().state);
    if (h.advLosses() !== 2) bad.push('défaites ' + h.advLosses());
    const name = 'QA' + (Date.now() % 1e6);
    document.getElementById('regName').value = name;
    await h.submitChampion();
    const me = (h.champions() || []).find((c) => c.name === name);
    if (h.info().state !== 'champions' || !form.hidden || !h.myRank() || !me || me.level !== 2 || me.losses !== 2 || me.char !== h.pickable[0]) bad.push('inscription ' + JSON.stringify({ st: h.info().state, rank: h.myRank(), me }));
    // tri : difficulté puis moins de défaites
    const l = h.champions(); for (let i = 1; i < l.length; i++) if (l[i - 1].level < l[i].level || (l[i - 1].level === l[i].level && l[i - 1].losses > l[i].losses)) bad.push('tri ' + i);
    // le serveur refuse : Le Boss, nom vide, difficulté inconnue ; il nettoie les noms
    for (const b of [{ name: 'X', char: h.boss, level: 0, losses: 0 }, { name: '  ', char: 0, level: 0, losses: 0 }, { name: 'X', char: 0, level: 7, losses: 0 }, { name: 'X', char: 0, level: 0, losses: -1 }]) if ((await post(b)).status !== 400) bad.push('accepté ' + JSON.stringify(b));
    const j = await (await post({ name: '<b>Zo\u0000é</b> très long nom', char: 0, level: 0, losses: 99 })).json();
    const cleaned = j.list.find((c, i) => i + 1 === j.rank) || {}; // il est peut-être hors du top 20 : on regarde seulement s'il y est
    if (j.rank <= 20 && (cleaned.name.length > 12 || /[<>\u0000]/.test(cleaned.name))) bad.push('nom pas nettoyé ' + cleaned.name);
    // menu CHAMPIONS
    h.toMenu(); h.chooseMenu(2); if (h.info().state !== 'champions') bad.push('menu champions');
    await sleep(300); if (!Array.isArray(h.champions())) bad.push('liste pas chargée');
    h.key('Enter'); if (h.info().state !== 'menu') bad.push('retour menu');
    return !bad.length || bad;
  });
  await check('en ligne : le serveur refuse Le Boss', async () => {
    const ws = new WebSocket('ws://' + location.host + '/ws');
    await new Promise((r) => { ws.onopen = r; });
    ws.send(JSON.stringify({ t: 'find', head: h.boss })); await sleep(200);
    const l = await fetch('/api/lobby', { cache: 'no-store' }).then((r) => r.json());
    ws.close(); await sleep(200);
    return l.waiting && l.head !== h.boss || l;
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
    h.toMenu(); h.chooseMenu(1); h.tap(h.consts.W / 2, 222); await sleep(300);
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
