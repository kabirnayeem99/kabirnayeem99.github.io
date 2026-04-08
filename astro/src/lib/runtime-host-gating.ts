const LOCAL_DEVELOPMENT_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

export function resolveCanonicalHostname(url: string): string | null {
  try {
    const hostname = normalizeHostname(new URL(url).hostname);
    return hostname.length > 0 ? hostname : null;
  } catch {
    return null;
  }
}

export function isLocalDevelopmentHostname(hostname: string): boolean {
  return LOCAL_DEVELOPMENT_HOSTNAMES.has(normalizeHostname(hostname));
}

export function readExpectedSiteHostname(doc: Document = document): string | null {
  const tag = doc.querySelector('meta[name="person-portfolio-site-hostname"]');
  if (!(tag instanceof HTMLMetaElement)) {
    return null;
  }

  const content = normalizeHostname(tag.content);
  return content.length > 0 ? content : null;
}

export function isProductionHostMatch(expectedHostname: string | null, currentHostname: string): boolean {
  if (expectedHostname === null) {
    return false;
  }

  const normalizedCurrentHostname = normalizeHostname(currentHostname);
  if (isLocalDevelopmentHostname(normalizedCurrentHostname)) {
    return false;
  }

  return normalizedCurrentHostname === expectedHostname;
}

export function shouldLoadUmamiScript(
  isProduction: boolean,
  websiteId: string,
  canonicalHostname: string | null,
): boolean {
  return isProduction && websiteId.trim().length > 0 && canonicalHostname !== null;
}
