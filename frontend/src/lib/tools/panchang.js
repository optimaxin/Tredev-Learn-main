import { getTimes, getMoonTimes } from "suncalc";

/*
 * Sun/moon ecliptic-longitude math below is adapted from SunCalc
 * (https://github.com/mourner/suncalc, BSD-2-Clause, © Vladimir Agafonkin),
 * which computes these internally but only exposes equatorial ra/dec.
 * Reusing the same formulas keeps tithi/nakshatra/yoga consistent with the
 * sunrise/sunset/moonrise/moonset values SunCalc itself returns below.
 */
const rad = Math.PI / 180;
const J1970 = 2440588;
const J2000 = 2451545;
const dayMs = 1000 * 60 * 60 * 24;

function toDays(date) {
  return date.valueOf() / dayMs - 0.5 + J1970 - J2000;
}

function sunEclipticLongitude(d) {
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = rad * 102.9372;
  const L = M + C + P + Math.PI;
  return ((L / rad) % 360 + 360) % 360;
}

const moonLon = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314],
  [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322],
  [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528],
  [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034],
  [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888], [2, 1, 0, 0, -6766],
  [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665],
  [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
  [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120],
  [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110],
  [3, 0, -1, 0, -892], [2, 1, 1, 0, -810], [4, -1, -2, 0, 759],
  [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691],
  [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399],
  [0, 0, 2, -2, -381], [1, 1, 1, 0, 351], [3, 0, -2, 0, -340],
  [4, 0, -3, 0, 330], [2, -1, 2, 0, 327], [0, 2, 1, 0, -323],
  [1, 1, -1, 0, 299], [2, 0, 3, 0, 294],
];
function moonEclipticLongitude(d) {
  const t = d / 36525;
  const Lp = 218.3164477 + t * 481267.88123421;
  const D = rad * (297.8501921 + t * 445267.1114034);
  const M = rad * (357.5291092 + t * 35999.0502909);
  const Mp = rad * (134.9633964 + t * 477198.8675055);
  const F = rad * (93.272095 + t * 483202.0175233);
  const sl = moonLon.reduce((sum, [d_, m, mp, f, coeff]) => sum + coeff * Math.sin(d_ * D + m * M + mp * Mp + f * F), 0);
  const l = Lp + sl / 1e6;
  return ((l % 360) + 360) % 360;
}

// Lahiri ayanamsa, linear approximation (~50.3"/year precession) — accurate to
// a few arcminutes for the multi-decade range this tool is used over.
function lahiriAyanamsa(date) {
  const year = date.getUTCFullYear() + (date.getUTCMonth()) / 12;
  return 23.85 + 0.013972 * (year - 2000);
}

const NAKSHATRAS = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya",
  "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha",
  "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta",
  "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];

const TITHI_NAMES = ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami",
  "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi"];

const YOGAS = ["Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma", "Dhriti",
  "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata",
  "Variyana", "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"];

const MOVABLE_KARANAS = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"];
const FIXED_KARANAS_TAIL = ["Shakuni", "Chatushpada", "Naga"];

const VARAS = ["Ravivar", "Somavar", "Mangalvar", "Budhavar", "Guruvar", "Shukravar", "Shanivar"];

function karanaForHalfTithi(halfTithiIndex) {
  // 60 half-tithis/month: Kimstughna (fixed) at 0, the 7 movable karanas cycle
  // 8x across 1-56, then Shakuni/Chatushpada/Naga (fixed) close out 57-59.
  if (halfTithiIndex === 0) return "Kimstughna";
  if (halfTithiIndex >= 57) return FIXED_KARANAS_TAIL[halfTithiIndex - 57];
  return MOVABLE_KARANAS[(halfTithiIndex - 1) % 7];
}

export function computePanchang(date, lat, lon) {
  const d = toDays(date);
  const sunLon = sunEclipticLongitude(d);
  const moonLonTropical = moonEclipticLongitude(d);
  const ayanamsa = lahiriAyanamsa(date);
  const sunSidereal = ((sunLon - ayanamsa) % 360 + 360) % 360;
  const moonSidereal = ((moonLonTropical - ayanamsa) % 360 + 360) % 360;

  const elongation = ((moonLonTropical - sunLon) % 360 + 360) % 360;
  const tithiIndex = Math.floor(elongation / 12); // 0-29
  const paksha = tithiIndex < 15 ? "Shukla" : "Krishna";
  const tithiInPaksha = tithiIndex % 15;
  const tithiName = tithiInPaksha === 14 ? (paksha === "Shukla" ? "Purnima" : "Amavasya") : TITHI_NAMES[tithiInPaksha];

  const nakshatraIndex = Math.floor(moonSidereal / (360 / 27));
  const nakshatraName = NAKSHATRAS[nakshatraIndex % 27];

  const yogaSum = ((sunSidereal + moonSidereal) % 360 + 360) % 360;
  const yogaIndex = Math.floor(yogaSum / (360 / 27));
  const yogaName = YOGAS[yogaIndex % 27];

  const halfTithiIndex = Math.floor(elongation / 6); // 0-59
  const karanaName = karanaForHalfTithi(halfTithiIndex);

  const vara = VARAS[date.getUTCDay()];

  const times = getTimes(date, lat, lon);
  const moonTimes = getMoonTimes(date, lat, lon);

  const fmt = (dt) => (dt instanceof Date && !isNaN(dt) ? dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

  const sunrise = times.sunrise;
  const sunset = times.sunset;
  let rahuKalam = null;
  let abhijit = null;
  if (sunrise instanceof Date && sunset instanceof Date && !isNaN(sunrise) && !isNaN(sunset)) {
    const dayLenMs = sunset - sunrise;
    const eighth = dayLenMs / 8;
    // Traditional 1-indexed day-segment (of 8) assigned to Rahu Kalam, by weekday (Sun..Sat)
    const rahuSegment = [8, 2, 7, 5, 6, 4, 3][date.getUTCDay()];
    const rahuStart = new Date(sunrise.getTime() + (rahuSegment - 1) * eighth);
    const rahuEnd = new Date(rahuStart.getTime() + eighth);
    rahuKalam = `${fmt(rahuStart)} – ${fmt(rahuEnd)}`;

    const noon = new Date(sunrise.getTime() + dayLenMs / 2);
    abhijit = `${fmt(new Date(noon.getTime() - 24 * 60000))} – ${fmt(new Date(noon.getTime() + 24 * 60000))}`;
  }

  return {
    date: date.toISOString().slice(0, 10),
    vara,
    paksha,
    tithi: tithiName,
    nakshatra: nakshatraName,
    yoga: yogaName,
    karana: karanaName,
    sunrise: fmt(sunrise),
    sunset: fmt(sunset),
    moonrise: fmt(moonTimes.rise),
    moonset: fmt(moonTimes.set),
    rahuKalam,
    abhijitMuhurta: abhijit,
    note: "Computed from standard low-precision solar/lunar formulas and the Lahiri ayanamsa — a study object, accurate to within a few minutes/degrees. Not a substitute for a published Panchang for ritual timing.",
  };
}

export const CITY_PRESETS = [
  { name: "New Delhi", lat: 28.6139, lon: 77.209 },
  { name: "Mumbai", lat: 19.076, lon: 72.8777 },
  { name: "Varanasi", lat: 25.3176, lon: 82.9739 },
  { name: "Chennai", lat: 13.0827, lon: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639 },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  { name: "Ujjain", lat: 23.1793, lon: 75.7849 },
  { name: "Ayodhya", lat: 26.7922, lon: 82.1998 },
];

if (process.env.NODE_ENV !== "production") {
  const r = computePanchang(new Date(), 28.6139, 77.209);
  console.assert(typeof r.tithi === "string" && r.tithi.length > 0, "computePanchang returns a tithi");
  console.assert(NAKSHATRAS.includes(r.nakshatra), "computePanchang returns a valid nakshatra");
}
