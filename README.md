# ipaforge.com

The website of [IPAForge](https://github.com/IPAForge/ipaforge), the free, open-source desktop app that installs SideStore and your own apps onto iPhone and iPad from Windows, macOS and Linux.

Live at **https://ipaforge.com**.

A single static page, served by GitHub Pages from `main`: no build step. The domain is set in `CNAME`; its DNS points at GitHub Pages, HTTPS is enforced, and `ipaforge.github.io` and `www.ipaforge.com` redirect to it.

- `index.html`: the page (its styles and script are inline); the download buttons follow the newest release through GitHub's API.
- `img/`: the icon and screenshots of the app (from its screenshot tests), light and dark.
- `og.png`: the 1280×640 preview shown when the link is shared.
- `robots.txt`, `sitemap.xml`: for search engines.
- `CNAME`: the site's domain, ipaforge.com.
- `google0b5838584fd20e84.html`: Google Search Console's ownership check; keep it.

To preview it locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
