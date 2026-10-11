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

// Browsers default to their most robotic voice. Prefer the natural-sounding ones most Macs, Chrome and Edge ship.
const PREFERRED = [/natural/i, /premium/i, /enhanced/i, /^Google US English$/, /^Samantha/, /^Ava/, /^Allison/, /^Aria/, /^Jenny/, /Google/];

async function bestVoice() {
  let voices = speechSynthesis.getVoices();
  // Chrome loads its voice list a moment after the page.
  if (!voices.length) {
    await new Promise((r) => {
      speechSynthesis.addEventListener("voiceschanged", r, { once: true });
      setTimeout(r, 1000);
    });
    voices = speechSynthesis.getVoices();
  }
  const english = voices.filter((v) => /^en[-_]US/i.test(v.lang));
  const pool = english.length ? english : voices.filter((v) => /^en/i.test(v.lang));
  for (const pattern of PREFERRED) {
    const match = pool.find((v) => pattern.test(v.name));
    if (match) return match;
  }
  return pool[0] ?? null;
}

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
  utterance.voice = await bestVoice();
  utterance.rate = 1.0;
  utterance.onend = onEnd;
  speechSynthesis.speak(utterance);
  return "browser";
}

// Turns a button into a Listen / Stop toggle for whatever proposal getProposal() returns.
// Updates the button's .label and icon (if it has them) so pill buttons keep their layout.
export function wireListenButton(button, getProposal) {
  const label = button.querySelector(".label") ?? button;
  const iconEl = button.querySelector(".dot i");
  const idle = label.textContent;
  const idleIcon = iconEl?.className;
  const set = (text, icon) => {
    label.textContent = text;
    if (iconEl && icon) iconEl.className = icon;
  };
  const reset = () => {
    set(idle, idleIcon);
    button.disabled = false;
    button.dataset.playing = "";
  };
  button.addEventListener("click", async () => {
    if (button.dataset.playing) {
      stopNarration();
      return reset();
    }
    button.disabled = true;
    set("Loading voice…", "icon-loader-circle spin");
    try {
      await playNarration(getProposal(), reset);
      button.dataset.playing = "1";
      set("Stop", "icon-square");
      button.disabled = false;
    } catch {
      reset();
      set("Audio not supported here");
    }
  });
}
