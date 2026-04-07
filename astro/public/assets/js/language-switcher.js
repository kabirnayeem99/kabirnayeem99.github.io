// @ts-check
/**
 * Lightweight accessible popover behavior for the language switcher.
 */
document.addEventListener("DOMContentLoaded", function () {
  /** @type {NodeListOf<HTMLElement>} */
  var switchers = document.querySelectorAll("[data-language-switcher]");

  /**
   * @param {HTMLElement} switcher
   * @returns {void}
   */
  switchers.forEach(function (switcher) {
    /** @type {HTMLButtonElement | null} */
    var candidateButton = /** @type {HTMLButtonElement | null} */ (
      switcher.querySelector("[data-language-switcher-button]")
    );
    /** @type {HTMLElement | null} */
    var candidateMenu = /** @type {HTMLElement | null} */ (switcher.querySelector("[data-language-switcher-menu]"));
    if (!(candidateButton instanceof HTMLButtonElement) || !(candidateMenu instanceof HTMLElement)) {
      return;
    }
    /** @type {HTMLButtonElement} */
    var button = candidateButton;
    /** @type {HTMLElement} */
    var menu = candidateMenu;
    /** @type {HTMLElement | null} */
    var site = /** @type {HTMLElement | null} */ (switcher.closest(".site"));

    /** @type {HTMLAnchorElement | null} */
    var firstLink = /** @type {HTMLAnchorElement | null} */ (menu.querySelector("a"));

    /**
     * Closes the language menu and resets switcher state.
     *
     * @returns {void}
     */
    function closeMenu() {
      button.setAttribute("aria-expanded", "false");
      menu.hidden = true;
      switcher.classList.remove("is-open");
      if (site instanceof HTMLElement) {
        site.classList.remove("is-language-menu-open");
      }
    }

    /**
     * Opens the language menu and marks the switcher active.
     *
     * @returns {void}
     */
    function openMenu() {
      button.setAttribute("aria-expanded", "true");
      menu.hidden = false;
      switcher.classList.add("is-open");
      if (site instanceof HTMLElement) {
        site.classList.add("is-language-menu-open");
      }
    }

    button.addEventListener("click", function () {
      var isOpen = button.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        closeMenu();
        return;
      }
      openMenu();
      if (firstLink instanceof HTMLElement) {
        firstLink.focus();
      }
    });

    /**
     * @param {MouseEvent} event
     * @returns {void}
     */
    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!switcher.contains(target)) {
        closeMenu();
      }
    });

    /**
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    switcher.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeMenu();
        button.focus();
      }
    });
  });
});
