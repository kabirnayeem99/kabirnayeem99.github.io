document.addEventListener("DOMContentLoaded", () => {
  const guardedImages = document.querySelectorAll<HTMLImageElement>(
    'img[data-hide-section-on-error="true"]',
  );

  const hideContainerSection = (image: HTMLImageElement): void => {
    const section = image.closest("section");
    if (section instanceof HTMLElement) {
      section.classList.add("is-hidden-media");
    }
  };

  guardedImages.forEach((image) => {
    image.addEventListener(
      "error",
      () => {
        hideContainerSection(image);
      },
      { once: true },
    );

    if (image.complete && image.naturalWidth === 0) {
      hideContainerSection(image);
    }
  });
});
