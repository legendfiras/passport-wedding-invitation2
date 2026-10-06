(() => {
  'use strict';
  const config = window.WEDDING_CONFIG;
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const params = new URLSearchParams(location.search);
  const demo = location.protocol === 'file:' || params.get('preview') === '1';
  const book = $('passport');
  const passportEntry = $('passportEntry');
  const runningAnimations = new Set();
  let state = 'closed';
  let cancelled = false;
  let musicPlaying = false;
  let responseSaved = false;
  const audio = new Audio(config.musicPath);
  audio.loop = true;
  audio.volume = 0.42;
  audio.preload = 'metadata';

  $('massMap').href = config.venues.mass.mapsUrl;
  $('celebrationMap').href = config.venues.celebration.mapsUrl;
  $('previewBadge').hidden = !demo;
  config.storyPhotos.forEach((src, i) => {
    if (!src) return;
    const image = $('storyPhoto' + i);
    image.addEventListener('load', () => { image.hidden = false; $('photoSlot' + i).classList.add('has-photo'); });
    image.addEventListener('error', () => { image.hidden = true; $('photoSlot' + i).classList.remove('has-photo'); });
    image.src = src;
  });
  const invitedName = (params.get('guest') || params.get('family') || params.get('name') || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (invitedName) { const parts = invitedName.split(' '); $('firstName').value = parts.shift(); $('lastName').value = parts.join(' '); }
  function countdown() {
    const remaining = Math.max(0, new Date(config.ceremonyStart).getTime() - Date.now());
    $('days').textContent = String(Math.floor(remaining / 86400000)).padStart(2, '0');
    $('hours').textContent = String(Math.floor(remaining / 3600000) % 24).padStart(2, '0');
    $('minutes').textContent = String(Math.floor(remaining / 60000) % 60).padStart(2, '0');
  }
  countdown(); setInterval(countdown, 30000);
  function showMusicState() {
    $('musicToggle').setAttribute('aria-pressed', String(musicPlaying));
    $('musicToggle').setAttribute('aria-label', musicPlaying ? 'Pause music' : 'Play music');
    $('musicLabel').textContent = musicPlaying ? 'Music on' : 'Music off';
  }
  function playMusic() {
    // Keep playback tied to a user gesture for mobile browser compatibility.
    audio.play().then(() => { musicPlaying = true; showMusicState(); }).catch(() => { musicPlaying = false; showMusicState(); });
  }
  // The envelope intro's opening tap starts the music.
  document.addEventListener('envelopeopen', () => { if (!musicPlaying) playMusic(); });
  addEventListener('load', () => { audio.preload = 'auto'; }, { once: true });
  $('musicToggle').addEventListener('click', () => { if (musicPlaying) { audio.pause(); musicPlaying = false; showMusicState(); } else playMusic(); });
  audio.addEventListener('error', () => { musicPlaying = false; showMusicState(); });
  async function animate(element, frames, duration, delay = 0, easing = 'cubic-bezier(.22,1,.36,1)') {
    if (cancelled) return;
    const animation = element.animate(frames, { duration, delay, easing, fill: 'forwards' });
    runningAnimations.add(animation);
    try { await animation.finished; if (!cancelled) Object.assign(element.style, frames[frames.length - 1]); } catch { /* Opening may finish immediately for reduced motion. */ }
    runningAnimations.delete(animation); animation.cancel();
  }
  function revealPage() { document.body.classList.add('is-open'); }
  function putBookInMount() {
    $('turningLeaf').style.transform = 'rotateY(-180deg)'; book.querySelector('.book-spine').style.opacity = '1'; book.removeAttribute('style'); $('bookMount').appendChild(book); book.style.opacity = '1';
  }
  function finishOpening() {
    if (state === 'open') return;
    cancelled = true;
    for (const animation of runningAnimations) animation.cancel();
    runningAnimations.clear(); passportEntry.hidden = true; revealPage(); putBookInMount(); state = 'open'; $('openingStatus').textContent = ''; prepareScrollReveals(); updateFlights();
  }
  async function dockBook() {
    if (cancelled) return;
    const first = book.getBoundingClientRect();
    // FLIP: carry the same opened passport into the invitation hero.
    document.body.appendChild(book);
    Object.assign(book.style, { position: 'fixed', left: first.left + 'px', top: first.top + 'px', width: first.width + 'px', height: first.height + 'px', transform: 'none', zIndex: '60' });
    passportEntry.hidden = true;
    revealPage();
    const last = $('bookMount').getBoundingClientRect();
    const dx = last.left - first.left; const dy = last.top - first.top; const sx = last.width / first.width; const sy = last.height / first.height;
    book.style.transformOrigin = 'top left'; state = 'docking';
    await animate(book, [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }], 1400);
    if (!cancelled) finishOpening();
  }
  async function openInvitation() {
    if (state !== 'closed') return;
    state = 'opening'; passportEntry.classList.add('is-opening'); $('openInvitation').disabled = true; $('openingStatus').textContent = 'Your passport is opening.'; if (!musicPlaying) playMusic();
    if (reduced.matches || typeof book.animate !== 'function') { finishOpening(); return; }
    const openScale = Number.parseFloat(getComputedStyle(passportEntry).getPropertyValue('--open-scale')) || 1;
    // Show the cream spine only once the cover has started to turn, so it never flashes on the closed book.
    setTimeout(() => { book.querySelector('.book-spine').style.opacity = '1'; }, 700);
    await Promise.all([
      animate($('turningLeaf'), [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], 1900, 80, 'cubic-bezier(.45,0,.16,1)'),
      animate(book, [{ transform: 'translateX(-25%) scale(1)' }, { transform: `translateX(0) scale(${openScale})` }], 1900, 80, 'cubic-bezier(.45,0,.16,1)'),
    ]);
    await dockBook();
  }
  $('openInvitation').addEventListener('click', openInvitation);
  document.addEventListener('envelopedone', () => setTimeout(openInvitation, 1100));
  $('scrollDown').addEventListener('click', () => $('story').scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' }));
  let observer;
  function prepareScrollReveals() {
    if (observer || reduced.matches || !('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: .1 });
    document.querySelectorAll('.scroll-reveal').forEach(el => { el.classList.add('awaiting-reveal'); observer.observe(el); });
  }
  let frameQueued = false;
  function progressIn(element) { const box = element.getBoundingClientRect(); return Math.max(0, Math.min(1, (innerHeight * .57 - box.top) / box.height)); }
  function placePlane(plane, path, container, progress, viewWidth, viewHeight) {
    const length = path.getTotalLength(); const d = length * progress; const point = path.getPointAtLength(d);
    const next = path.getPointAtLength(Math.min(length, d + 2)); const previous = path.getPointAtLength(Math.max(0, d - 2));
    const scaleX = container.clientWidth / viewWidth; const scaleY = container.clientHeight / viewHeight;
    const angle = Math.atan2((next.y - previous.y) * scaleY, (next.x - previous.x) * scaleX) * 180 / Math.PI + 45;
    plane.style.transform = `translate3d(${point.x * scaleX - plane.clientWidth / 2}px,${point.y * scaleY - plane.clientHeight / 2}px,0) rotate(${angle}deg)`;
    return length;
  }
  function updateFlights() {
    frameQueued = false;
    if (state !== 'open') return;
    const progress = progressIn($('storyRoute')); const path = $('storyProgress');
    const length = placePlane($('storyPlane'), path, $('storyRoute'), progress, 1000, 1540);
    path.style.strokeDasharray = length; path.style.strokeDashoffset = length * (1 - progress);
    placePlane($('destinationPlane'), $('destinationPath'), document.querySelector('.destination-path'), progressIn($('destinationRoute')), 100, 1500);
  }
  function queueFlights() { if (!frameQueued) { frameQueued = true; requestAnimationFrame(updateFlights); } }
  addEventListener('scroll', queueFlights, { passive: true }); addEventListener('resize', queueFlights, { passive: true });
  reduced.addEventListener('change', () => { if (reduced.matches && state === 'opening') finishOpening(); });

  const submissionId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const n = Math.random() * 16 | 0; return (c === 'x' ? n : (n & 3 | 8)).toString(16); });
  function responseCopy(attending, fullName) {
    const container = $('rsvpResponse'); container.replaceChildren();
    const heading = document.createElement('h4'); heading.textContent = attending === 'yes' ? 'You’re cleared for takeoff!' : 'We’ll miss you on this journey.'; container.appendChild(heading);
    const nameLine = document.createElement('p'); nameLine.className = 'reply-passenger'; nameLine.textContent = fullName; container.appendChild(nameLine);
    const lines = attending === 'yes' ? ['Your seats have been confirmed.', 'We can’t wait to celebrate our journey to forever with you.', 'See you at the gate!'] : ['Thank you for sending your love from afar.', 'You’ll be in our hearts as we begin our next adventure.'];
    lines.forEach(line => { const p = document.createElement('p'); p.textContent = line; container.appendChild(p); });
    container.hidden = false; $('rsvpForm').hidden = true; $('pendingStamp').hidden = true; $('confirmedStamp').hidden = attending !== 'yes'; $('declinedStamp').hidden = attending !== 'no';
    $('boardingTicket').classList.add(attending === 'yes' ? 'is-confirmed' : 'is-declined'); $('addCalendar').hidden = attending !== 'yes';
    if (attending === 'no') $('awaitingYou').textContent = 'Thank you for sending your love from afar.';
    container.focus({ preventScroll: true });
  }
  $('rsvpForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (responseSaved || $('rsvpForm').dataset.busy === 'true') return;
    const choice = event.submitter; const attending = choice ? choice.value : '';
    const firstName = $('firstName').value.trim().replace(/\s+/g, ' '); const lastName = $('lastName').value.trim().replace(/\s+/g, ' ');
    $('firstName').removeAttribute('aria-invalid'); $('lastName').removeAttribute('aria-invalid');
    if (!firstName || !lastName) { const missing = !firstName ? $('firstName') : $('lastName'); missing.setAttribute('aria-invalid', 'true'); missing.focus(); $('formMessage').textContent = 'Please enter your first and last name before sending your reply.'; return; }
    if (!['yes', 'no'].includes(attending)) { $('formMessage').textContent = 'Please choose Joyfully accept or Regretfully decline.'; return; }
    const payload = { submissionId, firstName, lastName, attending, guestCount: attending === 'yes' ? config.maxGuests : 0, memberNames: [] };
    let savedAttendance = attending;
    $('rsvpForm').dataset.busy = 'true'; const buttons = [...$('replyButtons').querySelectorAll('button')]; buttons.forEach(button => { button.disabled = true; });
    const originalLabel = choice.textContent; choice.textContent = 'Sending your reply…'; $('formMessage').textContent = '';
    try {
      if (demo) { try { sessionStorage.setItem('djc-preview-rsvp', JSON.stringify(payload)); } catch { /* File URLs may deny device storage. */ } }
      else {
        const response = await fetch(config.apiPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
        const result = await response.json().catch(() => ({})); if (!response.ok || !result.saved) throw new Error(result.error || 'We could not save your response.');
        if (['yes', 'no'].includes(result.attending)) savedAttendance = result.attending;
      }
      responseSaved = true; responseCopy(savedAttendance, firstName + ' ' + lastName);
    } catch (error) { $('formMessage').textContent = (error.message || 'We could not save your reply.') + ' Please try again.'; buttons.forEach(button => { button.disabled = false; }); choice.textContent = originalLabel; }
    finally { $('rsvpForm').dataset.busy = 'false'; }
  });

  function utc(date) { return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function icsEscape(text) { return String(text).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
  function fold(line) {
    let result = ''; let current = ''; let bytes = 0;
    for (const character of line) { const size = new TextEncoder().encode(character).length; if (bytes + size > 73) { result += current + '\r\n '; current = ''; bytes = 1; } current += character; bytes += size; }
    return result + current;
  }
  function calendarFile() {
    const stamp = utc(new Date());
    const event = (kind, title, start, end, venue) => [ 'BEGIN:VEVENT', `UID:djc-1219-${kind}@invitation.local`, `DTSTAMP:${stamp}`, `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`, `SUMMARY:${icsEscape(title)}`, `LOCATION:${icsEscape(venue.name + ', ' + venue.address)}`, `DESCRIPTION:${icsEscape('Delilah & Juan Carlos — Our journey to forever. ' + venue.mapsUrl)}`, 'STATUS:CONFIRMED', 'END:VEVENT' ];
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//D and JC//Passport to Forever//EN', 'CALSCALE:GREGORIAN', ...event('ceremony', 'Delilah & Juan Carlos · The Ceremony', config.ceremonyStart, config.ceremonyEnd, config.venues.mass), ...event('celebration', 'Delilah & Juan Carlos · The Celebration', config.celebrationStart, config.celebrationEnd, config.venues.celebration), 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
  }
  const google = new URL('https://calendar.google.com/calendar/render');
  google.search = new URLSearchParams({ action: 'TEMPLATE', text: 'Delilah & Juan Carlos · Our Wedding', dates: utc(config.ceremonyStart) + '/' + utc(config.celebrationEnd), ctz: config.timezone, location: config.venues.mass.name + ', ' + config.venues.mass.address, details: `Our great adventure begins.\n\n1:00 PM — The Ceremony\n${config.venues.mass.address}\n${config.venues.mass.mapsUrl}\n\n6:00 PM — The Celebration\n${config.venues.celebration.address}\n${config.venues.celebration.mapsUrl}\n\nDinner, dancing, desserts, and memories.` }).toString();
  $('googleCalendar').href = google.href;
  $('addCalendar').addEventListener('click', () => $('calendarDialog').showModal());
  $('closeCalendar').addEventListener('click', () => $('calendarDialog').close());
  $('calendarDialog').addEventListener('click', event => { const rect = $('calendarDialog').getBoundingClientRect(); if (event.target === $('calendarDialog') && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) $('calendarDialog').close(); });
  $('downloadCalendar').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([calendarFile()], { type: 'text/calendar;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'Delilah-Juan-Carlos-December-19-2026.ics'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
