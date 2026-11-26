// The stats figures bundled with the site, shown before (or instead of) the live requests.
// scripts/refresh-stats-snapshots.ts rewrites the JSON at deploy; each source has its own date.
import snapshots from "../../data/stats-snapshots.json";

export const personPortfolioSnapshots = Object.freeze(snapshots);

declare global {
  interface Window {
    personPortfolioSnapshots?: Readonly<typeof snapshots>;
  }

  var personPortfolioSnapshots: Window["personPortfolioSnapshots"];
}

globalThis.personPortfolioSnapshots = personPortfolioSnapshots;
