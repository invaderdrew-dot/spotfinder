// OWNER: Teammate 4 (backend). Wires everything together.
// Zero data: images stay in memory only, nothing is written to disk or a database.
import express from "express";
import multer from "multer";
import { readFileSync } from "fs";
import { analyzeImages, shotList, USING_MOCK } from "./lib/gemini.js";
import { rankLocations } from "./lib/match.js";
import { goldenHour, weather } from "./lib/timing.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 3 } });
const locations = () => JSON.parse(readFileSync(new URL("./data/locations.json", import.meta.url)));

app.use(express.json());
app.use(express.static("public"));

// 1) Photos + date in -> aesthetic profile + top 3 locations (with timing)
app.post("/api/plan", upload.array("photos", 3), async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().slice(0, 10);
    if (!req.files?.length && !USING_MOCK) return res.status(400).json({ error: "Upload 1 to 3 photos" });
    const profile = await analyzeImages(req.files || []);
    const top = rankLocations(profile, locations());
    const matches = await Promise.all(
      top.map(async (loc) => ({
        ...loc,
        timing: goldenHour(date, loc.lat, loc.lng),
        weather: await weather(date, loc.lat, loc.lng),
      }))
    );
    res.json({ date, profile, matches });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 2) Profile + chosen location -> shot list
app.post("/api/shotlist", async (req, res) => {
  try {
    const { profile, location } = req.body;
    res.json(await shotList(profile, location, location.timing || { window: "late afternoon" }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 3) Plan + pricing -> proposal data. Price math is deterministic, never AI.
app.post("/api/proposal", (req, res) => {
  const { clientName, date, location, plan, rate, hours } = req.body;
  const r = Number(rate) || 0;
  const h = Number(hours) || 0;
  res.json({
    clientName: clientName || "Client",
    date,
    location,
    plan,
    pricing: { rate: r, hours: h, total: Math.round(r * h * 100) / 100 },
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Spot Finder on :${PORT} ${USING_MOCK ? "(MOCK mode: add GEMINI_API_KEY to Secrets)" : "(Gemini live)"}`)
);
