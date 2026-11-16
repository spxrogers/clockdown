# Share cards (`og/*.png`)

Generates the Open Graph images that iMessage, Slack, X, WhatsApp and Facebook
show when a clockdown link is pasted.

```sh
node tools/og/build.mjs
```

Outputs `og/clockdown.png`, `og/timer.png` and `og/stopwatch.png` at 1200×630.
Commit the regenerated PNGs — the site is static, so they ship as files.

This directory is excluded from the deploy (see `.github/workflows/deploy.yml`);
only `og/` is published.

## Requirements

- Node 18+ (uses the built-in `fetch`; no npm dependencies)
- Chromium. Set `CHROME_BIN` if it isn't at `/opt/pw-browsers/chromium`:
  ```sh
  CHROME_BIN=/usr/bin/chromium node tools/og/build.mjs
  ```

Inter is downloaded from Google Fonts on first run and cached in `.fonts/`
(gitignored), so no font binaries live in the repo. The live site uses the
platform's system font (SF Pro on Apple devices), which can't be fetched or
redistributed; Inter is the closest open match, and pinning it keeps renders
identical on every machine.

## Editing a card

`card.html` is the shared layout; the per-card text, visual and colour live in
the `CARDS` array in `build.mjs`. The layout deliberately mirrors the live
counter page in dark appearance — black, white tabular numerals, no tiles, and
one soft two-colour wash — so the preview looks like the page it links to.

Each card's colour is a `palette: { h1, h2, c }`: two OKLCH hues and a chroma,
the same shape the site derives from a counter's emoji (see `CD.paint()` in
any page). The countdown card uses the palette of its default emoji, 🎉; the
timer is tomato red; the stopwatch is pool blue.

The cards show no event name or emoji on purpose: unfurlers can't see which
counter a link is for (see below), so a specific event would mislead whoever
receives a link to a different one.

## Why the render is fiddly

Two headless Chromium quirks are worked around in `build.mjs` and `crop.mjs`:

1. **`--window-size` includes window chrome**, so the viewport comes out ~87px
   shorter than requested. Headless captures the full window height but paints
   only inside the viewport, which leaves a dead band across the bottom of the
   card. The script measures that inset, renders oversized so the viewport lands
   at exactly 630px, then crops the extra rows back off.

2. **PNG filtering.** Chromium dithers the card's background gradient, and that
   per-pixel noise dominates the file size. The PNG spec's minimum-sum filter
   heuristic picks badly for it. Measured on these cards:

   | filter | size (avg per card) |
   | --- | --- |
   | None | 138 KB |
   | **Sub (used)** | **130 KB** |
   | Up | 172 KB |
   | Average | 161 KB |
   | Paeth | 150 KB |

   Dropping the fully-opaque alpha channel saves another 25% of raw bytes.
   Re-measure if the card design changes materially. The wash is what costs
   the space, but it is also what makes the card look like the product, so it
   stays. Browsers never fetch these; only link unfurlers do, once, and they
   cache.

## What these cards cannot do

The counter's name is **not** in them, and can't be. Every counter's data lives
in the URL's `#hash` fragment, which browsers never send to a server, and link
unfurlers don't run JavaScript. On static hosting there is no point at which a
per-counter title could be rendered.

The name does reach the recipient one other way: the in-app **Share** button
passes it as `navigator.share({ text })`, so it appears in the message body
above the preview card. See `shareCountdown()` in `index.html`.

Putting the name *in the card itself* would mean moving the data out of the
hash and into the path or query string, and serving the HTML from something
that can render per-request meta tags (a Vercel/Netlify/Cloudflare edge
function). That also means counter names would start appearing in server logs,
which they never do today.
