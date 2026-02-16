document.addEventListener('DOMContentLoaded', function () {
  var today = new Date();
  var lang = document.documentElement.lang || 'en';
  var localeMap = {
    bn: 'bn-BD',
    ar: 'ar-SA',
    ur: 'ur-PK'
  };
  var locale = localeMap[lang] || 'en-US';

  var yearElement = document.getElementById('year');
  if (yearElement) {
    yearElement.textContent = today.toLocaleDateString(locale, { year: 'numeric' });
  }

  var refreshedElement = document.getElementById('last-refreshed');
  if (refreshedElement) {
    refreshedElement.setAttribute('datetime', today.toISOString().split('T')[0]);
    var refreshedLocale = localeMap[lang] || 'en-GB';
    refreshedElement.textContent = today.toLocaleDateString(refreshedLocale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
});
