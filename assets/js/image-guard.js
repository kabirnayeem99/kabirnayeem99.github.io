document.addEventListener('DOMContentLoaded', function () {
  var guardedImages = document.querySelectorAll('img[data-hide-section-on-error="true"]');

  function hideContainerSection(image) {
    var section = image.closest('section');
    if (section) {
      section.classList.add('is-hidden-media');
    }
  }

  guardedImages.forEach(function (image) {
    image.addEventListener('error', function () {
      hideContainerSection(image);
    }, { once: true });

    if (image.complete && image.naturalWidth === 0) {
      hideContainerSection(image);
    }
  });
});
