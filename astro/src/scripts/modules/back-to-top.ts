document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector<HTMLButtonElement>("[data-back-to-top]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  const revealOffset = Math.max(window.innerHeight * 0.8, 420);

  const updateVisibility = (): void => {
    const shouldShow = window.scrollY > revealOffset;
    button.hidden = !shouldShow;
    button.classList.toggle("is-visible", shouldShow);
  };

  button.hidden = false;
  updateVisibility();

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", updateVisibility, { passive: true });
  window.addEventListener("resize", updateVisibility, { passive: true });
});
