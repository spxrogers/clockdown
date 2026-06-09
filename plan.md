# Clockdown — Countdown Timers That Don't Suck

## Architecture
Single `index.html` with embedded CSS + JS. Zero dependencies, zero build step. Deploys anywhere static files are served (GitHub Pages, Vercel, Netlify, S3).

## URL-Based Sharing
All countdown data lives in the URL hash fragment:

```
clockdown.us/#t=2025-12-31T00:00&n=New%20Years%20Eve&e=🎉
```

Parameters:
- `t` — target datetime (ISO 8601)
- `n` — event name
- `e` — emoji/icon (optional, defaults to a clock)
- `bg` — background theme (optional, e.g. `confetti`, `stars`, `gradient`)

No backend. No database. The URL **is** the data.

## Two Modes

1. **Creator mode** (`clockdown.us`) — Form to set event name, date/time, emoji, and theme. Live preview updates as you type. Big "Copy Link" button generates the hash URL.

2. **Countdown mode** (`clockdown.us/#t=...`) — Full-screen countdown with animated digits, event name, emoji, and background effect. When it hits zero: confetti explosion + celebration animation.

## Design Direction (Partiful-inspired)
- Dark base with bold accent color (electric purple/pink gradient)
- Big, chunky, animated digits with flip/morph transitions
- Glassmorphism cards for the creator form
- Animated backgrounds — subtle particle/gradient animations, theme-selectable
- Confetti/fireworks on completion (canvas-based, lightweight)
- Mobile-first responsive layout
- One Google Font (e.g. Inter or Space Grotesk) for modern feel

## Tech Stack
- Vanilla HTML/CSS/JS — single file, no framework
- CSS animations for digit transitions
- Canvas API for confetti/particle effects
- Web Share API for native mobile sharing (with clipboard fallback)
- No external dependencies

## File Structure
```
index.html          <- everything (HTML + <style> + <script>)
CNAME               <- for GitHub Pages custom domain
README.md
```

## Implementation Order
1. Countdown display engine (parsing URL, ticking digits)
2. Visual design + digit animations
3. Creator form with live preview
4. Share/copy link functionality
5. Background themes + completion celebration
6. Mobile polish + Web Share API
7. Deploy to GitHub Pages

## V2 Hooks (built-in but disabled)
- Empty `<div id="ad-slot">` ready for Adsterra
- GA snippet placeholder (commented out)
