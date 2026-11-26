type Theme = "light" | "dark";

declare global {
  interface Window {
    // Defined by the head bootstrap script (lib/page-labels.ts).
    personPortfolioTheme?: {
      readonly sync: () => void;
      readonly choose: (theme: Theme) => void;
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const icon = button.querySelector<HTMLImageElement>("[data-theme-toggle-icon]");

  const currentTheme = (): Theme => (
    document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
  );

  const showTheme = (theme: Theme): void => {
    const isDark = theme === "dark";
    button.setAttribute("aria-pressed", String(isDark));

    const nextLabel = isDark ? button.dataset.lightLabel : button.dataset.darkLabel;
    if (typeof nextLabel === "string" && nextLabel.length > 0) {
      button.setAttribute("aria-label", nextLabel);
      button.title = nextLabel;
    }

    if (icon instanceof HTMLImageElement) {
      const darkModeIconSrc = button.dataset.darkIconSrc;
      const lightModeIconSrc = button.dataset.lightIconSrc;
      const nextIconSrc = isDark ? darkModeIconSrc : lightModeIconSrc;
      if (typeof nextIconSrc === "string" && nextIconSrc.length > 0) {
        icon.src = nextIconSrc;
      }
    }
  };

  showTheme(currentTheme());
  // Fired for the toggle itself and for OS changes while no choice is stored.
  document.addEventListener("site-theme-change", () => {
    showTheme(currentTheme());
  });

  button.addEventListener("click", () => {
    window.personPortfolioTheme?.choose(currentTheme() === "dark" ? "light" : "dark");
  });
});

export {};
