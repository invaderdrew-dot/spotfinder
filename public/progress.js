// Owner: Teammate 1 (frontend). Covered by Andrew while OlutiJr is out.
// Full-screen progress panel for the two slow steps (reading the moodboard, writing the shot list).
// The first step stays active while we wait on Gemini; the later steps really do finish in under a
// second once its answer arrives, so they tick off quickly at the end.

import { esc, icon } from "/proposal.js";

const SLOW_AFTER_S = 12;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function startProgress({ title, steps, images = [], slowNote }) {
  const el = document.createElement("div");
  el.className = "progress no-print";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `
    <div class="progress-card">
      ${images.length ? `<div class="progress-photos">${images.slice(0, 3).map((u) => `<span style="background-image:url('${u}')"></span>`).join("")}</div>` : ""}
      <h2>${esc(title)}</h2>
      <ol class="progress-steps">
        ${steps.map((s, i) => `<li class="${i === 0 ? "active" : ""}"><span class="tick">${icon(i === 0 ? "loader-circle" : "circle")}</span>${esc(s)}</li>`).join("")}
      </ol>
      <p class="muted small progress-time"><span class="secs">0</span>s</p>
      <p class="muted small progress-slow" hidden>${esc(slowNote)}</p>
    </div>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add("on"));

  const started = Date.now();
  const timer = setInterval(() => {
    const s = Math.round((Date.now() - started) / 1000);
    el.querySelector(".secs").textContent = s;
    if (s >= SLOW_AFTER_S) el.querySelector(".progress-slow").hidden = false;
  }, 250);

  const items = [...el.querySelectorAll(".progress-steps li")];
  const mark = (li, state) => {
    li.className = state;
    li.querySelector(".tick").innerHTML = icon(state === "done" ? "check" : state === "active" ? "loader-circle" : "circle");
  };
  const close = async () => {
    clearInterval(timer);
    el.classList.remove("on");
    await wait(200);
    el.remove();
  };

  return {
    // Tick off every step, then fade out.
    async finish() {
      for (let i = 0; i < items.length; i++) {
        mark(items[i], "done");
        if (items[i + 1]) {
          mark(items[i + 1], "active");
          await wait(260);
        }
      }
      await wait(280);
      await close();
    },
    fail: close,
  };
}
