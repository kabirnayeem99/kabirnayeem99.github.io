// Umami loads only once the page is really shown: a prerendered page someone hovered but
// never opened must not count as a visit. Inline in <head>, compiled to ES5.
// HeadSeo.astro wraps the compiled script in a function that passes `umamiConfig`.
declare var umamiConfig: {
  readonly websiteId: string;
  readonly domains: string;
};

declare global {
  interface Document {
    /** Speculation Rules prerendering; not in every browser. */
    readonly prerendering?: boolean;
  }
}

function load(): void {
  var script = document.createElement("script");
  script.src = "https://cloud.umami.is/script.js";
  script.defer = true;
  script.dataset["websiteId"] = umamiConfig.websiteId;
  if (umamiConfig.domains !== "") {
    script.dataset["domains"] = umamiConfig.domains;
  }
  document.head.appendChild(script);
}

if (document.prerendering === true) {
  document.addEventListener("prerenderingchange", load, { once: true });
} else {
  load();
}

export {};
