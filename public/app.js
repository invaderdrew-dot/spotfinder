// OWNER: Teammate 1 (frontend). Holds state in memory only (zero data).
const state = { date: null, profile: null, matches: [], chosen: null, plan: null };
const $ = (id) => document.getElementById(id);

function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo(0, 0);
}
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => show(b.dataset.go)));

function loading(on, text) {
  $("loading").hidden = !on;
  if (text) $("loading-text").textContent = text;
}

// ---------- Screen 1: brief ----------
$("date").value = new Date().toISOString().slice(0, 10);
const drop = $("drop");
const input = $("photos");
["dragover", "dragenter"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((e) => drop.addEventListener(e, () => drop.classList.remove("over")));
drop.addEventListener("drop", (ev) => { ev.preventDefault(); input.files = ev.dataTransfer.files; preview(); });
input.addEventListener("change", preview);

function preview() {
  const files = [...input.files].slice(0, 3);
  $("previews").innerHTML = "";
  files.forEach((f) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(f);
    $("previews").appendChild(img);
  });
  $("drop-text").textContent = files.length ? `${files.length} photo(s) ready` : "Click or drag inspiration photos here";
}

$("brief-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const fd = new FormData();
  [...input.files].slice(0, 3).forEach((f) => fd.append("photos", f));
  fd.append("date", $("date").value);
  loading(true, "Reading your moodboard…");
  try {
    const res = await fetch("/api/plan", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    Object.assign(state, { date: data.date, profile: data.profile, matches: data.matches });
    renderMatches();
    show("screen-matches");
  } catch (e) {
    alert("Something went wrong: " + e.message);
  } finally {
    loading(false);
  }
});

// ---------- Screen 2: matches ----------
function renderMatches() {
  const p = state.profile;
  $("summary").textContent = p.summary;
  $("chips").innerHTML = ["aesthetic", "mood", "colors", "environment"]
    .flatMap((k) => (p[k] || []).map((t) => `<span class="chip"><b>${k}</b>${t}</span>`))
    .join("");
  $("cards").innerHTML = state.matches
    .map(
      (m, i) => `
    <div class="card">
      <div class="hero" style="${m.photoUrl ? `background-image:url('${m.photoUrl}')` : ""}">${m.photoUrl ? "" : "Add a photo in data/locations.json"}</div>
      <div class="body">
        <h3>${m.name}</h3>
        <div class="meta">${m.neighborhood}</div>
        <div class="why">${m.why}</div>
        <div class="meta">${m.timing.label}: ${m.timing.window}</div>
        <div class="meta">${m.weather.available ? `High ${m.weather.highF}°F · ${m.weather.rainChance}% rain` : m.weather.note}</div>
        <button class="cta" data-pick="${i}">Plan Shoot Here</button>
      </div>
    </div>`
    )
    .join("");
  document.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => pick(+b.dataset.pick)));
}

// ---------- Screen 3: plan ----------
async function pick(i) {
  state.chosen = state.matches[i];
  loading(true, "Planning your shots…");
  try {
    const res = await fetch("/api/shotlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: state.profile, location: state.chosen }),
    });
    state.plan = await res.json();
    if (!res.ok) throw new Error(state.plan.error);
    renderPlan();
    show("screen-plan");
  } catch (e) {
    alert("Something went wrong: " + e.message);
  } finally {
    loading(false);
  }
}

function renderPlan() {
  const c = state.chosen;
  $("plan").innerHTML = `
    <p class="sub">${state.plan.creativeDirection}</p>
    <p><b>${c.name}</b> · ${c.timing.label}: ${c.timing.window}</p>
    ${state.plan.shots.map((s, i) => `<div class="shot"><span class="n">${String(i + 1).padStart(2, "0")}</span><div><b>${s.title}</b><br>${s.direction}</div></div>`).join("")}`;
}

// ---------- Screen 4: proposal ----------
$("make-proposal").addEventListener("click", async () => {
  const res = await fetch("/api/proposal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientName: $("client").value, date: state.date, location: state.chosen,
      plan: state.plan, rate: $("rate").value, hours: $("hours").value,
    }),
  });
  const p = await res.json();
  const money = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  $("proposal").innerHTML = `
    <h2>Shoot Proposal for ${p.clientName}</h2>
    <div class="meta">${new Date(p.date + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
    <div class="hero" style="${p.location.photoUrl ? `background-image:url('${p.location.photoUrl}')` : ""}"></div>
    <h4>Creative direction</h4><p>${p.plan.creativeDirection}</p>
    <h4>Location</h4><p><b>${p.location.name}</b>, ${p.location.neighborhood}<br>${p.location.timing.label}: ${p.location.timing.window}</p>
    <h4>Shot list</h4>${p.plan.shots.map((s, i) => `<div class="shot"><span class="n">${String(i + 1).padStart(2, "0")}</span><div><b>${s.title}</b><br>${s.direction}</div></div>`).join("")}
    <h4>Pricing</h4><p>${money(p.pricing.rate)}/hr × ${p.pricing.hours} hrs</p><p class="total">${money(p.pricing.total)}</p>`;
  show("screen-proposal");
});
