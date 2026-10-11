// Owner: Teammate 1 (frontend). Covered by Andrew while OlutiJr is out.
// Four screens: New shoot -> Results -> Shot list -> Proposal. Design from Claude Design "Spot Finder v2".
import {
  esc, shortDate, money, mapLink, icon, safePhoto, weatherText, timelineHTML, warningChip, proposalHTML,
} from "/proposal.js";
import { shareLink } from "/share.js";
import { shrinkPhoto } from "/shrink.js";
import { wireListenButton, stopNarration } from "/narrate.js";

const $ = (sel) => document.querySelector(sel);
const CATEGORIES = ["aesthetic", "mood", "colors", "environment"];
const state = {
  photos: [null, null, null], // File per moodboard slot
  urls: [null, null, null], // preview URLs for those files
  deck: 0, // which moodboard photo the results carousel shows
  plan: null,
  dirty: false, // style tags edited since the last ranking
  open: new Set(), // spot cards with notes expanded
  location: null,
  shots: null,
  proposal: null,
};

// ---------- theme ----------
const THEMES = ["auto", "light", "dark"];
const THEME_ICONS = { auto: "icon-sun-moon", light: "icon-sun", dark: "icon-moon" };
let theme = "auto";
try {
  theme = THEMES.includes(localStorage.getItem("sf-theme")) ? localStorage.getItem("sf-theme") : "auto";
} catch {}
function applyTheme() {
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  $("#themeBtn i").className = THEME_ICONS[theme];
  $("#themeBtn").title = `Theme: ${theme}`;
}
$("#themeBtn").addEventListener("click", () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  try {
    localStorage.setItem("sf-theme", theme);
  } catch {}
  applyTheme();
});
applyTheme();

// ---------- navigation ----------
const reachable = {
  upload: () => true,
  results: () => Boolean(state.plan),
  shots: () => Boolean(state.shots),
  proposal: () => Boolean(state.proposal),
};
function show(id) {
  if (id !== "proposal") stopNarration();
  document.querySelectorAll(".screen").forEach((s) => (s.hidden = s.id !== id));
  document.querySelectorAll("#nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.nav === id);
    b.disabled = !reachable[b.dataset.nav]();
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("#nav button").forEach((b) => b.addEventListener("click", () => show(b.dataset.nav)));
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => show(b.dataset.go)));

// ---------- feedback ----------
let errorTimer;
function setError(msg) {
  clearTimeout(errorTimer);
  $("#error").hidden = !msg;
  $("#error").textContent = msg || "";
  if (msg) errorTimer = setTimeout(() => ($("#error").hidden = true), 7000);
}
let toastTimer;
function toast(msg) {
  clearTimeout(toastTimer);
  $("#toast").textContent = msg;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 3200);
}
// Shown when the server fell back because Gemini was slow or down.
function setNotice(el, msg) {
  el.hidden = !msg;
  el.textContent = msg || "";
}

async function api(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

// Puts a pill button into a loading state; returns a function that restores it.
function busy(button, text) {
  const label = button.querySelector(".label");
  const iconEl = button.querySelector(".dot i");
  const before = [label?.textContent, iconEl?.className];
  button.disabled = true;
  if (label) label.textContent = text;
  if (iconEl) iconEl.className = "icon-loader-circle spin";
  return () => {
    button.disabled = false;
    if (label) label.textContent = before[0];
    if (iconEl) iconEl.className = before[1];
  };
}

// ---------- 1. New shoot ----------
$("#date").value = new Date().toLocaleDateString("en-CA");
const photoCount = () => state.photos.filter(Boolean).length;

function setPhotos(fromSlot, files) {
  const images = [...files].filter((f) => f.type.startsWith("image/"));
  let slot = fromSlot;
  for (const f of images) {
    // Fill the chosen slot first, then the next empty ones.
    while (slot < 3 && state.photos[slot] && slot !== fromSlot) slot++;
    if (slot >= 3) break;
    if (state.urls[slot]) URL.revokeObjectURL(state.urls[slot]);
    state.photos[slot] = f;
    state.urls[slot] = URL.createObjectURL(f);
    slot++;
  }
  renderSlots();
}

function renderSlots() {
  $("#slots").innerHTML = state.photos
    .map((f, i) =>
      f
        ? `<div class="slot">
            <div class="filled" style="background-image:url('${state.urls[i]}')" role="img" aria-label="Reference photo ${i + 1}"></div>
            <span class="ref">Ref ${i + 1}</span>
            <button type="button" class="remove" data-remove="${i}" aria-label="Remove photo ${i + 1}">${icon("x")}</button>
          </div>`
        : `<div class="slot">
            <label class="empty" data-slot="${i}">
              <input type="file" accept="image/*" multiple data-file="${i}" />
              <span class="plus">${icon("image-plus")}</span>
              <span><strong>Ref ${i + 1}</strong><span class="muted small">Drop a photo or tap to upload</span></span>
            </label>
          </div>`
    )
    .join("");

  const n = photoCount();
  $("#photoCount").textContent = `${n} of 3 added`;
  $("#planBtn").disabled = n === 0;
  $("#uploadHint").textContent =
    n === 0 ? "Add 2–3 photos to start" : n === 1 ? "Add one more for a sharper read, or go with one" : "Ready. We'll match spots in Atlanta.";

  $("#slots").querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", () => {
      const i = Number(b.dataset.remove);
      URL.revokeObjectURL(state.urls[i]);
      state.photos[i] = null;
      state.urls[i] = null;
      renderSlots();
    })
  );
  $("#slots").querySelectorAll("[data-file]").forEach((input) =>
    input.addEventListener("change", (e) => setPhotos(Number(input.dataset.file), e.target.files))
  );
  $("#slots").querySelectorAll("[data-slot]").forEach((zone) => {
    ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => (e.preventDefault(), zone.classList.add("over"))));
    ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, () => zone.classList.remove("over")));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      setPhotos(Number(zone.dataset.slot), e.dataTransfer.files);
    });
  });
}
renderSlots();

$("#planForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("");
  const done = busy($("#planBtn"), "Reading the look…");
  try {
    const form = new FormData();
    const files = state.photos.filter(Boolean);
    for (const f of await Promise.all(files.map(shrinkPhoto))) form.append("photos", f);
    form.append("date", $("#date").value);
    state.plan = await api("/api/plan", { method: "POST", body: form });
    state.thumbs = state.urls.filter(Boolean);
    state.deck = 0;
    state.dirty = false;
    state.open.clear();
    state.shots = null;
    state.proposal = null;
    $("#mockBadge").hidden = !state.plan.mock;
    setNotice($("#planNotice"), state.plan.notice);
    // Carry the client's name forward to the proposal form.
    $("#proposalForm").clientName.value = $("#clientNameStart").value;
    renderResults();
    show("results");
  } catch (err) {
    setError(err.message);
  } finally {
    done();
  }
});

// ---------- 2. Results ----------
let vocabulary = null;
api("/api/vocabulary").then((v) => (vocabulary = v)).catch(() => {});

function renderResults() {
  renderDeck();
  renderProfile();
  renderMatches();
}

// The client's moodboard as a deck of cards with previous/next.
function renderDeck() {
  const thumbs = state.thumbs?.length ? state.thumbs : [null, null, null];
  const idx = Math.min(state.deck, thumbs.length - 1);
  const client = $("#clientNameStart").value.trim();
  $("#deckCol").innerHTML = `
    <div class="deck-view">
      <div class="deck-track" style="transform:translateX(calc(${-idx} * (min(280px, 70vw) + 12px)))">
        ${thumbs
          .map(
            (u, i) =>
              `<div class="deck-card ${i === idx ? "on" : ""} ${u ? "" : "stripes"}" data-deck="${i}" ${
                u ? `style="background-image:url('${u}')"` : ""
              } role="img" aria-label="Reference photo ${i + 1}"></div>`
          )
          .join("")}
      </div>
    </div>
    <div class="deck-nav">
      <button class="circle-btn" data-step="-1" aria-label="Previous reference">${icon("chevron-left")}</button>
      <div class="deck-dots">
        <span class="muted small">${client ? `${esc(client)}'s moodboard` : "Client moodboard"}</span>
        <div>${thumbs.map((_, i) => `<span class="d ${i === idx ? "on" : ""}"></span>`).join("")}</div>
      </div>
      <button class="circle-btn dark" data-step="1" aria-label="Next reference">${icon("chevron-right")}</button>
    </div>`;
  const go = (i) => {
    state.deck = (i + thumbs.length) % thumbs.length;
    renderDeck();
  };
  $("#deckCol").querySelectorAll("[data-deck]").forEach((c) => c.addEventListener("click", () => go(Number(c.dataset.deck))));
  $("#deckCol").querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => go(idx + Number(b.dataset.step))));
}

// Style tags are editable so the photographer can correct how Gemini read the moodboard.
function renderProfile() {
  const { profile } = state.plan;
  const tagCount = CATEGORIES.reduce((n, k) => n + profile[k].length, 0);
  const chips = CATEGORIES.flatMap((k) =>
    profile[k].map(
      (t) =>
        `<span class="tag-chip">${esc(t)}<button type="button" data-remove="${k}:${esc(t)}" aria-label="Remove ${esc(t)}">${icon("x")}</button></span>`
    )
  ).join("");
  const options = vocabulary
    ? CATEGORIES.map(
        (k) =>
          `<optgroup label="${k}">${vocabulary[k]
            .filter((t) => !profile[k].includes(t))
            .map((t) => `<option value="${k}:${t}">${t}</option>`)
            .join("")}</optgroup>`
      ).join("")
    : "";
  $("#profile").innerHTML = `
    <div class="look-head"><span class="icon-dot">${icon("arrow-right")}</span><span class="muted small">The look we read</span></div>
    <p class="look-quote">${esc(profile.summary)}</p>
    <div class="chip-row">
      ${chips}
      ${options ? `<label class="add-tag"><select id="addTag" aria-label="Add a style tag"><option value="">Add a tag</option>${options}</select><span class="plus-sm">${icon("plus")}</span></label>` : ""}
    </div>
    <div class="row-wrap">
      <button class="pill" id="rematch" ${state.dirty ? "" : "disabled"}><span class="label">Update spots</span><span class="dot">${icon("refresh-cw")}</span></button>
      <span class="muted small">${state.dirty ? "Tags changed. Update to re-rank the spots." : `Ranked on ${tagCount} tag${tagCount === 1 ? "" : "s"}`}</span>
    </div>`;

  const changed = () => {
    state.dirty = true;
    renderProfile();
  };
  $("#profile").querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", () => {
      const [k, t] = b.dataset.remove.split(":");
      profile[k] = profile[k].filter((x) => x !== t);
      changed();
    })
  );
  $("#addTag")?.addEventListener("change", (e) => {
    const [k, t] = e.target.value.split(":");
    if (k) profile[k] = [...profile[k], t];
    changed();
  });
  $("#rematch").addEventListener("click", async (e) => {
    setError("");
    const done = busy(e.currentTarget, "Updating…");
    try {
      const { matches } = await api("/api/rematch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, date: state.plan.date }),
      });
      state.plan.matches = matches;
      state.dirty = false;
      state.open.clear();
      renderProfile();
      renderMatches();
    } catch (err) {
      setError(err.message);
      done();
    }
  });
}

// Bold the matched tags inside the plain "why it matches" sentence.
function whyHTML(why, tags) {
  let html = esc(why);
  for (const t of tags ?? []) {
    const word = esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`\\b${word}\\b`, "g"), `<mark>${esc(t)}</mark>`);
  }
  return html;
}

function renderMatches() {
  const { matches, date } = state.plan;
  $("#resultsMeta").textContent = `Atlanta · ${shortDate(date)} · golden hour`;
  $("#matches").innerHTML = matches
    .map((m, i) => {
      const photo = safePhoto(m.photoUrl);
      const pct = Math.round(m.score * 100);
      const vibe = (m.environment ?? []).slice(0, 2).join(", ").replace(/-/g, " ");
      const notes = [m.timing.reason, m.lightingNotes, m.accessNotes]
        .filter(Boolean)
        .map((n) => `<li>${esc(String(n).replace(/^VERIFY:\s*/, ""))}</li>`)
        .join("");
      const open = state.open.has(i);
      return `
      <article class="spot ${i === 0 ? "best" : ""}" style="--i:${i}">
        <div class="spot-photo ${photo ? "" : "stripes"}">
          ${photo ? `<img src="${esc(photo)}" alt="${esc(m.name)}" loading="lazy" />` : `<span class="photo-label">location photo coming soon · ${esc(vibe)}</span>`}
          <div class="spot-top">
            ${i === 0 ? `<span class="rank best">${icon("sparkles")}Best match</span>` : `<span class="rank">#${i + 1}</span>`}
            <span class="score">${pct}%</span>
          </div>
          <a class="map-fab" href="${mapLink(m)}" target="_blank" rel="noopener" aria-label="Open ${esc(m.name)} in Google Maps">${icon("map-pin")}</a>
        </div>
        <div class="spot-body">
          <div class="spot-title">
            <h3>${esc(m.name)}</h3>
            <span>${esc(m.neighborhood)}, Atlanta · ${pct}% match</span>
          </div>
          <p class="why">${whyHTML(m.why, m.matchedTags)}</p>
          <div class="stack-12">
            <div class="row-between wrap tight"><span class="pill-outline">${icon("sunset")}${esc(m.timing.label ?? "Golden hour")}</span><span class="light-time">${esc(m.timing.window)}</span></div>
            ${timelineHTML(m.timing)}
          </div>
          <div class="chip-row">
            <span class="pill-outline plain">${icon("cloud-sun")}${esc(weatherText(m.weather))}</span>
            ${m.timing.warning ? `<span class="warn-chip">${icon("triangle-alert")}${esc(warningChip(m.timing.warning))}</span>` : ""}
          </div>
          ${m.timing.warning ? `<p class="warn-text">${esc(m.timing.warning)}</p>` : ""}
          <div class="notes">
            <button type="button" data-notes="${i}" aria-expanded="${open}">Lighting &amp; access notes<span class="chev">${icon(open ? "chevron-up" : "chevron-down")}</span></button>
            ${open ? `<ul>${notes}</ul>` : ""}
          </div>
          ${m.verified ? "" : `<p class="unverified">Location details not checked yet</p>`}
          <button class="pill full" data-pick="${i}"><span class="label">Plan this spot</span><span class="dot">${icon("arrow-up-right")}</span></button>
        </div>
      </article>`;
    })
    .join("");

  $("#matches").querySelectorAll("[data-notes]").forEach((b) =>
    b.addEventListener("click", () => {
      const i = Number(b.dataset.notes);
      state.open.has(i) ? state.open.delete(i) : state.open.add(i);
      renderMatches();
      // Re-rendering replays the rise animation; skip it for a simple toggle.
      $("#matches").querySelectorAll(".spot").forEach((c) => (c.style.animation = "none"));
    })
  );
  $("#matches").querySelectorAll("[data-pick]").forEach((b) =>
    b.addEventListener("click", () => pickSpot(state.plan.matches[b.dataset.pick], b))
  );
}

// ---------- 3. Shot list ----------
const GOLDEN = /golden|sunset|sunrise|window|last light|low sun/i;

async function pickSpot(location, button) {
  setError("");
  const done = busy(button, "Writing shot list…");
  try {
    state.location = location;
    state.shots = await api("/api/shotlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: state.plan.profile, location }),
    });
    state.proposal = null;
    renderShots();
    show("shots");
  } catch (err) {
    setError(err.message);
  } finally {
    done();
  }
}

function renderShots() {
  const loc = state.location;
  const t = loc.timing;
  $("#chosenSpot").innerHTML = `
    <span class="chip-dark">${icon("map-pin")}Chosen spot</span>
    <div class="stack-2">
      <h1>${esc(loc.name)}</h1>
      <span class="muted">${esc(loc.neighborhood)}, Atlanta · ${esc(shortDate(state.plan.date))} · <a href="${mapLink(loc)}" target="_blank" rel="noopener">Open map</a></span>
    </div>
    <div class="row-between wrap top-line">
      <span class="pill-outline">${icon("sunset")}Shooting window · ${esc(t.label ?? "Golden hour")}</span>
      <span class="muted small">${icon("cloud-sun")} ${esc(weatherText(loc.weather))}</span>
    </div>
    <span class="big-time">${esc(t.window)}</span>
    ${timelineHTML(t)}
    ${t.warning ? `<p class="warn-box"><strong>${esc(warningChip(t.warning))}.</strong> ${esc(t.warning)}</p>` : ""}`;

  const shots = state.shots.shots ?? [];
  $("#shotCount").textContent = `${shots.length} shots`;
  $("#shotList").innerHTML = shots
    .map(
      (s, i) => `
      <li>
        <span class="num">${i + 1}</span>
        <div class="stack-2">
          <div class="shot-head"><strong>${esc(s.title)}</strong>${s.when ? `<span class="when ${GOLDEN.test(s.when) ? "golden" : ""}">${icon("clock")}${esc(s.when)}</span>` : ""}</div>
          <span class="dir">${esc(s.direction)}</span>
        </div>
      </li>`
    )
    .join("");
  $("#shotTips").textContent = state.shots.tips ?? "";
  setNotice($("#shotsNotice"), state.shots.notice);
  updateTotal();
}

// Live total while typing. Pricing is plain arithmetic on the photographer's own numbers, never AI.
function updateTotal() {
  const f = $("#proposalForm");
  const rate = Number(f.rate.value) || 0;
  const hours = Number(f.hours.value) || 0;
  $("#totalLabel").textContent = rate ? `${hours} hours × ${money(rate)} / hour` : "Enter your hourly rate";
  $("#totalLive").textContent = money(Math.round(rate * hours * 100) / 100);
}
$("#proposalForm").addEventListener("input", updateTotal);

// ---------- 4. Proposal ----------
$("#proposalForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("");
  const button = e.submitter ?? e.target.querySelector("button[type=submit]");
  const done = busy(button, "Creating…");
  try {
    const fields = Object.fromEntries(new FormData(e.target));
    const p = await api("/api/proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...fields,
        date: state.plan.date,
        location: state.location,
        profile: state.plan.profile,
        shots: state.shots.shots,
      }),
    });
    renderProposal(p);
    show("proposal");
  } catch (err) {
    setError(err.message);
  } finally {
    done();
  }
});

const ACTIONS = `
  <button class="pill" id="listenBtn"><span class="label">Listen</span><span class="dot">${icon("play")}</span></button>
  <button class="pill outline" id="shareBtn"><span class="label">Copy client link</span><span class="dot">${icon("link")}</span></button>
  <button class="pill outline" id="printBtn"><span class="label">Print / PDF</span><span class="dot">${icon("printer")}</span></button>`;

function renderProposal(p) {
  state.proposal = p;
  $("#doc").innerHTML = proposalHTML(p, { actions: ACTIONS });
  wireListenButton($("#listenBtn"), () => state.proposal);
  $("#printBtn").addEventListener("click", () => window.print());
  // Client share link: the proposal travels inside the link, nothing is stored.
  $("#shareBtn").addEventListener("click", async () => {
    const link = await shareLink(state.proposal);
    try {
      await navigator.clipboard.writeText(link);
      toast("Link copied. Text or email it to your client.");
    } catch {
      window.prompt("Copy this link for your client:", link);
    }
  });
}

show("upload");
