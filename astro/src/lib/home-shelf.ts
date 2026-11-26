// The home shelf after "Last read": hand-picked books, newest read first. Picks missing from
// the snapshot are skipped; with none left, recent reads fill in.

interface SnapshotBook {
  readonly imageFileName: string;
  readonly dateRead: string | null;
}

const readTime = (book: SnapshotBook): number => {
  const time = Date.parse(book.dateRead ?? "");
  return Number.isNaN(time) ? 0 : time;
};

/** `books` is the snapshot, newest first: its first book is "Last read" and is never repeated. */
export function selectShelfPicks<T extends SnapshotBook>(
  books: readonly T[],
  pickedFileNames: readonly string[],
  limit: number,
): readonly T[] {
  const lastRead = books[0];
  const byFile = new Map(books.map((book) => [book.imageFileName, book]));
  const picked = pickedFileNames
    .flatMap((fileName) => byFile.get(fileName) ?? [])
    .filter((book) => book !== lastRead)
    .sort((a, b) => readTime(b) - readTime(a))
    .slice(0, limit);
  return picked.length > 0 ? picked : books.slice(1, 1 + limit);
}
