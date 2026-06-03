import { formatNumber, toSafeNumber } from "./stats-utils";
import { personPortfolioSnapshots } from "./stats-snapshots";

interface GitHubRepo {
  readonly name: string;
  readonly description: string;
  readonly stars: number;
  readonly language: string | null;
  readonly htmlUrl: string;
}

interface GitHubProfilePayload {
  readonly repos: readonly GitHubRepo[];
  readonly mergedPrs: number;
  readonly issuesOpened: number;
  readonly languages: Readonly<Record<string, number>>;
}

interface GitHubProfileCacheEnvelope {
  readonly cachedAt?: unknown;
  readonly payload?: unknown;
}

interface GitHubProfileCacheEntry {
  readonly payload: GitHubProfilePayload;
  readonly isFresh: boolean;
}

interface LanguageSegment {
  readonly name: string;
  readonly count: number;
  readonly color: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SVG_NS = "http://www.w3.org/2000/svg";

const LANG_COLORS: Readonly<Record<string, string>> = {
  kotlin: "#A97BFF",
  dart: "#00B4AB",
  java: "#b07219",
  typescript: "#3178c6",
  javascript: "#f1e05a",
  python: "#3572A5",
  swift: "#F05138",
  rust: "#dea584",
  go: "#00ADD8",
  "c++": "#f34b7d",
  c: "#555555",
  "c#": "#178600",
  ruby: "#701516",
  shell: "#89e051",
  php: "#4F5D95",
  lua: "#000080",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function langColor(name: string): string {
  return LANG_COLORS[name.toLowerCase()] ?? "#6b7280";
}

document.addEventListener("DOMContentLoaded", () => {
  const widget = document.querySelector<HTMLElement>("[data-github-profile-widget]");
  if (!(widget instanceof HTMLElement)) {
    return;
  }

  const reposApiUrl = widget.getAttribute("data-repos-api-url") ?? "";
  const prsApiUrl = widget.getAttribute("data-prs-api-url") ?? "";
  const issuesApiUrl = widget.getAttribute("data-issues-api-url") ?? "";
  const statusEl = widget.querySelector<HTMLElement>('[data-role="status"]');
  const visualsEl = widget.querySelector<HTMLElement>('[data-role="visuals"]');
  const statsEl = widget.querySelector<HTMLElement>('[data-role="summary-cards"]');
  const reposEl = widget.querySelector<HTMLElement>('[data-role="repos"]');
  const donutEl = widget.querySelector<HTMLElement>('[data-role="language-donut"]');
  const legendEl = widget.querySelector<HTMLElement>('[data-role="language-legend"]');

  const cacheKey = `person-portfolio:github-profile:v1:${encodeURIComponent(reposApiUrl)}`;

  const setStatus = (message: string, isError: boolean): void => {
    if (!(statusEl instanceof HTMLElement)) {
      return;
    }
    statusEl.textContent = message;
    statusEl.classList.toggle("is-error", isError);
  };

  const fetchJsonWithTimeout = async (url: string, timeoutMs: number): Promise<unknown> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        mode: "cors",
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const normalizeAllRepos = (raw: unknown): readonly GitHubRepo[] => {
    if (!Array.isArray(raw)) {
      return [];
    }

    return (raw as unknown[])
      .map((item): GitHubRepo | null => {
        if (!isRecord(item)) {
          return null;
        }
        if (item.fork === true) {
          return null;
        }
        const name = safeString(item.name);
        if (!name) {
          return null;
        }

        return {
          name,
          description: safeString(item.description),
          stars: Math.max(0, Math.round(toSafeNumber(item.stargazers_count))),
          language:
            typeof item.language === "string" && item.language.length > 0 ? item.language : null,
          htmlUrl: safeString(item.html_url),
        };
      })
      .filter((r): r is GitHubRepo => r !== null)
      .sort((a, b) => b.stars - a.stars);
  };

  const aggregateLanguages = (repos: readonly GitHubRepo[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    repos.forEach((repo) => {
      if (repo.language) {
        counts[repo.language] = (counts[repo.language] ?? 0) + 1;
      }
    });
    return counts;
  };

  const getStaticSnapshot = (): GitHubProfilePayload | null => {
    const snap = (personPortfolioSnapshots as unknown as Record<string, unknown>).githubProfile;
    if (!isRecord(snap)) {
      return null;
    }

    const repos = Array.isArray(snap.repos) ? (snap.repos as GitHubRepo[]) : [];
    const mergedPrs = Math.max(0, Math.round(toSafeNumber(snap.mergedPrs)));
    const issuesOpened = Math.max(0, Math.round(toSafeNumber(snap.issuesOpened)));
    const languages = isRecord(snap.languages)
      ? (snap.languages as Record<string, number>)
      : {};

    return { repos, mergedPrs, issuesOpened, languages };
  };

  const readCacheEntry = (): GitHubProfileCacheEntry | null => {
    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as GitHubProfileCacheEnvelope;
      if (!isRecord(parsed) || !isRecord(parsed.payload)) {
        return null;
      }

      const p = parsed.payload as unknown as GitHubProfilePayload;
      const cachedAt = toSafeNumber(parsed.cachedAt);
      const ageMs = cachedAt > 0 ? Date.now() - cachedAt : Number.POSITIVE_INFINITY;
      const isFresh = cachedAt > 0 && ageMs >= 0 && ageMs <= CACHE_TTL_MS;

      return { payload: p, isFresh };
    } catch {
      return null;
    }
  };

  const writeCache = (payload: GitHubProfilePayload): void => {
    try {
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({ cachedAt: Date.now(), payload }),
      );
    } catch {
      // localStorage may be unavailable or quota-limited.
    }
  };

  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

  const polarToCartesian = (
    cx: number,
    cy: number,
    r: number,
    angleDeg: number,
  ): { readonly x: number; readonly y: number } => ({
    x: cx + r * Math.cos(toRadians(angleDeg)),
    y: cy + r * Math.sin(toRadians(angleDeg)),
  });

  const describeArcPath = (
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number,
  ): string => {
    const start = polarToCartesian(cx, cy, r, startAngle);
    const end = polarToCartesian(cx, cy, r, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${cx.toFixed(3)} ${cy.toFixed(3)}`,
      `L ${start.x.toFixed(3)} ${start.y.toFixed(3)}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`,
      "Z",
    ].join(" ");
  };

  const renderLanguageDonut = (languages: Readonly<Record<string, number>>): void => {
    if (!(donutEl instanceof HTMLElement) || !(legendEl instanceof HTMLElement)) {
      return;
    }

    const entries = Object.entries(languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);

    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (total <= 0 || entries.length === 0) {
      return;
    }

    const segments: LanguageSegment[] = entries.map(([name, count]) => ({
      name,
      count,
      color: langColor(name),
    }));

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 200 200");
    svg.setAttribute("class", "github-profile-donut-svg");
    svg.setAttribute("aria-hidden", "true");

    const group = document.createElementNS(SVG_NS, "g");
    const radius = 86;
    let currentAngle = -90;

    segments.forEach((seg) => {
      const segAngle = (seg.count / total) * 360;
      if (segAngle <= 0.01) {
        currentAngle += segAngle;
        return;
      }

      const endAngle = currentAngle + segAngle;
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", describeArcPath(100, 100, radius, currentAngle, endAngle));
      path.setAttribute("fill", seg.color);
      path.setAttribute("stroke", "color-mix(in srgb, var(--surface) 92%, white 8%)");
      path.setAttribute("stroke-width", "1");
      group.appendChild(path);
      currentAngle = endAngle;
    });

    svg.appendChild(group);
    donutEl.innerHTML = "";
    donutEl.appendChild(svg);

    legendEl.innerHTML = "";
    segments.forEach((seg) => {
      const li = document.createElement("li");
      li.className = "github-profile-lang-item";

      const swatch = document.createElement("span");
      swatch.className = "github-profile-lang-swatch";
      swatch.style.backgroundColor = seg.color;

      const name = document.createElement("span");
      name.className = "github-profile-lang-name";
      name.textContent = seg.name;

      const count = document.createElement("span");
      count.className = "github-profile-lang-count";
      count.textContent = `${seg.count} repo${seg.count !== 1 ? "s" : ""}`;

      li.appendChild(swatch);
      li.appendChild(name);
      li.appendChild(count);
      legendEl.appendChild(li);
    });
  };

  const profileCard = (label: string, value: string): HTMLDivElement => {
    const card = document.createElement("div");
    card.className = "github-profile-card";

    const lbl = document.createElement("div");
    lbl.className = "github-profile-card-label";
    lbl.textContent = label;

    const val = document.createElement("div");
    val.className = "github-profile-card-value";
    val.textContent = value;

    card.appendChild(lbl);
    card.appendChild(val);
    return card;
  };

  const renderStats = (payload: GitHubProfilePayload): void => {
    if (!(statsEl instanceof HTMLElement)) {
      return;
    }
    statsEl.innerHTML = "";
    statsEl.appendChild(profileCard("Merged PRs", formatNumber(payload.mergedPrs)));
    statsEl.appendChild(profileCard("Issues opened", formatNumber(payload.issuesOpened)));
  };

  const renderRepos = (repos: readonly GitHubRepo[]): void => {
    if (!(reposEl instanceof HTMLElement)) {
      return;
    }
    reposEl.innerHTML = "";

    repos.forEach((repo) => {
      const card = document.createElement("div");
      card.className = "github-repo-card";

      const header = document.createElement("div");
      header.className = "github-repo-card-header";

      const nameLink = document.createElement("a");
      nameLink.className = "github-repo-card-name";
      nameLink.href = repo.htmlUrl;
      nameLink.target = "_blank";
      nameLink.rel = "noreferrer";
      nameLink.textContent = repo.name;
      header.appendChild(nameLink);

      const stars = document.createElement("span");
      stars.className = "github-repo-card-stars";
      stars.textContent = `★ ${formatNumber(repo.stars)}`;
      header.appendChild(stars);

      card.appendChild(header);

      if (repo.description) {
        const desc = document.createElement("p");
        desc.className = "github-repo-card-desc";
        desc.textContent = repo.description;
        card.appendChild(desc);
      }

      if (repo.language) {
        const langBadge = document.createElement("span");
        langBadge.className = "github-repo-card-lang";

        const dot = document.createElement("span");
        dot.className = "github-repo-card-lang-dot";
        dot.style.backgroundColor = langColor(repo.language);

        langBadge.appendChild(dot);
        langBadge.appendChild(document.createTextNode(repo.language));
        card.appendChild(langBadge);
      }

      reposEl.appendChild(card);
    });
  };

  const render = (payload: GitHubProfilePayload, statusMessage: string): void => {
    renderStats(payload);
    renderRepos(payload.repos);
    renderLanguageDonut(payload.languages);

    if (visualsEl instanceof HTMLElement) {
      visualsEl.hidden = false;
    }

    setStatus(statusMessage, false);
  };

  const renderStaticSnapshot = (): boolean => {
    const snapshot = getStaticSnapshot();
    if (!snapshot) {
      return false;
    }
    try {
      render(snapshot, "Showing bundled GitHub snapshot.");
      return true;
    } catch {
      return false;
    }
  };

  const renderCacheEntry = (entry: GitHubProfileCacheEntry): boolean => {
    try {
      render(
        entry.payload,
        entry.isFresh ? "Showing cached GitHub profile." : "Showing stale cached GitHub profile.",
      );
      return true;
    } catch {
      return false;
    }
  };

  const hasStaticSnapshot = renderStaticSnapshot();
  const cacheEntry = readCacheEntry();
  let hasRenderedCache = false;
  let hasFreshCache = false;

  if (cacheEntry) {
    hasRenderedCache = renderCacheEntry(cacheEntry);
    hasFreshCache = hasRenderedCache && cacheEntry.isFresh;
  }

  if (hasFreshCache) {
    return;
  }

  Promise.all([
    fetchJsonWithTimeout(reposApiUrl, 10_000),
    fetchJsonWithTimeout(prsApiUrl, 10_000),
    fetchJsonWithTimeout(issuesApiUrl, 10_000),
  ])
    .then(([reposRaw, prsRaw, issuesRaw]) => {
      const allRepos = normalizeAllRepos(reposRaw);
      const topRepos = allRepos.slice(0, 6);
      const languages = aggregateLanguages(allRepos);
      const mergedPrs = Math.max(
        0,
        Math.round(toSafeNumber(isRecord(prsRaw) ? prsRaw.total_count : 0)),
      );
      const issuesOpened = Math.max(
        0,
        Math.round(toSafeNumber(isRecord(issuesRaw) ? issuesRaw.total_count : 0)),
      );
      const payload: GitHubProfilePayload = {
        repos: topRepos,
        mergedPrs,
        issuesOpened,
        languages,
      };
      writeCache(payload);
      render(payload, "Updated from live GitHub data.");
    })
    .catch(() => {
      if (hasRenderedCache) {
        setStatus("Live GitHub refresh failed. Showing cached GitHub profile.", false);
        return;
      }

      if (hasStaticSnapshot) {
        setStatus("Live GitHub refresh failed. Showing bundled GitHub snapshot.", false);
        return;
      }

      if (visualsEl instanceof HTMLElement) {
        visualsEl.hidden = true;
      }

      setStatus("Could not load GitHub profile data right now.", true);
    });
});
