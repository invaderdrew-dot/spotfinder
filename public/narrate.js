// Owner: Andrew (backend + reliability)
// "Listen to this proposal": ElevenLabs voice when the server has a key, otherwise the browser's built-in voice.
// The script is plain code from the proposal fields. No AI writes it, so prices and times are read exactly.

import { prettyDate } from "/proposal.js";

const say = (n) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" }).replace(/\.00$/, "");
// "6:38 PM – 7:11 PM" reads better aloud as "6:38 PM to 7:11 PM".
const spoken = (s) => String(s ?? "").replace(/\s*[–-]\s*/g, " to ");

export function narrationScript(p) {
  const loc = p.location ?? {};
  const t = loc.timing ?? {};
  const rate = Number(p.pricing?.rate) || 0;
  const hours = Number(p.pricing?.hours) || 0;
  const shots = (p.shots ?? []).slice(0, 8).map((s, i) => `${i + 1}. ${s.title}.`).join(" ");
  return [
    `Hi ${p.clientName || "there"}, here's your shoot plan${p.photographerName ? ` from ${p.photographerName}` : ""}.`,
    `We're shooting on ${prettyDate(p.date)} at ${loc.name}${loc.neighborhood ? `, in ${loc.neighborhood}` : ""}.`,
    p.profile?.summary ? `The look: ${p.profile.summary}` : "",
    t.window ? `The suggested shooting window is ${(t.label ?? "golden hour").toLowerCase()}, ${spoken(t.window)}.` : "",
    t.warning ? `Heads up: ${t.warning}` : "",
    shots ? `The shot list: ${shots}` : "",
    `The investment is ${hours} hours at ${say(rate)} an hour, for a total of ${say(rate * hours)}.`,
    "Looking forward to it!",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2500);
}

let audio = null;

export function stopNarration() {
  audio?.pause();
  audio = null;
  window.speechSynthesis?.cancel();
}

// Plays the narration. Resolves "elevenlabs" or "browser" once playback starts; onEnd fires when it finishes.
export async function playNarration(p, onEnd = () => {}) {
  stopNarration();
  const text = narrationScript(p);
  try {
    const res = await fetch("/api/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(25000),
    });
    if (res.ok && res.status !== 204) {
      audio = new Audio(URL.createObjectURL(await res.blob()));
      audio.onended = onEnd;
      await audio.play();
      return "elevenlabs";
    }
  } catch {
    // fall through to the browser voice
  }
  if (!("speechSynthesis" in window)) throw new Error("This browser can't read aloud.");
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.onend = onEnd;
  speechSynthesis.speak(utterance);
  return "browser";
}

// Turns a button into a Listen / Stop toggle for whatever proposal getProposal() returns.
export function wireListenButton(button, getProposal) {
  const idle = button.textContent;
  const reset = () => {
    button.textContent = idle;
    button.disabled = false;
    button.dataset.playing = "";
  };
  button.addEventListener("click", async () => {
    if (button.dataset.playing) {
      stopNarration();
      return reset();
    }
    button.disabled = true;
    button.textContent = "Loading voice…";
    try {
      await playNarration(getProposal(), reset);
      button.dataset.playing = "1";
      button.textContent = "■ Stop";
      button.disabled = false;
    } catch {
      reset();
      button.textContent = "Audio not supported here";
    }
  });
}
