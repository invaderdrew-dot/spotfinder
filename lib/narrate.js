// Owner: Andrew (backend + reliability)
// Optional ElevenLabs voice for "Listen to this proposal". Without ELEVENLABS_API_KEY the browser's own voice is used.
// Only the narration script is sent to ElevenLabs, never photos. Audio is held in memory for 30 min, never on disk.

import { createHash } from "node:crypto";

// trim(): pasted Secrets often pick up a stray space or newline.
const env = (name) => process.env[name]?.trim() || undefined;
const KEY = env("ELEVENLABS_API_KEY");
// Both are overridable in Secrets if ElevenLabs renames things during the hackathon.
const VOICE = env("ELEVENLABS_VOICE_ID") || "21m00Tcm4TlvDq8ikWAM";
const MODEL = env("ELEVENLABS_MODEL") || "eleven_multilingual_v2";
export const MAX_CHARS = 2500;

export const NARRATION_ENABLED = Boolean(KEY);

// Small per-visitor limit so a public demo link can't burn through the ElevenLabs credits.
const recent = new Map();
export function allowNarration(ip, perMinute = 6) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 60000);
  if (hits.length >= perMinute) return false;
  hits.push(now);
  recent.set(ip, hits);
  return true;
}

// Replaying the same proposal (rehearsals, the demo itself) reuses the audio instead of spending credits again.
// Audio is kept in memory only, for 30 minutes at most, and never written to disk.
const CACHE_MS = 30 * 60000;
const CACHE_MAX = 20;
const cache = new Map();
const keyFor = (text) => createHash("sha256").update(`${VOICE}|${MODEL}|${text}`).digest("hex");

export function cachedAudio(text) {
  const hit = cache.get(keyFor(text));
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(keyFor(text));
    return null;
  }
  return hit.audio;
}

function remember(text, audio) {
  for (const [k, v] of cache) if (Date.now() - v.at > CACHE_MS) cache.delete(k);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(keyFor(text), { audio, at: Date.now() });
}

// Returns MP3 audio as a Buffer. Throws on any failure so the caller can fall back.
export async function speak(text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: MODEL }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const audio = Buffer.from(await res.arrayBuffer());
  remember(text, audio);
  return audio;
}
