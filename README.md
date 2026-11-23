# ipaforge.com

The website of [IPAForge](https://github.com/IPAForge/ipaforge), the free, open-source desktop app that installs SideStore and your own apps onto iPhone and iPad from Windows, macOS and Linux.

Live at **https://ipaforge.com**.

## Pages

| Page | Made from |
|---|---|
| `/` | `src/pages/home.html`, by hand |
| `/install/` | `docs/installing.md` in IPAForge/ipaforge |
| `/troubleshooting/` | every error the app shows, from the app's own locale files (`packages/ui/src/locales/<lang>.json`) in IPAForge/ipaforge |
| `/releases/` | `docs/releases/*.md` in IPAForge/ipaforge, with the dates from its GitHub releases |
| `/faq/` | `faq.items` in `src/i18n/<lang>.json` (the landing page shows its first questions) |

## Languages

Every language with a file in `src/i18n/` gets the landing page, Troubleshooting and the FAQ: English at the root, every other language under its code (`/de/`, `/de/troubleshooting/`, `/de/faq/`). Install and the release notes are in English only, and the other languages' pages say so next to their links.

- `src/i18n/en.json` is the source: every string the pages and their scripts show. A string another language doesn't have yet falls back to English.
- Troubleshooting uses the app's own translations of its errors, so a language the app has needs nothing more there.
- `src/pages/home.html` holds the landing page's markup, with `{{key}}` where a string goes.
- Each page names its other languages for search engines (`hreflang`, and in `sitemap.xml`), and the top bar has a menu to switch.

To add a language: copy `en.json` to `src/i18n/<code>.json` (the code the app uses) and translate it. Right-to-left languages (Arabic, Hebrew, Persian, Urdu) get `dir="rtl"`.

The docs pages are made from the app's repository, so they say what the app says: change `docs/installing.md` there, and the site follows on its next deploy.

## How it's built

`scripts/build.mjs` writes the whole site into `dist/`: every page in every language in one layout (the top bar, the docs sidebar, the footer), the sitemap, and the static files. No framework: plain HTML, CSS and a little JavaScript.

- `assets/css/tokens.css`: every colour, size and space, light and dark. `base.css` (shared), `home.css` and `docs.css` build on it.
- `assets/js/`: the theme switch (`site.js`), the landing page's screens and newest release (`home.js`), the docs' page picker and error search (`docs.js`). Their text comes from the page, in its language (`#strings`, written by the build).
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
