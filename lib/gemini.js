// Owner: Teammate 3 (Gemini)
// (A) moodboard photos -> aesthetic profile, (B) profile + location -> shot list.
// Without GEMINI_API_KEY it returns mock data so the rest of the team is never blocked.
import { readFileSync } from "node:fs";

const vocab = JSON.parse(readFileSync(new URL("../data/vocabulary.json", import.meta.url)));
const API_KEY = process.env.GEMINI_API_KEY;
// Override with GEMINI_MODEL if Google ships a newer model during the hackathon.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

export const MOCK = !API_KEY;

async function generate(parts, responseSchema) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return JSON.parse(text);
}

const tags = (allowed) => ({ type: "ARRAY", items: { type: "STRING", enum: allowed } });

// Gemini sometimes slips; never let an off-list tag reach the matcher.
const keepAllowed = (profile) => {
  for (const category of ["aesthetic", "mood", "colors", "environment"]) {
    profile[category] = (profile[category] ?? []).filter((t) => vocab[category].includes(t));
  }
  return profile;
};

// ---------- (A) Moodboard -> aesthetic profile ----------
export async function analyzeMoodboard(files) {
  if (MOCK) {
    return {
      aesthetic: ["editorial", "streetwear"],
      mood: ["cinematic", "bold"],
      colors: ["neutral", "warm"],
      environment: ["urban", "architecture"],
      summary: "Mock profile: urban editorial look with strong lines and warm neutral tones.",
    };
  }
  const parts = [
    {
      text:
        "You are a photography creative director. These are a client's inspiration photos. " +
        "Describe the style they share. Choose 1 to 3 tags per category, using only the allowed values. " +
        "Then write one sentence summarizing the look for a photographer.",
    },
    ...files.map((f) => ({ inline_data: { mime_type: f.mimetype, data: f.buffer.toString("base64") } })),
  ];
  const schema = {
    type: "OBJECT",
    properties: {
      aesthetic: tags(vocab.aesthetic),
      mood: tags(vocab.mood),
      colors: tags(vocab.colors),
      environment: tags(vocab.environment),
      summary: { type: "STRING" },
    },
    required: ["aesthetic", "mood", "colors", "environment", "summary"],
  };
  return keepAllowed(await generate(parts, schema));
}

// ---------- (B) Shot list for the chosen location ----------
export async function planShots(profile, location, timing) {
  if (MOCK) {
    return {
      shots: [
        { title: "Establishing wide", direction: `Full-length shot that shows off ${location.name}.`, when: "Start of golden hour" },
        { title: "Walking toward camera", direction: "Long lens, subject mid-stride, background compressed.", when: "Golden hour" },
        { title: "Detail close-up", direction: "Hands, accessories, or fabric texture in side light.", when: "Any time" },
        { title: "Leaning portrait", direction: "Subject against a strong line or wall, chin slightly down.", when: "Golden hour" },
        { title: "Backlit silhouette", direction: "Put the sun behind the subject and expose for the sky.", when: `Right before sunset (${timing.sunset})` },
      ],
      tips: "Mock shot list. Add GEMINI_API_KEY for one written for this moodboard.",
    };
  }
  const prompt =
    `Write a shot list of 5 to 8 shots for a photo shoot at ${location.name} (${location.neighborhood}, Atlanta). ` +
    `Client look: ${profile.summary} Tags: ${[...profile.aesthetic, ...profile.mood, ...profile.environment].join(", ")}. ` +
    `Lighting notes for the spot: ${location.lightingNotes}. Golden hour is ${timing.window}. ` +
    "Each shot needs a short title, one sentence of direction for the photographer, and when to take it. " +
    "End with one sentence of practical tips. Do not mention prices.";
  const schema = {
    type: "OBJECT",
    properties: {
      shots: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { title: { type: "STRING" }, direction: { type: "STRING" }, when: { type: "STRING" } },
          required: ["title", "direction", "when"],
        },
      },
      tips: { type: "STRING" },
    },
    required: ["shots", "tips"],
  };
  return generate([{ text: prompt }], schema);
}
