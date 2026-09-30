---
name: qa-jeu
description: QA de Carlito Fighter (le jeu de combat à grosses têtes façon Street Fighter 2 de ce repo : arcade contre l'IA à 3 niveaux, à 2 sur le même écran, ou en ligne) — lance la suite de tests automatisés (coups, parades haute/basse, coups spéciaux et recharge, K.O. et manches, temps écoulé, niveaux d'IA, mode en ligne) via le mode ?debug, vérifie le rendu desktop et mobile paysage (joystick + boutons POING / PIED / ★), puis corrige et re-teste. Utiliser quand on demande « qa », « teste le jeu », « vérifie que ça marche », ou après toute modification de public/index.html ou server.js.
---

# QA Carlito Fighter

- `public/index.html` : tout le jeu (canvas 960×540, rendu à la densité de l'écran). Visages dans `public/heads/p1.png` … `p6.png`.
  Personnages dans `CHARS` (vitesse, saut, vie, force, coup spécial, décor), coups dans `MOVES`, décors dans `STAGES`, IA dans `AI_LEVELS` / `aiThink`.
- `server.js` : sert le jeu **et** fait la mise en relation en ligne (WebSocket sur `…/ws`, dépendance `ws`, `GET api/lobby`).
  Le 1er joueur qui cherche attend ; le 2e lance le combat. L'hôte (role 0, J1 rouge) fait tourner le combat et envoie
  l'état à chaque image ; l'invité (role 1, J2 bleu) n'envoie que ses commandes (`x`, `y` et les compteurs `p k s u`).

La QA teste le jeu **image par image** grâce au mode `?debug`. Le panneau navigateur est souvent masqué, et
`requestAnimationFrame` y est alors en pause : un écran figé n'est pas forcément un bug. On pilote avec `window.__hb`.

## 1. Lancer le jeu

- `npm install` une fois (installe `ws`), puis `preview_start` `{ name: "carlito-fighter" }` : la config dans
  `C:\Users\lesma\Github\.claude\launch.json` lance `node CarlitoFighter/server.js` sur le port 8195.
  Hors de cette machine : `PORT=8195 node server.js`. **Pas de `python -m http.server`** : il n'a pas de WebSocket.
- Ouvre `http://localhost:8195/?debug&v=<valeur unique>`, vérifie `read_console_messages` (aucune erreur).
  **Change `v` à chaque rechargement après une modification.** Après une modification de `server.js`, redémarre la preview.
- **Si le panneau est masqué**, le canvas fait 0 × 0 : `resize_window` 960×540 avant les tests tactiles et les captures.

## 2. API de debug (`window.__hb`, seulement avec `?debug`)

| Appel | Effet |
|---|---|
| `start(a, b, { mode, ai })` | Combat direct (écran VS et « FIGHT » sautés), J1 perso `a`, J2 perso `b` (0 à 5). `mode` : `local` (défaut), `ai`, `online`. `ai: [niveau J1, niveau J2]` (0 facile, 1 moyen, 2 difficile, `null` = humain) — l'IA peut jouer contre l'IA |
| `toMenu()` / `chooseMenu(k)` / `toSelect()` | Menu (0-2 = arcade facile/moyen/difficile, 3 = 2 joueurs, 4 = en ligne), puis choix des persos |
| `key(code)` / `tap(x, y)` | Appui de menu (`ArrowDown`, `Enter`, `KeyF`, `Escape`…) / toucher en coordonnées du jeu (grille des persos : x = 352, 480, 608 ; y = 222, 350) |
| `run(n)` | Avance de `n` images (60 par seconde) |
| `press(i, k)` / `release(i, k)` / `releaseAll()` | Joueur `i` (0 = J1, 1 = J2), touche `left`, `right`, `up`, `down`, `p` (poing), `k` (pied), `s` (spécial) |
| `info()` | `{ state, mode, aiLevel, aiSlots, me, round, wins, timeLeft, pick, ready, touchMode, koMsg, roundWin, endNote, stage, ladder, ladderIdx, net }` — `state` : `menu`, `select`, `wait`, `vs`, `intro`, `fight`, `ko`, `end` |
| `players()` / `projectiles()` / `ctl()` / `touches()` | Objets du jeu. Combattant : `x y f hp st move t crouch onGround cd inv guard ko` ; `st` : `free`, `atk`, `hit`, `block`, `down`, `win` |
| `setHp(i, v)` / `setTime(s)` / `setTouchMode(b)` / `render()` | PV, chrono, mode tactile (boutons à l'écran), redessin (obligatoire avant une capture si le panneau est masqué) |
| `consts` / `chars` / `moves` / `menu` / `aiLevels` / `stages` | Constantes et tables du jeu |

## 3. Suite de tests automatisés

La suite est dans `checks.js`, à côté de ce fichier : 8 tests, dont 1 en ligne (le test simule l'autre joueur avec son
propre WebSocket). Le script est **asynchrone** :

1. `cp .claude/skills/qa-jeu/checks.js public/__checks.js` (fichier dans le `.gitignore`).
2. Dans la page, avec `javascript_tool` :
   ```js
   const src = await fetch('/__checks.js', { cache: 'no-store' }).then((r) => r.text());
   const r = await (0, eval)(src);
   ({ total: r.total, echecs: r.echecs, fails: r.results.filter((x) => !x.ok) })
   ```
3. Supprime `public/__checks.js` à la fin.

Durée : ~15 s (le test « IA » joue une trentaine de combats en accéléré). Tous les tests doivent passer. Le test d'IA
dépend du hasard : un échec isolé se relance une fois avant de chercher un bug. Pour un échec, commence par savoir si
c'est **le jeu** ou **le test** qui est en cause, corrige le bon côté, et ajoute un test pour chaque nouveau bug trouvé.

Règles de jeu que la suite protège :
- Poing à portée seulement ; **parade** = reculer (accroupi contre la balayette `ckick`, debout contre les coups sautés).
- Chaque perso lance **son** spécial (`CHARS[k].sp`), puis doit attendre sa recharge (`cd`). Carlito n'a qu'une boule de soleil à l'écran à la fois.
- K.O. → manche gagnée, manche suivante, **2 manches gagnantes** → fin. Temps écoulé → le plus en vie (en proportion) gagne la manche.
- **IA** : difficile > moyen > facile, jamais de `NaN`, les combats se terminent, l'IA difficile bat un joueur immobile.
- **En ligne** : attente, mise en relation, commandes de l'invité appliquées par l'hôte, départ d'un joueur = fin « Ton adversaire est parti ».

## 4. Contrôles visuels (pas couverts par la suite)

Captures : `start`, `run`, `render()`, puis `computer screenshot`. Vérifie :
- **Menu** : titre, 5 pastilles, les 6 têtes en bas, décor qui change toutes les 5 s. **Choix** : grille 3×2, fiches J1/J2 (stats, spécial), « ← MENU ».
- **Écran VS**, « MANCHE 1 / FIGHT ! », barres de vie (la rouge rattrape la jaune), ronds des manches gagnées, jauge de spécial, chrono.
- **Combattants** : grosse tête détourée sur corps cartoon, poses (garde, coups, accroupi, saut, touché, au sol, victoire).
- **Spéciaux** : boule de soleil à lunettes, charge avec poussière, uppercut avec traînée, onde du Tremblement, fumée violette d'Éclipse, tornade de feu.
- **6 décors** (un par perso, on se bat chez J2) : plage, Paris, dojo, toit la nuit, désert de l'éclipse, volcan (braises animées).
- **K.O.** (ralenti, « K.O. », « X gagne la manche », « PERFECT ! »), **fin** (GAGNÉ / PERDU / CHAMPION ! en arcade, prochain adversaire).
- **Mobile paysage** : `resize_window` 812×375, `setTouchMode(true)`. Pas de défilement, joystick fantôme sous le pouce,
  boutons POING / PIED / ★ en bas à droite (à 2 : vers le centre de chaque moitié), ★ grisé pendant la recharge.
  Remets ensuite le preset `desktop`.

## 5. Ce qui n'est pas testable en local

- Le **son** (Web Audio) et l'**annonceur** (synthèse vocale du navigateur) : signale-les comme non vérifiés.
- Le **vrai jeu en ligne entre deux téléphones** à travers Tailscale et le `hub` Caddy : après déploiement, vérifie depuis ici
  que `wss://games-carlitos.tail736807.ts.net/carlitofighter/ws` accepte une connexion (script node avec `ws`).
- L'équilibre ressenti entre persos par des humains (la suite ne mesure que l'IA contre l'IA).

## 6. Rapport

Termine par un résumé en français : résultat de la suite (X/8, détail des échecs), contrôles visuels faits
(capture si quelque chose a changé), bugs corrigés avec `fichier:ligne`, ce qui n'a pas pu être vérifié.

Ne commite pas sans que l'utilisateur le demande.
