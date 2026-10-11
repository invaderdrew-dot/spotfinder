// Owner: Teammate 4 (backend + timing)
// Picks the better golden-hour window (morning or evening) for a shoot date.
// Sun times come from SunCalc, which is offline math and always works.
// Weather comes from Open-Meteo (free, no key). Without a forecast we fall back to evening golden hour.
import SunCalc from "suncalc";

const TZ = "America/New_York";
const RAIN_WARNING = 40; // % chance of rain at which we warn the photographer
const HEAVY_CLOUD = 85; // % cloud cover that flattens golden-hour light
const MORNING_MARGIN = 15; // morning has to be clearly better to beat the evening default

const clock = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });

// Hours since local midnight as a decimal, e.g. 18.5 for 6:30 PM.
function localHours(d) {
  const [h, m] = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }).split(":");
  return Number(h) + Number(m) / 60;
}

function sunWindows(dateStr, lat, lng) {
  // Noon UTC as the reference keeps SunCalc on the right calendar day whatever the server's time zone.
  const t = SunCalc.getTimes(new Date(`${dateStr}T12:00:00Z`), lat, lng);
  return {
    sunset: clock(t.sunset),
    morning: { start: t.sunrise, end: t.goldenHourEnd },
    evening: { start: t.goldenHour, end: t.sunset },
  };
}

async function fetchForecast(dateStr, lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    hourly: "cloud_cover,precipitation_probability",
    daily: "temperature_2m_max,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    timezone: TZ,
    start_date: dateStr,
    end_date: dateStr,
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.hourly?.cloud_cover?.length === 24 ? data : null;
  } catch {
    return null; // too far out, network down, etc. The demo must not break.
  }
}

// Worst rain chance and average cloud cover across the hours a window touches.
function conditions(window, hourly) {
  const first = Math.floor(localHours(window.start));
  const last = Math.max(first, Math.ceil(localHours(window.end)) - 1);
  const hours = [];
  for (let h = first; h <= last && h < 24; h++) hours.push(h);
  const rain = Math.max(...hours.map((h) => hourly.precipitation_probability[h] ?? 0));
  const cloud = Math.round(hours.reduce((sum, h) => sum + (hourly.cloud_cover[h] ?? 0), 0) / hours.length);
  return { rainChance: rain, cloudCover: cloud, badness: rain + (cloud >= HEAVY_CLOUD ? 25 : 0) };
}

const describe = (c) => `${c.cloudCover}% cloud cover, ${c.rainChance}% chance of rain`;

export async function planTiming(dateStr, lat, lng) {
  const sun = sunWindows(dateStr, lat, lng);
  // startMin/endMin are minutes after local midnight, for drawing the window on a timeline.
  const mins = (d) => Math.round(localHours(d) * 60);
  const describeWindow = (label, w) => ({
    label,
    window: `${clock(w.start)} – ${clock(w.end)}`,
    startMin: mins(w.start),
    endMin: mins(w.end),
  });
  const windows = {
    morning: describeWindow("Morning golden hour", sun.morning),
    evening: describeWindow("Evening golden hour", sun.evening),
  };
  const forecast = await fetchForecast(dateStr, lat, lng);

  if (!forecast) {
    return {
      timing: {
        ...windows.evening,
        pick: "evening",
        sunset: sun.sunset,
        alternative: windows.morning,
        reason: "No forecast yet, so this defaults to evening golden hour. Check again within 2 weeks of the shoot.",
        warning: null,
      },
      weather: { available: false, note: "No forecast for this date yet" },
    };
  }

  const morning = conditions(sun.morning, forecast.hourly);
  const evening = conditions(sun.evening, forecast.hourly);
  const pick = morning.badness + MORNING_MARGIN <= evening.badness ? "morning" : "evening";
  const chosen = pick === "morning" ? morning : evening;
  const other = pick === "morning" ? evening : morning;

  const reason =
    pick === "morning"
      ? `Morning looks better (${describe(morning)}). Evening has ${describe(evening)}.`
      : chosen.badness < 10
        ? `Evening looks clear (${describe(evening)}).`
        : `Evening is still the better bet (${describe(evening)}; morning has ${describe(morning)}).`;

  const warning =
    chosen.rainChance >= RAIN_WARNING
      ? `${chosen.rainChance}% chance of rain even in the best window. Have a backup date or a covered spot ready.`
      : chosen.cloudCover >= HEAVY_CLOUD
        ? "Heavy cloud expected, so light will be soft and flat rather than golden."
        : null;

  return {
    timing: {
      ...windows[pick],
      pick,
      sunset: sun.sunset,
      alternative: { ...windows[pick === "morning" ? "evening" : "morning"], ...strip(other) },
      reason,
      warning,
      ...strip(chosen),
    },
    weather: {
      available: true,
      highF: Math.round(forecast.daily.temperature_2m_max[0]),
      rainChance: forecast.daily.precipitation_probability_max[0] ?? null,
    },
  };
}

const strip = ({ rainChance, cloudCover }) => ({ rainChance, cloudCover });
