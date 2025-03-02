document.addEventListener("DOMContentLoaded", function () {
  function showCacheNotice() {
    if (!localStorage.getItem("cacheNoticeDismissed")) {
      document.getElementById("cacheNotice").style.display = "block";
    }
  }

  window.dismissNotice = function () {
    localStorage.setItem("cacheNoticeDismissed", "true");
    document.getElementById("cacheNotice").style.display = "none";
  };

  showCacheNotice();
});
