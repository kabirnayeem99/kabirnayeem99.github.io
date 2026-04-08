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

export function buildSchemaGraphJson(input: SchemaGraphInput): string {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${input.baseUrl}/#website`,
        url: `${input.baseUrl}/`,
        name: input.websiteName,
        publisher: { "@id": `${input.baseUrl}/#person` },
        inLanguage: [...LANGS],
      },
      {
        "@type": "Person",
        "@id": `${input.baseUrl}/#person`,
        name: input.personName,
        url: input.canonicalUrl,
        image: input.ogImageUrl,
        sameAs: [...input.socialProfiles],
      },
    ],
  };

  return scriptSafeJson(graph);
}
