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

    if ("showPopover" in HTMLElement.prototype) {
      menu.hidden = false;
      menu.addEventListener("toggle", (rawEvent) => {
        const event = rawEvent as { newState: string };
        const isOpen = event.newState === "open";
        button.setAttribute("aria-expanded", String(isOpen));
        switcher.classList.toggle("is-open", isOpen);
        site?.classList.toggle("is-language-menu-open", isOpen);
        if (isOpen) {
          const rect = button.getBoundingClientRect();
          const isRtl = document.documentElement.dir === "rtl";
          menu.style.top = `${rect.bottom + 10}px`;
          if (isRtl) {
            menu.style.left = `${rect.left}px`;
            menu.style.right = "auto";
          } else {
            menu.style.right = `${window.innerWidth - rect.right}px`;
            menu.style.left = "auto";
          }
          firstLink?.focus();
        }
      });
    } else {
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
    }
  });
});
