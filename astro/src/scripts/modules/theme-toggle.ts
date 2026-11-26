import type { Theme } from "../../inline/theme-api";

document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }


  const currentTheme = (): Theme => (
    document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
  );

  const showTheme = (theme: Theme): void => {
    const isDark = theme === "dark";
    button.setAttribute("aria-pressed", String(isDark));

    const nextLabel = isDark ? button.dataset["lightLabel"] : button.dataset["darkLabel"];
    if (typeof nextLabel === "string" && nextLabel.length > 0) {
      button.setAttribute("aria-label", nextLabel);
      button.title = nextLabel;
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
