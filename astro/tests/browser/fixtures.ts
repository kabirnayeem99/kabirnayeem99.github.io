// Makes a page look the same on every run. Data that outside jobs refresh (Goodreads books,
// stats figures) and anything dated is swapped for fixed stand-ins in the same markup, so the
// layout is still checked while a data refresh changes nothing.
import assert from "node:assert/strict";
import type { BrowserContext, Page } from "playwright";

/** The day the page believes it is. */
const FIXED_NOW = new Date("2026-01-15T06:00:00Z");

const DAY_MS = 24 * 60 * 60 * 1000;
const LANGUAGES = ["Kotlin", "Dart", "Swift", "Go", "TypeScript", "Rust", "Python", "Java"];

function contributions(): { date: string; count: number }[] {
  return Array.from({ length: 371 }, (_, index) => ({
    date: new Date(FIXED_NOW.getTime() - index * DAY_MS).toISOString().slice(0, 10),
    count: (index * 7) % 13,
  }));
}

const repos = Array.from({ length: 6 }, (_, index) => ({
  name: index === 0 ? "fixture-repository-with-a-rather-long-name" : `fixture-repository-${index}`,
  description: "A stand-in repository description, long enough to wrap onto a second line on a phone.",
  stargazers_count: 60 - index * 7,
  language: LANGUAGES[index] ?? null,
  html_url: "https://github.com/example/fixture",
  fork: false,
}));

/** Responses for the live APIs the stats widgets call, by a fragment of their URL. */
const API_FIXTURES: readonly (readonly [string, unknown])[] = [
  [
    "3ee188ec-1b6b-454a-9c7d-12b1d02cf86b",
    { data: LANGUAGES.map((name, index) => ({ name, percent: [34, 22, 14, 10, 8, 6, 4, 2][index] })) },
  ],
  [
    "c002cbf8-c46e-46ee-b225-d7b680009c55",
    {
      data: {
        best_day: { date: "2025-06-12", text: "10 hrs 10 mins" },
        grand_total: {
          total_seconds: 3_600_000,
          human_readable_total: "1,000 hrs",
          human_readable_daily_average: "3 hrs 20 mins",
        },
        range: { start: "2021-01-01T00:00:00Z", end: "2026-01-14T00:00:00Z" },
      },
    },
  ],
  [
    "github-contributions-api.jogruber.de",
    {
      total: { 2020: 400, 2021: 900, 2022: 700, 2023: 500, 2024: 300, 2025: 1200, 2026: 80 },
      contributions: contributions(),
    },
  ],
  ["api.github.com/users/", repos],
  ["type:pr", { total_count: 42 }],
  ["type:issue", { total_count: 24 }],
  [
    "alfa-leetcode-api.onrender.com",
    { solvedProblem: 150, easySolved: 90, mediumSolved: 50, hardSolved: 10 },
  ],
];

/** Answers the stats APIs from the fixtures (all other outside requests stay blocked). */
export async function useFixtures(context: BrowserContext, origin: string): Promise<void> {
  await context.clock.setFixedTime(FIXED_NOW);
  // Each page starts without what the previous one cached.
  await context.addInitScript(() => {
    window.localStorage.clear();
  });
  await context.route(
    (url) => url.origin !== origin,
    async (route) => {
      const url = decodeURIComponent(route.request().url());
      const match = API_FIXTURES.find(([fragment]) => url.includes(fragment));
      if (match === undefined) {
        await route.abort();
        return;
      }
      await route.fulfill({ json: match[1], headers: { "access-control-allow-origin": "*" } });
    },
  );
}

/** Waits for the widgets to show the fixtures, then replaces the data written into the HTML. */
export async function stabilise(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");

  const widgets = [
    ["[data-wakatime-widget]", "Kotlin"],
    ["[data-github-commits-widget]", "2020"],
    ["[data-github-profile-widget]", "fixture-repository-1"],
    ["[data-leetcode-widget]", "150"],
  ] as const;
  for (const [selector, marker] of widgets) {
    if ((await page.locator(selector).count()) === 0) continue;
    // The compact year labels read "'20".
    const expected = marker === "2020" ? /2020|’20|'20/ : new RegExp(marker);
    await page.locator(selector).filter({ hasText: expected }).waitFor({ timeout: 10_000 });
  }

  await page.evaluate(() => {
    const setText = (selector: string, text: string): void => {
      for (const element of document.querySelectorAll(selector)) element.textContent = text;
    };
    setText(".footer-last-updated time", "15 Jan 2026");
    setText(".margin-note", "15 Jan 2026");
    setText("[data-last-finished]", "A Stand-in Book With a Reasonably Long Title");
    setText(".shelf-more-pocket > span", "+100 more");
    setText(".stats-report-section--typing .leetcode-card-value", "88.8 WPM");
    const typingNote = document.querySelector(".stats-report-section--typing .summary-card > p");
    for (const node of typingNote?.childNodes ?? []) {
      if (node.nodeType === Node.TEXT_NODE) node.textContent = (node.textContent ?? "").replace(/\p{Nd}+/gu, "100");
    }

    const cover =
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#8a7d6a"/><rect x="14" y="14" width="172" height="272" fill="none" stroke="#fff" stroke-width="4"/></svg>',
      );
    const titles = [
      "A Short Book",
      "A Considerably Longer Stand-in Title That Has to Wrap or Be Clipped Neatly",
      "পথের পাঁচালী",
      "كتاب الأيام",
    ];

    /** Leaves exactly `total` books in a shelf, all built from its first one. */
    const fillShelf = (grid: Element, total: number): void => {
      const books = [...grid.querySelectorAll(":scope > .gr_grid_book_container")];
      // The home shelf's first book carries the "last read" tape; the rest copy a plain one.
      const first = books[0];
      const plain = books[1] ?? first;
      if (first === undefined || plain === undefined) return;
      const after = grid.querySelector(":scope > .gr_grid_book_placeholder");
      for (const book of books) book.remove();
      for (let index = 0; index < total; index += 1) {
        const source = index === 0 ? first : plain;
        const book = source.cloneNode(true);
        if (!(book instanceof Element)) continue;
        const title = titles[index % titles.length] ?? "";
        const image = book.querySelector("img");
        if (image !== null) {
          image.src = cover;
          image.alt = title;
        }
        const link = book.querySelector("a");
        if (link !== null) link.title = title;
        const strip = book.querySelector(".book-strip--title");
        if (strip !== null) {
          strip.textContent = title;
          strip.removeAttribute("lang");
        }
        let date = book.querySelector(".book-strip--date");
        if (date === null) {
          date = document.createElement("span");
          date.className = "book-strip book-strip--date";
          book.prepend(date);
        }
        date.removeAttribute("hidden");
        date.textContent = "15 Jan 2026";
        grid.insertBefore(book, after);
      }
    };

    const years = [...document.querySelectorAll(".shelf-year")];
    if (years.length > 0) {
      const counts = [11, 5, 2];
      years.forEach((year, index) => {
        const total = counts[index];
        const grid = year.querySelector(".gr_grid_container");
        if (total === undefined || grid === null || grid.children.length === 0) {
          year.remove();
          return;
        }
        fillShelf(grid, total);
        const name = year.querySelector(".shelf-year-name");
        if (name !== null) name.textContent = String(2026 - index);
        const count = year.querySelector(".shelf-year-count");
        if (count !== null) count.textContent = `${total} books`;
      });
    } else {
      for (const grid of document.querySelectorAll(".goodreads-widget .gr_grid_container")) {
        fillShelf(grid, grid.querySelector(".gr_grid_book_placeholder") === null ? 12 : 9);
      }
    }
  });

  // Photographs and app screenshots become flat frames of the same natural size: the layout is
  // identical, cropping shows as a missing frame edge, and the baselines stay small.
  await page.evaluate(async () => {
    const photos = [...document.images].filter((image) => /\.(?:webp|png|jpe?g)$/i.test(image.getAttribute("src") ?? ""));
    for (const image of photos) {
      image.loading = "eager";
      await image.decode();
      const { naturalWidth: width, naturalHeight: height } = image;
      const edge = Math.max(4, Math.round(width / 40));
      image.removeAttribute("srcset");
      image.src =
        "data:image/svg+xml," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#8a7d6a"/><rect x="${edge}" y="${edge}" width="${width - 2 * edge}" height="${height - 2 * edge}" fill="none" stroke="#fff" stroke-width="${edge / 2}"/><path d="M0 0L${width} ${height}" stroke="#fff" stroke-width="${edge / 2}"/></svg>`,
        );
    }
  });

  // Lazy images load only when near the screen; a full-page picture needs them all.
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map(async (image) => {
        image.loading = "eager";
        try {
          await image.decode();
        } catch {
          // A blocked outside image stays broken, the same way on every run.
        }
      }),
    );
    await document.fonts.ready;
  });
  const broken = await page.evaluate(() =>
    [...document.images]
      .filter((image) => image.src.startsWith(window.location.origin) && image.naturalWidth === 0)
      .map((image) => image.src),
  );
  assert.deepEqual(broken, [], `images that did not load: ${broken.join(", ")}`);
}
