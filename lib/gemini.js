// Owner: Teammate 3 (Gemini)
// (A) moodboard photos -> aesthetic profile, (B) profile + location -> shot list.
// Without GEMINI_API_KEY it returns mock data so the rest of the team is never blocked.
import { readFileSync } from "node:fs";

const vocab = JSON.parse(readFileSync(new URL("../data/vocabulary.json", import.meta.url)));
const API_KEY = process.env.GEMINI_API_KEY;
// Override with GEMINI_MODEL if Google ships a newer model during the hackathon.
const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
// Set this in deployment secrets to change the backup without editing code.
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL?.trim() || "gemini-3.6-flash";

export const MOCK = !API_KEY;

async function generate(parts, responseSchema, primaryTimeoutMs = 8000) {
  const models = [...new Set([MODEL, FALLBACK_MODEL])];
  for (let attempt = 0; attempt < models.length; attempt++) {
    const model = models[attempt];
    try {
      return await generateWithModel(parts, responseSchema, model, attempt === 0 ? primaryTimeoutMs : 10000);
    } catch (err) {
      // 429 included: free-tier quotas are per model, so the backup may still have requests left.
      const transient = ["TimeoutError", "AbortError", "TypeError"].includes(err.name) ||
        /^Gemini (404|429|500|502|503|504)\b/.test(err.message);
      if (!transient || attempt === models.length - 1) throw err;
      console.warn(`[gemini] ${model} unavailable or slow; trying ${models[attempt + 1]}`);
    }
  }
}

async function generateWithModel(parts, responseSchema, model, timeoutMs) {
  // Abort stalled requests before the server's overall deadline is reached.
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        ...(model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const text = body.candidates?.[0]?.content?.parts
    ?.filter((part) => !part.thought && typeof part.text === "string")
    .map((part) => part.text).join("");
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
        "You are a photography creative director analyzing a client's inspiration photos. " +
        "Examine clothing, styling, poses, lighting, colors, backgrounds, and composition. " +
        "Identify the dominant visual style shared across the photos. " +
        "Choose 1 to 3 tags per category using only the allowed values. " +
        "Base your choices on visible evidence; do not default to urban or streetwear. " +
        "Then write one sentence describing the look and lighting for a photographer. " +
        "Refer to the person being photographed as the client, never as the subject.",
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
  // Allow photo analysis 20s on the primary plus 10s on the backup (under the 40s overall limit).
  return keepAllowed(await generate(parts, schema, 20000));
}

// ---------- (B) Shot list for the chosen location ----------
export async function planShots(profile, location, timing) {
  if (MOCK) {
    return {
      shots: [
        { title: "Establishing wide", direction: `Full-length shot that shows off ${location.name}.`, when: "Start of golden hour" },
        { title: "Walking toward camera", direction: "Use a long lens to photograph the client mid-stride with the background compressed.", when: "Golden hour" },
        { title: "Detail close-up", direction: "Hands, accessories, or fabric texture in side light.", when: "Any time" },
        { title: "Leaning portrait", direction: "Pose the client against a strong line or wall with their chin slightly down.", when: "Golden hour" },
        { title: "Backlit silhouette", direction: "Put the sun behind the client and expose for the sky.", when: `Right before sunset (${timing.sunset})` },
      ],
      tips: "Mock shot list. Add GEMINI_API_KEY for one written for this moodboard.",
    };
  }
  const prompt =
    `Write a shot list of 5 to 8 shots for a photo shoot at ${location.name} (${location.neighborhood}, Atlanta). ` +
    `Client look: ${profile.summary} Tags: ${[...profile.aesthetic, ...profile.mood, ...profile.environment].join(", ")}. ` +
    `Lighting notes for the spot: ${location.lightingNotes}. Golden hour is ${timing.window}. ` +
    "Each shot needs a short title, one sentence of direction for the photographer, and when to take it. " +
    "Refer to the person being photographed as the client, never as the subject. " +
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
