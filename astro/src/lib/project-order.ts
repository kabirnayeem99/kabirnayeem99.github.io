// Order of the cards within a project group.

/** Latest year named in a card's meta line ("২০২৪ - …", "2025–2026"); undated cards get 0. */
export function metaYear(meta: string | undefined): number {
  const latinDigits = (meta ?? "").replace(/[০-৯٠-٩۰-۹]/gu, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= 0x09e6 ? 0x09e6 : code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
  return Math.max(0, ...(latinDigits.match(/(?<!\d)(?:19|20)\d{2}(?!\d)/g) ?? []).map(Number));
}

// Array sort is stable, so cards from the same year keep the order they are written in.
export function newestFirst<T extends { readonly meta?: string }>(cards: readonly T[]): readonly T[] {
  return [...cards].sort((a, b) => metaYear(b.meta) - metaYear(a.meta));
}
