# Spot Finder (Hacklanta 2026)

A photographer uploads a client's moodboard. Spot Finder reads the look, ranks Atlanta locations that fit it, adds the golden-hour window and the weather, writes a shot list, and produces a printable proposal.

The full flow already works in **mock mode** with no API key. Each teammate swaps their mock piece for the real thing.

```
photos + date  ─► POST /api/plan      ─► Gemini tags the look ─► match.js ranks locations ─► top 3 + golden hour + weather
edit tags      ─► POST /api/rematch   ─► re-rank with the corrected tags (no extra Gemini call)
pick a spot    ─► POST /api/shotlist  ─► Gemini writes 5 to 8 shots for that spot
rate + hours   ─► POST /api/proposal  ─► printable proposal (pricing is plain code, never AI)
share         ─► /p.html#…           ─► client opens the proposal from the link itself (nothing stored)
```

Nothing is stored. Uploaded photos live in memory for a single request.

## Run it locally

```bash
git clone https://github.com/invaderdrew-dot/spotfinder
cd spotfinder
npm install
npm start            # http://localhost:3000
npm run test-match   # checks that each demo moodboard ranks the right spot first
```

For real AI, get a free key at aistudio.google.com and start with `GEMINI_API_KEY=your-key npm start`. Never commit the key.

## How we work

- **Build in Claude Code.** Clone the repo, `cd spotfinder`, run `claude`, and ask for changes to your own files. `CLAUDE.md` tells Claude Code the team rules, so it stays inside your files.
- **Host on Replit.** Andrew imports this repo into Replit (Create → Import from GitHub), adds `GEMINI_API_KEY` under Secrets, and clicks Run. That Replit app is the official demo.
- `git pull` before you start. Commit and `git push` when your piece works.
- **Only edit the files you own.** That keeps merges painless.

## Who owns what

| Person | Files | Goal | Done when |
|---|---|---|---|
| Teammate 1: Frontend | `public/index.html`, `public/app.js`, `public/proposal.js`, `public/style.css` | Make the 4 screens feel like a real product | Spot cards and the proposal look demo-ready |
| Teammate 2: Dataset + matching | `data/locations.json`, `lib/match.js`, `lib/match.test.js` | Grow to 12 to 15 Atlanta spots with real photos | `npm run test-match` passes |
| Frankelly (frankellyfeliz): Gemini | `lib/gemini.js`, `data/vocabulary.json` | Real moodboard analysis and shot lists | 3 real photos come back with sensible tags |
| Andrew: Backend, timing, reliability | `server.js`, `lib/timing.js`, `public/share.js`, `public/p.html` | Weather-smart timing, shareable proposal links, demo never breaks | No crashes; right golden-hour window picked from the forecast |

## Rules

- **Data shapes are shared.** Tell the team before you rename or remove a JSON field.
- **Tags come only from `data/vocabulary.json`**, for both Gemini output and locations, or matching breaks.
- **Every `VERIFY` note must be checked** (coordinates, access, permit rules) before the demo. Set `"verified": true` when it's checked.
- **Photos:** only use photos you took or have permission to use. Save them in `public/locations/` and set `"photoUrl": "/locations/atl-001.jpg"`.
- **AI never sets prices.** The photographer types the rate.

## Checkpoints

| Time | Goal |
|---|---|
| 7 PM Sat | Real Gemini tags and 8+ locations |
| 9 PM Sat | Real shot lists, screens styled |
| Midnight Sat | Full flow with real photos, all 3 demo moodboards tested |
| 9 AM Sun | Polish, backup demo video, pitch rehearsed |
