// Runtime checks for data the page does not control: API responses, browser storage and JSON.

/** Any non-null object, arrays included. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A string with something in it: not missing, and not "". */
export function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

/** The value if it is an object, otherwise an empty one. */
export function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

/** The value if it is an array, otherwise an empty one. */
export function toArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}
