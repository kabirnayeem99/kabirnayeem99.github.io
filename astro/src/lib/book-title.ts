// Goodreads appends the series to a title: "Lonesome Dove (Lonesome Dove, #1)".
export const withoutSeries = (title: string): string => title.replace(/\s*\([^()]*#\d+(?:\.\d+)?\)\s*$/, "").trim();
