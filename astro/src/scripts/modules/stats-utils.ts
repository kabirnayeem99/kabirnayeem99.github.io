export interface StatsUtils {
  readonly toSafeNumber: (value: unknown) => number;
  readonly formatPercent: (value: number) => string;
  readonly formatDuration: (seconds: number) => string;
  readonly toUtcDateOnly: (date: Date) => Date;
  readonly parseDateOnly: (value: unknown) => Date | null;
  readonly addUtcDays: (date: Date, days: number) => Date;
  readonly dateKey: (date: Date) => string;
  readonly formatDate: (date: Date) => string;
  readonly formatNumber: (value: number) => string;
}

export function toSafeNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function formatPercent(value: number): string {
  if (value < 1) {
    return `${value.toFixed(2)}%`;
  }
  return `${value.toFixed(1)}%`;
}

export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(toSafeNumber(seconds)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secondsRemainder = totalSeconds % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} hrs ${minutes} mins`;
  }
  if (hours > 0) {
    return `${hours} hrs`;
  }
  if (minutes > 0) {
    return `${minutes} mins`;
  }
  return `${secondsRemainder} secs`;
}

export function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return toUtcDateOnly(parsed);
}

export function addUtcDays(date: Date, days: number): Date {
  const millisPerDay = 86_400_000;
  return new Date(date.getTime() + days * millisPerDay);
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(toSafeNumber(value))));
}

export const personPortfolioStatsUtils: Readonly<StatsUtils> = Object.freeze({
  toSafeNumber,
  formatPercent,
  formatDuration,
  toUtcDateOnly,
  parseDateOnly,
  addUtcDays,
  dateKey,
  formatDate,
  formatNumber,
});

declare global {
  interface Window {
    personPortfolioStatsUtils?: Readonly<StatsUtils>;
  }

  var personPortfolioStatsUtils: Readonly<StatsUtils> | undefined;
}

(globalThis as typeof globalThis & { personPortfolioStatsUtils?: Readonly<StatsUtils> })
  .personPortfolioStatsUtils = personPortfolioStatsUtils;

