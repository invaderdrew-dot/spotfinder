// Owner: Andrew (backend + reliability)
// Keeps the demo alive when Gemini is slow or down: time limits, one retry, and honest fallbacks.
// Wraps lib/gemini.js from the outside so the Gemini owner's file stays theirs.

const ms = (name, fallback) => Number(process.env[name]) || fallback;
export const LIMITS = {
  analyze: ms("GEMINI_ANALYZE_TIMEOUT_MS", 40000),
  shots: ms("GEMINI_SHOTS_TIMEOUT_MS", 30000),
};

class TimeoutError extends Error {}

function withTimeout(promise, limit) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`timed out after ${(limit / 1000).toFixed(1)}s`)), limit);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Rate limits and server hiccups are worth one quick retry; bad keys and bad requests are not.
const retryable = (err) => /^Gemini (429|500|502|503|504)\b/.test(err.message) || err.name === "TypeError";

// Waits between retries. Google 503 "high demand" spikes often clear within a few seconds.
const BACKOFF = [1000, 2000, 4000];

// "Gemini 503: {...json...}" -> "Gemini 503: This model is currently experiencing high demand..."
const short = (err) => {
  const inner = err.message.match(/"message":\s*"([^"]+)"/)?.[1];
  return (inner ? `${err.message.split(":")[0]}: ${inner}` : err.message).slice(0, 120);
};

// Runs a Gemini call within `limit` ms. Returns { value } on success or { error } on failure, never throws.
// Retryable errors get up to 3 more tries with growing waits, as long as the time limit allows.
export async function guarded(label, call, limit) {
  const deadline = Date.now() + limit;
  for (let attempt = 1; ; attempt++) {
    try {
      return { value: await withTimeout(call(), Math.max(1000, deadline - Date.now())) };
    } catch (err) {
      const wait = BACKOFF[attempt - 1];
      // Only retry if there is still time for the wait plus a real attempt.
      if (wait && retryable(err) && deadline - Date.now() > wait + 3000) {
        console.warn(`[reliability] ${label} try ${attempt} failed (${short(err)}), retrying in ${wait / 1000}s`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      // Log the reason only. Never log photos or client details.
      console.warn(`[reliability] ${label} fell back after ${attempt} tr${attempt === 1 ? "y" : "ies"}: ${short(err)}`);
      return { error: err };
    }
  }
}

// No tags rather than made-up ones: the photographer picks the style with the tag editor.
export function fallbackProfile() {
  return {
    aesthetic: [],
    mood: [],
    colors: [],
    environment: [],
    summary: "We couldn't read the photos just now. Add the style tags that fit the moodboard, then update the spots.",
  };
}

// Basic but solid shot list built from the location and the picked light window.
export function fallbackShots(location, timing) {
  const name = location.name || "the location";
  const window = timing?.window || "golden hour";
  return {
    shots: [
      { title: "Establishing wide", direction: `Full-length frame that shows off ${name} and sets the scene.`, when: `Start of the window (${window})` },
      { title: "Walking toward camera", direction: "Long lens, client mid-stride, background compressed behind them.", when: "Early in the window" },
      { title: "Environmental portrait", direction: `Place the client against the strongest feature of ${name}, leaving negative space.`, when: "Middle of the window" },
      { title: "Detail close-up", direction: "Hands, accessories, or fabric texture in side light.", when: "Any time" },
      { title: "Seated or leaning pose", direction: "Use a ledge, step, or wall for a relaxed pose; shoot slightly below eye level.", when: "Middle of the window" },
      { title: "Golden-light finale", direction: "Backlight the client with the low sun and expose for skin.", when: `End of the window (${window})` },
    ],
    tips: "Basic shot list. The AI shot writer didn't respond, so tailor these to the moodboard.",
  };
}
