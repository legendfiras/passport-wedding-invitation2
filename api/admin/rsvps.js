import { redis, RSVP_KEY, json, apiError } from '../../lib/rsvp-store.mjs';
import { authorized } from '../../lib/admin-session.mjs';
export default {
  async fetch(request) {
    if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
    if (!authorized(request)) return json({ error: 'Authentication required.' }, 401);
    try {
      const values = await redis(['HVALS', RSVP_KEY]);
      const rows = (values || []).map(value => JSON.parse(value)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
      return json({ summary: { attendingHouseholds: rows.filter(row => row.attending === 'yes').length, decliningHouseholds: rows.filter(row => row.attending === 'no').length, attendingGuests: rows.reduce((sum, row) => sum + row.guestCount, 0) }, responses: rows });
    } catch (error) { return apiError(error); }
  },
};
