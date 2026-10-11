// Owner: Teammate 1 (frontend). Covered by Andrew while OlutiJr is out.
import { esc, prettyDate, mapLink, unverified, proposalHTML } from "/proposal.js";
import { shareLink } from "/share.js";
import { shrinkPhoto } from "/shrink.js";
import { wireListenButton, stopNarration } from "/narrate.js";

const $ = (sel) => document.querySelector(sel);
const state = { files: [], plan: null, location: null, shots: null };


// ---------- navigation ----------
function show(id) {
  if (id !== "proposal") stopNarration();
  document.querySelectorAll(".screen").forEach((s) => (s.hidden = s.id !== id));
  const order = ["upload", "results", "shots", "proposal"];
  document.querySelectorAll("#steps li").forEach((li) => {
    const i = order.indexOf(li.dataset.step);
    li.classList.toggle("active", li.dataset.step === id);
    li.classList.toggle("done", i < order.indexOf(id));
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => show(b.dataset.go)));

function setError(msg) {
  $("#error").hidden = !msg;
  $("#error").textContent = msg || "";
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

function busy(button, label) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  return () => {
    button.disabled = false;
    button.textContent = original;
  };
}

// ---------- 1. moodboard ----------
$("#date").value = new Date().toLocaleDateString("en-CA");

function addFiles(list) {
  state.files = [...state.files, ...[...list].filter((f) => f.type.startsWith("image/"))].slice(0, 3);
  $("#thumbs").innerHTML = "";
  state.files.forEach((f, i) => {
    const wrap = document.createElement("div");
    wrap.className = "thumb";
    wrap.innerHTML = `<img alt="Inspiration photo ${i + 1}" /><button type="button" aria-label="Remove photo">×</button>`;
    wrap.querySelector("img").src = URL.createObjectURL(f);
    wrap.querySelector("button").onclick = () => {
      state.files.splice(i, 1);
      addFiles([]);
    };
    $("#thumbs").append(wrap);
  });
}
$("#photos").addEventListener("change", (e) => {
  addFiles(e.target.files);
  e.target.value = "";
});
const drop = $("#drop");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => (e.preventDefault(), drop.classList.add("over"))));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  addFiles(e.dataTransfer.files);
});

$("#planForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("");
  const done = busy($("#planBtn"), "Reading the moodboard…");
  try {
    const form = new FormData();
    for (const f of await Promise.all(state.files.map(shrinkPhoto))) form.append("photos", f);
    form.append("date", $("#date").value);
    state.plan = await api("/api/plan", { method: "POST", body: form });
    (state.thumbs ?? []).forEach((u) => URL.revokeObjectURL(u));
    state.thumbs = state.files.map((f) => URL.createObjectURL(f));
    $("#mockBadge").hidden = !state.plan.mock;
    setNotice($("#planNotice"), state.plan.notice);
    renderResults();
    show("results");
  } catch (err) {
    setError(err.message);
  } finally {
    done();
  }
});

// ---------- 2. matches ----------
const CATEGORIES = ["aesthetic", "mood", "colors", "environment"];
let vocabulary = null;
api("/api/vocabulary").then((v) => (vocabulary = v)).catch(() => {});

function renderResults() {
  renderProfile(false);
  renderMatches();
}

// Style tags are editable so the photographer can correct how Gemini read the moodboard.
function renderProfile(dirty) {
  const { profile } = state.plan;
  const chips = CATEGORIES.flatMap((k) =>
    profile[k].map(
      (t) => `<span class="chip ${k}">${esc(t)}<button type="button" data-remove="${k}:${esc(t)}" aria-label="Remove ${esc(t)}">×</button></span>`
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
  const board = (state.thumbs ?? []).map((u, i) => `<img src="${u}" alt="Inspiration photo ${i + 1}" />`).join("");
  $("#profile").innerHTML = `
    ${board ? `<div class="moodboard" aria-label="Client moodboard">${board}</div><div class="arrow" aria-hidden="true">→</div>` : ""}
    <div class="look">
    <p class="eyebrow">The look we read</p>
    <p class="summary">${esc(profile.summary)}</p>
    <div class="chips">${chips}
      ${options ? `<select id="addTag" aria-label="Add a style tag"><option value="">+ Add tag</option>${options}</select>` : ""}
    </div>
    <p class="muted small">Not quite right? Remove or add tags, then update the spots.</p>
    ${dirty ? `<button class="primary" id="rematch">Update spots</button>` : ""}
    </div>`;

  $("#profile").querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", () => {
      const [k, t] = b.dataset.remove.split(":");
      profile[k] = profile[k].filter((x) => x !== t);
      renderProfile(true);
    })
  );
  $("#addTag")?.addEventListener("change", (e) => {
    const [k, t] = e.target.value.split(":");
    if (k) profile[k] = [...profile[k], t];
    renderProfile(true);
  });
  $("#rematch")?.addEventListener("click", async (e) => {
    setError("");
    const done = busy(e.target, "Updating…");
    try {
      const { matches } = await api("/api/rematch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, date: state.plan.date }),
      });
      state.plan.matches = matches;
      renderResults();
    } catch (err) {
      setError(err.message);
      done();
    }
  });
}


function renderMatches() {
  const { matches, date } = state.plan;
  $("#resultsDate").textContent = prettyDate(date);

  $("#matches").innerHTML = matches
    .map((m, i) => {
      const wx = m.weather.available
        ? `${m.weather.highF}°F${m.weather.rainChance != null ? ` · ${m.weather.rainChance}% rain` : ""}`
        : "Forecast not out yet";
      // Until a real photo exists, a color wash keyed to the spot's vibe looks intentional, not missing.
      const env = m.environment?.[0] ?? "urban";
      const photo = m.photoUrl
        ? `<img src="${esc(m.photoUrl)}" alt="${esc(m.name)}" />`
        : `<div class="placeholder"><small>Photo coming soon</small><span>${esc((m.environment ?? []).slice(0, 2).join(" · ").replace(/-/g, " "))}</span></div>`;
      const matched = (m.matchedTags ?? []).slice(0, 5).map((t) => `<span class="chip hit">${esc(t)}</span>`).join("");
      const notes = [m.timing.reason, m.lightingNotes, m.accessNotes]
        .filter(Boolean)
        .map((n) => `<p>${esc(String(n).replace(/^VERIFY:\s*/, ""))}</p>`)
        .join("");
      return `
      <article class="spot card${i === 0 ? " best" : ""}" style="--i:${i}">
        <div class="photo env-${esc(env)}">
          ${photo}
          <span class="rank">${i === 0 ? "Best match" : `#${i + 1}`}</span>
          <span class="score">${Math.round(m.score * 100)}% match</span>
        </div>
        <div class="body">
          <h3>${esc(m.name)}</h3>
          <p class="where">${esc(m.neighborhood)}${unverified(m.address) ? "" : ` · ${esc(m.address)}`} · <a href="${mapLink(m)}" target="_blank" rel="noopener">Map ↗</a></p>
          <p class="why">${esc(m.why)}</p>
          ${matched ? `<div class="chips">${matched}</div>` : ""}
          <div class="facts">
            <div><span class="label">Best light</span><strong>${esc(m.timing.window)}</strong><span class="muted small">${esc(m.timing.label ?? "")}</span></div>
            <div><span class="label">Weather</span><strong>${esc(wx)}</strong></div>
          </div>
          ${m.timing.warning ? `<p class="warn small">⚠ ${esc(m.timing.warning)}</p>` : ""}
          <details class="more"><summary>Lighting & access notes</summary>${notes}</details>
          ${m.verified ? "" : `<p class="unverified">Location details not checked yet</p>`}
          <button class="primary" data-pick="${i}">Plan this spot</button>
        </div>
      </article>`;
    })
    .join("");

  $("#matches").querySelectorAll("[data-pick]").forEach((b) =>
    b.addEventListener("click", () => pickSpot(state.plan.matches[b.dataset.pick], b))
  );
}

// ---------- 3. shot list ----------
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
    $("#shotsTitle").textContent = `Shot list: ${location.name}`;
    $("#shotsTiming").textContent = `${prettyDate(state.plan.date)} · ${location.timing.label} ${location.timing.window}`;
    $("#shotList").innerHTML = state.shots.shots
      .map((s) => `<li><strong>${esc(s.title)}</strong><span>${esc(s.direction)}</span><em>${esc(s.when)}</em></li>`)
      .join("");
    $("#shotTips").textContent = state.shots.tips;
    setNotice($("#shotsNotice"), state.shots.notice);
    show("shots");
  } catch (err) {
    setError(err.message);
  } finally {
    done();
  }
}

// ---------- 4. proposal ----------
$("#proposalForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("");
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
  }
});

function renderProposal(p) {
  state.proposal = p;
  $("#doc").innerHTML = proposalHTML(p);
  $("#shareStatus").textContent = "";
}

wireListenButton($("#listenBtn"), () => state.proposal);

// Client share link: the proposal travels inside the link, nothing is stored.
$("#shareBtn").addEventListener("click", async () => {
  const link = await shareLink(state.proposal);
  try {
    await navigator.clipboard.writeText(link);
    $("#shareStatus").textContent = "Link copied. Text or email it to your client.";
  } catch {
    window.prompt("Copy this link for your client:", link);
  }
});

show("upload");
