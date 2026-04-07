// @ts-check
/**
 * Progressive enhancement for long mobile pages.
 * Reveals a compact back-to-top button after the reader scrolls down.
 */
document.addEventListener("DOMContentLoaded", function () {
  /** @type {HTMLButtonElement | null} */
  var candidateButton = /** @type {HTMLButtonElement | null} */ (document.querySelector("[data-back-to-top]"));
  if (!(candidateButton instanceof HTMLButtonElement)) {
    return;
  }
  /** @type {HTMLButtonElement} */
  var button = candidateButton;

  var revealOffset = Math.max(window.innerHeight * 0.8, 420);

  /**
   * Syncs button visibility with current scroll position.
   *
   * @returns {void}
   */
  function updateVisibility() {
    var shouldShow = window.scrollY > revealOffset;
    button.hidden = !shouldShow;
    button.classList.toggle("is-visible", shouldShow);
  }

  button.hidden = false;
  updateVisibility();

  button.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", updateVisibility, { passive: true });
  window.addEventListener("resize", updateVisibility, { passive: true });
});
