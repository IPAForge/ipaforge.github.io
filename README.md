# ipaforge.com

The website of [IPAForge](https://github.com/IPAForge/ipaforge), the free, open-source desktop app that installs SideStore and your own apps onto iPhone and iPad from Windows, macOS and Linux.

Live at **https://ipaforge.com**.

## Pages

| Page | Made from |
|---|---|
| `/` | `src/pages/home.html`, by hand |
| `/install/` | `docs/installing.md` in IPAForge/ipaforge |
| `/troubleshooting/` | every error the app shows, from `packages/ui/src/locales/en.json` in IPAForge/ipaforge |
| `/releases/` | `docs/releases/*.md` in IPAForge/ipaforge, with the dates from its GitHub releases |
| `/faq/` | `src/content/faq.mjs` (the landing page shows its first questions) |

The docs pages are made from the app's repository, so they say what the app says: change `docs/installing.md` there, and the site follows on its next deploy.

## How it's built

`scripts/build.mjs` writes the whole site into `dist/`: every page in one layout (the top bar, the docs sidebar, the footer), the sitemap, and the static files. No framework: plain HTML, CSS and a little JavaScript.

- `assets/css/tokens.css`: every colour, size and space, light and dark. `base.css` (shared), `home.css` and `docs.css` build on it.
- `assets/js/`: the theme switch (`site.js`), the landing page's screens and newest release (`home.js`), the docs' page picker and error search (`docs.js`).
- `img/`: the icon (SVG, and PNGs at 48, 96, 192 and 512 px) and screenshots of the app, light and dark. `favicon.ico` (16, 32, 48 px) and `site.webmanifest` for browsers and search results. `og.png`: the preview shown when a link is shared.
- Search engines get structured data on every page (`structuredData` in the build): the site's name and logo and the app (with its newest version and screenshots) on `/`, a breadcrumb and the page itself (a TechArticle for the guides, the FAQ's questions) on the docs pages, and an Atom feed of the releases at `/releases/feed.xml`.
- `CNAME`: the domain. `google0b5838584fd20e84.html`: Google Search Console's ownership check; keep it.

## Deploying

`.github/workflows/deploy.yml` builds the site and publishes it to GitHub Pages (Settings › Pages › Source: GitHub Actions). It runs:

- on every push to `main`;
- when IPAForge publishes a release: its release workflow sends this repository an `app-released` event;
- by hand, from the Actions tab.

## Locally

With a checkout of IPAForge/ipaforge next to this one:

```sh
npm install
CONTENT_DIR=../ipaforge npm run build
npm run preview   # http://localhost:4321
```
