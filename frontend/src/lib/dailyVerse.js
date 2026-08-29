// Daily Bhagavad Gita verse — auto-fetched, no manual DB entry / staff panel needed.

// ponytail: bhagavadgitaapi.in (spec'd endpoint) is now a parked/for-sale domain (verified 2026-08-27).
// vedicscriptures.github.io serves the same /slok/{chapter}/{verse} shape it was originally built on —
// swap API_BASE back if bhagavadgitaapi.in ever comes back online.
const API_BASE = "https://vedicscriptures.github.io/slok";

// Verses per chapter, in order — sums to 700, the total verse count in the Gita.
const CHAPTER_VERSE_COUNTS = [47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 34, 27, 20, 24, 28, 78];
const TOTAL_VERSES = CHAPTER_VERSE_COUNTS.reduce((a, b) => a + b, 0); // 700

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

/** Maps today's day-of-year (mod 700) onto a (chapter, verse) pair, cycling through the whole Gita. */
export function getDailyChapterVerse(date = new Date()) {
  let remaining = (dayOfYear(date) % TOTAL_VERSES) + 1;
  for (let ch = 0; ch < CHAPTER_VERSE_COUNTS.length; ch++) {
    if (remaining <= CHAPTER_VERSE_COUNTS[ch]) return { chapter: ch + 1, verse: remaining };
    remaining -= CHAPTER_VERSE_COUNTS[ch];
  }
  return { chapter: 18, verse: CHAPTER_VERSE_COUNTS[17] };
}

// "sanskrit—meaning; sanskrit—meaning; ..." → [{ sanskrit, iast, meaning }] — the shape the original
// spec assumed. Kept for forward-compat in case a mirror ever serves this field directly.
function parseWordMeanings(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw.split(/;|\n/).map((s) => s.trim()).filter(Boolean).map((chunk) => {
    const m = chunk.match(/^(.*?)[—\-:]\s*(.*)$/);
    const sanskrit = m ? m[1].trim() : chunk;
    const meaning = m ? m[2].trim() : "";
    const iast = /^[a-zA-Z.'Ā-ỿ\s]+$/.test(sanskrit) ? sanskrit : "";
    return { sanskrit, iast, meaning };
  });
}

// This API has no `word_meanings` field, but Swami Sivananda's `ec` entry packs a word-by-word
// gloss ahead of his commentary, e.g. "कर्मणि in work? एव only? ... अकर्मणि in inaction.Commentary <text>".
function splitSivaEc(ec) {
  if (!ec || typeof ec !== "string") return { words: "", commentary: "" };
  const idx = ec.search(/\.Commentary/i);
  if (idx === -1) return { words: "", commentary: ec.trim() };
  return { words: ec.slice(0, idx), commentary: ec.slice(idx).replace(/^\.Commentary\s*/i, "").trim() };
}

function parseSivaWords(wordsBlock) {
  if (!wordsBlock) return [];
  // The source data reuses "?" both as the word-pair delimiter and as a mid-sentence comma inside
  // English glosses — only split where "?" is actually followed by the next Sanskrit word.
  const cleaned = wordsBlock.replace(/^\s*\d+\.\d+\s+/, ""); // strip a leading "6.7 " reference prefix
  return cleaned.split(/\?(?=\s*[ऀ-ॿ])/).map((s) => s.trim()).filter(Boolean).map((chunk) => {
    const m = chunk.match(/^([ऀ-ॿ][ऀ-ॿ\s]*?)\s+([A-Za-z(].*)$/);
    return m
      ? { sanskrit: m[1].trim(), iast: "", meaning: m[2].replace(/\?/g, ",").trim() }
      : { sanskrit: chunk, iast: "", meaning: "" };
  });
}

const AUTHOR_KEYS = ["tej", "siva", "chinmay", "purohit"];
const COMMENTARY_FIELDS = ["ec", "hc", "sc", "ht"];

// Each author key holds an { author, et?, ec?/hc?/ht? } object — split into translation vs. commentary.
function mapAttributions(data) {
  const translations = [];
  const commentaries = [];
  const siva = splitSivaEc(data.siva?.ec);
  for (const key of AUTHOR_KEYS) {
    const entry = data[key];
    if (!entry || typeof entry !== "object") continue;
    const author = entry.author || key;
    if (entry.et) translations.push({ author, text: entry.et });
    if (key === "siva") {
      if (siva.commentary) commentaries.push({ author, text: siva.commentary });
      continue;
    }
    const cField = COMMENTARY_FIELDS.find((f) => entry[f]);
    if (cField) commentaries.push({ author, text: entry[cField] });
  }
  return { translations, commentaries, wordByWord: parseSivaWords(siva.words) };
}

/** Fetches + maps today's verse straight from the free Gita API into <ShlokaPlayer/>'s prop shape. */
export async function fetchDailyVerse(date = new Date()) {
  const { chapter, verse } = getDailyChapterVerse(date);
  const res = await fetch(`${API_BASE}/${chapter}/${verse}`);
  if (!res.ok) throw new Error(`Gita API responded ${res.status}`);
  const data = await res.json();
  const { translations, commentaries, wordByWord } = mapAttributions(data);
  return {
    scripture: "BHAGAVAD GITA",
    reference: `${chapter}.${verse}`,
    devanagari: data.slok,
    iast: data.transliteration,
    word_by_word: data.word_meanings ? parseWordMeanings(data.word_meanings) : wordByWord,
    translations,
    commentaries,
  };
}
