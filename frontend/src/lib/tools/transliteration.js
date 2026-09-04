import Sanscript from "sanscript";

export const ROMAN_SCHEMES = [
  { value: "iast", label: "IAST" },
  { value: "hk", label: "Harvard-Kyoto" },
  { value: "itrans", label: "ITRANS / English" },
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

if (process.env.NODE_ENV !== "production") {
  console.assert(toDevanagari("namaste", "hk") === toDevanagari("namaste", "hk"), "toDevanagari is deterministic");
  console.assert(detectScript("श्री") === "devanagari", "detectScript recognizes Devanagari");
  console.assert(detectScript("shri") === "roman", "detectScript recognizes roman input");
}
