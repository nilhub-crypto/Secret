// ============================================================
//  SGIC — Secret Game Info Catcher — Node.js Backend
//  Deploy on Render.com — free tier works fine
//  Routes:
//    POST /sgic/payload      ← executor posts here
//    GET  /                  ← dashboard
//    GET  /api/payloads      ← list all captures
//    GET  /api/payload/:id   ← fetch one capture
//    DELETE /api/payload/:id ← delete one
// ============================================================

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;  // Render injects PORT automatically

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// POST /sgic/payload — executor hits this
app.post('/sgic/payload', (req, res) => {
  const body = req.body;
  if (!body || !body.game) return res.status(400).json({ error: 'missing game object' });

  const id       = crypto.randomBytes(6).toString('hex');
  const filename = `${id}_${body.game.id || 'unknown'}.json`;
  const record   = {
    _id        : id,
    _filename  : filename,
    _receivedAt: new Date().toISOString(),
    _userId    : req.headers['x-sgic-client'] || 'unknown',
    ...body,
  };

  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(record, null, 2));
  console.log(`[SGIC] payload saved — id=${id} game=${body.game.name}`);

  res.json({ ok: true, id, viewUrl: `/api/payload/${id}` });
});

// GET /api/payloads — history list
app.get('/api/payloads', (req, res) => {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  const list  = files.map(f => {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
      return {
        id         : d._id,
        receivedAt : d._receivedAt,
        userId     : d._userId,
        gameName   : d.game?.name,
        placeId    : d.game?.placeId,
        gameId     : d.game?.id,
        scriptCount: (d.scripts?.length||0)+(d.localScripts?.length||0)+(d.moduleScripts?.length||0),
        remoteCount: (d.remotes?.length||0)+(d.remoteFunctions?.length||0),
      };
    } catch { return null; }
  }).filter(Boolean).sort((a,b)=>new Date(b.receivedAt)-new Date(a.receivedAt));
  res.json(list);
});

// GET /api/payload/:id
app.get('/api/payload/:id', (req, res) => {
  const { id } = req.params;
  if (!/^[a-f0-9]{12}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  const file = fs.readdirSync(DATA_DIR).find(f => f.startsWith(id));
  if (!file) return res.status(404).json({ error: 'not found' });
  res.setHeader('Content-Type', 'application/json');
  res.send(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
});

// DELETE /api/payload/:id
app.delete('/api/payload/:id', (req, res) => {
  const { id } = req.params;
  if (!/^[a-f0-9]{12}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  const file = fs.readdirSync(DATA_DIR).find(f => f.startsWith(id));
  if (!file) return res.status(404).json({ error: 'not found' });
  fs.unlinkSync(path.join(DATA_DIR, file));
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SGIC] running on port ${PORT}`);
});
