// Renders the Open Graph share cards in og/ from card.html using headless Chromium.
// Run: node tools/og/build.mjs   (see tools/og/README.md for setup)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { cropTop } from './crop.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium';
const WIDTH = 1200;
const HEIGHT = 630;

const chrome = (args) =>
  execFileSync(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString();

// --window-size includes window chrome, so the viewport comes out shorter than
// the window. Headless captures the full window height but only paints inside
// the viewport, leaving a dead band across the bottom of the card. So render
// with the window oversized by the inset (viewport lands at exactly HEIGHT,
// everything paints) and crop the leftover rows back off. The inset varies by
// Chromium version, so measure it rather than hard-coding it.
function viewportInset(tmpDir) {
  const probe = resolve(tmpDir, 'probe.html');
  writeFileSync(probe, '<html><body><b id="v"></b><script>v.textContent=innerHeight</script></body></html>');
  const dom = chrome([`--window-size=${WIDTH},${HEIGHT}`, '--dump-dom', `file://${probe}`]);
  const inner = Number(dom.match(/<b id="v">(\d+)<\/b>/)?.[1]);
  if (!inner) throw new Error('could not measure headless viewport height');
  return HEIGHT - inner;
}

// The live site uses the platform's system font (SF Pro on Apple devices), which
// can't be fetched or redistributed. Inter is the closest open match, and fixing
// the font keeps renders identical on any machine. Fetched on demand rather than
// vendored, so the repo carries no font binaries. Cached in .fonts/.
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700';
const FONT_WEIGHTS = [500, 600, 700];

async function ensureFonts(cacheDir) {
  mkdirSync(cacheDir, { recursive: true });
  const missing = FONT_WEIGHTS.filter((w) => !existsSync(resolve(cacheDir, `inter-${w}.ttf`)));
  if (!missing.length) return;

  console.log(`fetching Inter (${missing.join(', ')})...`);
  const css = await fetch(FONT_CSS).then((r) => {
    if (!r.ok) throw new Error(`font CSS request failed: ${r.status}`);
    return r.text();
  });

  for (const weight of missing) {
    const block = css.split('@font-face').find((b) => b.includes(`font-weight: ${weight};`));
    const url = block?.match(/https:\/\/[^)]+\.ttf/)?.[0];
    if (!url) throw new Error(`no TTF for Inter ${weight} in the Google Fonts CSS`);
    const ttf = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`font download failed: ${r.status}`);
      return r.arrayBuffer();
    });
    writeFileSync(resolve(cacheDir, `inter-${weight}.ttf`), Buffer.from(ttf));
  }
}

const digits = (units) =>
  `<div class="digits">${units
    .map(([v, l]) => `<div class="unit"><span class="num">${v}</span><span class="unit-label">${l}</span></div>`)
    .join('')}</div>`;

// Ring at `left` (0-1) of the duration remaining, like the live timer page.
const ring = (time, left) => {
  const C = 2 * Math.PI * 94;
  return `<div class="ring-wrap"><svg class="ring" viewBox="0 0 200 200"><circle class="track" cx="100" cy="100" r="94"/>` +
    `<circle class="prog" cx="100" cy="100" r="94" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - left)).toFixed(2)}"/></svg>` +
    `<span class="num">${time}</span></div>`;
};

// Each tool gets one colour, as an OKLCH hue pair + chroma (the same palette
// shape the site derives from an emoji). Countdown uses the palette of its
// default emoji, 🎉; timer is tomato red; stopwatch is pool blue.
const CARDS = [
  {
    out: 'og/clockdown.png',
    sub: '',
    palette: { h1: 83, h2: 29, c: 0.163 },
    visual: digits([['12', 'days'], ['04', 'hours'], ['37', 'minutes'], ['52', 'seconds']]),
    headline: "Countdown Timers That Don't Suck",
    footnote: 'clockdown.us — no signup, no ads, no bloat',
  },
  {
    out: 'og/timer.png',
    sub: ' / timer',
    palette: { h1: 28, h2: 60, c: 0.17 },
    visual: ring('18:42', 0.75),
    headline: 'Countdown From Any Duration',
    footnote: 'clockdown.us/timer — pause, resume, reset',
  },
  {
    out: 'og/stopwatch.png',
    sub: ' / stopwatch',
    palette: { h1: 240, h2: 196, c: 0.15 },
    visual: '<div class="readout"><span class="num">12:47.30</span></div>',
    headline: 'Count Up With Laps',
    footnote: 'clockdown.us/stopwatch — start, split, share',
  },
];

const template = readFileSync(resolve(here, 'card.html'), 'utf8');
const fonts = resolve(here, '.fonts');
await ensureFonts(fonts);

const tmp = resolve(here, '.build');
mkdirSync(tmp, { recursive: true });
// card.html loads the fonts by relative path, so the render dir needs copies.
for (const weight of FONT_WEIGHTS) {
  writeFileSync(resolve(tmp, `inter-${weight}.ttf`), readFileSync(resolve(fonts, `inter-${weight}.ttf`)));
}

const inset = viewportInset(tmp);

for (const card of CARDS) {
  const slots = { ...card.palette, sub: card.sub, visual: card.visual, headline: card.headline, footnote: card.footnote };
  const html = template.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    if (!(key in slots)) throw new Error(`card.html slot {{${key}}} has no value for ${card.out}`);
    return String(slots[key]);
  });

  const page = resolve(tmp, 'page.html');
  writeFileSync(page, html);
  const png = resolve(repo, card.out);
  mkdirSync(dirname(png), { recursive: true });

  chrome([
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${WIDTH},${HEIGHT + inset}`,
    `--screenshot=${png}`,
    `file://${page}`,
  ]);
  writeFileSync(png, cropTop(readFileSync(png), HEIGHT));

  console.log(`rendered ${card.out} (${WIDTH}x${HEIGHT})`);
}

rmSync(tmp, { recursive: true, force: true });
