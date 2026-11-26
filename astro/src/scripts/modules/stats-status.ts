// Status lines under the stats widgets, in the page's language. They say where the figures on
// screen come from, and call them live only straight after a successful fetch; saved figures
// (the bundled snapshot or this browser's cache) carry their date.
import { isLang, type Lang } from "../../lib/locale-config";
import { formatMarginDate } from "../../lib/notebook";

export type StatsSource = "WakaTime" | "GitHub" | "LeetCode";
export type SavedKind = "snapshot" | "cache";

export interface SavedFigures {
  readonly kind: SavedKind;
  /** ISO timestamp or epoch milliseconds of when the figures were fetched. */
  readonly savedAt: string | number;
}

interface Copy {
  readonly live: (source: StatsSource) => string;
  readonly saved: Readonly<Record<SavedKind, (source: StatsSource, date: string) => string>>;
  readonly refreshFailed: string;
  readonly unavailable: (source: StatsSource) => string;
}

const COPY: Readonly<Record<Lang, Copy>> = {
  en: {
    live: (source) => `Updated just now with live ${source} data.`,
    saved: {
      snapshot: (source, date) => `Showing a ${source} snapshot from ${date}.`,
      cache: (source, date) => `Showing ${source} data saved in this browser on ${date}.`,
    },
    refreshFailed: "Live refresh failed.",
    unavailable: (source) => `Could not load ${source} data right now.`,
  },
  bn: {
    live: (source) => `এইমাত্র ${source} থেকে লাইভ ডাটা আনা হয়েছে।`,
    saved: {
      snapshot: (source, date) => `${date} তারিখের ${source} স্ন্যাপশট দেখানো হচ্ছে।`,
      cache: (source, date) => `${date} তারিখে এই ব্রাউজারে সংরক্ষিত ${source} ডাটা দেখানো হচ্ছে।`,
    },
    refreshFailed: "লাইভ ডাটা আনা যায়নি।",
    unavailable: (source) => `এই মুহূর্তে ${source} ডাটা লোড করা যাচ্ছে না।`,
  },
  ar: {
    live: (source) => `حُدِّثَتِ ٱلْبَيَانَاتُ ٱلْآنَ مُبَاشَرَةً مِنْ ${source}.`,
    saved: {
      snapshot: (source, date) => `تُعْرَضُ لَقْطَةٌ مِنْ ${source} بِتَارِيخِ ${date}.`,
      cache: (source, date) => `تُعْرَضُ بَيَانَاتُ ${source} ٱلْمَحْفُوظَةُ فِي هٰذَا ٱلْمُتَصَفِّحِ بِتَارِيخِ ${date}.`,
    },
    refreshFailed: "تَعَذَّرَ ٱلتَّحْدِيثُ ٱلْمُبَاشِرُ.",
    unavailable: (source) => `تَعَذَّرَ تَحْمِيلُ بَيَانَاتِ ${source} ٱلْآنَ.`,
  },
  ur: {
    live: (source) => `ابھی ${source} سے لائیو ڈیٹا لیا گیا ہے۔`,
    saved: {
      snapshot: (source, date) => `${date} کا ${source} اسنیپ شاٹ دکھایا جا رہا ہے۔`,
      cache: (source, date) => `اس براؤزر میں ${date} کو محفوظ کیا گیا ${source} ڈیٹا دکھایا جا رہا ہے۔`,
    },
    refreshFailed: "لائیو ڈیٹا نہیں آ سکا۔",
    unavailable: (source) => `ابھی ${source} ڈیٹا لوڈ نہیں ہو سکا۔`,
  },
};

function pageLang(): Lang {
  const lang = document.documentElement.lang;
  return isLang(lang) ? lang : "en";
}

export function liveStatus(source: StatsSource): string {
  return COPY[pageLang()].live(source);
}

export function savedStatus(source: StatsSource, figures: SavedFigures): string {
  const lang = pageLang();
  const date = formatMarginDate(new Date(figures.savedAt).toISOString(), lang);
  return COPY[lang].saved[figures.kind](source, date);
}

export function refreshFailedStatus(source: StatsSource, figures: SavedFigures): string {
  return `${COPY[pageLang()].refreshFailed} ${savedStatus(source, figures)}`;
}

export function unavailableStatus(source: StatsSource): string {
  return COPY[pageLang()].unavailable(source);
}
