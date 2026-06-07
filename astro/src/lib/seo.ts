import { LANGS } from "./locale-config";

export interface SchemaGraphInput {
  readonly baseUrl: string;
  readonly websiteName: string;
  readonly personName: string;
  readonly canonicalUrl: string;
  readonly ogImageUrl: string;
  readonly socialProfiles: readonly string[];
  readonly lang?: string;
}

const PERSON_FIELDS_BY_LANG: Partial<Record<string, { jobTitle: string; description: string }>> = {
  bn: {
    jobTitle: "সফটওয়্যার ইঞ্জিনিয়ার",
    description: "সফটওয়্যার ইঞ্জিনিয়ার · মুসলিম · বইপ্রেমী · জ্ঞানপিপাসু",
  },
  ar: {
    jobTitle: "مُهَنْدِسُ بَرْمَجِيَّات",
    description: "مُهَنْدِسُ بَرْمَجِيَّات · مُسْلِم · مُحِبُّ ٱلْقِرَاءَةِ · فُضُولِيّ",
  },
  ur: {
    jobTitle: "سافٹ ویئر انجینئر",
    description: "سافٹ ویئر انجینئر · مسلمان · کتاب دوست · جستجو کرنے والا",
  },
};

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
  const personFields = (input.lang && PERSON_FIELDS_BY_LANG[input.lang]) || {
    jobTitle: "Software Engineer",
    description: "Software Engineer · Muslim · Bibliophile · Philomath",
  };
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
        url: `${input.baseUrl}/`,
        image: input.ogImageUrl,
        sameAs: sameAsProfiles,
        jobTitle: personFields.jobTitle,
        description: personFields.description,
        worksFor: {
          "@type": "Organization",
          name: "Syarah",
          url: "https://syarah.com/",
        },
        knowsAbout: [
          "Android Development",
          "Kotlin",
          "Kotlin Multiplatform",
          "Flutter",
          "iOS Development",
          "PHP",
          "Laravel",
          "Software Engineering",
        ],
      },
    ],
  };

  return scriptSafeJson(graph);
}
