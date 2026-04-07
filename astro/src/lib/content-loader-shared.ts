import { resolve } from "node:path";
import type { Direction, Lang } from "./site-types";

export const CONTENT_PATH = resolve(process.cwd(), "src/data/site-content.json");

export interface MetaText {
  readonly title: string;
  readonly description: string;
  readonly keywords: string;
}

export interface LocaleInfo {
  readonly dir: Direction;
  readonly author: string;
  readonly ogImageAlt: string;
}

export interface SiteData {
  readonly baseUrl: string;
  readonly personName: string;
  readonly websiteName: string;
  readonly twitterSite: string;
  readonly socialProfiles: readonly string[];
  readonly googleSiteVerification: string;
}

export type RouteMap = Readonly<Record<Lang, string>>;

export function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected object at ${path}`);
  }
  return value as Record<string, unknown>;
}

export function readString(source: Record<string, unknown>, key: string, path: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string at ${path}.${key}`);
  }
  return value;
}

export function readOptionalString(
  source: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  const value = source[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected string at ${path}.${key}`);
  }
  return value;
}

export function readDirection(source: Record<string, unknown>, key: string, path: string): Direction {
  const value = readString(source, key, path);
  if (value !== "ltr" && value !== "rtl") {
    throw new Error(`Expected direction at ${path}.${key}`);
  }
  return value;
}

export function readStringArray(
  source: Record<string, unknown>,
  key: string,
  path: string,
): readonly string[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`);
  }
  const output: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (typeof entry !== "string") {
      throw new Error(`Expected string at ${path}.${key}[${index}]`);
    }
    output.push(entry);
  }
  return output;
}

export function readOptionalStringArray(
  source: Record<string, unknown>,
  key: string,
  path: string,
): readonly string[] {
  const value = source[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`);
  }
  const output: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (typeof entry !== "string") {
      throw new Error(`Expected string at ${path}.${key}[${index}]`);
    }
    output.push(entry);
  }
  return output;
}

export function readRouteMap(source: Record<string, unknown>, path: string): RouteMap {
  return {
    en: readString(source, "en", path),
    bn: readString(source, "bn", path),
    ar: readString(source, "ar", path),
    ur: readString(source, "ur", path),
  };
}
