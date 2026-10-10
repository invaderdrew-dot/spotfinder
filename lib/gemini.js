// OWNER: Teammate 3 (Gemini)
// Two jobs: (A) read inspiration photos -> aesthetic profile, (B) write a shot list.
// No API key? It returns MOCK data so everyone else can keep building.
import { readFileSync } from "fs";

const vocab = JSON.parse(readFileSync(new URL("../data/vocabulary.json", import.meta.url)));
const KEY = process.env.GEMINI_API_KEY;
// Check https://ai.google.dev/gemini-api/docs/models for the current model name.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const USING_MOCK = !KEY;

async function callGemini(parts, schema) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

const tagList = (values) => ({ type: "ARRAY", items: { type: "STRING", enum: values } });

// ---------- (A) Moodboard -> aesthetic profile ----------
export async function analyzeImages(files) {
  if (USING_MOCK) {
    return {
      aesthetic: ["editorial", "streetwear"],
      mood: ["cinematic", "bold"],
      colors: ["neutral", "muted"],
      environment: ["urban", "architecture"],
      summary: "MOCK: an urban editorial look with strong lines and muted colors.",
    };
  }
  const parts = [
    {
      text:
        "You are a photography creative director. Look at these client inspiration photos " +
        "and describe the shared visual style. Pick 1 to 3 tags per category, ONLY from the allowed values. " +
        "Write a one-sentence summary a photographer would understand.",
    },
    ...files.map((f) => ({ inline_data: { mime_type: f.mimetype, data: f.buffer.toString("base64") } })),
  ];
  const schema = {
    type: "OBJECT",
    properties: {
      aesthetic: tagList(vocab.aesthetic),
      mood: tagList(vocab.mood),
      colors: tagList(vocab.colors),
      environment: tagList(vocab.environment),
      summary: { type: "STRING" },
    },
    required: ["aesthetic", "mood", "colors", "environment", "summary"],
  };
  return callGemini(parts, schema);
}

// ---------- (B) Shot list for one chosen location ----------
export async function shotList(profile, location, timing) {
  if (USING_MOCK) {
    return {
      creativeDirection: `MOCK: ${profile.summary || "Editorial look"} at ${location.name}.`,
      shots: [
        { title: "Establishing wide", direction: `Full scene at ${location.name}, subject small in frame.` },
        { title: "Full-body portrait", direction: "Centered, use the background's lines to frame the subject." },
        { title: "Low-angle outfit detail", direction: "Shoot from knee height to make the outfit read bold." },
        { title: "Textured close-up", direction: "Tight portrait against the most textured surface." },
        { title: "Walking shot", direction: "Subject walks toward camera; shoot a burst for natural motion." },
      ],
    };
  }
  const parts = [
    {
      text:
        `Client style: ${JSON.stringify(profile)}\n` +
        `Location: ${location.name} (${location.neighborhood}). Features: ${[...location.environment, ...location.aesthetic].join(", ")}. ` +
        `Notes: ${location.lightingNotes}\n` +
        `Suggested shooting window: ${timing.window}\n\n` +
        "Write a one-sentence creative direction and 6 distinct, specific shots for this location and style. " +
        "Each shot gets a short title and one sentence of direction. Only reference features listed above; do not invent landmarks.",
    },
  ];
  const schema = {
    type: "OBJECT",
    properties: {
      creativeDirection: { type: "STRING" },
      shots: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: { title: { type: "STRING" }, direction: { type: "STRING" } },
          required: ["title", "direction"],
        },
      },
    },
    required: ["creativeDirection", "shots"],
  };
  return callGemini(parts, schema);
}
