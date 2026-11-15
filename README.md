# ⏰ clockdown

**A social countdown timer website that doesn't suck.**

Make a countdown, give it a name and an emoji, send the link to your friends. No signup, no ads, no bloat.

👉 **[clockdown.us](https://clockdown.us)**

## What's in the box

| | | |
| --- | --- | --- |
| 🎉 **Countdown** | [clockdown.us](https://clockdown.us) | Count down to a date and time, in any timezone. Confetti when it hits zero. |
| ⏲️ **Timer** | [clockdown.us/timer](https://clockdown.us/timer/) | Count down from a duration, with pause, resume and reset. |
| ⏱️ **Stopwatch** | [clockdown.us/stopwatch](https://clockdown.us/stopwatch/) | Count up, with lap splits. |

Each one has a creator with a live preview, five themes (`galaxy`, `sunset`, `ocean`, `neon`, `minimal`) and a Share button that uses your phone's native share sheet when it can.

Want the backstory? [Read the motivation →](https://clockdown.us/motivation/)

## The URL *is* the data

There's no backend and no database. Everything about a counter lives in the link's `#hash`:

```
https://clockdown.us/#t=2026-12-31T00:00&tz=America/New_York&n=New%20Year&e=🎉
```

| Param | Used by | Meaning |
| --- | --- | --- |
| `t` | countdown | Target date and time (`YYYY-MM-DDTHH:MM`) |
| `tz` | countdown | IANA timezone of `t` (defaults to the viewer's) |
| `d` | timer | Duration in seconds |
| `s` | stopwatch | Always `1`; marks a stopwatch link |
| `n` | all | Name (optional) |
| `e` | all | Emoji (optional) |
| `bg` | all | Theme (optional, defaults to `galaxy`) |

Browsers never send the hash to a server, so counter names don't show up in anyone's logs, ours included.

## Running it locally

There's no build step and nothing to install. Each page is a single HTML file with its CSS and JS inline. Serve the repo root with any static server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (Opening `index.html` straight from disk mostly works too, but the links between pages expect a server.)

## Project layout

```
index.html             countdown (the home page)
timer/index.html       timer
stopwatch/index.html   stopwatch
motivation/index.html  the "why"
404.html               not-found page
og/                    link-preview images shown by iMessage, Slack, etc.
tools/og/              script that renders og/*.png (see its README)
CNAME                  custom domain for GitHub Pages
```

## Deploying

It's all GitHub Actions and GitHub Pages:

- **Push to `main`** and [`deploy.yml`](.github/workflows/deploy.yml) copies the site to the `gh-pages` branch. Markdown, `tools/` and CI files are left out.
- **Open a PR** and [`pr-preview.yml`](.github/workflows/pr-preview.yml) publishes it to `https://clockdown.us/pr/<number>/` and comments the link on the PR. The preview is removed when the PR closes.

New pages and folders deploy on their own; there's no list to update.

## Link previews

The cards in `og/` are generated, not hand-drawn. If you change the design, regenerate them with `node tools/og/build.mjs` and commit the PNGs. [`tools/og/README.md`](tools/og/README.md) has the details, including why a card can't show a counter's name.
