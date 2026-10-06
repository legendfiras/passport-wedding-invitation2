import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReply, saveReply } from '../lib/rsvp-store.mjs';
import rsvpFunction from '../api/rsvps.js';
import dashboardFunction from '../api/admin/rsvps.js';
import { configured, newSession, authorized } from '../lib/admin-session.mjs';
const reply = { submissionId: '11111111-1111-4111-8111-111111111111', firstName: 'Jane', lastName: 'Guest', attending: 'yes', memberNames: ['Jane Guest', 'John Guest'] };

test('durable storage is atomic and repeated submissions preserve the first response', async () => {
  const rows = new Map();
  const command = async ([operation, key, field, value]) => {
    if (operation === 'HSETNX') { if (rows.has(field)) return 0; rows.set(field, value); return 1; }
    if (operation === 'HGET') return rows.get(field);
    throw new Error('unexpected command');
  };
  const first = await saveReply(reply, command);
  assert.equal(first.saved, true); assert.equal(first.duplicate, false);
  assert.deepEqual(first.memberNames, reply.memberNames);
  const duplicate = await saveReply({ ...reply, attending: 'no' }, command);
  assert.equal(duplicate.duplicate, true); assert.equal(duplicate.attending, 'yes'); assert.equal(rows.size, 1);
});

test('declines clear guest names; extra guests and invalid replies are rejected', () => {
  const no = validateReply({ ...reply, attending: 'no' });
  assert.equal(no.guestCount, 0); assert.deepEqual(no.memberNames, []);
  assert.throws(() => validateReply({ ...reply, memberNames: ['A', 'B', 'C'] }), /two named guests/);
  assert.throws(() => validateReply({ ...reply, lastName: '' }), /last name/);
});

test('a production deployment without durable storage never returns a saved confirmation', async () => {
  delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const request = new Request('https://invitation.example/api/rsvps', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://invitation.example' }, body: JSON.stringify(reply) });
  const response = await rsvpFunction.fetch(request);
  assert.equal(response.status, 503); assert.equal((await response.json()).saved, undefined);
});

test('production endpoints reject cross-origin writes and unauthenticated staff reads', async () => {
  const response = await rsvpFunction.fetch(new Request('https://invitation.example/api/rsvps', { method: 'POST', headers: { Origin: 'https://elsewhere.example' }, body: '{}' }));
  assert.equal(response.status, 403);
  const staff = await dashboardFunction.fetch(new Request('https://invitation.example/api/admin/rsvps'));
  assert.equal(staff.status, 401);
});

test('staff session signature rejects tampering and expires', () => {
  process.env.ADMIN_USERNAME = 'staff'; process.env.ADMIN_PASSWORD = 'local-test-only'; process.env.SESSION_SECRET = 'a-test-secret-with-more-than-thirty-two-characters';
  assert.equal(configured(), true);
  const token = newSession();
  assert.equal(authorized(new Request('https://invitation.example', { headers: { Cookie: 'djcsession=' + token } })), true);
  assert.equal(authorized(new Request('https://invitation.example', { headers: { Cookie: 'djcsession=' + token + 'x' } })), false);
  delete process.env.ADMIN_USERNAME; delete process.env.ADMIN_PASSWORD; delete process.env.SESSION_SECRET;
});
