// Owner: Andrew (reliability). Run with: npm run eval-match
// Scores the matcher against realistic moodboard profiles (the kind of tags Gemini returns).
// For each profile: which spots would a photographer accept at #1, and which would look wrong anywhere in the top 3.
import { readFileSync } from "node:fs";
import { rankLocations } from "../lib/match.js";

const locations = JSON.parse(readFileSync(new URL("../data/locations.json", import.meta.url)));
const name = Object.fromEntries(locations.map((l) => [l.id, l.name]));

const cases = [
  { label: "streetwear graffiti", p: { aesthetic: ["streetwear", "edgy"], mood: ["bold", "energetic"], colors: ["vibrant"], environment: ["street-art", "urban"] },
    top: ["atl-001", "atl-015"], never: ["atl-003", "atl-007", "atl-012", "atl-010"] },
  { label: "soft romantic garden", p: { aesthetic: ["romantic", "natural"], mood: ["soft", "dreamy"], colors: ["pastel"], environment: ["greenery"] },
    top: ["atl-003", "atl-007", "atl-004"], never: ["atl-001", "atl-008", "atl-014", "atl-015"] },
  { label: "luxury editorial", p: { aesthetic: ["luxury", "editorial"], mood: ["cinematic"], colors: ["warm"], environment: ["architecture", "historic"] },
    top: ["atl-005", "atl-012", "atl-010"], never: ["atl-001", "atl-015", "atl-006"] },
  { label: "moody industrial", p: { aesthetic: ["edgy", "editorial"], mood: ["moody", "cinematic"], colors: ["muted", "monochrome"], environment: ["industrial"] },
    top: ["atl-008", "atl-014", "atl-001"], never: ["atl-003", "atl-007", "atl-004"] },
  { label: "casual lifestyle park", p: { aesthetic: ["casual", "natural"], mood: ["playful", "serene"], colors: ["warm", "earthy"], environment: ["greenery"] },
    top: ["atl-004", "atl-006", "atl-003"], never: ["atl-012", "atl-010", "atl-001"] },
  { label: "city skyline night-out", p: { aesthetic: ["glam", "editorial"], mood: ["cinematic", "bold"], colors: ["cool"], environment: ["skyline", "rooftop"] },
    top: ["atl-013", "atl-002"], never: ["atl-003", "atl-007"] },
  { label: "vintage old-Hollywood", p: { aesthetic: ["vintage", "glam"], mood: ["dreamy", "cinematic"], colors: ["warm"], environment: ["historic", "indoor"] },
    top: ["atl-012"], never: ["atl-001", "atl-006", "atl-004"] },
  { label: "clean minimal", p: { aesthetic: ["minimal", "editorial"], mood: ["serene"], colors: ["neutral", "monochrome"], environment: ["architecture", "indoor"] },
    top: ["atl-011", "atl-010", "atl-009"], never: ["atl-001", "atl-015", "atl-003"] },
  { label: "colorful playful murals", p: { aesthetic: ["casual", "streetwear"], mood: ["playful", "energetic"], colors: ["vibrant"], environment: ["street-art"] },
    top: ["atl-015", "atl-001"], never: ["atl-012", "atl-011", "atl-003"] },
  { label: "waterside serene", p: { aesthetic: ["natural", "romantic"], mood: ["serene"], colors: ["cool", "pastel"], environment: ["water", "greenery"] },
    top: ["atl-003", "atl-007", "atl-004"], never: ["atl-001", "atl-008", "atl-014"] },
  { label: "urban trail casual", p: { aesthetic: ["casual"], mood: ["energetic", "playful"], colors: ["warm"], environment: ["urban", "greenery"] },
    top: ["atl-006", "atl-004"], never: ["atl-012", "atl-010"] },
  { label: "grand interior", p: { aesthetic: ["luxury"], mood: ["cinematic"], colors: ["warm", "neutral"], environment: ["indoor", "architecture"] },
    top: ["atl-012", "atl-010", "atl-009", "atl-011"], never: ["atl-001", "atl-003", "atl-006"] },
];

let topHits = 0;
let wrongInTop3 = 0;
for (const c of cases) {
  const ranked = rankLocations(c.p, locations);
  const ids = ranked.map((r) => r.id);
  const goodTop = c.top.includes(ids[0]);
  const wrong = ids.filter((id) => c.never.includes(id));
  topHits += goodTop;
  wrongInTop3 += wrong.length;
  const flag = goodTop && !wrong.length ? "PASS" : "MISS";
  console.log(`${flag}  ${c.label.padEnd(26)} ${ranked.map((r) => `${name[r.id]} ${Math.round(r.score * 100)}%`).join(" | ")}`);
  if (wrong.length) console.log(`      wrong in top 3: ${wrong.map((id) => name[id]).join(", ")}`);
}
console.log(`\nRight #1: ${topHits}/${cases.length}   Wrong spots in a top 3: ${wrongInTop3}`);
