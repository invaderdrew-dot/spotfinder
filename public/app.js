// Owner: Teammate 1 (frontend)
import { esc, prettyDate, mapLink, unverified, proposalHTML } from "/proposal.js";
import { shareLink } from "/share.js";
import { shrinkPhoto } from "/shrink.js";

const $ = (sel) => document.querySelector(sel);
const state = { files: [], plan: null, location: null, shots: null };


// ---------- navigation ----------
function show(id) {
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
  $("#profile").innerHTML = `
    <h3>The look</h3>
    <p>${esc(profile.summary)}</p>
    <div class="chips">${chips}
      ${options ? `<select id="addTag" aria-label="Add a style tag"><option value="">+ Add tag</option>${options}</select>` : ""}
    </div>
    <p class="muted small">Not quite right? Remove or add tags, then update the spots.</p>
    ${dirty ? `<button class="primary" id="rematch">Update spots</button>` : ""}`;

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
        ? `${m.weather.highF}°F high${m.weather.rainChance != null ? ` · ${m.weather.rainChance}% rain` : ""}`
        : esc(m.weather.note);
      const photo = m.photoUrl
        ? `<img src="${esc(m.photoUrl)}" alt="${esc(m.name)}" />`
        : `<div class="placeholder">${esc(m.name)}</div>`;
      return `
      <article class="spot card">
        <div class="photo">${photo}<span class="score">${Math.round(m.score * 100)}% match</span></div>
        <h3>${esc(m.name)}</h3>
        <p class="muted">${esc(m.neighborhood)}${unverified(m.address) ? "" : ` · ${esc(m.address)}`} · <a href="${mapLink(m)}" target="_blank" rel="noopener">Map</a></p>
        <p>${esc(m.why)}</p>
        <dl>
          <dt>Best light</dt><dd>${esc(m.timing.window)} <span class="muted small">(${esc(m.timing.pick)})</span></dd>
          <dt>Weather</dt><dd>${wx}</dd>
          <dt>Access</dt><dd>${esc(m.accessNotes.replace(/^VERIFY:\s*/, ""))}</dd>
        </dl>
        <p class="small">${esc(m.timing.reason)}</p>
        ${m.timing.warning ? `<p class="warn small">⚠ ${esc(m.timing.warning)}</p>` : ""}
        ${m.verified ? "" : `<p class="unverified">Details not checked yet</p>`}
        <button class="primary" data-pick="${i}">Plan this spot</button>
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
