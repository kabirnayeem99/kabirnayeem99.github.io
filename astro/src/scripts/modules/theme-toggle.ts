type Theme = "light" | "dark";

interface SiteThemeChangeDetail {
  readonly theme: Theme;
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const icon = button.querySelector<HTMLImageElement>("[data-theme-toggle-icon]");
  const storageKey = "person-portfolio-theme";

  const persistTheme = (theme: Theme): void => {
    try {
      window.localStorage.setItem(storageKey, theme);
    } catch {
      // Ignore storage failures and keep current in-memory theme.
    }
  };

  const currentTheme = (): Theme => (
    document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
  );

  const applyTheme = (theme: Theme, emitEvent: boolean): void => {
    const isDark = theme === "dark";
    document.documentElement.setAttribute("data-theme", theme);
    if (emitEvent) {
      document.dispatchEvent(
        new CustomEvent<SiteThemeChangeDetail>("site-theme-change", {
          detail: { theme },
        }),
      );
    }

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

  let storedTheme: Theme | null = null;
  try {
    const localTheme = window.localStorage.getItem(storageKey);
    if (localTheme === "light" || localTheme === "dark") {
      storedTheme = localTheme;
    }
  } catch {
    // Ignore storage failures and keep default theme from the bootstrap script.
  }

  applyTheme(storedTheme ?? currentTheme(), false);

  button.addEventListener("click", () => {
    const nextTheme: Theme = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
    persistTheme(nextTheme);
  });
});

export {};
