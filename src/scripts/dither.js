// The jerboa backdrop: sand drawn with ordered dithering, in the brand orange.
//
//   <canvas data-dither="desert"></canvas>  dunes to the horizon, for a hero
//   <canvas data-dither="dunes"></canvas>   a row of dunes, for the footer
//
// Each canvas is drawn at one pixel per dot (--dither-cell CSS pixels) and
// scaled up unsmoothed, so a frame costs a few thousand pixels. Colours come
// from the tokens (--accent, --accent-deep). The picture moves slowly, only
// while it is on screen, and stays still under prefers-reduced-motion.
//
// The same file runs on jerboa.dev, docs.jerboa.dev and the hub
// (public/dither.js): keep the three copies identical.

// 8×8 Bayer matrix: the order in which dots switch on as a tone gets lighter.
const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
].map((n) => (n + 0.5) / 64);

const FRAME_MS = 90;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

// Tone (0 dark … 1 light) of the dot at x, y at time t, per picture.
// A ridge of sand: its crest line at x, as two sine waves that drift apart.
const crestAt = (x, t, i, base, swell, ripple) =>
  base - swell * Math.sin((x + t * (0.4 + i * 0.3)) * (0.021 + i * 0.008) + i * 2.3)
       - ripple * Math.sin((x - t * (0.2 + i * 0.15)) * (0.053 + i * 0.009) + i);

const scenes = {
  // A row of three dunes, far to near, for the footer. Each has a lit crest
  // line and a slope that falls into shade; a nearer dune hides those behind.
  dunes(x, y, t, w, h) {
    let tone = 0;
    for (let i = 0; i < 3; i++) {
      const crest = crestAt(x, t, i, h * (0.4 + i * 0.2), h * 0.28, h * 0.07);
      if (y < crest) continue;
      const depth = Math.min(1, (y - crest) / (h * 0.4));
      tone = y - crest < 1 ? 1 : (0.2 + i * 0.2) * (1 - 0.7 * depth);
    }
    return tone;
  },
  // The same dunes as a whole landscape, for a hero: six ridges receding to
  // a hazy horizon under a crescent moon.
  desert(x, y, t, w, h) {
    // Dunes are sized in dots, not in shares of the height, so they look the
    // same in a tall hero and in a short title band.
    const swell = Math.min(h * 0.09, 9);
    const horizon = h * 0.46;
    let tone = 0;
    for (let i = 0; i < 6; i++) {
      const crest = crestAt(x, t, i, horizon + (h - horizon) * (i / 6), swell * (0.6 + i * 0.16), swell * 0.25);
      if (y < crest) continue;
      const depth = Math.min(1, (y - crest) / (h * 0.16));
      tone = y - crest < 1 ? 1 : (0.1 + i * 0.1) * (1 - 0.65 * depth);
    }
    if (tone) return tone;
    // Sky: the moon, lit on its right side and kept near the top however tall
    // the hero is, and haze just above the horizon.
    const r = Math.max(5, Math.min(w, h) * 0.055);
    const mx = x - w * 0.9, my = y - Math.min(h * 0.2, 28);
    if (mx * mx + my * my < r * r) {
      const sx = mx + r * 0.45, sy = my + r * 0.15;
      return sx * sx + sy * sy < r * r ? 0.1 : 1;
    }
    return Math.max(0, 0.16 * (1 - (horizon - swell - y) / (h * 0.18)));
  },
};

// A CSS colour as [r, g, b], resolved by the canvas itself.
function rgb(ctx, value) {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = value.trim() || 'transparent';
  ctx.fillRect(0, 0, 1, 1);
  return ctx.getImageData(0, 0, 1, 1).data.slice(0, 3);
}

function start(canvas) {
  const scene = scenes[canvas.dataset.dither] ?? scenes.dunes;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const style = getComputedStyle(canvas);
  const cell = parseFloat(style.getPropertyValue('--dither-cell')) || 4;
  const hi = rgb(ctx, style.getPropertyValue('--accent'));
  const lo = rgb(ctx, style.getPropertyValue('--accent-deep'));
  // Each canvas starts elsewhere in time, so two on a page never match.
  const offset = (canvas.dataset.dither ?? '').length * 7.3;
  let image = null;
  let visible = false;
  let timer = 0;

  function resize() {
    const w = Math.max(1, Math.ceil(canvas.clientWidth / cell));
    const h = Math.max(1, Math.ceil(canvas.clientHeight / cell));
    if (image && image.width === w && image.height === h) return;
    canvas.width = w;
    canvas.height = h;
    image = ctx.createImageData(w, h);
    draw();
  }

  function draw() {
    if (!image) return;
    const { width: w, height: h, data } = image;
    const t = offset + (reduced.matches ? 0 : performance.now() / 1000);
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i += 4) {
        const tone = scene(x, y, t, w, h);
        const edge = BAYER[(y & 7) * 8 + (x & 7)];
        if (tone <= edge) { data[i + 3] = 0; continue; }
        // The lightest tones take the full accent; the rest its deep shade.
        const c = tone - edge > 0.3 ? hi : lo;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function tick() {
    clearTimeout(timer);
    if (!canvas.isConnected) return stop();
    if (!visible || document.hidden || reduced.matches) return;
    draw();
    timer = setTimeout(() => requestAnimationFrame(tick), FRAME_MS);
  }

  const sized = new ResizeObserver(resize);
  const seen = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    tick();
  });
  function stop() {
    clearTimeout(timer);
    sized.disconnect();
    seen.disconnect();
    document.removeEventListener('visibilitychange', tick);
    reduced.removeEventListener('change', tick);
  }
  sized.observe(canvas);
  seen.observe(canvas);
  document.addEventListener('visibilitychange', tick);
  reduced.addEventListener('change', tick);
  resize();
}

function init() {
  document.querySelectorAll('canvas[data-dither]:not([data-dither-on])').forEach((canvas) => {
    canvas.setAttribute('data-dither-on', '');
    start(canvas);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
// Astro swaps the page without reloading scripts.
document.addEventListener('astro:page-load', init);
