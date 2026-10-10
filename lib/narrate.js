// Owner: Andrew (backend + reliability)
// Optional ElevenLabs voice for "Listen to this proposal". Without ELEVENLABS_API_KEY the browser's own voice is used.
// Only the narration script is sent to ElevenLabs: no photos, and nothing is stored here.

const KEY = process.env.ELEVENLABS_API_KEY;
// Both are overridable in Secrets if ElevenLabs renames things during the hackathon.
const VOICE = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
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

// Returns MP3 audio as a Buffer. Throws on any failure so the caller can fall back.
export async function speak(text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: MODEL }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}
