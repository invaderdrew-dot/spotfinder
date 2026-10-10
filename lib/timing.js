// OWNER: Teammate 4 (backend + timing)
// Golden hour from SunCalc (offline math, always works).
// Weather from Open-Meteo (free, no API key). If it fails, we say "unavailable" and move on.
import SunCalc from "suncalc";

const TZ = "America/New_York";

function fmt(d) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
}

export function goldenHour(dateStr, lat, lng) {
  // Noon local avoids picking the wrong day.
  const t = SunCalc.getTimes(new Date(`${dateStr}T12:00:00`), lat, lng);
  return {
    window: `${fmt(t.goldenHour)} – ${fmt(t.sunset)}`,
    sunset: fmt(t.sunset),
    label: "Suggested shooting window",
  };
}

export async function weather(dateStr, lat, lng) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=temperature_2m_max,precipitation_probability_max,weather_code` +
      `&temperature_unit=fahrenheit&timezone=${encodeURIComponent(TZ)}` +
      `&start_date=${dateStr}&end_date=${dateStr}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(res.status);
    const d = (await res.json()).daily;
    return {
      available: true,
      highF: Math.round(d.temperature_2m_max[0]),
      rainChance: d.precipitation_probability_max[0],
    };
  } catch {
    // Dates too far out, network down, etc. The demo must not break.
    return { available: false, note: "Forecast unavailable for this date" };
  }
}
