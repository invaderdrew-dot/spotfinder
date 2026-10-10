// Owner: Teammate 1 (frontend)
const $ = (sel) => document.querySelector(sel);
const state = { files: [], plan: null, location: null, shots: null };

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const prettyDate = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const money = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

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
    state.files.forEach((f) => form.append("photos", f));
    form.append("date", $("#date").value);
    state.plan = await api("/api/plan", { method: "POST", body: form });
    $("#mockBadge").hidden = !state.plan.mock;
    renderResults();
    show("results");
  } catch (err) {
    setError(err.message);
  } finally {
    done();
  }
});

// ---------- 2. matches ----------
function renderResults() {
  const { profile, matches, date } = state.plan;
  const chips = ["aesthetic", "mood", "colors", "environment"]
    .flatMap((k) => profile[k].map((t) => `<span class="chip ${k}">${esc(t)}</span>`))
    .join("");
  $("#profile").innerHTML = `<h3>The look</h3><p>${esc(profile.summary)}</p><div class="chips">${chips}</div>`;
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
        <p class="muted">${esc(m.neighborhood)}</p>
        <p>${esc(m.why)}</p>
        <dl>
          <dt>Golden hour</dt><dd>${esc(m.timing.window)}</dd>
          <dt>Weather</dt><dd>${wx}</dd>
          <dt>Access</dt><dd>${esc(m.accessNotes.replace(/^VERIFY:\s*/, ""))}</dd>
        </dl>
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
    $("#shotsTiming").textContent = `${prettyDate(state.plan.date)} · Golden hour ${location.timing.window}`;
    $("#shotList").innerHTML = state.shots.shots
      .map((s) => `<li><strong>${esc(s.title)}</strong><span>${esc(s.direction)}</span><em>${esc(s.when)}</em></li>`)
      .join("");
    $("#shotTips").textContent = state.shots.tips;
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
  const loc = p.location;
  $("#doc").innerHTML = `
    <header>
      <p class="eyebrow">Shoot proposal${p.photographerName ? ` · ${esc(p.photographerName)}` : ""}</p>
      <h1>${esc(p.clientName)}</h1>
      <p>${prettyDate(p.date)}</p>
    </header>
    <section>
      <h2>The look</h2>
      <p>${esc(p.profile.summary)}</p>
    </section>
    <section>
      <h2>Location</h2>
      <p><strong>${esc(loc.name)}</strong>, ${esc(loc.neighborhood)}, Atlanta</p>
      <p>Call time is set for golden hour, <strong>${esc(loc.timing.window)}</strong>. Sunset is at ${esc(loc.timing.sunset)}.</p>
    </section>
    <section>
      <h2>Shot list</h2>
      <ol>${p.shots.map((s) => `<li><strong>${esc(s.title)}.</strong> ${esc(s.direction)}</li>`).join("")}</ol>
    </section>
    <section class="price">
      <h2>Investment</h2>
      <table>
        <tr><td>${p.pricing.hours} hours × ${money(p.pricing.rate)}/hr</td><td>${money(p.pricing.total)}</td></tr>
        <tr class="total"><td>Total</td><td>${money(p.pricing.total)}</td></tr>
      </table>
    </section>`;
}

show("upload");
