# Delilah & Juan Carlos — A Passport to Forever

A separate navy, antique gold and ivory invitation for **December 19, 2026**. Ceremony: **2:00 PM**, Saint Rose of Lima Catholic Church. Celebration: **6:00 PM**, Infinity Party Room. Times use the venue's **America/New_York** timezone.

## Preview

Open `dist/index.html` in a modern browser. File previews display **Invitation preview**; their RSVP responses demonstrate the interface and are not sent to the hosts.

For the real local RSVP flow, install **Node 24** and run:

```sh
npm run dev
```

Open `http://localhost:3000`. There are no third-party runtime dependencies. Local replies persist in SQLite under `data/` and survive restarts. Add `?preview=1` to test the interface without saving real replies.

## Included

- Immediate closed-passport first view, separate front/back 3D cover faces, and a continuous opening transition carrying the same open book into the reveal.
- Bundled calligraphy, local fonts, textured navy/ivory surfaces, gold crest, illustrated book, live countdown and **Scroll down**.
- A scroll-driven curving flight path and three alternating photo frames.
- Separate ceremony ticket → dress code → celebration ticket, using the exact original map URLs.
- Boarding-pass RSVP, **Flight no. 12-19**, first/last name, and a multiline field for full guest names.
- Acceptance reveals **RSVP CONFIRMED** and the calendar button after saving. Decline shows “Thank you for sending your love from afar.” and hides the calendar button.
- Native calendar popup with Google Calendar and an `.ics` download containing separate ceremony and celebration events.
- Earlier journey, dress code, named-guests, adults-only, November 6 RSVP deadline, two-guest reservation and closing wording.
- Original music, starting from the opening tap, plus a visible music control.
- Preserved protected staff dashboard / CSV export at `/admin.html`.
- Reduced-motion support and keyboard-accessible controls.

## Real couple photos

No real couple photographs were included in the references or earlier package. Three frames are explicitly marked as placeholders; no likenesses were fabricated.

Put the photographs in `dist/assets/photos/` and update `storyPhotos` in `dist/config.js`:

```js
storyPhotos: [
  'assets/photos/the-day-we-met.jpg',
  'assets/photos/she-said-yes.jpg',
  'assets/photos/our-forever.jpg',
],
```

Photos fill portrait frames with `object-fit: cover`; use `object-position` to preserve the desired face framing.

## Vercel deployment

Copy this folder's contents to the separate repository **legendfiras/passport-wedding-invitation2** and import it into Vercel. Neither repository nor either live website has been changed while making this ZIP.

The included `vercel.json` selects framework **Other**, build **npm run build**, static output **dist**, and the production functions in **api/**.

For **live durable RSVP storage**, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel's server environment and redeploy. Never place those credentials in `dist/config.js`. Production handlers save atomically with `HSETNX`; duplicate retries cannot insert another reply or overwrite the first. Without these settings the invitation still renders, but live replies report temporary unavailability and never show a false saved confirmation. Use `?preview=1` to test the visual RSVP flow.

For the staff dashboard, also configure `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET` (at least 32 characters). Production sessions are signed and expire after eight hours. Local Node hosting uses the original SQLite server and session flow. Copy `.env.example` to `.env` for local settings; `npm run dev` loads it.

No production credentials or guest records are included.

## Details to finalize

- Latest names, spelling, date, event start times and flight number supersede earlier values.
- Calendar end times were not provided. Default blocks are one hour for the ceremony and five hours for the celebration; edit `ceremonyEnd` and `celebrationEnd` if hosts provide exact end times.
- The exact font file from the image was not provided. Pinyon Script is a close calligraphic match, bundled with Cormorant Garamond for offline preview.
- Venue illustrations reuse the supplied artwork through CSS windows; they are decorative artwork rather than photographs of the venues.
- `VALIDATION.md` states completed checks and any browser-verification limitations. No specific device frame rate is promised.

## Validate

```sh
npm run check
npm run build
npm test
```

| File | Edit |
| --- | --- |
| `dist/config.js` | Photos, maps, music and calendar dates |
| `dist/index.html` | Guest-facing text and layout |
| `dist/styles.css` | Material, typography, geometry and mobile layout |
| `dist/app.js` | Opening, scroll plane, RSVP and calendar |
| `server.mjs` | Local/persistent Node hosting |
| `api/` and `lib/` | Durable Vercel RSVP and staff routes |

Sources: [Vercel Node Functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json), [Upstash REST](https://upstash.com/docs/redis/features/restapi), [Google Fonts](https://github.com/google/fonts). See `ART_DIRECTION.md` and `CODEX_HANDOFF.md` for continuation.
