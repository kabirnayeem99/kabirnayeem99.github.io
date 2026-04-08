document.addEventListener("DOMContentLoaded", () => {
  const switchers = document.querySelectorAll<HTMLElement>("[data-language-switcher]");

  switchers.forEach((switcher) => {
    const button = switcher.querySelector<HTMLButtonElement>("[data-language-switcher-button]");
    const menu = switcher.querySelector<HTMLElement>("[data-language-switcher-menu]");
    if (!(button instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) {
      return;
    }

    const site = switcher.closest<HTMLElement>(".site");
    const firstLink = menu.querySelector<HTMLAnchorElement>("a");

    const closeMenu = (): void => {
      button.setAttribute("aria-expanded", "false");
      menu.hidden = true;
      switcher.classList.remove("is-open");
      site?.classList.remove("is-language-menu-open");
    };

    const openMenu = (): void => {
      button.setAttribute("aria-expanded", "true");
      menu.hidden = false;
      switcher.classList.add("is-open");
      site?.classList.add("is-language-menu-open");
    };

    button.addEventListener("click", () => {
      const isOpen = button.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        closeMenu();
        return;
      }

      openMenu();
      firstLink?.focus();
    });

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (!switcher.contains(event.target)) {
        closeMenu();
      }
    });

    switcher.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }

      closeMenu();
      button.focus();
    });
  });
});
