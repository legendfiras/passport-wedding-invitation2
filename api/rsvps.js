import { saveReply, limitRequests, sameOrigin, jsonBody, json, apiError } from '../lib/rsvp-store.mjs';
export default {
  async fetch(request) {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
    if (!sameOrigin(request)) return json({ error: 'Request origin is not allowed.' }, 403);
    try { const body = await jsonBody(request); await limitRequests(request); const row = await saveReply(body); return json(row, row.duplicate ? 200 : 201); }
    catch (error) { return apiError(error); }
  },
};
