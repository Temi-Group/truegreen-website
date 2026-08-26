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
login.html        Client portal login (password-gated)
dashboard.html    Client dashboard (embeds the Claude artifact)
404.html          Not-found page
CNAME             Custom domain for GitHub Pages
assets/
  css/styles.css  All styling (brand tokens at top)
  js/main.js      Nav, scroll reveal, contact form
  js/portal.js            Client portal login + dashboard behaviour
  js/dashboard-crypto.mjs Shared PBKDF2 + AES-GCM (browser and CLI)
  img/            Logo SVGs (full-colour + white)
data/
  dashboard.json  Encrypted dashboard URL + "updated" date
scripts/
  set-dashboard-url.mjs   CLI tool to publish a new dashboard URL
  encrypt.html            Same tool in the browser (no Node needed)
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


## Client portal

Clients open `truegreen.co.za/login.html`, enter one shared password, and land on
`dashboard.html`, which embeds the current Claude artifact full-page.

### How the password works — and what it does not do

There is no server: this is a static GitHub Pages site, so there is nothing to
authenticate against. Instead the password **is the decryption key**:

- The Claude artifact URL is encrypted with AES-256-GCM under a key derived from
  the password via PBKDF2-SHA256 (310 000 iterations) and stored in
  `data/dashboard.json`. The URL is never in the repo in plaintext.
- The password is never transmitted or stored — it only ever exists in the
  client's browser, and GCM's authentication tag is what verifies it.
- After a successful unlock the URL is held in `sessionStorage` and cleared on
  logout or when the tab closes.

**Be clear with clients about the limit:** this keeps the link out of the public
repo and out of casual view. Anyone who already has the Claude share link can
still open it directly, and anyone with the password can share the link onward.
It is "keep honest people out", not authentication. Do not put anything on the
dashboard that would be damaging if it leaked.

### Daily operating loop

The best case needs **no commit at all**: update the artifact in Claude and keep
the same public share link. Clients just refresh `dashboard.html`.

Only when Claude issues a **new** URL do you republish:

```bash
node scripts/set-dashboard-url.mjs --url "https://claude.ai/public/artifacts/..."
# prompts for the shared password (not echoed, not in shell history)

git add data/dashboard.json
git commit -m "Update client dashboard"
git push
```

GitHub Pages redeploys in a minute or two.

**No Node installed?** Serve the repo (`python3 -m http.server 8080`) and open
`http://localhost:8080/scripts/encrypt.html`. It does exactly the same thing in
the browser — paste the URL, password and date, then save the JSON it produces
over `data/dashboard.json`. Nothing is uploaded; the encryption is local.

### Rotating the password

Rotation and re-pointing are the same operation: re-run the tool with the new
password (and the current URL), then commit `data/dashboard.json`. Every client
must be given the new password, because the old one no longer decrypts anything.
Old passwords stay valid only for whatever copy of the file is still cached in a
browser, so rotate when someone leaves — and change the Claude share link too if
that matters, since the old link keeps working on its own.

### Local preview of the portal

The portal pages use ES modules and `fetch()`, which browsers block on
`file://`. Serve the folder instead:

```bash
python3 scripts/serve-local.py
# then visit http://localhost:8080/login.html
```

That server also accepts `POST /save`, which lets `scripts/encrypt.html` write
the config into `data/` directly instead of you downloading and moving it.

### Two ways to publish the dashboard

`scripts/encrypt.html` offers both. The portal prefers
`data/dashboard-content.json` and falls back to `data/dashboard.json`.

**Self-hosted (recommended).** The whole dashboard page is encrypted into
`data/dashboard-content.json`. After login it is rendered straight into the
page from truegreen.co.za, inside a `srcdoc` iframe sandboxed to
`allow-scripts` — an opaque origin, so the embedded page cannot reach the
portal's session. No third-party branding, and no address a viewer can copy
or forward. The source page must be self-contained: the tool warns if it
finds external references, because nothing outside the file is fetched.

**Link only.** `data/dashboard.json` holds just a URL. Note that claude.ai
sends `Content-Security-Policy: frame-ancestors 'self'`, so Claude artifacts
can never be embedded — the portal detects a claude.ai host and shows a
branded launch card that opens the link in a new tab instead.

### The cost of self-hosting

Self-hosting is a snapshot. When the numbers change you must re-encrypt and
commit, whereas a shared Claude link with *Always share latest version* on
updates with no deploy at all. Choose deliberately:

| | Self-hosted | Claude link |
| :-- | :-- | :-- |
| Third-party branding | none | Claude header, "unverified" label |
| Link a viewer can forward | none | yes — the link is the credential |
| Daily update | re-encrypt + commit | none, owner republishes |

### What actually protects the dashboard

Self-hosted, the encrypted blob sits in a **public** GitHub repo, so the only
attack is offline guessing of the password. PBKDF2 at 310 000 iterations makes
that slow, but a short or guessable password would not survive it — use a long
passphrase. On a link-only config, the password merely hides the link; whoever
holds the link can open it regardless.

### Claude cannot be embedded — confirmed

claude.ai serves `Content-Security-Policy: frame-ancestors 'self'`, so a Claude
artifact **cannot** be shown in an iframe on truegreen.co.za. The browser refuses
the frame; there is no workaround from our side.

`dashboard.html` therefore detects a `claude.ai` / `claude.com` URL and goes
straight to a branded launch card with an **Open Dashboard** button that opens
the artifact in a new tab. The login gate still applies before that card is
reached. Any non-Claude URL is still embedded normally, with an 8-second
watchdog, so the embed path stays available if the dashboard ever moves.

