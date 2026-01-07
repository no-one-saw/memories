import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { MongoClient, ObjectId } from 'mongodb';
import multer from 'multer';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const MONGODB_URI = requiredEnv('MONGODB_URI');
const MONGODB_DB = process.env.MONGODB_DB || 'memory_viewer';
const APP_PASSWORD = requiredEnv('APP_PASSWORD');
const SESSION_SECRET = requiredEnv('SESSION_SECRET');

const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db(MONGODB_DB);
const media = db.collection('media');

await media.createIndex({ key: 1 }, { unique: true });
await media.createIndex({ createdAt: -1 });

const app = express();
app.use(express.json({ limit: '2mb' }));

/** @type {Set<string>} */
const sessions = new Set();

/**
 * @param {string | undefined} cookie
 * @returns {Record<string,string>}
 */
function parseCookies(cookie){
  const out = {};
  if (!cookie) return out;
  const parts = cookie.split(';');
  for (const p of parts){
    const idx = p.indexOf('=');
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function newSessionId(){
  const raw = crypto.randomBytes(32).toString('hex');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(raw).digest('hex');
  return `${raw}.${sig}`;
}

/**
 * @param {string} sid
 */
function isValidSessionId(sid){
  const parts = sid.split('.');
  if (parts.length !== 2) return false;
  const [raw, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(raw).digest('hex');
  try{
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  }catch{
    return false;
  }
}

function requireAuth(req, res, next){
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies.mv_session;
  if (!sid || !isValidSessionId(sid) || !sessions.has(sid)){
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safeExt = ext && ext.length <= 12 ? ext : '';
    const base = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cb(null, `${base}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
    files: 200
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies.mv_session;
  const authed = !!(sid && isValidSessionId(sid) && sessions.has(sid));
  res.json({ authed });
});

app.post('/api/login', (req, res) => {
  const pass = typeof req.body?.password === 'string' ? req.body.password : '';
  if (pass !== APP_PASSWORD){
    res.status(401).json({ error: 'invalid_password' });
    return;
  }
  const sid = newSessionId();
  sessions.add(sid);
  res.setHeader('Set-Cookie', `mv_session=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; Path=/`);
  res.json({ ok: true });
});

app.get('/api/media', requireAuth, async (_req, res) => {
  const docs = await media
    .find({}, { projection: { storedName: 0 } })
    .sort({ createdAt: -1 })
    .limit(1000)
    .toArray();
  const out = docs.map(d => ({
    id: String(d._id),
    key: d.key,
    name: d.name,
    kind: d.kind,
    size: d.size,
    lastModified: d.lastModified,
    url: d.url,
    createdAt: d.createdAt
  }));
  res.json({ items: out });
});

app.post('/api/upload', requireAuth, upload.array('files'), async (req, res) => {
  /** @type {import('multer').File[]} */
  // @ts-ignore
  const files = Array.isArray(req.files) ? req.files : [];

  if (!files.length) {
    res.status(400).json({ error: 'No files' });
    return;
  }

  const out = [];
  for (const f of files) {
    const mime = f.mimetype || '';
    const kind = mime.startsWith('image/') ? 'image' : (mime.startsWith('video/') ? 'video' : null);
    if (!kind) continue;

    const name = f.originalname || f.filename;
    const size = Number.isFinite(f.size) ? f.size : 0;

    // Browser doesn't send lastModified in multipart; approximate with upload time.
    const lastModified = Date.now();
    const key = `${name}|${size}|${lastModified}`;
    const url = `/uploads/${encodeURIComponent(f.filename)}`;

    const doc = {
      key,
      name,
      kind,
      size,
      lastModified,
      url,
      storedName: f.filename,
      createdAt: new Date()
    };

    try {
      await media.insertOne(doc);
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 11000) {
        // duplicate key: ignore
      } else {
        throw e;
      }
    }

    out.push(doc);
  }

  const responseItems = out.map(d => ({
    id: String(d._id),
    key: d.key,
    name: d.name,
    kind: d.kind,
    size: d.size,
    lastModified: d.lastModified,
    url: d.url,
    createdAt: d.createdAt
  }));

  res.json({ items: responseItems });
});

app.delete('/api/media/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  if (!id){
    res.status(400).json({ error: 'missing_id' });
    return;
  }

  let _id;
  try{
    _id = new ObjectId(id);
  }catch{
    res.status(400).json({ error: 'invalid_id' });
    return;
  }

  const doc = await media.findOne({ _id });
  if (!doc){
    res.status(404).json({ error: 'not_found' });
    return;
  }

  if (doc.storedName && typeof doc.storedName === 'string'){
    const fp = path.join(uploadsDir, doc.storedName);
    try{ fs.unlinkSync(fp); }catch(e){}
  }

  await media.deleteOne({ _id });
  res.json({ ok: true });
});

app.post('/api/media', requireAuth, async (req, res) => {
  const body = req.body;
  const items = Array.isArray(body?.items) ? body.items : [];

  const docs = [];
  for (const it of items) {
    const key = typeof it?.key === 'string' ? it.key : null;
    const name = typeof it?.name === 'string' ? it.name : null;
    const kind = it?.kind === 'image' || it?.kind === 'video' ? it.kind : null;
    const size = Number.isFinite(it?.size) ? it.size : null;
    const lastModified = Number.isFinite(it?.lastModified) ? it.lastModified : null;

    if (!key || !name || !kind || size === null || lastModified === null) continue;

    docs.push({
      key,
      name,
      kind,
      size,
      lastModified,
      createdAt: new Date()
    });
  }

  if (docs.length === 0) {
    res.status(400).json({ error: 'No valid items' });
    return;
  }

  const results = { inserted: 0, skipped: 0 };
  for (const doc of docs) {
    try {
      await media.insertOne(doc);
      results.inserted++;
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 11000) {
        results.skipped++;
        continue;
      }
      throw e;
    }
  }

  res.json(results);
});

app.get('/login', (_req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Login</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    margin:0;
    min-height:100vh;
    display:grid;
    place-items:center;
    background:
      radial-gradient(1000px 600px at 15% 10%, rgba(124,92,255,.22), transparent 60%),
      radial-gradient(900px 520px at 80% 25%, rgba(34,211,238,.18), transparent 55%),
      #0b1020;
    color:#eaf0ff;
  }
  .shell{width:min(520px,92vw);}
  .top{
    display:flex;
    align-items:center;
    justify-content:space-between;
    margin-bottom:10px;
    padding:0 6px;
  }
  .brand{display:flex; align-items:center; gap:10px}
  .dot{width:12px; height:12px; border-radius:999px; background:linear-gradient(135deg,#7c5cff,#22d3ee); box-shadow:0 10px 30px rgba(34,211,238,.15)}
  .brand h1{margin:0; font-size:14px; letter-spacing:.2px; font-weight:800}
  .pill{font-size:11px; color:rgba(234,240,255,.78); border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); padding:6px 10px; border-radius:999px}
  .card{
    border-radius:18px;
    padding:18px;
    background:rgba(255,255,255,.06);
    border:1px solid rgba(255,255,255,.12);
    box-shadow: 0 28px 70px rgba(0,0,0,.45);
    backdrop-filter: blur(10px);
  }
  .title{margin:2px 0 6px; font-size:16px; font-weight:850}
  .sub{margin:0 0 14px; color:rgba(234,240,255,.70); font-size:12.5px; line-height:1.55}
  .row{display:flex; gap:10px; align-items:center}
  .field{position:relative; flex:1}
  input{
    width:100%;
    padding:12px 44px 12px 12px;
    border-radius:14px;
    border:1px solid rgba(255,255,255,.14);
    background:rgba(0,0,0,.22);
    color:#eaf0ff;
    outline:none;
  }
  input:focus{border-color:rgba(34,211,238,.55); box-shadow:0 0 0 4px rgba(34,211,238,.12)}
  .toggle{
    position:absolute;
    right:10px;
    top:50%;
    transform:translateY(-50%);
    border:0;
    background:transparent;
    color:rgba(234,240,255,.72);
    cursor:pointer;
    padding:8px;
    border-radius:10px;
  }
  .toggle:hover{background:rgba(255,255,255,.06)}
  .btn{
    width:100%;
    margin-top:10px;
    padding:12px 12px;
    border-radius:14px;
    border:0;
    font-weight:850;
    letter-spacing:.2px;
    color:#07101f;
    background:linear-gradient(90deg,#7c5cff,#22d3ee);
    cursor:pointer;
    box-shadow:0 14px 35px rgba(124,92,255,.22);
  }
  .btn:disabled{opacity:.65; cursor:not-allowed}
  .err{margin-top:10px; color:#ffb4b4; font-size:12px; min-height:16px}

  .success{
    position:fixed;
    inset:0;
    display:grid;
    place-items:center;
    opacity:0;
    pointer-events:none;
    background:
      radial-gradient(900px 520px at 55% 40%, rgba(124,92,255,.22), transparent 60%),
      radial-gradient(900px 520px at 45% 55%, rgba(34,211,238,.18), transparent 55%),
      rgba(11,16,32,.92);
    backdrop-filter: blur(10px);
    transition: opacity 260ms ease;
  }
  .success .box{
    display:flex;
    align-items:center;
    gap:10px;
    padding:10px 14px;
    border-radius:999px;
    border:1px solid rgba(255,255,255,.14);
    background:rgba(255,255,255,.06);
    box-shadow:0 26px 80px rgba(0,0,0,.55);
  }
  .success .spark{
    width:12px;
    height:12px;
    border-radius:999px;
    background:linear-gradient(135deg,#7c5cff,#22d3ee);
    animation: pop 800ms ease-in-out infinite;
  }
  .success .txt{font-weight:900; letter-spacing:.2px; font-size:14px}

  @keyframes pop{
    0%,100%{transform:scale(1); filter:brightness(1)}
    50%{transform:scale(1.25); filter:brightness(1.15)}
  }

  body.ok .success{opacity:1}
  body.ok .card{transform:scale(.985); filter:blur(.3px); opacity:.88}
  .card{transition: transform 260ms ease, filter 260ms ease, opacity 260ms ease}
</style></head>
<body>
  <div class="shell">
    <div class="top">
      <div class="brand"><div class="dot"></div><h1>Nen's Memories</h1></div>
      <div class="pill">Protected</div>
    </div>
    <div class="card">
      <div class="title">Enter password</div>
      <div class="sub">Sign in to view and manage your uploaded media.</div>
      <div class="row">
        <div class="field">
          <input id="pw" type="password" placeholder="Password" autocomplete="current-password" />
          <button class="toggle" id="toggle" type="button" aria-label="Toggle password visibility">Show</button>
        </div>
      </div>
      <button class="btn" id="btn" type="button">Login</button>
      <div class="err" id="err"></div>
    </div>
  </div>
  <div class="success" id="success" aria-hidden="true">
    <div class="box">
      <div class="spark"></div>
      <div class="txt" id="welcome">Welcome</div>
    </div>
  </div>
  <script>
    const pw = document.getElementById('pw');
    const btn = document.getElementById('btn');
    const toggle = document.getElementById('toggle');
    const err = document.getElementById('err');
    const welcome = document.getElementById('welcome');
    async function go(){
      err.textContent = '';
      const password = pw.value;
      btn.disabled = true;
      btn.textContent = 'Logging in…';
      let ok = false;
      try{
        const res = await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});
        if(!res.ok){ err.textContent = 'Wrong password'; return; }
        ok = true;
        welcome.textContent = "Welcome back";
        document.body.classList.add('ok');
        setTimeout(()=>{ location.href = '/'; }, 720);
      } finally {
        if (!ok){
          btn.disabled = false;
          btn.textContent = 'Login';
        }
      }
    }
    btn.addEventListener('click', go);
    pw.addEventListener('keydown', (e)=>{ if(e.key==='Enter') go(); });
    toggle.addEventListener('click', ()=>{
      const isPw = pw.type === 'password';
      pw.type = isPw ? 'text' : 'password';
      toggle.textContent = isPw ? 'Hide' : 'Show';
      pw.focus();
    });
  </script>
</body></html>`);
});

app.use('/api', requireAuth);
app.use('/uploads', requireAuth, express.static(uploadsDir));

app.get('/', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies.mv_session;
  if (!sid || !isValidSessionId(sid) || !sessions.has(sid)){
    res.redirect('/login');
    return;
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies.mv_session;
  if (!sid || !isValidSessionId(sid) || !sessions.has(sid)){
    res.redirect('/login');
    return;
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

const port = Number(process.env.PORT || 5173);
app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
