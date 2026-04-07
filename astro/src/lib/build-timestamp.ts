import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export interface BuildTimestamp {
  readonly iso: string;
  readonly display: string;
}

const ASTRO_ROOT = process.cwd();

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${sign}${pad2(hours)}:${pad2(minutes)}`;
}

function formatIsoLocal(date: Date): string {
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}${formatOffset(date)}`
  );
}

function formatDisplay(date: Date): string {
  const hour24 = date.getHours();
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const amPm = hour24 >= 12 ? "PM" : "AM";
  return (
    `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad2(hour12)}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())} ${amPm}`
  );
}

function findLatestTimestampMillis(): number {
  const candidates: string[] = [
    resolve(ASTRO_ROOT, "src/data/site-content.json"),
    resolve(ASTRO_ROOT, "public/assets/css/styles.source.css"),
  ];

  const assetJsDir = resolve(ASTRO_ROOT, "public/assets/js");
  for (const name of readdirSync(assetJsDir)) {
    if (name.endsWith(".js")) {
      candidates.push(resolve(assetJsDir, name));
    }
  }

  const sourceRoot = resolve(ASTRO_ROOT, "src");
  const stack: string[] = [sourceRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      continue;
    }

    const stats = statSync(current);
    if (stats.isDirectory()) {
      for (const name of readdirSync(current)) {
        stack.push(resolve(current, name));
      }
      continue;
    }

    if (current.endsWith(".ts") || current.endsWith(".astro")) {
      candidates.push(current);
    }
  }

  let latest = 0;
  for (const path of candidates) {
    const mtime = statSync(path).mtimeMs;
    if (mtime > latest) {
      latest = mtime;
    }
  }

  return latest;
}

export function computeLegacyBuildTimestamp(): BuildTimestamp {
  const latest = findLatestTimestampMillis();
  const date = new Date(latest === 0 ? Date.now() : latest);
  return {
    iso: formatIsoLocal(date),
    display: formatDisplay(date),
  };
}
