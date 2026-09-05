import Sanscript from "sanscript";

export const ROMAN_SCHEMES = [
  { value: "itrans", label: "Easy English", example: "shree ganeshaay namah", hint: "Type it the way it sounds — best for everyday typing." },
  { value: "iast", label: "Standard (with accent marks)", example: "śrī gaṇeśāya namaḥ", hint: "Used in books and academic texts — has small marks over letters." },
  { value: "hk", label: "Capitals style", example: "shrii gaNeshaaya namaH", hint: "Uses capital letters instead of accent marks — common in software." },
];

export const SCRIPT_OPTIONS = [
  { value: "devanagari", label: "Devanagari (Hindi/Sanskrit)", example: "श्री गणेशाय नमः", hint: "The native script used in Hindi and Sanskrit texts." },
  ...ROMAN_SCHEMES,
];

const DEVANAGARI_RANGE = /[ऀ-ॿ]/;

export function detectScript(text) {
  return DEVANAGARI_RANGE.test(text) ? "devanagari" : "roman";
}

export function toRoman(devanagariText, scheme = "iast") {
  if (!devanagariText) return "";
  return Sanscript.t(devanagariText, "devanagari", scheme);
}

export function toDevanagari(romanText, scheme = "iast") {
  if (!romanText) return "";
  return Sanscript.t(romanText, scheme, "devanagari");
}

export function transliterate(text, fromScheme, toScheme) {
  if (!text || fromScheme === toScheme) return text || "";
  return Sanscript.t(text, fromScheme, toScheme);
}

if (process.env.NODE_ENV !== "production") {
  console.assert(toDevanagari("namaste", "hk") === toDevanagari("namaste", "hk"), "toDevanagari is deterministic");
  console.assert(detectScript("श्री") === "devanagari", "detectScript recognizes Devanagari");
  console.assert(detectScript("shri") === "roman", "detectScript recognizes roman input");
  console.assert(transliterate("श्री", "devanagari", "itrans") === toRoman("श्री", "itrans"), "transliterate matches toRoman");
  console.assert(transliterate("shrI", "itrans", "devanagari") === toDevanagari("shrI", "itrans"), "transliterate matches toDevanagari");
}
