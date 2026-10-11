// Owner: Andrew (backend + reliability)
// Zero-data share links: the whole proposal is compressed into the part of the URL after "#".
// Browsers never send that part to a server, so nothing about the client is stored or even seen by us.

const VERSION = "v1";

// Keep only what the client page shows, so links stay short.
function toShareable(p) {
  const loc = p.location ?? {};
  const t = loc.timing ?? {};
  return {
    clientName: p.clientName,
    photographerName: p.photographerName,
    date: p.date,
    profile: {
      summary: p.profile?.summary,
      tags: ["aesthetic", "mood", "colors", "environment"].flatMap((k) => p.profile?.[k] ?? []).slice(0, 8),
    },
    location: {
      name: loc.name,
      neighborhood: loc.neighborhood,
      address: loc.address,
      lat: loc.lat,
      lng: loc.lng,
      photoUrl: loc.photoUrl,
      weather: loc.weather,
      timing: { label: t.label, window: t.window, startMin: t.startMin, endMin: t.endMin, reason: t.reason, warning: t.warning },
    },
    shots: (p.shots ?? []).map(({ title, direction, when }) => ({ title, direction, when })),
    pricing: { rate: p.pricing?.rate, hours: p.pricing?.hours },
  };
}

const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function shareLink(proposal) {
  const json = new TextEncoder().encode(JSON.stringify(toShareable(proposal)));
  const packed = await pipe(json, new CompressionStream("deflate-raw"));
  return `${location.origin}/p.html#${VERSION}.${toBase64Url(packed)}`;
}

// Returns the proposal, or null if the link is broken or cut off.
export async function readShareLink(hash) {
  try {
    const [version, data] = hash.replace(/^#/, "").split(".");
    if (version !== VERSION || !data) return null;
    const json = await pipe(fromBase64Url(data), new DecompressionStream("deflate-raw"));
    const p = JSON.parse(new TextDecoder().decode(json));
    return p && typeof p === "object" && p.location ? p : null;
  } catch {
    return null;
  }
}
