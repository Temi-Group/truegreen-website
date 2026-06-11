# Lifetime Truegreen Developments — Website

Marketing website for **Lifetime Truegreen Developments (Pty) Ltd** — solar, battery backup and water purification across Gauteng and South Africa.

- **Domain:** truegreen.co.za
- **Hosting:** GitHub Pages (static site, no build step)
- **Stack:** plain HTML, CSS and vanilla JS

## Structure

```
index.html        Home
solar.html        Solar & Battery Backup
water.html        Water Purification
estates.html      Estate Solutions (zero-cost model)
about.html        About
contact.html      Contact / enquiry form
404.html          Not-found page
CNAME             Custom domain for GitHub Pages
assets/
  css/styles.css  All styling (brand tokens at top)
  js/main.js      Nav, scroll reveal, contact form
  img/            Logo SVGs (full-colour + white)
```

## Brand

| Token | Hex |
|-------|-----|
| Deep Teal | `#0D5B66` |
| Leaf Green | `#4CAF50` |
| Charcoal Grey | `#61666B` |
| Sky Blue | `#2FA8E0` |
| Light Green | `#8BC34A` |
| Soft Sage | `#CFE8D4` |
| Warm Grey | `#E6E9EB` |

Typography: **Trebuchet MS**. Tagline: *Sustainable Solutions. Lasting Impact.*

## Local preview

Open `index.html` directly in a browser, or serve the folder:

```powershell
python -m http.server 8080
# then visit http://localhost:8080
```

## Notes

- The logo is currently a hand-built SVG approximation. To use the official artwork, drop
  `logo-full.png` (and a white version) into `assets/img/` and update the `<img>` references.
- The contact form has no backend — it opens the visitor's email client pre-filled.
  Swap in a form service (Formspree, Netlify Forms, etc.) when ready.
- No confidential/investor material (funding, profit, named estates, commercial rates) is
  published on this site by design.

## Deployment

Hosted via GitHub Pages from the `main` branch root. The `CNAME` file points the site at
`truegreen.co.za`. DNS must point the domain at GitHub Pages (records provided separately).
