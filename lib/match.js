// OWNER: Teammate 2 (dataset + matching)
// Deterministic ranking: no AI here, so results are predictable and easy to debug.
// Weights are starting guesses. Tune them against your 3 demo moodboards.

const WEIGHTS = { aesthetic: 0.5, environment: 0.25, mood: 0.15, colors: 0.1 };

function overlap(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const hits = a.filter((t) => b.includes(t)).length;
  return hits / a.length; // share of the client's tags this location covers
}

export function rankLocations(profile, locations, topN = 3) {
  const scored = locations.map((loc) => {
    const parts = {};
    let score = 0;
    for (const [key, w] of Object.entries(WEIGHTS)) {
      parts[key] = overlap(profile[key], loc[key]);
      score += parts[key] * w;
    }
    const shared = Object.keys(WEIGHTS).flatMap((k) =>
      (profile[k] || []).filter((t) => (loc[k] || []).includes(t))
    );
    return {
      ...loc,
      score: Math.round(score * 100) / 100,
      matchedTags: shared,
      why: explain(shared),
    };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, topN);
}

// Plain-language reason shown on each card (judges trust a reason more than a %).
function explain(tags) {
  if (!tags.length) return "A versatile backdrop that can be styled to your brief.";
  return `Matches your ${tags.slice(0, 3).join(", ")} look.`;
}
