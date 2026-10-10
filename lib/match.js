// Owner: Teammate 2 (dataset + matching)
// Ranks locations against an aesthetic profile. Pure function, no network, easy to test.

// How much each category counts toward the score. Must add up to 1.
export const WEIGHTS = { aesthetic: 0.35, environment: 0.3, mood: 0.2, colors: 0.15 };

export function scoreLocation(profile, location) {
  let score = 0;
  const shared = [];
  for (const [category, weight] of Object.entries(WEIGHTS)) {
    const wanted = profile[category] ?? [];
    if (!wanted.length) continue;
    const hits = wanted.filter((tag) => location[category]?.includes(tag));
    score += weight * (hits.length / wanted.length);
    shared.push(...hits);
  }
  return { score: Math.round(score * 100) / 100, shared };
}

export function rankLocations(profile, locations, topN = 3) {
  return locations
    .map((location) => {
      const { score, shared } = scoreLocation(profile, location);
      return { ...location, score, matchedTags: shared, why: reason(shared) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// A short reason on each card makes a match easier to trust than a bare percentage.
function reason(tags) {
  if (!tags.length) return "Flexible backdrop that you can style to fit the brief.";
  return `Fits the ${tags.slice(0, 3).join(", ")} feel of the moodboard.`;
}
