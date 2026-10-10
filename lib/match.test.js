// Run with: npm run test-match
// Quick sanity check of the ranking against fake moodboard profiles.
import { readFileSync } from "fs";
import { rankLocations } from "./match.js";

const locations = JSON.parse(readFileSync(new URL("../data/locations.json", import.meta.url)));

const demos = {
  streetwear: { aesthetic: ["streetwear", "edgy"], mood: ["bold"], colors: ["vibrant"], environment: ["street-art", "urban"] },
  romantic: { aesthetic: ["romantic", "natural"], mood: ["soft", "dreamy"], colors: ["pastel"], environment: ["greenery", "water"] },
  luxury: { aesthetic: ["luxury", "editorial"], mood: ["cinematic"], colors: ["warm"], environment: ["architecture", "historic"] },
};

for (const [name, profile] of Object.entries(demos)) {
  console.log(`\n${name.toUpperCase()}`);
  for (const r of rankLocations(profile, locations)) {
    console.log(`  ${r.score.toFixed(2)}  ${r.name}  (${r.why})`);
  }
}
