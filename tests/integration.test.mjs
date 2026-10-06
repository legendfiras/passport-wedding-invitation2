import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import test from 'node:test';

const projectRoot = new URL('..', import.meta.url);
const dataDir = mkdtempSync(join(tmpdir(), 'djc-rsvp-'));
let server;
let baseUrl;

async function freePort() {
  return await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
    probe.on('error', reject);
  });
}

async function startServer() {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server.mjs'], {
    cwd: projectRoot,
    env: {
      ...process.env, PORT: String(port), DATA_DIR: dataDir,
      ADMIN_USERNAME: 'staff-test', ADMIN_PASSWORD: 'strong-test-password',
      SESSION_SECRET: 'test-secret-that-is-longer-than-thirty-two-characters',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timed out')), 5000);
    server.stdout.on('data', chunk => {
      if (chunk.toString().includes('invitation running')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.once('exit', code => reject(new Error(`Server exited with ${code}`)));
  });
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  await new Promise(resolve => server.once('exit', resolve));
}

test.before(startServer);
test.after(async () => {
  await stopServer();
  rmSync(dataDir, { recursive: true, force: true });
});

test('serves invitation and protects staff records', async () => {
  const page = await fetch(baseUrl + '/');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Flight Itinerary/);
  assert.match(html, /Before you board/);
  assert.match(html, /One love\. One journey\. One forever\./);
  assert.match(html, /id="days"/);
  assert.match(html, /app\.js/);
  assert.match(html, /2026-12-19/);
  assert.match(html, /DECEMBER 19 · 6:00 PM/);
  assert.match(html, /DECEMBER 19 · 1:00 PM/);
  assert.doesNotMatch(html, /6:30 PM|wedding-motifs/);
  const unauthorized = await fetch(baseUrl + '/api/admin/rsvps');
  assert.equal(unauthorized.status, 401);
});

test('saves yes and no responses, prevents duplicate inserts, and survives restart', async () => {
  const yesPayload = {
    submissionId: '11111111-1111-4111-8111-111111111111',
    firstName: 'Test', lastName: 'Family', attending: 'yes',
    guestCount: 3, memberNames: ['Guest Two', 'Guest Three'],
  };
  const noPayload = {
    submissionId: '22222222-2222-4222-8222-222222222222',
    firstName: 'No', lastName: 'Guest', attending: 'no',
    guestCount: 0, memberNames: [],
  };
  for (const payload of [yesPayload, noPayload]) {
    const response = await fetch(baseUrl + '/api/rsvps', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    assert.equal(response.status, 201);
    const saved = await response.json();
    assert.equal(saved.attending, payload.attending);
    assert.equal(saved.guestCount, payload.attending === 'yes' ? 2 : 0);
  }
  const duplicate = await fetch(baseUrl + '/api/rsvps', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(yesPayload),
  });
  assert.equal(duplicate.status, 200);
  const duplicateResult = await duplicate.json();
  assert.equal(duplicateResult.duplicate, true);
  assert.equal(duplicateResult.attending, 'yes');
  assert.equal(duplicateResult.guestCount, 2);

  await stopServer();
  await startServer();
  const login = await fetch(baseUrl + '/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'staff-test', password: 'strong-test-password' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const dashboard = await fetch(baseUrl + '/api/admin/rsvps', { headers: { Cookie: cookie } });
  assert.equal(dashboard.status, 200);
  const data = await dashboard.json();
  assert.deepEqual(data.summary, { attendingHouseholds: 1, decliningHouseholds: 1, attendingGuests: 2 });
  assert.equal(data.responses.length, 2);
  assert.deepEqual(data.responses.find(item => item.attending === 'yes').memberNames, ['Guest Two', 'Guest Three']);
});

test('serves the opening and music with correct types and byte-range playback', async () => {
  const paths = [
    ['/assets/love-story.mp3', 'audio/mpeg'],
  ];
  for (const [path, type] of paths) {
    const original = readFileSync(new URL('../dist' + path, import.meta.url));
    const head = await fetch(baseUrl + path, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-type'), type);
    assert.equal(Number(head.headers.get('content-length')), original.length);
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    const partial = await fetch(baseUrl + path, { headers: { Range: 'bytes=0-31' } });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('content-range'), `bytes 0-31/${original.length}`);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), original.subarray(0, 32));
    const tail = await fetch(baseUrl + path, { headers: { Range: 'bytes=-24' } });
    assert.equal(tail.status, 206);
    assert.deepEqual(Buffer.from(await tail.arrayBuffer()), original.subarray(-24));
    const invalid = await fetch(baseUrl + path, { headers: { Range: `bytes=${original.length}-` } });
    assert.equal(invalid.status, 416);
  }
  for (const name of ['passport-cover', 'passport-spread']) {
    const image = await fetch(baseUrl + `/assets/${name}.png`);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/png');
    await image.arrayBuffer();
  }
});
