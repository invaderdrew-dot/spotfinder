// Owner: Teammate 2 (dataset + matching)
// Ranks locations against an aesthetic profile. Pure function, no network, easy to test.

// How much each category counts toward the score. Must add up to 1.
export const WEIGHTS = { aesthetic: 0.35, environment: 0.3, mood: 0.2, colors: 0.15 };

// A tag shared by most spots (like "urban") says little about which spot fits, so it counts less.
// Weight = log(1 + spots / spots with that tag). Tags no spot has get the top weight.
export function tagRarity(locations) {
  const counts = {};
  for (const l of locations) for (const c of Object.keys(WEIGHTS)) for (const t of l[c] ?? []) counts[`${c}:${t}`] = (counts[`${c}:${t}`] ?? 0) + 1;
  const n = locations.length;
  return (category, tag) => Math.log(1 + n / (counts[`${category}:${tag}`] ?? 1));
}

export function scoreLocation(profile, location, rarity = () => 1) {
  let score = 0;
  const shared = [];
  const byCategory = {};
  for (const [category, weight] of Object.entries(WEIGHTS)) {
    const wanted = profile[category] ?? [];
    if (!wanted.length) continue;
    const hits = wanted.filter((tag) => location[category]?.includes(tag));
    const sum = (tags) => tags.reduce((total, t) => total + rarity(category, t), 0);
    score += weight * (sum(hits) / sum(wanted));
    shared.push(...hits);
    byCategory[category] = hits;
  }
  return { score: Math.round(score * 100) / 100, shared, byCategory };
}

export function rankLocations(profile, locations, topN = 3) {
  const rarity = tagRarity(locations);
  return locations
    .map((location) => {
      const { score, shared, byCategory } = scoreLocation(profile, location, rarity);
      return { ...location, score, matchedTags: shared, why: reason(byCategory) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// A short reason on each card makes a match easier to trust than a bare percentage.
// Says which part matched, e.g. "A street-art, urban backdrop for a streetwear, edgy look, with a bold mood and vibrant tones."
const list = (tags) => (tags.length > 1 ? `${tags.slice(0, -1).join(", ")} and ${tags.at(-1)}` : tags[0]);
const a = (word) => (/^[aeiou]/i.test(word) ? "an" : "a");
function reason({ environment = [], aesthetic = [], mood = [], colors = [] }) {
  if (![environment, aesthetic, mood, colors].some((t) => t.length)) return "Flexible backdrop that you can style to fit the brief.";
  let text = "";
  if (environment.length) text = `${a(environment[0])} ${list(environment)} backdrop`;
  if (aesthetic.length) text += `${text ? " for" : "Suits"} ${a(aesthetic[0])} ${list(aesthetic)} look`;
  const extras = [mood.length && `${a(mood[0])} ${list(mood)} mood`, colors.length && `${list(colors)} tones`].filter(Boolean);
  if (extras.length) text += `${text ? ", with" : "Brings"} ${extras.join(" and ")}`;
  return text.replace(/^./, (c) => c.toUpperCase()) + ".";
}
