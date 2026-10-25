import { posix as pathPosix } from "node:path";
import {
  asRecord,
  loadSiteContentRoot,
  readLocaleInfo,
  readOptionalString,
  readOptionalStringArray,
  readRouteMap,
  readString,
  readStringArray,
  type LocaleInfo,
  type MetaText,
  type RouteMap,
  type SiteData,
} from "./content-loader-shared";
import { LANGS, OG_LOCALE_BY_LANG, type Lang } from "./locale-config";

export type { Lang } from "./locale-config";
export { OG_LOCALE_BY_LANG } from "./locale-config";

interface HeaderText {
  readonly siteTitle: string;
}

interface WorkProjectSiteData extends SiteData {
  readonly locale: LocaleInfo;
}

export interface CardImage {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly caption?: string;
  /** Work page: a photo of where the work happened, shown small beside the product shots. */
  readonly place?: boolean;
}

export interface ContentCard {
  readonly title: string;
  readonly href?: string;
  readonly meta?: string;
  readonly paragraphs: readonly string[];
  readonly bullets: readonly string[];
  readonly images?: readonly CardImage[];
  /** Work page only: company mark stamped beside the title. */
  readonly logo?: CardImage;
  /** Work page only: small tool/platform marks stuck on the photo stack. */
  readonly stickers?: readonly CardImage[];
  /** Work page only: handwritten name tags (client products and the like). */
  readonly tags?: readonly string[];
  /** A few lines of code or terminal output, shown as a taped slip in place of a photo. */
  readonly snippet?: string;
}

export interface PictureCredit {
  readonly name: string;
  readonly author: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly source: string;
}

function readCardImage(raw: unknown, imagePath: string): CardImage {
  const image = asRecord(raw, imagePath);
  const { width, height } = image;
  if (typeof width !== "number" || typeof height !== "number") {
    throw new Error(`Expected numeric width/height at ${imagePath}`);
  }
  const caption = readOptionalString(image, "caption", imagePath);
  if (image.place !== undefined && typeof image.place !== "boolean") {
    throw new Error(`Expected boolean at ${imagePath}.place`);
  }
  return {
    src: readString(image, "src", imagePath),
    alt: readString(image, "alt", imagePath),
    width,
    height,
    ...(caption === undefined ? {} : { caption }),
    ...(image.place === true ? { place: true } : {}),
  };
}

function readCardImages(source: Record<string, unknown>, key: string, path: string): readonly CardImage[] {
  const value = source[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`);
  }
  return value.map((raw, index) => readCardImage(raw, `${path}.${key}[${index}]`));
}

function readPictureCredits(source: Record<string, unknown>, path: string): readonly PictureCredit[] {
  const value = source.picture_credits;
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.picture_credits`);
  }
  return value.map((raw, index) => {
    const creditPath = `${path}.picture_credits[${index}]`;
    const credit = asRecord(raw, creditPath);
    return {
      name: readString(credit, "name", creditPath),
      author: readString(credit, "author", creditPath),
      license: readString(credit, "license", creditPath),
      licenseUrl: readString(credit, "license_url", creditPath),
      source: readString(credit, "source", creditPath),
    };
  });
}

export interface ProjectGroup {
  readonly title: string;
  readonly items: readonly ContentCard[];
  /** "compact": a plain grid of small cards for minor work; otherwise journal spreads. */
  readonly layout?: "compact";
}

interface AlternateLink {
  readonly hrefLang: Lang | "x-default";
  readonly href: string;
}

interface CommonPageContent {
  readonly lang: Lang;
  readonly site: WorkProjectSiteData;
  readonly route: string;
  readonly homeRoute: string;
  readonly pageRoutes: RouteMap;
  readonly meta: MetaText;
  readonly header: HeaderText;
  readonly footerHtml: string;
}

export interface WorkPageContent extends CommonPageContent {
  readonly summary: string;
  readonly sectionTitle: string;
  readonly entries: readonly ContentCard[];
  readonly heroImages: readonly CardImage[];
  readonly tagsLabel: string;
  readonly creditsTitle: string;
  readonly pictureCredits: readonly PictureCredit[];
}

export interface ProjectPageContent extends CommonPageContent {
  readonly groups: readonly ProjectGroup[];
}

function readContentCards(
  source: Record<string, unknown>,
  key: string,
  path: string,
): readonly ContentCard[] {
  const value = source[key];
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}.${key}`);
  }

  const cards: ContentCard[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const itemPath = `${path}.${key}[${index}]`;
    const item = asRecord(value[index], itemPath);
    const href = readOptionalString(item, "href", itemPath);
    const meta = readOptionalString(item, "meta", itemPath);
    const card: {
      title: string;
      paragraphs: readonly string[];
      bullets: readonly string[];
      href?: string;
      meta?: string;
      images?: readonly CardImage[];
      logo?: CardImage;
      stickers?: readonly CardImage[];
      tags?: readonly string[];
      snippet?: string;
    } = {
      title: readString(item, "title", itemPath),
      paragraphs: readOptionalStringArray(item, "paragraphs", itemPath),
      bullets: readOptionalStringArray(item, "bullets", itemPath),
    };

    if (href !== undefined) {
      card.href = href;
    }
    if (meta !== undefined) {
      card.meta = meta;
    }
    const images = readCardImages(item, "images", itemPath);
    if (images.length > 0) {
      card.images = images;
    }
    if (item.logo !== undefined) {
      card.logo = readCardImage(item.logo, `${itemPath}.logo`);
    }
    const stickers = readCardImages(item, "stickers", itemPath);
    if (stickers.length > 0) {
      card.stickers = stickers;
    }
    const tags = readOptionalStringArray(item, "tags", itemPath);
    if (tags.length > 0) {
      card.tags = tags;
    }
    const snippet = readOptionalString(item, "snippet", itemPath);
    if (snippet !== undefined) {
      card.snippet = snippet;
    }

    cards.push(card);
  }

  return cards;
}

function readProjectGroups(source: Record<string, unknown>, path: string): readonly ProjectGroup[] {
  const groupsRaw = source.groups;
  if (!Array.isArray(groupsRaw)) {
    throw new Error(`Expected array at ${path}.groups`);
  }

  const groups: ProjectGroup[] = [];
  for (let index = 0; index < groupsRaw.length; index += 1) {
    const groupPath = `${path}.groups[${index}]`;
    const group = asRecord(groupsRaw[index], groupPath);
    const layout = readOptionalString(group, "layout", groupPath);
    if (layout !== undefined && layout !== "compact") {
      throw new Error(`Unknown layout "${layout}" at ${groupPath}.layout`);
    }
    groups.push({
      title: readString(group, "title", groupPath),
      items: readContentCards(group, "items", groupPath),
      ...(layout === undefined ? {} : { layout }),
    });
  }

  return groups;
}

interface SharedContentContext {
  readonly root: ReturnType<typeof loadSiteContentRoot>;
  readonly site: WorkProjectSiteData;
  readonly routes: Record<string, unknown>;
}

function loadSharedContext(lang: Lang): SharedContentContext {
  const root = loadSiteContentRoot();

  const site = asRecord(root.site, "root.site");
  const siteLocales = asRecord(site.locales, "root.site.locales");
  const siteLocale = asRecord(siteLocales[lang], `root.site.locales.${lang}`);
  const routes = asRecord(root.routes, "root.routes");

  return {
    root,
    site: {
      baseUrl: readString(site, "base_url", "root.site"),
      personName: readString(site, "person_name", "root.site"),
      websiteName: readString(site, "website_name", "root.site"),
      twitterSite: readString(site, "twitter_site", "root.site"),
      socialProfiles: readStringArray(site, "social_profiles", "root.site"),
      googleSiteVerification: readString(site, "google_site_verification", "root.site"),
      locale: readLocaleInfo(siteLocale, `root.site.locales.${lang}`),
    },
    routes,
  };
}

function readCommonPageContent(
  lang: Lang,
  pageId: "work" | "project",
): {
  readonly context: SharedContentContext;
  readonly localePage: Record<string, unknown>;
  readonly common: CommonPageContent;
} {
  const context = loadSharedContext(lang);
  const pages = asRecord(context.root.pages, "root.pages");
  const page = asRecord(pages[pageId], `root.pages.${pageId}`);
  const locales = asRecord(page.locales, `root.pages.${pageId}.locales`);
  const localePage = asRecord(locales[lang], `root.pages.${pageId}.locales.${lang}`);
  const meta = asRecord(localePage.meta, `root.pages.${pageId}.locales.${lang}.meta`);
  const header = asRecord(localePage.header, `root.pages.${pageId}.locales.${lang}.header`);

  const workOrProjectRoutes = readRouteMap(
    asRecord(context.routes[pageId], `root.routes.${pageId}`),
    `root.routes.${pageId}`,
  );
  const indexRoutes = readRouteMap(
    asRecord(context.routes.index, "root.routes.index"),
    "root.routes.index",
  );

  return {
    context,
    localePage,
    common: {
      lang,
      site: context.site,
      route: workOrProjectRoutes[lang],
      homeRoute: indexRoutes[lang],
      pageRoutes: workOrProjectRoutes,
      meta: {
        title: readString(meta, "title", `root.pages.${pageId}.locales.${lang}.meta`),
        description: readString(meta, "description", `root.pages.${pageId}.locales.${lang}.meta`),
        keywords: readString(meta, "keywords", `root.pages.${pageId}.locales.${lang}.meta`),
      },
      header: {
        siteTitle: readString(header, "site_title", `root.pages.${pageId}.locales.${lang}.header`),
      },
      footerHtml: readString(localePage, "footer_html", `root.pages.${pageId}.locales.${lang}`),
    },
  };
}

export function loadWorkPageContent(lang: Lang): WorkPageContent {
  const { context, localePage, common } = readCommonPageContent(lang, "work");
  const path = `root.pages.work.locales.${lang}`;
  const page = asRecord(asRecord(context.root.pages, "root.pages").work, "root.pages.work");
  return {
    ...common,
    summary: readString(localePage, "summary", path),
    sectionTitle: readString(localePage, "section_title", path),
    entries: readContentCards(localePage, "entries", path),
    heroImages: readCardImages(localePage, "hero_images", path),
    tagsLabel: readString(localePage, "tags_label", path),
    creditsTitle: readString(localePage, "credits_title", path),
    pictureCredits: readPictureCredits(page, "root.pages.work"),
  };
}

export function loadProjectPageContent(lang: Lang): ProjectPageContent {
  const { localePage, common } = readCommonPageContent(lang, "project");
  return {
    ...common,
    groups: readProjectGroups(localePage, `root.pages.project.locales.${lang}`),
  };
}

export function buildAlternateLinks(
  baseUrl: string,
  pageRoutes: RouteMap,
): readonly AlternateLink[] {
  const links: AlternateLink[] = LANGS.map((lang) => ({
    hrefLang: lang,
    href: `${baseUrl}/${pageRoutes[lang]}`,
  }));
  links.push({
    hrefLang: "x-default",
    href: `${baseUrl}/${pageRoutes.en}`,
  });
  return links;
}

export function buildOgLocaleAlternates(lang: Lang): readonly string[] {
  return LANGS.filter((entry) => entry !== lang).map((entry) => OG_LOCALE_BY_LANG[entry]);
}

export function relativeHref(fromRoute: string, toRoute: string): string {
  const fromDir = pathPosix.dirname(fromRoute) || ".";
  return pathPosix.relative(fromDir, toRoute);
}

export function routeHref(fromRoute: string, toRoute: string): string {
  return relativeHref(fromRoute, toRoute);
}

export function assetHref(currentRoute: string, assetPath: string): string {
  return relativeHref(currentRoute, assetPath);
}
