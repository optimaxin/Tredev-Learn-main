const MASTER_NUMBERS = [11, 22, 33];

function digitSum(str) {
  return str.split("").reduce((sum, d) => sum + Number(d), 0);
}

export function reduceNumber(n) {
  let num = Math.abs(Math.trunc(n));
  while (num > 9 && !MASTER_NUMBERS.includes(num)) {
    num = digitSum(String(num));
  }
  return num;
}

export function lifePathNumber(dobISO) {
  if (!dobISO || !/^\d{4}-\d{2}-\d{2}$/.test(dobISO)) return { number: null, steps: [] };
  const digits = dobISO.replace(/-/g, "").split("");
  let current = digitSum(digits.join(""));
  const steps = [`${dobISO} → ${digits.join("+")} = ${current}`];
  while (current > 9 && !MASTER_NUMBERS.includes(current)) {
    const nextDigits = String(current).split("");
    const next = digitSum(nextDigits.join(""));
    steps.push(`${current} → ${nextDigits.join("+")} = ${next}`);
    current = next;
  }
  return { number: current, steps };
}

const PYTHAGOREAN_MAP = {};
"AJS".split("").forEach((c) => (PYTHAGOREAN_MAP[c] = 1));
"BKT".split("").forEach((c) => (PYTHAGOREAN_MAP[c] = 2));
"CLU".split("").forEach((c) => (PYTHAGOREAN_MAP[c] = 3));
"DMV".split("").forEach((c) => (PYTHAGOREAN_MAP[c] = 4));
"ENW".split("").forEach((c) => (PYTHAGOREAN_MAP[c] = 5));
"FOX".split("").forEach((c) => (PYTHAGOREAN_MAP[c] = 6));
"GPY".split("").forEach((c) => (PYTHAGOREAN_MAP[c] = 7));
"HQZ".split("").forEach((c) => (PYTHAGOREAN_MAP[c] = 8));
"IR".split("").forEach((c) => (PYTHAGOREAN_MAP[c] = 9));

const CHALDEAN_MAP = {};
"AIJQY".split("").forEach((c) => (CHALDEAN_MAP[c] = 1));
"BKR".split("").forEach((c) => (CHALDEAN_MAP[c] = 2));
"CGLS".split("").forEach((c) => (CHALDEAN_MAP[c] = 3));
"DMT".split("").forEach((c) => (CHALDEAN_MAP[c] = 4));
"EHNX".split("").forEach((c) => (CHALDEAN_MAP[c] = 5));
"UVW".split("").forEach((c) => (CHALDEAN_MAP[c] = 6));
"OZ".split("").forEach((c) => (CHALDEAN_MAP[c] = 7));
"FP".split("").forEach((c) => (CHALDEAN_MAP[c] = 8));

export function expressionNumber(fullName, system = "pythagorean") {
  const letters = (fullName || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!letters) return { number: null, system, steps: [] };
  const map = system === "chaldean" ? CHALDEAN_MAP : PYTHAGOREAN_MAP;
  let current = letters.split("").reduce((sum, ch) => sum + (map[ch] || 0), 0);
  const steps = [`${letters} → sum = ${current}`];
  while (current > 9 && !MASTER_NUMBERS.includes(current)) {
    const nextDigits = String(current).split("");
    const next = digitSum(nextDigits.join(""));
    steps.push(`${current} → ${nextDigits.join("+")} = ${next}`);
    current = next;
  }
  return { number: current, system, steps };
}

export const NUMBER_PROFILES = {
  1: {
    title: "The Leader",
    summary: "A study in independence and initiative — the number of the one who begins.",
    rulingPlanet: "Sun",
    traits: ["Independent", "Driven", "Original", "Self-reliant"],
    careerPaths: ["Entrepreneurship", "Leadership roles", "Pioneering fields", "Solo practice"],
  },
  2: {
    title: "The Diplomat",
    summary: "A study in partnership and balance — the number of the peacemaker.",
    rulingPlanet: "Moon",
    traits: ["Cooperative", "Sensitive", "Intuitive", "Patient"],
    careerPaths: ["Counseling", "Mediation", "Partnerships", "Support roles"],
  },
  3: {
    title: "The Communicator",
    summary: "A study in creativity and expression — the number of the artist and speaker.",
    rulingPlanet: "Jupiter",
    traits: ["Expressive", "Creative", "Optimistic", "Social"],
    careerPaths: ["Writing", "Performing arts", "Teaching", "Public speaking"],
  },
  4: {
    title: "The Builder",
    summary: "A study in structure and discipline — the number of the steady worker.",
    rulingPlanet: "Rahu",
    traits: ["Grounded", "Methodical", "Reliable", "Persistent"],
    careerPaths: ["Engineering", "Project management", "Finance", "Administration"],
  },
  5: {
    title: "The Explorer",
    summary: "A study in freedom and change — the number of the restless traveler.",
    rulingPlanet: "Mercury",
    traits: ["Adaptable", "Curious", "Energetic", "Versatile"],
    careerPaths: ["Sales", "Travel", "Media", "Marketing"],
  },
  6: {
    title: "The Nurturer",
    summary: "A study in harmony and responsibility — the number of the caretaker.",
    rulingPlanet: "Venus",
    traits: ["Caring", "Responsible", "Harmonious", "Loyal"],
    careerPaths: ["Healthcare", "Education", "Family business", "Design"],
  },
  7: {
    title: "The Seeker",
    summary: "A study in introspection and wisdom — the number of the analyst.",
    rulingPlanet: "Ketu",
    traits: ["Analytical", "Reflective", "Private", "Perceptive"],
    careerPaths: ["Research", "Spirituality", "Science", "Writing"],
  },
  8: {
    title: "The Achiever",
    summary: "A study in ambition and material mastery — the number of the executive.",
    rulingPlanet: "Saturn",
    traits: ["Ambitious", "Disciplined", "Authoritative", "Resilient"],
    careerPaths: ["Business management", "Law", "Real estate", "Finance"],
  },
  9: {
    title: "The Humanitarian",
    summary: "A study in completion and compassion — the number of the idealist.",
    rulingPlanet: "Mars",
    traits: ["Compassionate", "Idealistic", "Generous", "Wise"],
    careerPaths: ["Nonprofit work", "Healing arts", "Activism", "Philosophy"],
  },
  11: {
    title: "The Intuitive",
    summary: "A master number study in insight — the number of the teacher and visionary.",
    rulingPlanet: "Moon (heightened)",
    traits: ["Visionary", "Intuitive", "Inspiring", "Sensitive"],
    careerPaths: ["Teaching", "Counseling", "Spiritual guidance", "Design"],
  },
  22: {
    title: "The Master Builder",
    summary: "A master number study in large-scale vision made real — the number of the architect.",
    rulingPlanet: "Rahu (heightened)",
    traits: ["Visionary", "Practical", "Ambitious", "Disciplined"],
    careerPaths: ["Architecture", "Large-scale enterprise", "Engineering", "Civic leadership"],
  },
  33: {
    title: "The Master Healer",
    summary: "A master number study in selfless service — the number of the teacher-healer.",
    rulingPlanet: "Venus (heightened)",
    traits: ["Compassionate", "Nurturing", "Devoted", "Wise"],
    careerPaths: ["Healing professions", "Teaching", "Community service", "Counseling"],
  },
};

const FALLBACK_PROFILE = {
  title: "Unmapped",
  summary: "This number has no recorded symbolism yet.",
  rulingPlanet: "—",
  traits: [],
  careerPaths: [],
};

export function describeNumber(n) {
  return NUMBER_PROFILES[n] || FALLBACK_PROFILE;
}

if (process.env.NODE_ENV !== "production") {
  console.assert(reduceNumber(38) === 11, "reduceNumber stops at master number");
  console.assert(reduceNumber(29) === 11, "reduceNumber master number preserved");
  console.assert(reduceNumber(45) === 9, "reduceNumber basic case");
  console.assert(lifePathNumber("1990-05-12").number === 9, "lifePathNumber basic case");
  console.assert(lifePathNumber("").number === null, "lifePathNumber handles empty input");
  console.assert(expressionNumber("Arjuna", "pythagorean").number != null, "expressionNumber computes");
  console.assert(expressionNumber("", "chaldean").number === null, "expressionNumber handles empty name");
}
