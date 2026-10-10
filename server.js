// Owner: Andrew (backend, timing, reliability)
// Photos are held in memory for one request only. Nothing is written to disk or a database.
import express from "express";
import multer from "multer";
import { readFileSync } from "node:fs";
import { analyzeMoodboard, planShots, MOCK } from "./lib/gemini.js";
import { rankLocations } from "./lib/match.js";
import { planTiming } from "./lib/timing.js";
import { guarded, LIMITS, fallbackProfile, fallbackShots } from "./lib/reliability.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

// Read on every request so dataset edits show up without a restart.
const loadLocations = () => JSON.parse(readFileSync(new URL("./data/locations.json", import.meta.url)));
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const vocabulary = JSON.parse(readFileSync(new URL("./data/vocabulary.json", import.meta.url)));
const validDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d ?? "") ? d : today());

const topMatches = (profile, date) =>
  Promise.all(
    rankLocations(profile, loadLocations()).map(async (loc) => ({ ...loc, ...(await planTiming(date, loc.lat, loc.lng)) }))
  );

app.get("/api/health", (_req, res) => res.json({ ok: true, mock: MOCK }));
app.get("/api/vocabulary", (_req, res) => res.json(vocabulary));

// Step 1: moodboard + date -> aesthetic profile and top 3 spots with timing and weather.
app.post("/api/plan", upload.array("photos", 3), async (req, res, next) => {
  try {
    const date = validDate(req.body.date);
    if (!req.files?.length && !MOCK) return res.status(400).json({ error: "Upload 1 to 3 photos." });

    const { value, error } = await guarded("moodboard analysis", () => analyzeMoodboard(req.files ?? []), LIMITS.analyze);
    const profile = error ? fallbackProfile() : value;
    const notice = error ? "The AI couldn't read the photos just now, so pick the style tags yourself below." : null;
    res.json({ date, mock: MOCK, profile, matches: await topMatches(profile, date), notice });
  } catch (err) {
    next(err);
  }
});

// Step 1b: the photographer edited the style tags -> re-rank without calling Gemini again.
app.post("/api/rematch", async (req, res, next) => {
  try {
    const { profile, date } = req.body ?? {};
    if (!profile) return res.status(400).json({ error: "Missing profile." });
    for (const category of Object.keys(vocabulary).filter((k) => !k.startsWith("_"))) {
      profile[category] = (profile[category] ?? []).filter((t) => vocabulary[category].includes(t));
    }
    res.json({ matches: await topMatches(profile, validDate(date)) });
  } catch (err) {
    next(err);
  }
});

// Step 2: profile + chosen spot -> shot list.
app.post("/api/shotlist", async (req, res, next) => {
  try {
    const { profile, location } = req.body ?? {};
    if (!profile || !location?.name) return res.status(400).json({ error: "Missing profile or location." });
    const timing = location.timing ?? { window: "late afternoon", sunset: "sunset" };
    const { value, error } = await guarded("shot list", () => planShots(profile, location, timing), LIMITS.shots);
    // An empty or malformed list is as bad as no list.
    if (!error && Array.isArray(value?.shots) && value.shots.length >= 3) return res.json(value);
    res.json({ ...fallbackShots(location, timing), notice: "The AI shot writer didn't respond, so here's a basic shot list to start from." });
  } catch (err) {
    next(err);
  }
});

// Step 3: plan + photographer's rate -> proposal. Pricing is plain arithmetic and never comes from AI.
app.post("/api/proposal", (req, res) => {
  const { clientName, photographerName, date, location, profile, shots, rate, hours } = req.body ?? {};
  const r = Math.max(0, Number(rate) || 0);
  const h = Math.max(0, Number(hours) || 0);
  res.json({
    clientName: clientName?.trim() || "Client",
    photographerName: photographerName?.trim() || "",
    date,
    location,
    profile,
    shots,
    pricing: { rate: r, hours: h, total: Math.round(r * h * 100) / 100 },
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err instanceof multer.MulterError ? 400 : 500;
  res.status(status).json({ error: err.message || "Something went wrong." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Spot Finder running on port ${PORT} ${MOCK ? "(mock mode: set GEMINI_API_KEY for real AI)" : "(Gemini live)"}`);
});
