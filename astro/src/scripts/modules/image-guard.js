// @ts-check
/**
 * Hides a parent section when guarded media fails to load.
 */
document.addEventListener("DOMContentLoaded", function () {
  /** @type {NodeListOf<HTMLImageElement>} */
  var guardedImages = document.querySelectorAll('img[data-hide-section-on-error="true"]');

  /**
   * @param {HTMLImageElement} image
   * @returns {void}
   */
  function hideContainerSection(image) {
    var section = image.closest("section");
    if (section) {
      section.classList.add("is-hidden-media");
    }
  }

  guardedImages.forEach(function (image) {
    image.addEventListener(
      "error",
      function () {
        hideContainerSection(image);
      },
      { once: true }
    );

    if (image.complete && image.naturalWidth === 0) {
      hideContainerSection(image);
    }
  });
});
