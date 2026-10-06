// Envelope opening intro. Runs before the deferred invitation scripts so the
// sealed envelope is the very first thing painted.
(() => {
  'use strict';
  const FADE_START = 3.2; // fade before the inner light turns bright white
  const FADE_MS = 950;
  const root = document.documentElement;
  const intro = document.getElementById('envelopeIntro');
  const video = document.getElementById('introVideo');
  const tap = document.getElementById('envelopeTap');

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { intro.remove(); return; }

  const variant = matchMedia('(max-aspect-ratio: 1/1)').matches ? 'mobile' : 'desktop';
  video.poster = `assets/intro/envelope-opening-${variant}-poster.webp`;
  video.innerHTML = `<source src="assets/intro/envelope-opening-${variant}.webm" type='video/webm; codecs="vp9"'>`
    + `<source src="assets/intro/envelope-opening-${variant}.mp4" type="video/mp4">`;
  video.load();
  root.classList.add('intro-active', 'has-envelope');

  let opened = false;
  let fading = false;
  let stallTimer = 0;

  function fade() {
    if (fading) return;
    fading = true;
    clearTimeout(stallTimer);
    // Freeze the envelope so its inner light cannot keep brightening over the passport.
    video.pause();
    intro.classList.add('is-fading');
    root.classList.remove('intro-active');
    // One opening only: the passport opens by itself once the envelope fades.
    document.dispatchEvent(new Event('envelopedone'));
    setTimeout(() => intro.remove(), FADE_MS + 60);
  }
  function watch() {
    if (fading) return;
    if (video.currentTime >= FADE_START) fade(); else requestAnimationFrame(watch);
  }
  function open() {
    if (opened) return;
    opened = true;
    intro.classList.add('is-opening');
    // Start the music inside this tap so mobile browsers allow sound.
    document.dispatchEvent(new Event('envelopeopen'));
    video.addEventListener('ended', fade, { once: true });
    video.addEventListener('error', fade, { once: true });
    video.querySelector('source:last-child').addEventListener('error', fade, { once: true });
    // Never keep guests waiting behind the envelope on a slow connection.
    video.addEventListener('waiting', () => { clearTimeout(stallTimer); stallTimer = setTimeout(fade, 2500); });
    video.addEventListener('playing', () => clearTimeout(stallTimer));
    stallTimer = setTimeout(() => { if (video.currentTime === 0) fade(); }, 3500);
    const playing = video.play();
    if (playing) playing.then(() => requestAnimationFrame(watch)).catch(fade);
    else requestAnimationFrame(watch);
  }
  tap.addEventListener('click', open);
})();
