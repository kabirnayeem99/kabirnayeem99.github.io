import { LANGS } from "./locale-config";

export interface SchemaGraphInput {
  readonly baseUrl: string;
  readonly websiteName: string;
  readonly personName: string;
  readonly canonicalUrl: string;
  readonly ogImageUrl: string;
  readonly socialProfiles: readonly string[];
}

export function scriptSafeJson(value: object): string {
  return JSON.stringify(value).replace("</script", "<\\/script");
}

function normalizeSameAsProfiles(profiles: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const profile of profiles) {
    const candidate = profile.trim();
    if (candidate.length === 0) {
      continue;
    }

    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      continue;
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      continue;
    }

    const normalized = parsed.toString();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      output.push(normalized);
    }
  }

  return output;
}

export function buildSchemaGraphJson(input: SchemaGraphInput): string {
  const sameAsProfiles = normalizeSameAsProfiles(input.socialProfiles);
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${input.baseUrl}/#website`,
        url: `${input.baseUrl}/`,
        name: input.websiteName,
        sameAs: sameAsProfiles,
        publisher: { "@id": `${input.baseUrl}/#person` },
        inLanguage: [...LANGS],
      },
      {
        "@type": "Person",
        "@id": `${input.baseUrl}/#person`,
        name: input.personName,
        url: input.canonicalUrl,
        image: input.ogImageUrl,
        sameAs: sameAsProfiles,
      },
    ],
  };

  return scriptSafeJson(graph);
}
