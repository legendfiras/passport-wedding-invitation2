import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
const maxAge = 8 * 60 * 60;
export function configured() { return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && (process.env.SESSION_SECRET || '').length >= 32); }
export function credentialMatches(username, password) {
  const hash = value => createHash('sha256').update(String(value || '')).digest();
  return timingSafeEqual(hash(username), hash(process.env.ADMIN_USERNAME)) && timingSafeEqual(hash(password), hash(process.env.ADMIN_PASSWORD));
}
function sign(payload) { return createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url'); }
export function newSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + maxAge * 1000, username: process.env.ADMIN_USERNAME, nonce: randomBytes(12).toString('hex') })).toString('base64url');
  return payload + '.' + sign(payload);
}
export function authorized(request) {
  if (!configured()) return false;
  try {
    const token = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith('djcsession='))?.slice(11);
    const [payload, signature] = (token || '').split('.');
    if (!payload || !signature) return false;
    const expected = Buffer.from(sign(payload)); const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() && data.username === process.env.ADMIN_USERNAME;
  } catch { return false; }
}
export function cookie(token, clear = false) { return `djcsession=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${clear ? 0 : maxAge}`; }
