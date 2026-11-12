// Guess the language of a short mixed-script string (a book title) from its letters, so it
// can carry a lang attribute. Fonts are already chosen per character by unicode-range; this
// only matters for the Arabic block, which Urdu shares: Urdu gets Gulzar (Nastaleeq),
// Arabic gets Amiri (Naskh).

export type ScriptLang = "ur" | "ar" | "bn";

// Letters Urdu uses and Arabic does not: ٹ ڈ ڑ ں ھ ہ ۂ ۃ ے ۓ
const URDU_ONLY = /[ٹڈڑںھہ-ۃےۓ]/;
const ARABIC_BLOCK = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const BENGALI_BLOCK = /[ঀ-৿]/;

export function scriptLang(text: string | undefined | null): ScriptLang | undefined {
  if (typeof text !== "string" || text.length === 0) {
    return undefined;
  }
  if (URDU_ONLY.test(text)) {
    return "ur";
  }
  if (ARABIC_BLOCK.test(text)) {
    return "ar";
  }
  if (BENGALI_BLOCK.test(text)) {
    return "bn";
  }
  return undefined;
}

/** Sets or clears `lang` on an element from its text. */
export function applyScriptLang(el: HTMLElement, text: string): void {
  const lang = scriptLang(text);
  if (lang === undefined) {
    el.removeAttribute("lang");
  } else {
    el.lang = lang;
  }
}
