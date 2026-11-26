// The shape of every JSON file the site is built from. content-validate.ts runs these over
// the files (the build fails on any problem); the loaders use them for their types.
//
// Plain Node imports this file too (tests, astro.config.mjs, the stats refresh script), so
// relative imports carry their extension.
import { z } from "astro/zod";
import { ICON_NAMES } from "./icon-names.ts";
import { ALL_PAGE_IDS, LANGS, PAGE_IDS } from "./locale-config.ts";
import { resolveSocialPlatformFromHref } from "./social-chip-icons.ts";

/* ---------- Values ---------- */

const text = z.string().refine((value) => value.trim().length > 0, { error: "must not be empty" });

function isWebUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/.test(value) && URL.canParse(value);
}

const webUrl = z.string().refine(isWebUrl, { error: "must be a full http(s) URL without spaces" });

/** A link the visitor follows: a web address or an email address. */
const href = z.string().refine((value) => isWebUrl(value) || /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
  error: "must be a full http(s) URL or a mailto: address",
});

/** A file under public/. content-validate.ts also checks that it exists. */
const assetPath = z
  .string()
  .regex(/^assets\/[^\s?#]+\.(?:avif|gif|jpe?g|png|svg|webp)$/, { error: 'must be an image path starting "assets/"' });

const route = z
  .string()
  .regex(/^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.html$/, { error: 'must be a relative page route such as "bn/work.html"' });

const dimension = z.int().positive();
const digits = z.string().regex(/^\d+$/, { error: "must be digits only" });
const languageTag = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/, { error: "must be a language tag" });
const icon = z.enum(ICON_NAMES, { error: (issue) => `unknown icon ${JSON.stringify(issue.input)}` });
const pageId = z.enum(PAGE_IDS);
const anyPageId = z.enum(ALL_PAGE_IDS);

/** One value in every language; a missing one is a missing translation. */
function perLang<T extends z.ZodType>(schema: T) {
  return z.strictObject({ en: schema, bn: schema, ar: schema, ur: schema });
}

/* ---------- Shared files ---------- */

const localeInfoSchema = z.strictObject({
  dir: z.enum(["ltr", "rtl"]),
  author: text,
  language_switcher_label: text,
  og_image_alt: text,
  labels: z.strictObject({
    skip_to_main: text,
    close_page: text,
    last_updated: text,
    back_to_top: text,
    theme_dark: text,
    theme_light: text,
  }),
  build_timestamp: z.strictObject({
    prefix: text,
    day_period: z.strictObject({ morning: text, afternoon: text, evening: text }),
  }),
  social_platform_labels: z.strictObject({ github: text, linkedin: text, medium: text, leetcode: text }),
});

const socialProfile = webUrl.refine(
  (value) => {
    try {
      resolveSocialPlatformFromHref(value);
      return true;
    } catch {
      return false;
    }
  },
  { error: "must be a GitHub, LinkedIn, Medium or LeetCode address" },
);

export const siteSchema = z.strictObject({
  base_url: webUrl.refine((value) => !value.endsWith("/"), { error: "must not end with a slash" }),
  person_name: text,
  website_name: text,
  twitter_site: z.string().regex(/^@\w+$/, { error: 'must be a handle such as "@name"' }),
  social_profiles: z.array(socialProfile),
  google_site_verification: text,
  language_menu_labels: perLang(text),
  locales: perLang(localeInfoSchema),
});

const routeMap = perLang(route);

export const routesSchema = z.strictObject({
  index: routeMap,
  work: routeMap,
  project: routeMap,
  blog: routeMap,
  stats: routeMap,
  reading: routeMap,
});

// Each language lists every shared page once; "reading" is optional (English has it today).
const navOrder = z.array(anyPageId).superRefine((entries, context) => {
  entries.forEach((entry, index) => {
    if (entries.indexOf(entry) !== index) {
      context.addIssue({ code: "custom", path: [index], message: `"${entry}" is listed twice` });
    }
  });
  for (const id of PAGE_IDS) {
    if (!entries.includes(id)) {
      context.addIssue({ code: "custom", message: `page "${id}" is missing` });
    }
  }
});

export const navigationSchema = perLang(navOrder);

const navLabel = perLang(text);

export const navigationLabelsSchema = z.strictObject({
  index: navLabel,
  work: navLabel,
  project: navLabel,
  blog: navLabel,
  stats: navLabel,
  reading: navLabel,
});

const skillsSchema = z.strictObject({
  groups: z.array(
    z.strictObject({
      label: perLang(text),
      items: z.array(
        z.strictObject({
          name: text,
          icon: icon.optional(),
          lang: languageTag.optional(),
          note: perLang(text).optional(),
        }),
      ),
    }),
  ),
});

// A pick missing from the snapshot is skipped by the home page, so it is not an error here.
const featuredBooksSchema = z.strictObject({
  books: z
    .array(z.string().regex(/^[^/\s]+\.webp$/, { error: "must be a .webp file name" }))
    .refine((names) => new Set(names).size === names.length, { error: "lists a book twice" }),
});

/* ---------- Generated files ---------- */

// Written by Python's datetime.isoformat() and JavaScript's toISOString(): "Z", an offset,
// or (for a date typed into the snapshot by hand and written back) no zone at all.
const timestamp = z.iso.datetime({ offset: true, local: true, error: "must be an ISO 8601 date and time" });

// scripts/goodreads_snapshot/update_goodreads_snapshot.py writes this file.
const goodreadsSnapshotSchema = z.strictObject({
  generatedAt: timestamp,
  books: z
    .array(
      z.strictObject({
        title: text,
        href: webUrl,
        alt: z.string(),
        imageUrl: webUrl,
        imageLocal: z.string().regex(/^\/assets\/.+/, { error: 'must start with "/assets/"' }),
        imageFileName: z.string().regex(/^[^/]+$/, { error: "must be a file name" }),
        dateRead: timestamp.nullable(),
      }),
    )
    // <last-finished/> in the page copy needs a book to name.
    .min(1),
});

// scripts/refresh-stats-snapshots.ts writes this file, and keeps a source's previous figures
// when the new ones do not match these. Objects passed through from an API are loose: the
// service may add fields at any time.
const count = z.int().nonnegative();
const calendarDate = z.iso.date({ error: "must be a date as YYYY-MM-DD" });

const submissionCounts = z.array(z.looseObject({ difficulty: z.string(), count, submissions: count }));

export const statsSnapshotSourceSchemas = {
  wakatime: z.strictObject({
    generatedAt: timestamp,
    languagePayload: z.strictObject({
      data: z.array(z.strictObject({ name: z.string(), percent: z.number(), color: z.string() })).min(1),
    }),
    summaryPayload: z.strictObject({
      data: z.strictObject({
        best_day: z.looseObject({ date: text }),
        grand_total: z.looseObject({ total_seconds: z.number().positive() }),
        range: z.looseObject({ start: text, end: text }),
      }),
    }),
  }),
  githubCommits: z.strictObject({
    generatedAt: timestamp,
    total: z.record(z.string(), count),
    contributions: z.array(z.strictObject({ date: calendarDate, count, level: count.optional() })).min(1),
  }),
  githubProfile: z.strictObject({
    generatedAt: timestamp,
    repos: z
      .array(
        z.strictObject({
          name: z.string(),
          description: z.string(),
          stars: count,
          language: z.string().nullable(),
          htmlUrl: webUrl,
        }),
      )
      .min(1),
    mergedPrs: count,
    issuesOpened: count,
    languages: z.record(z.string(), count),
  }),
  leetcode: z.strictObject({
    generatedAt: timestamp,
    solved: z.strictObject({
      solvedProblem: count,
      easySolved: count,
      mediumSolved: count,
      hardSolved: count,
      totalSubmissionNum: submissionCounts,
      acSubmissionNum: submissionCounts,
    }),
  }),
};

const statsSnapshotsSchema = z.strictObject(statsSnapshotSourceSchemas);

/* ---------- Pages ---------- */

const meta = z.strictObject({ title: text, description: text, keywords: text });
const header = z.strictObject({ site_title: text, tagline: text });
const ogType = z.enum(["website", "article"]);

const image = z.strictObject({
  src: assetPath,
  alt: text,
  width: dimension,
  height: dimension,
  caption: text.optional(),
  place: z.boolean().optional(),
});

const action = z
  .strictObject({
    label: text,
    href: href.optional(),
    page_id: pageId.optional(),
    variant: z.enum(["primary", "secondary"]),
  })
  .refine((value) => value.href !== undefined || value.page_id !== undefined, {
    error: 'needs "href" or "page_id"',
  });

const article = z.strictObject({ title: text, href, summary: text });

const card = z.strictObject({
  title: text,
  href: href.optional(),
  meta: text.optional(),
  paragraphs: z.array(text).optional(),
  bullets: z.array(text).optional(),
  images: z.array(image).optional(),
  logo: image.optional(),
  stickers: z.array(z.strictObject({ icon, label: text })).optional(),
  tags: z.array(text).optional(),
  snippet: text.optional(),
});

const indexSection = z.strictObject({
  title: text,
  paragraphs: z.array(text).optional(),
  images: z.array(image).optional(),
  items: z.array(z.strictObject({ label: text, html: text, image: image.optional() })).optional(),
  highlights: z
    .array(card.pick({ title: true, href: true, meta: true, paragraphs: true, bullets: true }))
    .optional(),
  tags: z.array(text).optional(),
  articles: z.array(article).optional(),
  actions: z.array(action).optional(),
  contacts: z.array(text).optional(),
});

const indexLocale = z.strictObject({
  meta,
  header,
  summary_card: z.array(text),
  sections: z.array(indexSection),
  footer_html: text,
  top_actions_title: text,
  top_actions: z.array(action),
  view_all_stats_label: text,
  social_row_label: text,
});

const indexPageSchema = z.strictObject({
  og_type: ogType,
  locales: perLang(indexLocale),
});

const workPageSchema = z.strictObject({
  og_type: ogType,
  locales: perLang(
    z.strictObject({
      meta,
      header,
      summary: text,
      section_title: text,
      entries: z.array(card),
      footer_html: text,
      credits_title: text,
      tags_label: text,
      projects_link: text,
      hero_images: z.array(image),
    }),
  ),
  picture_credits: z
    .array(z.strictObject({ name: text, author: text, license: text, license_url: webUrl, source: webUrl }))
    .optional(),
});

const projectPageSchema = z.strictObject({
  og_type: ogType,
  locales: perLang(
    z.strictObject({
      meta,
      header,
      groups: z.array(
        z.strictObject({ title: text, layout: z.literal("compact").optional(), items: z.array(card) }),
      ),
      footer_html: text,
    }),
  ),
});

const blogPageSchema = z.strictObject({
  og_type: ogType,
  locales: perLang(
    z.strictObject({
      meta,
      header,
      articles: z.array(z.strictObject({ title: text, href, meta: text, summary: text })),
      footer_html: text,
    }),
  ),
});

const statsSections = z.strictObject({
  wakatime: z.strictObject({
    title: text,
    index_title: text.optional(),
    status_text: text,
    languages_url: webUrl,
    summary_url: webUrl,
    aria_label: text,
  }),
  languages: z.strictObject({
    title: text,
    intro: text,
    wakatime_copy: text,
    wakatime_profile_href: webUrl,
    wakatime_badge_src: webUrl,
    wakatime_badge_alt: text,
    wakatime_embed_src: webUrl,
    wakatime_embed_alt: text,
    github_copy: text,
    github_profile_href: webUrl,
    github_embed_src: webUrl,
    github_embed_alt: text,
  }),
  github_commits: z.strictObject({
    title: text,
    description: text,
    status_text: text,
    contrib_url: webUrl,
    source_label: text,
    source_href: webUrl,
    source_text: text,
    heatmap_aria_label: text,
    legend_aria_label: text,
  }),
  leetcode: z.strictObject({
    title: text,
    copy: text,
    username: text,
    api_url: webUrl,
    profile_href: webUrl,
    profile_label: text,
    status_text: text,
  }),
  learning_path: z.strictObject({ title: text, copy: text, href: webUrl, image_src: webUrl, image_alt: text }),
  goodreads: z.strictObject({
    title: text,
    index_title: text.optional(),
    copy: text,
    index_copy: text.optional(),
    widget_id: digits,
    user_id: digits,
    user_name: text,
    profile_href: webUrl,
    profile_label: text,
    script_src: webUrl,
    status_text: text,
  }),
  github_profile: z.strictObject({
    title: text,
    status_text: text,
    repos_api_url: webUrl,
    prs_api_url: webUrl,
    issues_api_url: webUrl,
    source_href: webUrl,
    source_text: text,
    repos_aria_label: text,
    language_aria_label: text,
  }),
});

const statsPageSchema = z.strictObject({
  og_type: ogType,
  locales: perLang(
    z.strictObject({ meta, header, intro: z.array(text), sections: statsSections, footer_html: text }),
  ),
});

// exactOptional: the reading loader hands these objects to the page as they are.
const optionalText = z.exactOptional(text);
const countText = text.refine((value) => value.includes("{count}"), { error: 'must contain "{count}"' });

// English only.
export const readingPageSchema = z.strictObject({
  og_type: ogType,
  locales: z.strictObject({
    en: z.strictObject({
      meta,
      header: z.strictObject({ site_title: text }),
      intro: z.array(text),
      now: z.strictObject({
        title: text,
        last_read_label: text,
        items: z.array(
          z.strictObject({
            title: text,
            subtitle: optionalText,
            author: optionalText,
            lang: z.exactOptional(languageTag),
            note: text,
            image: z.exactOptional(z.strictObject({ src: assetPath, alt: text, width: dimension, height: dimension })),
          }),
        ),
      }),
      languages: z.strictObject({
        title: text,
        intro: optionalText,
        items: z.array(z.strictObject({ name: text, lang: languageTag, level: text, note: text })),
      }),
      notes: z.strictObject({
        title: text,
        items: z.array(
          z.strictObject({
            title: text,
            author: optionalText,
            date: z.exactOptional(calendarDate),
            href: z.exactOptional(href),
            paragraphs: z.array(text).min(1),
          }),
        ),
      }),
      shelf: z.strictObject({
        title: text,
        copy: text,
        recent_label: text,
        undated_label: text,
        count_one: countText,
        count_other: countText,
      }),
      footer_html: text,
    }),
  }),
});

export const pageSchemas = {
  index: indexPageSchema,
  work: workPageSchema,
  project: projectPageSchema,
  blog: blogPageSchema,
  stats: statsPageSchema,
  reading: readingPageSchema,
} as const;

/** Every JSON file the build reads, by path under src/data. */
export const CONTENT_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  "site-content/site.json": siteSchema,
  "site-content/routes.json": routesSchema,
  "site-content/navigation.json": navigationSchema,
  "site-content/navigation-labels.json": navigationLabelsSchema,
  "site-content/skills.json": skillsSchema,
  "site-content/featured-books.json": featuredBooksSchema,
  "site-content/goodreads-snapshot.json": goodreadsSnapshotSchema,
  ...Object.fromEntries(ALL_PAGE_IDS.map((id) => [`site-content/pages/${id}.json`, pageSchemas[id]])),
  "stats-snapshots.json": statsSnapshotsSchema,
};

/** The language a JSON path belongs to: its first segment that names one. */
export function langOfPath(path: readonly PropertyKey[]): string | undefined {
  return LANGS.find((lang) => path.includes(lang));
}
