// Serveur de Carlito Fighter : sert le jeu (dossier public) et met en relation les joueurs en ligne.
// Mise en relation : le 1er joueur qui cherche attend, le 2e démarre la partie avec lui.
// Ensuite le serveur relaie seulement les messages entre les deux (l'hôte fait tourner la partie).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const PICKABLE = [0, 1, 2, 4, 5]; // persos jouables (3, Le Boss, est réservé à l'aventure) : même liste que PICKABLE dans index.html

// Tableau d'honneur : ceux qui ont fini l'aventure (battu Le Boss). Gardé dans DATA_DIR/champions.json
// (un volume Docker, pour survivre aux mises à jour). Classement : difficulté, puis le moins de défaites, puis le plus ancien.
// ponytail: le jeu tourne dans le navigateur, un tricheur peut s'inscrire sans jouer ; ok entre potes, sinon valider côté serveur.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CHAMPIONS = path.join(DATA_DIR, 'champions.json');
let champions = [];
try { champions = JSON.parse(fs.readFileSync(CHAMPIONS, 'utf8')); } catch (e) { /* pas encore de champion */ }
const byRank = (a, b) => b.level - a.level || a.losses - b.losses || a.date - b.date;
function addChampion(m) {
  const name = String(m.name || '').replace(/[^\p{L}\p{N} ._'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  const char = m.char, level = m.level, losses = m.losses;
  if (!name || !PICKABLE.includes(char) || ![0, 1, 2].includes(level) || !Number.isInteger(losses) || losses < 0 || losses > 999) return null;
  const entry = { name, char, level, losses, date: Date.now() };
  champions.push(entry);
  champions.sort(byRank);
  champions = champions.slice(0, 100);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFile(CHAMPIONS, JSON.stringify(champions), (err) => err && console.error('champions', err));
  const rank = champions.indexOf(entry) + 1;
  return rank || null;
}
const sendJson = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  // quelqu'un attend-il un adversaire en ligne ? (affiché sur l'accueil du jeu)
  if (p === '/api/lobby') {
    const w = waiting && waiting.readyState === 1;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ waiting: !!w, head: w ? waiting.head : null }));
  }
  if (p === '/api/champions') {
    if (req.method === 'GET') return sendJson(res, 200, champions.slice(0, 20));
    if (req.method !== 'POST') return sendJson(res, 405, {});
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1000) req.destroy(); });
    req.on('end', () => {
      let m; try { m = JSON.parse(body); } catch (e) { return sendJson(res, 400, {}); }
      const rank = addChampion(m);
      if (!rank) return sendJson(res, 400, { error: 'invalide' });
      console.log('champion', champions[rank - 1].name, 'rang', rank);
      sendJson(res, 200, { rank, list: champions.slice(0, 20) });
    });
    return;
  }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(PUB, path.normalize(p));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404'); }
    const ext = path.extname(file);
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream' };
    // la page est revérifiée à chaque visite (sinon Safari garde l'ancienne version)
    if (ext === '.html') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 4096 });
let waiting = null;
const send = (ws, m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    const txt = raw.toString();
    let m;
    try { m = JSON.parse(txt); } catch (e) { return; }
    if (m.t === 'find' && !ws.peer) {
      ws.head = PICKABLE.includes(m.head) ? m.head : PICKABLE[0];
      if (waiting && waiting !== ws && waiting.readyState === 1) {
        const host = waiting; waiting = null;
        host.peer = ws; ws.peer = host;
        const heads = [host.head, ws.head];
        send(host, { t: 'start', role: 0, heads });
        send(ws, { t: 'start', role: 1, heads });
        console.log('partie lancée', heads);
      } else waiting = ws;
    } else if ((m.t === 'in' || m.t === 's') && ws.peer && ws.peer.readyState === 1) {
      ws.peer.send(txt);
    }
  });
  ws.on('close', () => {
    if (waiting === ws) waiting = null;
    if (ws.peer) { send(ws.peer, { t: 'left' }); ws.peer.peer = null; }
  });
});

server.listen(PORT, () => console.log('Carlito Fighter sur le port ' + PORT));
