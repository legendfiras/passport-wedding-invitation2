# D & JC wedding invitation — magical opening comparison

A comparison version of the complete wedding invitation for Delila and JuanCarlos on December 19, 2026. Its new entrance uses embossed floral envelope folds, golden light, a passport reveal, and a hinged passport opening. The original music, boarding pass, countdown, itinerary, household RSVP, and staff dashboard are included.

The baseline was copied from `legendfiras/pasport-weddinginvitation` at commit `952875b997d8db32594ca8d614a2530bdc08fb96`. Deploy this repository as a separate project to keep the original invitation and comparison link active.

## Magical opening

- The gold seal starts the opening and the original music in the same tap.
- A 9.2-second, 780 × 1300 H.264 film runs at 45 frames per second, with embedded WebP start and end images.
- The envelope fills a portrait phone viewport, then the camera gently pulls back so both passport pages fit.
- The existing `invitation:start` and `invitation:complete` events connect the new opening to `dist/app.js`.
- Reduced motion, skipping, and unavailable video fall back to the open passport and reveal the invitation.
- MP4 and music responses support byte ranges for mobile playback.

The entrance controller is `dist/entrance.js`, its additional styles are `dist/magical-opening.css`, and the three opening assets are in `dist/assets/magic/`. The remaining invitation content and its configuration are copied from the original project.

## Requirements

- Node.js 22.5 or newer (the app uses Node's built-in SQLite module)
- No package installation or third-party service is required

## Run locally

PowerShell:

```powershell
Copy-Item .env.example .env
# Edit .env, then load its values into your shell or set them directly:
$env:ADMIN_USERNAME = 'staff'
$env:ADMIN_PASSWORD = 'use-a-long-unique-password'
$env:SESSION_SECRET = 'use-at-least-32-random-characters'
npm.cmd start
```

Open <http://localhost:3000>. The private dashboard is linked discreetly in the invitation footer or available directly at <http://localhost:3000/admin.html>.

Node does not automatically read `.env`; configure the variables in the host environment (or load them with your deployment platform). The admin login is intentionally disabled if any required security value is missing.

## Configuration

Invitation details are centralized in [`dist/config.js`](dist/config.js):

- music path
- wedding date and `America/New_York` timezone
- venue names, addresses, times, and Google Maps URLs

The two supplied exact map links are already configured. All displayed event times are fixed Kissimmee local times; the browser does not convert them.

### Music

The provided track is served from:

```text
dist/audio/risk-it-all.mp3
```

and configured as `/audio/risk-it-all.mp3`. The guest's first tap starts both the music and entrance. Playback loops at 50% volume and continues through the RSVP flow. If the file is missing or playback is rejected, the invitation remains usable.

## Persistence and deployment

RSVPs are stored in `data/rsvps.sqlite` by default. Set `DATA_DIR` to a durable, writable volume on the deployment host. The database uses WAL mode and survives page reloads and server restarts. Back up that directory as part of normal deployment operations.

Required environment variables:

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | Staff login name |
| `ADMIN_PASSWORD` | Long, unique staff password |
| `SESSION_SECRET` | Random secret of at least 32 characters |

Optional: `PORT`, `NODE_ENV=production`, and `DATA_DIR`. Production mode adds the `Secure` flag to the HTTP-only, SameSite session cookie, so deploy behind HTTPS.

This is a stateful Node application, not a static-only deployment. Use any Node 22+ host with persistent disk. Do not deploy only `dist/`; doing so would omit RSVP storage and staff authentication.

## Verification

```powershell
npm.cmd run check
npm.cmd test
```

The integration test saves both Yes and No households, rejects unauthenticated dashboard access, verifies duplicate-submission protection, restarts the server, signs in, and confirms the saved totals remain available.
