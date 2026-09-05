import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Picks the Hindi twin of a translated DB field (e.g. "title" -> "title_hi")
// when the site language is Hindi and a translation exists, else the English value.
export function localized(obj, field, lang) {
  if (lang === "hi" && obj?.[`${field}_hi`]) return obj[`${field}_hi`];
  return obj?.[field];
}
