import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const staticRoot = resolve(projectRoot, 'dist');
// Vercel's filesystem is read-only except /tmp.
const dataDir = resolve(process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/data' : join(projectRoot, 'data')));
mkdirSync(dataDir, { recursive: true });
const database = new DatabaseSync(join(dataDir, 'rsvps.sqlite'));
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    attending TEXT NOT NULL CHECK (attending IN ('yes', 'no')),
    guest_count INTEGER NOT NULL CHECK (guest_count BETWEEN 0 AND 20),
    member_names TEXT NOT NULL DEFAULT '[]',
    submitted_at TEXT NOT NULL
  );
`);

const port = Number.parseInt(process.env.PORT || '3000', 10);
const production = process.env.NODE_ENV === 'production';
const adminUsername = process.env.ADMIN_USERNAME || '';
const adminPassword = process.env.ADMIN_PASSWORD || '';
const sessionSecret = (process.env.SESSION_SECRET || '').length >= 32 ? process.env.SESSION_SECRET : '';
const sessions = new Map();
const rateLimits = new Map();
const SESSION_TTL = 8 * 60 * 60 * 1000;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

function send(response, status, body, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function secureHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; font-src 'self'; script-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) throw Object.assign(new Error('Request is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON.'), { status: 400 });
  }
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.host; } catch { return false; }
}

function passwordMatches(input) {
  if (!adminPassword || typeof input !== 'string') return false;
  const expected = createHash('sha256').update(adminPassword).digest();
  const actual = createHash('sha256').update(input).digest();
  return timingSafeEqual(expected, actual);
}

function hashSession(token) {
  return createHash('sha256').update(token + sessionSecret).digest('hex');
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map(item => {
    const index = item.indexOf('=');
    return [item.slice(0, index).trim(), decodeURIComponent(item.slice(index + 1))];
  }));
}

function isAuthenticated(request) {
  if (!sessionSecret) return false;
  const token = parseCookies(request).djcsession;
  if (!token) return false;
  const key = hashSession(token);
  const expiry = sessions.get(key);
  if (!expiry || expiry < Date.now()) {
    sessions.delete(key);
    return false;
  }
  sessions.set(key, Date.now() + SESSION_TTL);
  return true;
}

function sessionCookie(token, maxAge = SESSION_TTL / 1000) {
  return `djcsession=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production ? '; Secure' : ''}`;
}

function rateLimited(request) {
  const key = request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (rateLimits.get(key) || []).filter(time => now - time < 60_000);
  recent.push(now);
  rateLimits.set(key, recent);
  return recent.length > 10;
}

function serialize(row) {
  return {
    id: row.id, firstName: row.first_name, lastName: row.last_name,
    attending: row.attending, guestCount: row.guest_count,
    memberNames: JSON.parse(row.member_names), submittedAt: row.submitted_at,
  };
}

async function handleApi(request, response, pathname) {
  if (!sameOrigin(request)) return send(response, 403, { error: 'Request origin is not allowed.' });
  if (pathname === '/api/rsvps' && request.method === 'POST') {
    if (rateLimited(request)) return send(response, 429, { error: 'Too many attempts. Please wait a moment and try again.' });
    const body = await readJson(request);
    const submissionId = cleanText(body.submissionId, 80);
    const firstName = cleanText(body.firstName, 60);
    const lastName = cleanText(body.lastName, 60);
    const attending = body.attending === 'yes' || body.attending === 'no' ? body.attending : '';
    const guestCount = attending === 'yes' ? 2 : 0;
    const memberNames = attending === 'yes' && Array.isArray(body.memberNames) ? body.memberNames.map(name => cleanText(name, 100)).filter(Boolean) : [];
    if (memberNames.length > 2) return send(response, 400, { error: 'This invitation is reserved for two named guests.' });
    if (!/^[0-9a-f-]{20,80}$/i.test(submissionId)) return send(response, 400, { error: 'Invalid submission. Please refresh and try again.' });
    if (!firstName || !lastName) return send(response, 400, { error: 'First and last name are required.' });
    if (!attending) return send(response, 400, { error: 'Please choose an attendance response.' });
    const existing = database.prepare('SELECT id, attending, guest_count FROM rsvps WHERE submission_id = ?').get(submissionId);
    if (existing) return send(response, 200, {
      saved: true, id: existing.id, duplicate: true,
      attending: existing.attending, guestCount: existing.guest_count,
    });
    const submittedAt = new Date().toISOString();
    const result = database.prepare(`
      INSERT INTO rsvps (submission_id, first_name, last_name, attending, guest_count, member_names, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(submissionId, firstName, lastName, attending, guestCount, JSON.stringify(memberNames), submittedAt);
    return send(response, 201, {
      saved: true, id: Number(result.lastInsertRowid), attending, guestCount,
    });
  }
  if (pathname === '/api/admin/login' && request.method === 'POST') {
    if (!adminUsername || !adminPassword || !sessionSecret) return send(response, 503, { error: 'Staff login has not been configured.' });
    if (rateLimited(request)) return send(response, 429, { error: 'Too many attempts. Please wait and try again.' });
    const body = await readJson(request);
    const usernameOk = cleanText(body.username, 100) === adminUsername;
    if (!usernameOk || !passwordMatches(body.password)) return send(response, 401, { error: 'Invalid username or password.' });
    const token = randomBytes(32).toString('base64url');
    sessions.set(hashSession(token), Date.now() + SESSION_TTL);
    return send(response, 200, { authenticated: true }, { 'Set-Cookie': sessionCookie(token) });
  }
  if (pathname === '/api/admin/logout' && request.method === 'POST') {
    const token = parseCookies(request).djcsession;
    if (token) sessions.delete(hashSession(token));
    return send(response, 200, { authenticated: false }, { 'Set-Cookie': sessionCookie('', 0) });
  }
  if (pathname === '/api/admin/rsvps' && request.method === 'GET') {
    if (!isAuthenticated(request)) return send(response, 401, { error: 'Authentication required.' });
    const rows = database.prepare('SELECT * FROM rsvps ORDER BY submitted_at DESC').all().map(serialize);
    return send(response, 200, {
      summary: {
        attendingHouseholds: rows.filter(row => row.attending === 'yes').length,
        decliningHouseholds: rows.filter(row => row.attending === 'no').length,
        attendingGuests: rows.reduce((sum, row) => sum + row.guestCount, 0),
      },
      responses: rows,
    });
  }
  return send(response, 404, { error: 'Not found.' });
}

function serveStatic(request, response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  let decoded;
  try { decoded = decodeURIComponent(requested); } catch { return send(response, 400, { error: 'Invalid path.' }); }
  const filePath = resolve(staticRoot, '.' + normalize(decoded));
  const relativePath = relative(staticRoot, filePath);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) return send(response, 403, { error: 'Forbidden.' });
  try {
    const file = statSync(filePath);
    if (!file.isFile()) throw new Error('not a file');
    const extension = extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Cache-Control': ['.html', '.css', '.js'].includes(extension) ? 'no-cache' : 'public, max-age=3600',
      'Content-Length': file.size,
    };
    const isMedia = ['.mp4', '.mp3', '.m4a', '.webm'].includes(extension);
    if (isMedia) headers['Accept-Ranges'] = 'bytes';
    // Safari requests parts of a video before playing it. Serve actual
    // byte ranges so the new opening can load and seek on iPhones.
    if (isMedia && request.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      let start = 0;
      let end = file.size - 1;
      if (match && (match[1] || match[2])) {
        if (match[1]) {
          start = Number(match[1]);
          end = match[2] ? Math.min(Number(match[2]), end) : end;
        } else start = Math.max(0, file.size - Number(match[2]));
      }
      if (!match || (!match[1] && !match[2]) || start > end || start >= file.size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
        response.writeHead(416, { 'Content-Range': `bytes */${file.size}` });
        return response.end();
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${file.size}`;
      headers['Content-Length'] = end - start + 1;
      response.writeHead(206, headers);
      return response.end(request.method === 'HEAD' ? undefined : readFileSync(filePath).subarray(start, end + 1));
    }
    response.writeHead(200, headers);
    response.end(request.method === 'HEAD' ? undefined : readFileSync(filePath));
  } catch {
    send(response, 404, { error: 'Not found.' });
  }
}

const server = http.createServer(async (request, response) => {
  secureHeaders(response);
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) await handleApi(request, response, url.pathname);
    else if (request.method === 'GET' || request.method === 'HEAD') serveStatic(request, response, url.pathname);
    else send(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    console.error(error);
    send(response, error.status || 500, { error: error.status ? error.message : 'Unexpected server error.' });
  }
});

server.listen(port, () => {
  console.log(`D & JC invitation running at http://localhost:${port}`);
  if (!adminUsername || !adminPassword || !sessionSecret) console.warn('Staff login is disabled until ADMIN_USERNAME, ADMIN_PASSWORD, and SESSION_SECRET are set.');
});

function shutdown() {
  database.close();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
