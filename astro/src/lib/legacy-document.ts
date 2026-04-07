import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LEGACY_ROOT = resolve(process.cwd(), "..");

export interface LegacyDocument {
  readonly fullHtml: string;
}

function assertLooksLikeHtmlDocument(source: string, legacyRelativePath: string): void {
  if (!source.toLowerCase().includes("<html")) {
    throw new Error(`Expected an HTML document in ${legacyRelativePath}`);
  }
}

export function readLegacyDocument(legacyRelativePath: string): LegacyDocument {
  const legacyPath = resolve(LEGACY_ROOT, legacyRelativePath);
  const source = readFileSync(legacyPath, "utf-8");
  assertLooksLikeHtmlDocument(source, legacyRelativePath);
  return { fullHtml: source };
}
