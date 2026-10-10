// Owner: Teammate 4 (backend + timing)
// Golden hour comes from SunCalc, which is offline math and always works.
// Weather comes from Open-Meteo (free, no key). If it fails, the app says so and keeps going.
import SunCalc from "suncalc";

const TZ = "America/New_York";

const clock = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });

// Use noon UTC as the reference so the date never slips a day, whatever the server's time zone.
export function goldenHour(dateStr, lat, lng) {
  const t = SunCalc.getTimes(new Date(`${dateStr}T12:00:00Z`), lat, lng);
  return {
    window: `${clock(t.goldenHour)} – ${clock(t.sunset)}`,
    goldenHourStart: clock(t.goldenHour),
    sunset: clock(t.sunset),
    morningWindow: `${clock(t.sunrise)} – ${clock(t.goldenHourEnd)}`,
  };
}

export async function weather(dateStr, lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    daily: "temperature_2m_max,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    timezone: TZ,
    start_date: dateStr,
    end_date: dateStr,
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const { daily } = await res.json();
    return {
      available: true,
      highF: Math.round(daily.temperature_2m_max[0]),
      rainChance: daily.precipitation_probability_max[0] ?? null,
    };
  } catch {
    // Expected when the date is more than ~2 weeks out or the network is down.
    return { available: false, note: "No forecast for this date yet" };
  }
}
