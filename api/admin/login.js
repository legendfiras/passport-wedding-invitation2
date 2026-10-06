import { jsonBody, json, apiError, sameOrigin, limitRequests } from '../../lib/rsvp-store.mjs';
import { configured, credentialMatches, newSession, cookie } from '../../lib/admin-session.mjs';
export default {
  async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
    if (!configured()) return json({ error: 'Staff login has not been configured.' }, 503);
    try {
      await limitRequests(request); const body = await jsonBody(request);
      if (!credentialMatches(body.username, body.password)) return json({ error: 'Invalid username or password.' }, 401);
      return json({ authenticated: true }, 200, { 'Set-Cookie': cookie(newSession()) });
    } catch (error) { return apiError(error); }
  },
};
