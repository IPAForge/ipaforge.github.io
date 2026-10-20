# ipaforge.github.io

The website of [IPAForge](https://github.com/SirReaDy/ipaforge), the free, open-source desktop app that installs SideStore and your own apps onto iPhone and iPad from Windows, macOS and Linux.

Live at **https://ipaforge.github.io**.

A single static page, served by GitHub Pages from `main`: no build step.

- `index.html`: the page (its styles and script are inline); the download buttons follow the newest release through GitHub's API.
- `img/`: the icon and screenshots of the app (from its screenshot tests), light and dark.
- `og.png`: the 1280×640 preview shown when the link is shared.
- `robots.txt`, `sitemap.xml`: for search engines.

To preview it locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
