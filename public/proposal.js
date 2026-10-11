// Owner: Teammate 1 (frontend). Covered by Andrew while OlutiJr is out.
// The proposal layout, shared by the app (screen 4) and the client share page (p.html), plus small
// helpers the app reuses. Shared links can be edited by anyone, so every field is treated as untrusted.

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const prettyDate = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const shortDate = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
export const money = (n) =>
  (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" }).replace(/\.00$/, "");
export const mapLink = (m) =>
  `https://www.google.com/maps/search/?api=1&query=${Number(m.lat) || 0},${Number(m.lng) || 0}`;
export const unverified = (s) => !s || /^VERIFY/.test(s);
export const icon = (name) => `<i class="icon-${name}" aria-hidden="true"></i>`;

// Only our own location photos or https images; never javascript: or data: URLs from a link.
export const safePhoto = (url) => (/^\/locations\/[\w.-]+$/.test(url ?? "") || /^https:\/\//.test(url ?? "") ? url : "");

export function weatherText(w) {
  if (!w?.available) return "Forecast not out yet";
  return `${Number(w.highF) || 0}°F${w.rainChance != null ? ` · ${Number(w.rainChance) || 0}% rain` : ""}`;
}

const clockLabel = (min) => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
};

// The golden-hour window drawn on a track that runs from about an hour before to an hour after it.
export function timelineHTML(t) {
  const start = Number(t?.startMin);
  const end = Number(t?.endMin);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "";
  const from = Math.floor((start - 60) / 30) * 30;
  const to = Math.ceil((end + 50) / 30) * 30;
  return `
    <div class="track" aria-hidden="true">
      <div style="flex:${start - from}"></div><div class="gold" style="flex:${end - start}"></div><div style="flex:${to - end}"></div>
    </div>
    <div class="track-labels"><span>${clockLabel(from)}</span><span>${clockLabel(to)}</span></div>`;
}

// Turns a timing warning into the short chip label the design uses.
export const warningChip = (warning) => (/rain/i.test(warning ?? "") ? "Rain risk" : /cloud/i.test(warning ?? "") ? "Overcast" : "Heads up");

export function proposalHTML(p, { actions = "" } = {}) {
  const loc = p.location ?? {};
  const t = loc.timing ?? {};
  const rate = Number(p.pricing?.rate) || 0;
  const hours = Number(p.pricing?.hours) || 0;
  const total = Math.round(rate * hours * 100) / 100;
  const photo = safePhoto(loc.photoUrl);
  const tags = (p.profile?.tags ?? ["aesthetic", "mood", "colors", "environment"].flatMap((k) => p.profile?.[k] ?? [])).slice(0, 8);
  const shots = (p.shots ?? [])
    .map(
      (s, i) => `
      <li>
        <span class="num small-num">${i + 1}</span>
        <div><strong>${esc(s.title)}</strong>${s.when ? ` <span class="muted">· ${esc(s.when)}</span>` : ""}<p>${esc(s.direction)}</p></div>
      </li>`
    )
    .join("");
  return `
    <div class="hero ${photo ? "" : "stripes"}">
      ${photo ? `<img src="${esc(photo)}" alt="${esc(loc.name)}" />` : ""}
      <span class="chip-badge">Shoot proposal</span>
      <a class="map-fab big" href="${mapLink(loc)}" target="_blank" rel="noopener" aria-label="Open map">${icon("map-pin")}</a>
    </div>
    <div class="doc-body">
      <header class="doc-head">
        <h1>${esc(loc.name)}</h1>
        <span class="muted">${esc(loc.neighborhood)}, Atlanta · <a href="${mapLink(loc)}" target="_blank" rel="noopener">Open in Maps</a></span>
        <div class="tiles">
          <div><span>Photographer</span><strong>${esc(p.photographerName || "—")}</strong></div>
          <div><span>Client</span><strong>${esc(p.clientName || "Client")}</strong></div>
          <div><span>Date</span><strong>${esc(new Date(`${p.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }))}</strong></div>
        </div>
      </header>
      ${actions ? `<div class="doc-actions no-print">${actions}</div>` : ""}
      <section class="doc-section">
        <span class="muted small">The look</span>
        <p class="serif-quote">${esc(p.profile?.summary)}</p>
        ${tags.length ? `<div class="chip-row">${tags.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>` : ""}
      </section>
      <section class="doc-section">
        <div class="row-between">
          <span class="pill-outline">${icon("sunset")}Suggested window · ${esc(t.label ?? "Golden hour")}</span>
          <span class="muted small">${esc(weatherText(loc.weather))}</span>
        </div>
        <span class="big-time">${esc(t.window)}</span>
        ${timelineHTML(t)}
        ${t.reason ? `<p class="muted small">${esc(t.reason)}</p>` : ""}
        ${t.warning ? `<p class="warn-box"><strong>${esc(warningChip(t.warning))}.</strong> ${esc(t.warning)}</p>` : ""}
      </section>
      ${shots ? `<section class="doc-section"><span class="muted small">Shot list</span><ol class="doc-shots">${shots}</ol></section>` : ""}
      <section class="pricing">
        <span class="muted small">Pricing</span>
        <div class="row-between"><span>${hours} hours × ${money(rate)} / hour</span><span>${money(total)}</span></div>
        <div class="row-between total"><strong>Total</strong><span class="big-total">${money(total)}</span></div>
      </section>
      <footer class="muted small">Prepared by ${esc(p.photographerName || "your photographer")} · ${esc(
        new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      )}</footer>
    </div>`;
}
