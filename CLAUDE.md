# Spot Finder: notes for Claude Code

Hackathon app (Hacklanta 2026, built in a weekend by 4 people). It turns a client's moodboard into a shoot-ready proposal: Gemini tags the look, `lib/match.js` ranks curated Atlanta spots, then come timing, a shot list and a printable proposal. See README.md for ownership and checkpoints.

## Commands
- `npm start`: runs the server on :3000. Without `GEMINI_API_KEY` it uses mock data.
- `npm run test-match`: each demo moodboard must rank its expected spot first. Run it after touching `data/locations.json` or `lib/match.js`.

## Stack
Node 20+, Express, ES modules, and a plain HTML/CSS/JS frontend with no build step. Don't add frameworks, bundlers or new dependencies unless the team agrees.

## Team rules (follow these when editing)
- **Only edit files owned by the person you're working for.** Ownership is in the README table. If a change needs someone else's file, stop and say what they need to change instead of editing it.
- **Don't change data shapes** (JSON fields in API responses, `locations.json`, `vocabulary.json`) without saying so clearly. Other teammates' code depends on them.
- **Tags must come from `data/vocabulary.json`**, both in Gemini output and in locations.
- **Never invent location facts.** Anything unchecked stays prefixed with `VERIFY:` and `"verified": false`.
- **Prices are never AI-generated.** Pricing is plain arithmetic on the photographer's own numbers.
- **Zero data:** uploaded photos stay in memory for one request. Don't write them to disk, log them, or add a database or accounts.
- Every Gemini path must keep a working mock fallback so nobody is blocked without a key.
- Never commit API keys or `.env` files.

## Git
Run `git pull` before starting. Commit small, focused changes and push when they work. If a pull conflicts in a file you don't own, keep the owner's version.
