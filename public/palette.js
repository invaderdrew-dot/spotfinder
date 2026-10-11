// Owner: Teammate 1 (frontend). Covered by Andrew while OlutiJr is out.
// Pulls the main colors out of the moodboard photos, right in the browser (no AI, nothing uploaded).
// Photographers use a palette like this to plan wardrobe and the edit.

const SAMPLE = 48; // each photo is shrunk to 48x48 before counting colors
const MIN_DISTANCE = 48; // colors closer than this (RGB distance) count as the same swatch

const load = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export async function extractPalette(urls, count = 5) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const buckets = new Map();

  for (const url of urls) {
    try {
      const img = await load(url);
      ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
      const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);
      for (let i = 0; i < data.length; i += 4) {
        // Group similar pixels into buckets of 16 levels per channel, keeping a running average.
        const key = (data[i] >> 4) * 256 + (data[i + 1] >> 4) * 16 + (data[i + 2] >> 4);
        const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
        b.n++;
        b.r += data[i];
        b.g += data[i + 1];
        b.b += data[i + 2];
        buckets.set(key, b);
      }
    } catch {
      // A photo the browser can't draw just doesn't contribute.
    }
  }

  const ranked = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((b) => [Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)]);
  const picked = [];
  for (const c of ranked) {
    if (picked.every((p) => distance(p, c) >= MIN_DISTANCE)) picked.push(c);
    if (picked.length === count) break;
  }
  // Light to dark reads like a swatch card.
  return picked.sort((a, b) => b[0] + b[1] + b[2] - (a[0] + a[1] + a[2])).map(hex);
}
