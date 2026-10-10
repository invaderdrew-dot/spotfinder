# Spot Finder: Hacklanta 2026

From moodboard to shoot-ready proposal. **Already works end to end in mock mode.** Each person replaces their mock piece with the real thing.

## 1. Get it running on Replit (Andrew, 10 min)

1. Create a **free GitHub repo** called `spotfinder` and upload every file in this folder (drag and drop on github.com works).
2. In Replit: **Create → Import from GitHub → pick the repo.**
3. In Replit **Secrets** add `GEMINI_API_KEY` (free key from aistudio.google.com).
4. Click **Run** (or run `npm install && npm start` in the Shell). The app opens in the preview.

No key yet? It still runs on fake "MOCK" data, so nobody is blocked.

## 2. How 4 people work on it for free (no paid Replit plan)

- Everyone imports **the same GitHub repo** into **their own free Replit** (step 1, items 2 to 4).
- **Only edit your own files** (table below). That's what prevents broken merges.
- When your piece works: Replit's **Git** panel → commit → **push**.
- Andrew's Replit is the official demo app. At each checkpoint, Andrew **pulls**, runs it, and everyone tests together.
- Before you start working each time: **pull** first.

## 3. Who owns what

| Person | Files | First goal | Done when |
|---|---|---|---|
| Teammate 1: Frontend | `public/index.html`, `public/app.js`, `public/style.css` | Make the 4 screens look great | Results cards and proposal look like a real product |
| Teammate 2: Dataset + matching | `data/locations.json`, `lib/match.js` | Grow to 12 to 15 Atlanta spots with real photos | `npm run test-match` puts the right spot on top for all 3 demo moodboards |
| Teammate 3: Gemini | `lib/gemini.js`, `data/vocabulary.json` | Real image analysis + shot lists | Uploading 3 real photos returns sensible tags |
| Teammate 4: Backend + timing | `server.js`, `lib/timing.js` | Keep endpoints solid, real weather | No crashes; weather shows for dates within ~2 weeks |
| Andrew | Repo, merging, demo moodboards, pitch | Get step 1 done, ask organizers the rules | Demo flow rehearsed |

## 4. Rules everyone follows

- **Don't change the data shapes** (the JSON fields) without telling the team.
- **Tags must come from `data/vocabulary.json`**, for both Gemini and locations, or matching breaks.
- **Location facts marked `VERIFY` must be checked** (coordinates, access, permit rules) before the demo. Set `"verified": true` when done.
- **Photos:** use photos you took or are allowed to use. Put them in `public/locations/` and set `"photoUrl": "/locations/atl-001.jpg"`.
- **Prices are never made up by AI.** The photographer types the rate.

## 5. Checkpoints

| Time | Goal |
|---|---|
| 7 PM Sat | Real Gemini tags + 8 or more locations |
| 9 PM Sat | Real shot lists, screens styled |
| Midnight Sat | Full flow with real photos, all 3 demo moodboards tested |
| 9 AM Sun | Polish, backup demo video, pitch rehearsed |

## How it works

```
photos + date ─► /api/plan ─► Gemini tags the look ─► match.js ranks locations.json ─► top 3 + golden hour + weather
pick a spot   ─► /api/shotlist ─► Gemini writes 5 to 8 shots for that spot
rate + hours  ─► /api/proposal ─► printable client proposal (math is plain code)
```

Nothing is saved anywhere. Photos stay in memory for one request.
