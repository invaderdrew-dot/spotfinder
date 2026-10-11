// Owner: Andrew (reliability). Run with: npm run check-locations
// Read-only check of data/locations.json. Errors break the app or the demo; warnings are fixes to make before judging.
import { readFileSync, existsSync } from "node:fs";
import { rankLocations } from "../lib/match.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const vocab = read("../data/vocabulary.json");
let locations;
try {
  // Optional path argument, for testing against a copy.
  locations = process.argv[2] ? JSON.parse(readFileSync(process.argv[2])) : read("../data/locations.json");
} catch (err) {
  console.error(`✗ data/locations.json is not valid JSON: ${err.message}`);
  console.error("  Common causes: a missing comma between spots, or a trailing comma after the last one.");
  process.exit(1);
}

const CATEGORIES = ["aesthetic", "mood", "colors", "environment"];
// Rough box around metro Atlanta. Catches swapped or mistyped coordinates.
const inAtlanta = (lat, lng) => lat > 33.4 && lat < 34.2 && lng > -84.8 && lng < -84.0;
const errors = [];
const warnings = [];
const seen = new Set();

for (const [i, loc] of locations.entries()) {
  const who = `${loc.id ?? `#${i + 1}`} ${loc.name ?? "(no name)"}`;
  const err = (m) => errors.push(`${who}: ${m}`);
  const warn = (m) => warnings.push(`${who}: ${m}`);

  for (const field of ["id", "name", "neighborhood"]) if (!loc[field]) err(`missing "${field}"`);
  if (loc.id && seen.has(loc.id)) err(`duplicate id "${loc.id}"`);
  seen.add(loc.id);

  for (const c of CATEGORIES) {
    if (!Array.isArray(loc[c]) || !loc[c].length) {
      err(`"${c}" needs at least one tag`);
      continue;
    }
    for (const tag of loc[c]) {
      if (!vocab[c].includes(tag)) err(`"${tag}" is not an allowed ${c} tag (allowed: ${vocab[c].join(", ")})`);
    }
  }

  if (typeof loc.lat !== "number" || typeof loc.lng !== "number") err("lat and lng must be numbers, not text in quotes");
  else if (!inAtlanta(loc.lat, loc.lng)) err(`coordinates ${loc.lat}, ${loc.lng} aren't in Atlanta (lat first, then lng, which is negative)`);

  if (!loc.photoUrl) warn("no photo yet");
  else if (!/^\/locations\/[\w.-]+$/.test(loc.photoUrl)) err(`photoUrl should look like "/locations/${loc.id}.jpg"`);
  else if (!existsSync(new URL(`../public${loc.photoUrl}`, import.meta.url))) err(`photo file public${loc.photoUrl} doesn't exist`);

  const unchecked = ["address", "lightingNotes", "accessNotes"].filter((f) => /^VERIFY/.test(loc[f] ?? ""));
  if (loc.verified === true && unchecked.length) err(`marked verified but ${unchecked.join(", ")} still say VERIFY`);
  if (loc.verified !== true) warn(`not verified yet${unchecked.length ? ` (check ${unchecked.join(", ")})` : ""}`);
}

// Same three demo themes as lib/match.test.js.
const themes = {
  streetwear: { aesthetic: ["streetwear", "edgy"], mood: ["bold"], colors: ["vibrant"], environment: ["street-art", "urban"] },
  romantic: { aesthetic: ["romantic", "natural"], mood: ["soft", "dreamy"], colors: ["pastel"], environment: ["greenery", "water"] },
  luxury: { aesthetic: ["luxury", "editorial"], mood: ["cinematic"], colors: ["warm"], environment: ["architecture", "historic"] },
};
const notes = [];
if (!errors.length) {
  const tops = Object.entries(themes).map(([name, profile]) => [name, rankLocations(profile, locations)]);
  for (const [name, top] of tops) {
    const weak = top.filter((l) => l.score < 0.4);
    notes.push(`${name.padEnd(10)} ${top.map((l) => `${l.name} (${Math.round(l.score * 100)}%)`).join(", ")}`);
    if (weak.length) warnings.push(`${name} theme: ${weak.map((l) => l.name).join(", ")} only match${weak.length === 1 ? "es" : ""} weakly. Add more ${name} spots.`);
  }
  const counts = {};
  for (const [, top] of tops) for (const l of top) counts[l.name] = (counts[l.name] ?? 0) + 1;
  for (const [name, n] of Object.entries(counts)) {
    if (n === tops.length) warnings.push(`${name} shows up in the top 3 for every theme. Judges will notice the repeat.`);
  }
}

const verified = locations.filter((l) => l.verified === true).length;
const withPhotos = locations.filter((l) => l.photoUrl).length;
console.log(`\n${locations.length} spots · ${verified} verified · ${withPhotos} with photos (goal: 10 to 12)\n`);
if (notes.length) console.log(`Top 3 per demo theme:\n  ${notes.join("\n  ")}\n`);
for (const e of errors) console.log(`✗ ${e}`);
for (const w of warnings) console.log(`! ${w}`);
console.log(errors.length ? `\n${errors.length} error(s): fix these, the app may break.` : "\nNo errors.");
process.exit(errors.length ? 1 : 0);
