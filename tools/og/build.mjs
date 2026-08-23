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

// Space Grotesk is fetched on demand rather than vendored, so the repo carries
// no font binaries (and no OFL redistribution obligations). Cached in .fonts/.
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700';
const FONT_WEIGHTS = [500, 700];

async function ensureFonts(cacheDir) {
  mkdirSync(cacheDir, { recursive: true });
  const missing = FONT_WEIGHTS.filter((w) => !existsSync(resolve(cacheDir, `sg-${w}.ttf`)));
  if (!missing.length) return;

  console.log(`fetching Space Grotesk (${missing.join(', ')})...`);
  const css = await fetch(FONT_CSS).then((r) => {
    if (!r.ok) throw new Error(`font CSS request failed: ${r.status}`);
    return r.text();
  });

  for (const weight of missing) {
    const block = css.split('@font-face').find((b) => b.includes(`font-weight: ${weight};`));
    const url = block?.match(/https:\/\/[^)]+\.ttf/)?.[0];
    if (!url) throw new Error(`no TTF for Space Grotesk ${weight} in the Google Fonts CSS`);
    const ttf = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`font download failed: ${r.status}`);
      return r.arrayBuffer();
    });
    writeFileSync(resolve(cacheDir, `sg-${weight}.ttf`), Buffer.from(ttf));
  }
}

const unit = (value, label) =>
  `<div class="timer-unit"><div class="timer-digits"><span class="digit-value">${value}</span></div><span class="digit-label">${label}</span></div>`;

const grid = (units) =>
  units.map(([v, l]) => unit(v, l)).join('<span class="timer-colon">:</span>');

const CARDS = [
  {
    out: 'og/clockdown.png',
    sub: '',
    grid: grid([['12', 'Days'], ['04', 'Hours'], ['37', 'Minutes'], ['52', 'Seconds']]),
    headline: "Countdown Timers That Don't Suck",
    footnote: 'clockdown.us — no signup, no ads, no bloat',
  },
  {
    out: 'og/timer.png',
    sub: ' / timer',
    grid: grid([['00', 'Hours'], ['25', 'Minutes'], ['00', 'Seconds']]),
    headline: 'Countdown From Any Duration',
    footnote: 'clockdown.us/timer — pause, resume, reset',
  },
  {
    out: 'og/stopwatch.png',
    sub: ' / stopwatch',
    grid: grid([['00', 'Hours'], ['12', 'Minutes'], ['47', 'Seconds']]),
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
  writeFileSync(resolve(tmp, `sg-${weight}.ttf`), readFileSync(resolve(fonts, `sg-${weight}.ttf`)));
}

const inset = viewportInset(tmp);

for (const card of CARDS) {
  const html = template
    .replace('data-slot="sub"></span>', `data-slot="sub">${card.sub}</span>`)
    .replace('data-slot="grid"></div>', `data-slot="grid">${card.grid}</div>`)
    .replace('data-slot="headline"></div>', `data-slot="headline">${card.headline}</div>`)
    .replace('data-slot="footnote"></div>', `data-slot="footnote">${card.footnote}</div>`);

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
