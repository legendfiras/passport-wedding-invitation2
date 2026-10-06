import { json, sameOrigin } from '../../lib/rsvp-store.mjs';
import { cookie } from '../../lib/admin-session.mjs';
export default {
  async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
    return json({ authenticated: false }, 200, { 'Set-Cookie': cookie('', true) });
  },
};
