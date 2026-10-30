/* The projector, without the film in it.
 *
 * Fitting the frame to the window, the clock, the scrubber and the export hook
 * are the same job whichever cut is playing, so they live here and a film only
 * has to hand over a duration, a scene table and a function that draws one
 * frame at a time.
 *
 * The export hook is `window.PK` for every film, so one exporter serves all
 * of them. */

import { Clock, text } from './anim.js';

const $ = (id) => document.getElementById(id);

export function runFilm({ scenes, duration, render, ready = Promise.resolve(), frameW = 1080, frameH = 1920, settle = null }) {
  const stage = $('stage');
  // A landscape film sizes its own stage; film.css defaults to 1080x1920.
  stage.style.width = `${frameW}px`;
  stage.style.height = `${frameH}px`;

  /* Divide by the FRAME's own dimensions, not by a remembered 1920x1080. Get
     this backwards and a portrait stage is scaled to the window's width and
     runs off the bottom; the symptom reads as "I can't see the whole thing"
     and looks nothing like a scaling bug. */
  function fit() {
    const box = stage.parentElement.getBoundingClientRect();
    stage.style.transform = `scale(${Math.min(box.width / frameW, box.height / frameH)})`;
  }
  addEventListener('resize', fit);
  fit();

  // Review-only guide: platform chrome is drawn over the video by TikTok and
  // Reels. Keep critical text, faces and buttons inside the clear rectangle.
  // It is a child of the stage so it follows the same fit as every film.
  const params = new URLSearchParams(location.search);
  const safeZone = document.createElement('div');
  safeZone.id = 'safeZone';
  safeZone.setAttribute('aria-hidden', 'true');
  // Approximated from TikTok's in-app layout on a 1080x1920 frame.
  // The right edge stays open above the profile/like rail, then curves over
  // the profile photo and runs left of the actions. This is a guide, not a crop.
  const safeArea = 'M60 160 H1074 V920 C1074 965 975 958 931 994 ' +
    'C895 1018 892 1060 900 1090 V1720 H60 Z';
  safeZone.innerHTML = `<svg viewBox="0 0 1080 1920" preserveAspectRatio="none">
    <path class="safe-shade" fill-rule="evenodd" d="M0 0 H1080 V1920 H0 Z ${safeArea}"/>
    <path class="safe-outline" d="${safeArea}"/>
  </svg><div class="safe-top">TOP UI</div>
  <div class="safe-right">LIKES / COMMENTS</div>
  <div class="safe-bottom">DESCRIPTION / AUDIO</div>`;
  stage.appendChild(safeZone);
  document.body.classList.toggle('safe-zone', !params.has('export') || params.has('safe-zone'));
  document.body.classList.toggle('safe-zone-capture', params.has('safe-zone'));

  const clock = new Clock(duration, render);

  /* ---------- dev chrome ---------- */

  const scrub = $('scrub');
  const marks = $('scrubMarks');
  if (marks) {
    for (const s of scenes) {
      const i = document.createElement('i');
      i.style.left = `${(s.t0 / duration) * 100}%`;
      marks.appendChild(i);
      const b = document.createElement('b');
      b.style.left = `${(s.t0 / duration) * 100}%`;
      b.textContent = s.id;
      marks.appendChild(b);
    }
  }

  const safeBtn = document.createElement('button');
  safeBtn.id = 'safeBtn';
  safeBtn.type = 'button';
  safeBtn.title = 'Toggle social safe zone (G)';
  safeBtn.textContent = 'Safe';
  $('loopBtn').after(safeBtn);
  const toggleSafeZone = () => {
    const shown = document.body.classList.toggle('safe-zone');
    safeBtn.setAttribute('aria-pressed', String(shown));
  };
  safeBtn.setAttribute('aria-pressed', String(document.body.classList.contains('safe-zone')));
  safeBtn.onclick = toggleSafeZone;

  let dragging = false;
  scrub.addEventListener('input', () => { dragging = true; clock.seek((scrub.value / 1000) * duration); });
  scrub.addEventListener('change', () => { dragging = false; });

  $('playBtn').onclick = () => clock.toggle();
  $('rateBtn').onclick = () => {
    clock.rate = clock.rate === 1 ? 0.35 : clock.rate === 0.35 ? 2 : 1;
    text($('rateBtn'), `${clock.rate}×`);
  };
  $('loopBtn').onclick = () => {
    clock.loop = !clock.loop;
    // Dev chrome only — the class is styled in lib/film.css so no colour is
    // named in JS. It never appears under ?export.
    $('loopBtn').classList.toggle('off', !clock.loop);
  };

  addEventListener('keydown', (e) => {
    if (e.key === ' ') { e.preventDefault(); clock.toggle(); }
    else if (e.key === 'ArrowRight') { clock.pause(); clock.seek(clock.t + (e.shiftKey ? 1 : 1 / 60)); }
    else if (e.key === 'ArrowLeft') { clock.pause(); clock.seek(clock.t - (e.shiftKey ? 1 : 1 / 60)); }
    else if (e.key === 'h' || e.key === 'H') {
      document.body.classList.toggle('nochrome');
      $('devbar').classList.toggle('hide');
      fit();
    } else if (e.key === 'g' || e.key === 'G') {
      toggleSafeZone();
    } else if (e.key >= '1' && e.key <= '9') {
      const s = scenes[+e.key - 1];
      if (s) clock.seek(s.t0);
    }
  });

  const tick = () => {
    requestAnimationFrame(tick);
    if (!dragging) scrub.value = Math.round((clock.t / duration) * 1000);
    text($('tc'), `${clock.t.toFixed(2)} / ${duration.toFixed(2)}`);
    text($('playBtn'), clock.playing ? '❚❚' : '▶');
  };
  tick();

  /* ---------- go ---------- */

  clock.seek(0);
  const settled = ready.then(() => { render(clock.t); return true; });

  window.PK = {
    clock,
    DURATION: duration,
    SCENES: scenes,
    ready: settled,
    seek: (t) => { clock.pause(); clock.seek(t); },
    /** Draw one frame synchronously, so a capture can never race the renderer.
     *  A film that shows footage passes `settle(t)`: a promise that resolves
     *  when that frame's images are decoded. The capture tools await it, so a
     *  footage frame can never be grabbed half-loaded. Films without footage
     *  return undefined here and nothing changes for them. */
    frame: (t) => { clock.pause(); clock.t = t; render(t); return settle ? settle(t) : undefined; },
  };

  if (new URLSearchParams(location.search).has('export')) {
    document.body.classList.add('nochrome');
    $('devbar').classList.add('hide');
    clock.pause();
    fit();
  } else {
    settled.then(() => clock.play());
  }

  return clock;
}

/** Fonts, faces and anything else that has to be in memory before frame one. */
export function preload(photos = []) {
  return Promise.all([
    document.fonts.ready,
    ...photos.map((src) => new Promise((res) => {
      const img = new Image();
      img.onload = img.onerror = res;
      img.src = src;
    })),
    ...Array.from(document.images).map((i) => i.decode().catch(() => {})),
  ]);
}
