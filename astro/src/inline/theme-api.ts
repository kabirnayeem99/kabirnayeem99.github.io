export type Theme = "light" | "dark";

declare global {
  interface Window {
    // Defined by the head bootstrap script (inline/theme-bootstrap.ts).
    personPortfolioTheme?: {
      readonly sync: () => void;
      readonly choose: (theme: Theme) => void;
    };
  }
}
