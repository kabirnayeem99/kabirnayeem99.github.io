const toggles = document.querySelectorAll<HTMLButtonElement>("[data-hero-avatar-toggle]");

for (const toggle of toggles) {
  const showLabel = toggle.dataset.labelShow;
  const hideLabel = toggle.dataset.labelHide;

  const syncState = (expanded: boolean) => {
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    const label = expanded ? hideLabel : showLabel;
    if (label !== undefined) {
      toggle.setAttribute("aria-label", label);
      toggle.title = label;
    }
  };

  syncState(false);

  toggle.addEventListener("click", () => {
    syncState(toggle.getAttribute("aria-expanded") !== "true");
  });

  toggle.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true") {
      return;
    }
    event.preventDefault();
    syncState(false);
  });
}
