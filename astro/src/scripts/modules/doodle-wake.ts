// Firefox (and other browsers without CSS scroll-driven animations) can't run the
// `animation-timeline: view()` wake-in defined in styles.css, so replicate it here
// via IntersectionObserver + a class toggle. Skipped entirely where the native CSS
// version already applies, so the two never double up.
const supportsScrollTimeline =
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("animation-timeline", "view()");

if (!supportsScrollTimeline && "IntersectionObserver" in window) {
  document.addEventListener("DOMContentLoaded", () => {
    const doodles = document.querySelectorAll<HTMLElement>(".margin-doodle");
    if (doodles.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle("is-awake", entry.isIntersecting);
        }
      },
      { threshold: 0.15 },
    );

    for (const doodle of doodles) {
      observer.observe(doodle);
    }
  });
}
