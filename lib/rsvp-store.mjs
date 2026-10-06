import { createHash } from 'node:crypto';

export const RSVP_KEY = 'djc:1219:2026:rsvps';
export const cleanText = (value, max = 120) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
export function validateReply(body) {
  const submissionId = cleanText(body?.submissionId, 80);
  const firstName = cleanText(body?.firstName, 60);
  const lastName = cleanText(body?.lastName, 60);
  const attending = body?.attending;
  if (!/^[0-9a-f-]{20,80}$/i.test(submissionId)) throw Object.assign(new Error('Please refresh the invitation and try again.'), { status: 400 });
  if (!firstName || !lastName) throw Object.assign(new Error('First and last name are required.'), { status: 400 });
  if (!['yes', 'no'].includes(attending)) throw Object.assign(new Error('Please choose an attendance response.'), { status: 400 });
  if (attending === 'yes' && body.memberNames != null && !Array.isArray(body.memberNames)) throw Object.assign(new Error('Guest names must be a list.'), { status: 400 });
  const memberNames = attending === 'yes' && Array.isArray(body.memberNames) ? body.memberNames.map(name => cleanText(name, 100)).filter(Boolean) : [];
  if (memberNames.length > 2) throw Object.assign(new Error('This invitation is reserved for two named guests.'), { status: 400 });
  return { submissionId, firstName, lastName, attending, guestCount: attending === 'yes' ? 2 : 0, memberNames };
}
export async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw Object.assign(new Error('Replies are temporarily unavailable. Please contact the hosts.'), { status: 503 });
  const response = await fetch(url.replace(/\/$/, ''), {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok || result.error) throw Object.assign(new Error('Replies are temporarily unavailable. Please try again.'), { status: 503 });
  return result.result;
}
export async function saveReply(body, command = redis) {
  const reply = validateReply(body);
  const row = { ...reply, id: reply.submissionId, submittedAt: new Date().toISOString() };
  // One atomic command: retries cannot insert a second reply or overwrite the first.
  const inserted = await command(['HSETNX', RSVP_KEY, row.submissionId, JSON.stringify(row)]);
  if (Number(inserted) === 1) return { ...row, saved: true, duplicate: false };
  const stored = await command(['HGET', RSVP_KEY, row.submissionId]);
  if (!stored) throw Object.assign(new Error('We could not verify your saved reply. Please try again.'), { status: 503 });
  return { ...JSON.parse(stored), saved: true, duplicate: true };
}
export async function limitRequests(request, command = redis) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const hash = createHash('sha256').update(ip).digest('hex').slice(0, 24);
  const key = 'djc:rate:' + hash + ':' + Math.floor(Date.now() / 60000);
  const count = Number(await command(['INCR', key]));
  if (count === 1) await command(['EXPIRE', key, 120]);
  if (count > 20) throw Object.assign(new Error('Too many attempts. Please wait a moment and try again.'), { status: 429 });
}
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
export async function jsonBody(request) {
  const body = await request.text();
  if (Buffer.byteLength(body) > 32768) throw Object.assign(new Error('Your reply is too large.'), { status: 413 });
  try { return JSON.parse(body); } catch { throw Object.assign(new Error('Invalid reply.'), { status: 400 }); }
}
export function json(data, status = 200, extra = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
export function apiError(error) { return json({ error: error.status ? error.message : 'We could not save your reply. Please try again.' }, error.status || 503); }
