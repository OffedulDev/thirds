const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = __dirname;
const publicDir = path.join(root, 'public');
const dataDir = path.join(root, 'data');
const dataFile = path.join(dataDir, 'workflows.json');
const uploadsDir = path.join(dataDir, 'uploads');
const configFile = path.join(dataDir, 'config.json');
const legacyConfigFile = path.join(root, 'config.json');
const port = Number(process.env.PORT) || 3000;
const clients = new Set();
const sessions = new Map();
const loginAttempts = new Map();
const sessionLifetime = 12 * 60 * 60 * 1000;

function readConfig() {
  if (!fs.existsSync(configFile) && fs.existsSync(legacyConfigFile)) {
    fs.copyFileSync(legacyConfigFile, configFile, fs.constants.COPYFILE_EXCL);
  }
  if (!fs.existsSync(configFile)) {
    const password = crypto.randomBytes(24).toString('base64url');
    fs.writeFileSync(configFile, JSON.stringify({ auth: { username: 'admin', password } }, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(`Configurazione creata in data/config.json. Password iniziale per admin: ${password}`);
  }
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  const username = String(config.auth?.username || '').trim();
  const password = String(config.auth?.password || '');
  if (!username || !password) throw new Error('config.json deve contenere auth.username e auth.password non vuoti.');
  return { username, password };
}
const authConfig = readConfig();

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, JSON.stringify({ workflows: [], activeId: null, overlayEnabled: true, entranceEnabled: false, entranceSequence: 0 }, null, 2));

function readState() {
  try {
    const state = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return {
      workflows: Array.isArray(state.workflows) ? state.workflows.map(item => cleanWorkflow(item)) : [],
      activeId: state.activeId || null,
      overlayEnabled: state.overlayEnabled !== false,
      entranceEnabled: Boolean(state.entranceEnabled),
      entranceSequence: Number(state.entranceSequence) || 0
    };
  } catch {
    return { workflows: [], activeId: null, overlayEnabled: true, entranceEnabled: false, entranceSequence: 0 };
  }
}
let state = readState();

function persist() {
  const temporary = `${dataFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2));
  fs.renameSync(temporary, dataFile);
}
function publish() {
  const message = `data: ${JSON.stringify(state)}\n\n`;
  for (const client of clients) client.write(message);
}
function update() { persist(); publish(); }
function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}
function sessionFor(request) {
  const cookie = String(request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('thirds_session='));
  const token = cookie?.slice('thirds_session='.length);
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, session };
}
function setSessionCookie(request, response, token, maxAge) {
  const secure = request.socket.encrypted || request.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `thirds_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`);
}
function sameSecret(left, right) {
  const leftHash = crypto.createHash('sha256').update(String(left)).digest();
  const rightHash = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}
function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 1000000) { reject(new Error('Richiesta troppo grande.')); request.destroy(); }
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Formato della richiesta non valido.')); }
    });
    request.on('error', reject);
  });
}
function parseImageUpload(request) {
  const contentType = String(request.headers['content-type'] || '').toLowerCase();
  const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
  const extension = extensions[contentType];
  if (!extension) {
    request.resume();
    return Promise.reject(new Error('Carica un file PNG, JPEG, WebP o GIF.'));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    request.on('end', () => {
      if (tooLarge) return reject(new Error('Il logo deve pesare al massimo 5 MB.'));
      const image = Buffer.concat(chunks);
      const valid = contentType === 'image/png'
        ? image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : contentType === 'image/jpeg'
          ? image[0] === 255 && image[1] === 216 && image[2] === 255
          : contentType === 'image/gif'
            ? image.subarray(0, 3).toString('ascii') === 'GIF'
            : image.subarray(0, 4).toString('ascii') === 'RIFF' && image.subarray(8, 12).toString('ascii') === 'WEBP';
      if (!image.length || !valid) return reject(new Error('Il file selezionato non è un’immagine valida.'));
      const filename = `${crypto.randomUUID()}.${extension}`;
      try {
        fs.writeFileSync(path.join(uploadsDir, filename), image, { flag: 'wx' });
        resolve(`/uploads/${filename}`);
      } catch {
        reject(new Error('Non è stato possibile salvare il logo.'));
      }
    });
    request.on('error', reject);
  });
}
function cleanWorkflow(input) {
  const workflow = {
    id: String(input.id || crypto.randomUUID()),
    name: String(input.name || '').trim().slice(0, 100),
    motto: String(input.motto || '').trim().slice(0, 200),
    logo: String(input.logo || '').trim().slice(0, 2000),
    candidates: Array.isArray(input.candidates) ? input.candidates.map(name => String(name).trim().slice(0, 100)).filter(Boolean).slice(0, 100) : []
  };
  if (!workflow.name) throw new Error('Inserisci il nome della lista.');
  if (!workflow.candidates.length) throw new Error('Inserisci almeno un candidato.');
  return workflow;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'GET' && url.pathname === '/api/session') return sendJson(response, 200, { authenticated: Boolean(sessionFor(request)) });
    if (request.method === 'POST' && url.pathname === '/api/login') {
      const clientIp = request.socket.remoteAddress || 'unknown';
      const attempts = loginAttempts.get(clientIp) || { count: 0, windowStart: Date.now() };
      if (Date.now() - attempts.windowStart > 15 * 60 * 1000) { attempts.count = 0; attempts.windowStart = Date.now(); }
      if (attempts.count >= 10) return sendJson(response, 429, { error: 'Troppi tentativi. Riprova tra 15 minuti.' });
      try {
        const body = await parseBody(request);
        if (!sameSecret(body.username, authConfig.username) || !sameSecret(body.password, authConfig.password)) {
          attempts.count++;
          loginAttempts.set(clientIp, attempts);
          return sendJson(response, 401, { error: 'Nome utente o password non corretti.' });
        }
        loginAttempts.delete(clientIp);
        const token = crypto.randomBytes(32).toString('base64url');
        sessions.set(token, { expiresAt: Date.now() + sessionLifetime });
        setSessionCookie(request, response, token, sessionLifetime / 1000);
        return sendJson(response, 200, { authenticated: true });
      } catch (error) {
        return sendJson(response, 400, { error: error.message || 'Accesso non riuscito.' });
      }
    }
    if (request.method === 'POST' && url.pathname === '/api/logout') {
      const current = sessionFor(request);
      if (current) sessions.delete(current.token);
      setSessionCookie(request, response, '', 0);
      return sendJson(response, 200, { authenticated: false });
    }
    if (request.method !== 'GET' && !sessionFor(request)) return sendJson(response, 401, { error: 'Accesso richiesto.' });
    if (request.method === 'POST' && url.pathname === '/api/logos') {
      try { return sendJson(response, 201, { logo: await parseImageUpload(request) }); }
      catch (error) { return sendJson(response, 400, { error: error.message || 'Caricamento del logo non riuscito.' }); }
    }
    if (request.method === 'GET' && url.pathname === '/api/state') return sendJson(response, 200, state);
    if (request.method === 'GET' && url.pathname === '/api/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      response.write(`data: ${JSON.stringify(state)}\n\n`);
      clients.add(response);
      response.on('close', () => clients.delete(response));
      return;
    }
    try {
      const body = await parseBody(request);
      if (request.method === 'POST' && url.pathname === '/api/workflows') {
        const workflow = cleanWorkflow(body);
        state.workflows.push(workflow);
        if (!state.activeId) state.activeId = workflow.id;
        update();
        return sendJson(response, 201, workflow);
      }
      const workflowMatch = url.pathname.match(/^\/api\/workflows\/([^/]+)$/);
      if (workflowMatch && request.method === 'PUT') {
        const index = state.workflows.findIndex(item => item.id === decodeURIComponent(workflowMatch[1]));
        if (index < 0) return sendJson(response, 404, { error: 'Lista non trovata.' });
        state.workflows[index] = cleanWorkflow({ ...body, id: state.workflows[index].id });
        update();
        return sendJson(response, 200, state.workflows[index]);
      }
      if (workflowMatch && request.method === 'DELETE') {
        const id = decodeURIComponent(workflowMatch[1]);
        state.workflows = state.workflows.filter(item => item.id !== id);
        if (state.activeId === id) state.activeId = state.workflows[0]?.id || null;
        update();
        return sendJson(response, 200, state);
      }
      if (request.method === 'POST' && url.pathname === '/api/control') {
        if (body.action === 'select' && state.workflows.some(item => item.id === body.id)) {
          if (state.activeId === body.id) state.overlayEnabled = !state.overlayEnabled;
          else {
            state.activeId = body.id;
            state.overlayEnabled = true;
          }
          if (state.entranceEnabled && state.overlayEnabled) state.entranceSequence++;
        } else if (body.action === 'toggle-entrance') {
          state.entranceEnabled = !state.entranceEnabled;
        } else return sendJson(response, 400, { error: 'Comando di controllo sconosciuto.' });
        update();
        return sendJson(response, 200, state);
      }
      return sendJson(response, 404, { error: 'Risorsa non trovata.' });
    } catch (error) {
      return sendJson(response, 400, { error: error.message || 'Richiesta non riuscita.' });
    }
  }

  if (url.pathname === '/') {
    response.writeHead(302, { Location: '/admin', 'Cache-Control': 'no-store' });
    return response.end();
  }
  if (url.pathname === '/control') {
    response.writeHead(302, { Location: '/admin/control', 'Cache-Control': 'no-store' });
    return response.end();
  }
  const page = url.pathname === '/admin' || url.pathname === '/admin/create' ? 'admin.html' : url.pathname === '/admin/control' ? 'control.html' : url.pathname === '/login' ? 'login.html' : url.pathname === '/overlay' ? 'overlay.html' : url.pathname === '/lists-overlay' ? 'lists-overlay.html' : null;
  if (page === 'admin.html' || page === 'control.html') {
    if (!sessionFor(request)) {
      response.writeHead(302, { Location: `/login?next=${encodeURIComponent(url.pathname)}`, 'Cache-Control': 'no-store' });
      return response.end();
    }
  } else if (page === 'login.html' && sessionFor(request)) {
    response.writeHead(302, { Location: '/admin', 'Cache-Control': 'no-store' });
    return response.end();
  }
  const requested = page || (url.pathname.startsWith('/') ? url.pathname.slice(1) : '');
  if (url.pathname.startsWith('/uploads/')) {
    const filename = path.basename(url.pathname.slice('/uploads/'.length));
    if (!/^[\da-f-]+\.(png|jpg|webp|gif)$/i.test(filename)) return sendJson(response, 404, { error: 'File non trovato.' });
    const file = path.join(uploadsDir, filename);
    const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
    return fs.readFile(file, (error, content) => {
      if (error) return sendJson(response, 404, { error: 'File non trovato.' });
      response.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
      response.end(content);
    });
  }
  const file = path.resolve(publicDir, requested);
  if (file !== publicDir && !file.startsWith(`${publicDir}${path.sep}`)) return sendJson(response, 403, { error: 'Accesso non consentito.' });
  fs.readFile(file, (error, content) => {
    if (error) return sendJson(response, 404, { error: 'Risorsa non trovata.' });
    const ext = path.extname(file);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
    response.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(content);
  });
});

server.listen(port, '0.0.0.0', () => console.log(`Grafiche elettorali attive su http://localhost:${port}`));
