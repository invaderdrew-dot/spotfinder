// Run with: npm run test-match
// Each demo moodboard must put its expected spot at the top. Exits 1 if any do not.
import { readFileSync } from "node:fs";
import { rankLocations } from "./match.js";

const locations = JSON.parse(readFileSync(new URL("../data/locations.json", import.meta.url)));

const demos = [
  {
    name: "streetwear",
    expect: "atl-001",
    profile: { aesthetic: ["streetwear", "edgy"], mood: ["bold"], colors: ["vibrant"], environment: ["street-art", "urban"] },
  },
  {
    name: "romantic",
    expect: "atl-003",
    profile: { aesthetic: ["romantic", "natural"], mood: ["soft", "dreamy"], colors: ["pastel"], environment: ["greenery", "water"] },
  },
  {
    name: "luxury",
    expect: "atl-005",
    profile: { aesthetic: ["luxury", "editorial"], mood: ["cinematic"], colors: ["warm"], environment: ["architecture", "historic"] },
  },
];

let failed = 0;
for (const { name, expect, profile } of demos) {
  const ranked = rankLocations(profile, locations);
  const ok = ranked[0]?.id === expect;
  if (!ok) failed++;
  console.log(`\n${ok ? "PASS" : "FAIL"}  ${name} (expected ${expect})`);
  for (const r of ranked) console.log(`  ${r.score.toFixed(2)}  ${r.name}: ${r.why}`);
}

console.log(failed ? `\n${failed} demo(s) failed` : "\nAll demos pass");
process.exit(failed ? 1 : 0);
