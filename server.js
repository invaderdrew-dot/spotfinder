// Owner: Andrew (backend, timing, reliability)
// Photos are held in memory for one request only. Nothing is written to disk or a database.
import express from "express";
import multer from "multer";
import { readFileSync } from "node:fs";
import { analyzeMoodboard, planShots, MOCK } from "./lib/gemini.js";
import { rankLocations } from "./lib/match.js";
import { planTiming } from "./lib/timing.js";
import { guarded, LIMITS, fallbackProfile, fallbackShots } from "./lib/reliability.js";
import { NARRATION_ENABLED, MAX_CHARS, allowNarration, speak } from "./lib/narrate.js";

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
// One line per request in the Console, e.g. "[speed] plan total=4.1s gemini=3.9s", to check the under-60s goal.
const logSpeed = (step, t) =>
  console.log(`[speed] ${step} ` + Object.entries(t).map(([k, v]) => `${k}=${typeof v === "number" && k !== "photos" ? (v / 1000).toFixed(1) + "s" : v}`).join(" "));
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

    const t0 = Date.now();
    const { value, error } = await guarded("moodboard analysis", () => analyzeMoodboard(req.files ?? []), LIMITS.analyze);
    const profile = error ? fallbackProfile() : value;
    const notice = error ? "The AI couldn't read the photos just now, so pick the style tags yourself below." : null;
    const t1 = Date.now();
    const matches = await topMatches(profile, date);
    logSpeed("plan", { photos: req.files?.length ?? 0, gemini: t1 - t0, spots: Date.now() - t1, total: Date.now() - t0, fallback: Boolean(error) });
    res.json({ date, mock: MOCK, profile, matches, notice });
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
    const t0 = Date.now();
    const { value, error } = await guarded("shot list", () => planShots(profile, location, timing), LIMITS.shots);
    // An empty or malformed list is as bad as no list.
    const ok = !error && Array.isArray(value?.shots) && value.shots.length >= 3;
    logSpeed("shotlist", { gemini: Date.now() - t0, fallback: !ok });
    if (ok) return res.json(value);
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

// Pre-demo check for /status.html: is every moving part actually working right now?
// Runs one tiny real Gemini call, so results are cached for a minute to keep it cheap.
let statusCache = null;
// "Gemini 400: {...json...}" -> "Gemini 400: API key not valid..."
const readable = (msg) => {
  const inner = msg.match(/"message":\s*"([^"]+)"/)?.[1];
  return (inner ? `${msg.split(":")[0]}: ${inner}` : msg).slice(0, 160);
};
app.get("/api/status", async (_req, res) => {
  if (statusCache && Date.now() - statusCache.at < 60000) return res.json(statusCache.body);
  const started = Date.now();
  const inTwoDays = new Date(Date.now() + 2 * 86400000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const sample = { name: "Piedmont Park", neighborhood: "Midtown", lightingNotes: "open meadow" };
  const sampleProfile = { aesthetic: ["natural"], mood: ["serene"], colors: ["earthy"], environment: ["greenery"], summary: "Soft natural portraits." };

  const [gemini, timing] = await Promise.all([
    MOCK
      ? { error: new Error("No GEMINI_API_KEY in Secrets, so the app is using mock data") }
      : guarded("status check", () => planShots(sampleProfile, sample, { window: "6:30 PM – 7:00 PM", sunset: "7:00 PM" }), 20000),
    planTiming(inTwoDays, 33.7851, -84.3738),
  ]);
  const locs = loadLocations();
  const verified = locs.filter((l) => l.verified === true).length;
  const photos = locs.filter((l) => l.photoUrl).length;
  const shots = gemini.value?.shots?.length ?? 0;

  const body = {
    checkedAt: new Date().toISOString(),
    seconds: Math.round((Date.now() - started) / 100) / 10,
    checks: [
      { name: "Gemini", ok: shots >= 3, detail: gemini.error ? readable(gemini.error.message) : `Live: wrote ${shots} test shots` },
      { name: "Weather forecast", ok: timing.weather.available, detail: timing.weather.available ? `Open-Meteo reachable (${timing.weather.highF}°F in 2 days)` : "Open-Meteo didn't answer. Spots still show golden hour." },
      { name: "Locations", ok: locs.length >= 10, detail: `${locs.length} spots (goal 10 to 12)` },
      { name: "Verified spots", ok: verified === locs.length, detail: `${verified} of ${locs.length} verified` },
      { name: "Location photos", ok: photos === locs.length, detail: `${photos} of ${locs.length} have photos` },
      { name: "ElevenLabs voice", ok: NARRATION_ENABLED, optional: true, detail: NARRATION_ENABLED ? "Key set" : "No key, so Listen uses the browser voice (fine)" },
    ],
  };
  statusCache = { at: Date.now(), body };
  res.json(body);
});

// Optional: proposal script -> ElevenLabs MP3. 204 means "no key here, use the browser's voice".
app.post("/api/narrate", async (req, res) => {
  if (!NARRATION_ENABLED) return res.status(204).end();
  const text = String(req.body?.text ?? "").trim();
  if (!text || text.length > MAX_CHARS) return res.status(400).json({ error: `Narration must be 1 to ${MAX_CHARS} characters.` });
  if (!allowNarration(req.ip)) return res.status(429).json({ error: "Too many narrations, try again in a minute." });
  try {
    res.type("audio/mpeg").send(await speak(text));
  } catch (err) {
    console.warn(`[narrate] fell back to browser voice: ${err.message.slice(0, 160)}`);
    res.status(503).json({ error: "Voice unavailable" });
  }
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
