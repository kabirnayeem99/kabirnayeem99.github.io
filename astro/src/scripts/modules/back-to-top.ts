document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector<HTMLButtonElement>("[data-back-to-top]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const revealOffset = Math.max(window.innerHeight * 0.8, 420);

  const setVisible = (shouldShow: boolean): void => {
    button.hidden = !shouldShow;
    button.classList.toggle("is-visible", shouldShow);
  };

  // A sentinel at the reveal offset: once it scrolls above the viewport the button shows.
  // The observer runs off the scroll path, so scrolling never waits on this script.
  const sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  sentinel.style.cssText = `position:absolute;top:${revealOffset}px;left:0;width:1px;height:1px;pointer-events:none;`;
  document.body.append(sentinel);

  button.hidden = false;
  setVisible(window.scrollY > revealOffset);

  new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (entry) {
      setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    }
  }).observe(sentinel);

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});
