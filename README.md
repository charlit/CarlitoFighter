# Carlito Fighter

Jeu de combat façon *Street Fighter 2*, avec les grosses têtes de Carlito Soccer. Deux façons de jouer :

- **Aventure contre l'IA** : on choisit AVENTURE, puis la difficulté sur la page suivante (facile, moyen, difficile), puis on affronte un à un les 4 autres
  combattants et enfin **Le Boss**. L'écran VS montre le parcours (adversaires battus ✔, combat en cours, Le Boss au bout).
  Perdu ? On retente le même adversaire. **Le Boss n'est pas jouable** (ni en aventure, ni en ligne).
  **Battre Le Boss** permet de s'inscrire au **tableau d'honneur** (menu CHAMPIONS) : on tape son nom, et le classement
  se fait par difficulté puis par nombre de défaites pendant l'aventure. La liste est gardée par le serveur (`data/champions.json`).
- **En ligne** : on attend qu'un autre joueur choisisse « En ligne », le combat démarre tout seul
  (l'accueil affiche quand quelqu'un attend déjà).

Combats en 2 manches gagnantes de 60 s, K.O. ou temps écoulé (le plus en vie gagne). On se bat dans le décor de J2.

Le jeu tient dans `public/index.html`, les visages dans `public/heads/`. `server.js` sert le jeu et met en relation
les joueurs en ligne (WebSocket).

## Les combattants

| | Style | Coup spécial ★ | Décor |
|---|---|---|---|
| **Carlito** | équilibré | Rayon de soleil : boule qui traverse l'écran | Plage |
| **Moustache** | très rapide, frappe fort | Charge moustache : fonce et met au sol | Rue de Paris |
| **Nono** | karatéka | Super uppercut : contre les sauts (on l'évite accroupi) | Dojo |
| **Le Boss** (non jouable, dernier adversaire de l'aventure) | lent, costaud, beaucoup de vie | Tremblement : onde au sol, il faut sauter | Toit du building |
| **Éclipse** | aérien | Éclipse totale : disparaît et frappe dans le dos | Désert de l'éclipse |
| **Maxou** | endurant | Tornade de feu : plusieurs coups en avançant | Volcan |

Les réglages (vitesse, saut, vie, force) sont dans le tableau `CHARS`, les coups (dégâts, portée, vitesse) dans `MOVES`.

## Contrôles

**Clavier** :

| | Au choix |
|---|---|
| Marcher / sauter / s'accroupir | Q D / Z / S, ou ← → / ↑ / ↓ |
| Poing · Pied · Spécial | F · G · H, ou K · L · M (ou pavé num. 1 2 3) |

**Parer** = reculer (accroupi contre les balayettes, debout contre les coups sautés).
Échap = retour au menu.

**Au doigt (téléphone en paysage)** : le pouce gauche est un joystick invisible (glisser ◀ ▶ marcher, ↑ sauter,
↓ s'accroupir) ; à droite, 3 boutons POING · PIED · ★.

## Tester en local

```bash
npm install
```

```bash
PORT=8195 node server.js
```

Puis `http://localhost:8195/?debug` (API de test `window.__hb`). Les vérifications automatiques sont dans `.claude/skills/qa-jeu/checks.js`
(mode d’emploi dans `SKILL.md` à côté). Pour tester le mode en ligne, ouvre le jeu dans deux onglets et choisis « En ligne ».

## Déployer sur le Mac mini

Première fois :

```bash
git clone https://github.com/charlit/CarlitoFighter.git ~/CarlitoFighter
```

Puis, à chaque mise à jour :

```bash
cd ~/CarlitoFighter && git pull && docker build -t carlito-fighter . && docker rm -f carlito-fighter
```

```bash
docker run -d --name carlito-fighter --restart unless-stopped -p 8087:8080 -v ~/CarlitoFighter-data:/app/data carlito-fighter
```

Le `-v` garde le tableau d'honneur dans `~/CarlitoFighter-data` sur le Mac mini : sans lui, la liste serait perdue
à chaque mise à jour du conteneur.

Puis dans `~/hub/Caddyfile` : `redir /carlitofighter /carlitofighter/` et
`handle_path /carlitofighter/* { reverse_proxy host.docker.internal:8087 }`, et un lien dans `~/hub/site/index.html`.
Le jeu n'utilise que des chemins relatifs (WebSocket compris), il marche sous n'importe quel sous-chemin.
