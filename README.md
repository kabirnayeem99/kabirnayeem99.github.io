# PersonPortfolio

Static multilingual portfolio site built with plain HTML + CSS.

## Structure

- `index.html`, `work.html`, `project.html`, `blog.html`, `stats.html`: English pages.
- `bn/`, `ar/`, `ur/`: Localized page sets.
- `assets/css/styles.css`: Shared stylesheet for all pages.
- `assets/js/year.js`: Shared script that localizes the footer year text.
- `assets/icons/`: Favicon, app icons, and social preview icon.
- `assets/images/`: Content images used by pages.
- `site.webmanifest`, `robots.txt`, `sitemap.xml`: SEO and PWA metadata.

## Local preview

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Maintenance

- Keep page URLs stable (`/work.html`, `/project.html`, etc.) to avoid SEO/link breakage.
- Reuse `assets/js/year.js` for any page with a `<span id="year">...</span>` footer year.
- Run link validation before publishing:

```bash
python3 src/main.py --validate-links
```
