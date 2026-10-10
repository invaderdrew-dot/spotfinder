// Owner: Teammate 1 (frontend)
// The proposal layout, shared by the app (screen 4) and the client share page (p.html).
// Shared links can be edited by anyone, so treat every field as untrusted: escape all text.

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const prettyDate = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const money = (n) => (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
export const mapLink = (m) =>
  `https://www.google.com/maps/search/?api=1&query=${Number(m.lat) || 0},${Number(m.lng) || 0}`;
export const unverified = (s) => !s || /^VERIFY/.test(s);

// Only our own location photos or https images; never javascript: or data: URLs from a link.
const safePhoto = (url) => (/^\/locations\/[\w.-]+$/.test(url ?? "") || /^https:\/\//.test(url ?? "") ? url : "");

export function proposalHTML(p) {
  const loc = p.location ?? {};
  const timing = loc.timing ?? {};
  const rate = Number(p.pricing?.rate) || 0;
  const hours = Number(p.pricing?.hours) || 0;
  const total = Math.round(rate * hours * 100) / 100;
  const photo = safePhoto(loc.photoUrl);
  return `
    <header>
      <p class="eyebrow">Shoot proposal${p.photographerName ? ` · ${esc(p.photographerName)}` : ""}</p>
      <h1>${esc(p.clientName || "Client")}</h1>
      <p>${esc(prettyDate(p.date))}</p>
    </header>
    <section>
      <h2>The look</h2>
      <p>${esc(p.profile?.summary)}</p>
    </section>
    <section>
      <h2>Location</h2>
      ${photo ? `<img class="hero" src="${esc(photo)}" alt="${esc(loc.name)}" />` : ""}
      <p><strong>${esc(loc.name)}</strong>, ${esc(loc.neighborhood)}, Atlanta</p>
      <p>${unverified(loc.address) ? "" : `${esc(loc.address)} · `}<a href="${mapLink(loc)}" target="_blank" rel="noopener">Open in Google Maps</a></p>
      <p>Suggested shooting window: <strong>${esc((timing.label ?? "Golden hour").toLowerCase())}, ${esc(timing.window)}</strong>. ${esc(timing.reason)}</p>
      ${timing.warning ? `<p><em>${esc(timing.warning)}</em></p>` : ""}
    </section>
    <section>
      <h2>Shot list</h2>
      <ol>${(p.shots ?? []).map((s) => `<li><strong>${esc(s.title)}.</strong> ${esc(s.direction)}</li>`).join("")}</ol>
    </section>
    <section class="price">
      <h2>Investment</h2>
      <table>
        <tr><td>${hours} hours × ${money(rate)}/hr</td><td>${money(total)}</td></tr>
        <tr class="total"><td>Total</td><td>${money(total)}</td></tr>
      </table>
    </section>`;
}
