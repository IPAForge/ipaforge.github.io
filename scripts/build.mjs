// Builds ipaforge.com into dist/: the hand-made landing page, and the docs pages made from the IPAForge repository
// (the install guide, the release notes and the app's own error texts), all in one layout.
//
// Every language in src/i18n/ gets every page under its code (/de/faq/); English stays at the root. Troubleshooting
// comes from the app's own translated error texts, Install and the release notes from its translated docs
// (docs/i18n/<lang>/), each falling back to English, with a note, where a translation isn't there yet.
//
//   CONTENT_DIR=../ipaforge node scripts/build.mjs
//
// CONTENT_DIR is a checkout of IPAForge/ipaforge (CI checks it out next to this repo). GITHUB_TOKEN, when set,
// is used to read the release dates from GitHub's API.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { marked } from 'marked'

import { FAQ_ON_HOME } from '../src/content/faq.mjs'
import { LANGUAGES, localePath, nativeName, SOURCE, t } from '../src/i18n/index.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = resolve(ROOT, process.env.CONTENT_DIR ?? '../ipaforge')
const DIST = join(ROOT, 'dist')
const SITE = 'https://ipaforge.com'
const REPO = 'https://github.com/IPAForge/ipaforge'
const DISCORD = 'https://discord.gg/kGJn7NC5Zf'
const PATREON = 'https://patreon.com/IPAForge'
/** The Weblate project where IPAForge is translated; /translate/ sends visitors there. */
const WEBLATE = 'https://hosted.weblate.org/engage/ipaforge/'

if (!existsSync(join(CONTENT, 'docs/installing.md')))
  throw new Error(`CONTENT_DIR (${CONTENT}) is not a checkout of IPAForge/ipaforge`)

const read = (path) => readFileSync(path, 'utf8')
const esc = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

// ---------------------------------------------------------------------------------------------------------------
// Markdown: headings get ids (the sidebar lists the h2s), tables scroll on their own, links to other docs files
// go to the site's page for them or to the file on GitHub. A translated page's headings take the English page's ids in
// order (Weblate keeps the structure), or one written at the heading's end (`## Descargar {#download}`), so a link to
// `#download` works in every language.

/** The site's page for a file in the app repository (by its path there), when it has one. */
const DOC_PAGES = {
  'docs/device.md': '/troubleshooting/',
  'docs/apple-account.md': '/troubleshooting/',
  'docs/installing.md': '/install/'
}
const HEADING_ID = /\s*\{#([\w-]+)\}\s*$/

/**
 * `file` is the Markdown file's path in the app repository: relative links resolve from its folder. `ids` are the
 * English page's heading ids, in order, for a translation of it. Returns every heading's id too, in order.
 */
const markdown = (source, { demote = false, lang = SOURCE, file = 'docs/installing.md', ids: english = [] } = {}) => {
  const toc = []
  const ids = []
  const renderer = new marked.Renderer()
  renderer.heading = function ({ tokens, depth }) {
    const rendered = this.parser.parseInline(tokens)
    const explicit = rendered.match(HEADING_ID)?.[1]
    const text = rendered.replace(HEADING_ID, '')
    const id = explicit ?? english[ids.length] ?? (slug(text) || `section-${ids.length + 1}`)
    ids.push(id)
    const level = demote ? depth + 1 : depth
    if (depth === 2) toc.push({ id, text: text.replace(/<[^>]+>/g, '') })
    return `<h${level} id="${id}">${text}</h${level}>\n`
  }
  renderer.table = function (token) {
    return `<div class="table">${marked.Renderer.prototype.table.call(this, token)}</div>\n`
  }
  renderer.link = function ({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens)
    let target = href
    if (!/^([a-z]+:|#|\/)/.test(href)) {
      const [path, hash] = href.split('#')
      const linked = posix.normalize(posix.join(posix.dirname(file), path))
      const anchor = hash ? `#${hash}` : ''
      target = DOC_PAGES[linked] ? `${href_(lang, DOC_PAGES[linked])}${anchor}` : `${REPO}/blob/main/${linked}${anchor}`
    }
    return `<a href="${esc(target)}"${title ? ` title="${esc(title)}"` : ''}>${text}</a>`
  }
  return { html: marked.parse(source, { renderer }), toc, ids }
}

// ---------------------------------------------------------------------------------------------------------------
// The layout every page shares.

const NAV = [
  { path: '/install/', key: 'nav.install' },
  { path: '/troubleshooting/', key: 'nav.troubleshooting' },
  { path: '/releases/', key: 'nav.releases' },
  { path: '/faq/', key: 'nav.faq' }
]

/** The pages every language has (all of them; the 404 page is English only). */
const TRANSLATED = ['/', '/install/', '/troubleshooting/', '/releases/', '/faq/']
const isTranslated = (path) => TRANSLATED.includes(path)
/** Where a link to the site's `path` goes from a page in `lang`: its own language's page, when there is one. */
const href = (lang, path) => (isTranslated(path) ? localePath(lang, path) : path)
/** The same, for the Markdown link renderer, whose own `href` argument hides `href`. */
const href_ = (lang, path) => href(lang, path)
/** Links written in a string (`/install/`, `/faq/`, `/`) go to the page in the string's language. */
const localizeLinks = (lang, html) =>
  html.replace(/href="(\/(?:install\/|troubleshooting\/|releases\/|faq\/)?)([#"])/g, (_, path, end) => `href="${href(lang, path)}${end}`)

/**
 * A doc from the app repository in `lang`: its translation in docs/i18n/<lang>/ when there is one, else English.
 * `rel` is its path under docs/ (`installing.md`, `releases/0.1.0-alpha.9.md`).
 */
const docIn = (lang, rel) => {
  const translated = `docs/i18n/${lang}/${rel}`
  const file = lang !== SOURCE && existsSync(join(CONTENT, translated)) ? translated : `docs/${rel}`

  return { file, source: read(join(CONTENT, file)), isEnglish: file === `docs/${rel}` && lang !== SOURCE }
}
/** Said on a page, or a release, shown in English because its translation isn't there yet. */
const englishNote = (lang) => `<p class="lang-note" role="note">${esc(t(lang, 'language.notTranslated'))}</p>`

const languageOf = (code) => LANGUAGES.find((language) => language.code === code)

const SPRITE = read(join(ROOT, 'src/sprite.svg'))
const SOFTWARE = JSON.parse(read(join(ROOT, 'src/content/software.json')))
/** The app's screens on the landing page, for the app's structured data. */
const SCREENSHOTS = ['install-home', 'preload', 'apps', 'developer', 'repair', 'devices', 'sidestore-qr']

// What Google reads about the site: its name and logo (WebSite, Organization) on the home page with the app itself,
// and on every docs page where it sits (a breadcrumb), with the page's own data (the FAQ's questions) next to it.
const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  name: 'IPAForge',
  alternateName: 'ipaforge.com',
  url: `${SITE}/`,
  inLanguage: LANGUAGES.map((language) => language.code),
  publisher: { '@id': `${SITE}/#organization` }
}
const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: 'IPAForge',
  url: `${SITE}/`,
  logo: { '@type': 'ImageObject', url: `${SITE}/img/icon-512.png`, width: 512, height: 512 },
  sameAs: SOFTWARE.sameAs
}
const withoutContext = ({ '@context': _, ...rest }) => rest
const breadcrumb = (lang, path) => {
  const item = NAV.find((entry) => entry.path === path)

  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'IPAForge', item: `${SITE}${href(lang, '/')}` },
      { '@type': 'ListItem', position: 2, name: item ? t(lang, item.key) : path, item: `${SITE}${href(lang, path)}` }
    ]
  }
}
/** A docs page itself: a TechArticle for a guide, a WebPage otherwise, with when its content last changed. */
const pageNode = ({ lang, path, title, description, pageType = 'WebPage' }) => {
  const modified = lastmod[path]?.slice(0, 10)
  const url = `${SITE}${href(lang, path)}`

  return {
    '@type': pageType,
    '@id': `${url}#page`,
    url,
    name: title,
    ...(pageType === 'TechArticle'
      ? {
          headline: title,
          author: { '@id': `${SITE}/#organization` },
          publisher: { '@id': `${SITE}/#organization` },
          image: `${SITE}/og.png`,
          about: { '@id': `${SITE}/#software` },
          proficiencyLevel: 'Beginner'
        }
      : {}),
    description,
    inLanguage: lang,
    isPartOf: { '@id': `${SITE}/#website` },
    ...(modified ? { dateModified: modified } : {})
  }
}
const structuredData = ({ lang, path, title, description, jsonLd, pageType, noindex }) => {
  if (noindex) return ''
  const graph =
    path === '/'
      ? [WEBSITE, ORGANIZATION, ...(jsonLd ? [withoutContext(jsonLd)] : [])]
      : [
          // The page's own data (the FAQ's questions) makes the page that type, rather than a second node.
          {
            ...pageNode({ lang, path, title, description, pageType: jsonLd?.['@type'] ?? pageType }),
            ...(jsonLd ? withoutContext(jsonLd) : {})
          },
          breadcrumb(lang, path)
        ]
  const data = { '@context': 'https://schema.org', '@graph': graph }

  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>\n`
}

/** The same page in every language, for search engines (`x-default` is English); none for an English-only page. */
const alternates = (path) =>
  isTranslated(path)
    ? [
        ...LANGUAGES.map(({ code }) => `<link rel="alternate" hreflang="${code}" href="${SITE}${localePath(code, path)}">`),
        `<link rel="alternate" hreflang="x-default" href="${SITE}${path}">`
      ].join('\n') + '\n'
    : ''

const head = ({ lang, path, title, description, kind, jsonLd, pageType, noindex = false }) => {
  const { dir, ogLocale } = languageOf(lang)
  const url = `${SITE}${href(lang, path)}`
  const ogImageAlt = t(lang, 'meta.ogImageAlt')
  const otherLocales = isTranslated(path)
    ? LANGUAGES.filter(({ code }) => code !== lang)
        .map((language) => `<meta property="og:locale:alternate" content="${language.ogLocale}">\n`)
        .join('')
    : ''

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">\n<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`}
${noindex ? '' : alternates(path)}<meta name="author" content="Dan Motpan">
<link rel="alternate" type="application/atom+xml" title="${esc(t(lang, 'meta.feedTitle'))}" href="${SITE}/releases/feed.xml">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f7f7fb" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b0c19" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/img/icon.svg" type="image/svg+xml">
<link rel="icon" href="/img/icon-96.png" sizes="96x96" type="image/png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="IPAForge">
<meta property="og:locale" content="${ogLocale}">
${otherLocales}<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="640">
<meta property="og:image:alt" content="${esc(ogImageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/og.png">
<meta name="twitter:image:alt" content="${esc(ogImageAlt)}">
${structuredData({ lang, path, title, description, jsonLd, pageType, noindex })}<script>
  try {
    const theme = localStorage.getItem('theme')
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
  } catch {}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/base.css">
<link rel="stylesheet" href="/assets/css/${kind === 'home' ? 'home' : 'docs'}.css">
</head>
<body>
`
}

/** A nav link, to the page in this language. */
const navLink = (lang, item, current) =>
  `<a href="${href(lang, item.path)}"${item.path === current ? ' aria-current="page"' : ''}>${esc(t(lang, item.key))}</a>`

/** The language menu: this page in each language, or that language's home page when this page is English only. */
const languageMenu = (lang, path) => {
  if (LANGUAGES.length < 2) return ''
  const target = (code) => (isTranslated(path) ? localePath(code, path) : localePath(code, '/'))
  const items = LANGUAGES.map(
    ({ code, name }) =>
      `          <li><a href="${target(code)}" hreflang="${code}" lang="${code}"${code === lang ? ' aria-current="true"' : ''}>${esc(name)}</a></li>`
  ).join('\n')

  return `      <details class="lang-menu">
        <summary class="btn small" aria-label="${esc(t(lang, 'language.label'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg><span class="label">${esc(languageOf(lang).name)}</span></summary>
        <ul>
${items}
        </ul>
      </details>
`
}

/** The strings the page's scripts need, in its language. */
const scriptStrings = (lang, kind) => {
  const strings = {
    toLight: t(lang, 'header.toLight'),
    toDark: t(lang, 'header.toDark'),
    ...(kind === 'home'
      ? { shots: t(lang, 'home.shots'), downloadFor: t(lang, 'home.downloadFor') }
      : {
          count: t(lang, 'troubleshooting.count'),
          countOf: t(lang, 'troubleshooting.countOf'),
          installFor: t(lang, 'install.for'),
          mac: t(lang, 'install.mac'),
          windows: t(lang, 'install.windows'),
          linux: t(lang, 'install.linux'),
          intel: t(lang, 'install.intel')
        })
  }
  // An escaped `<` can't end the script early.
  return `<script type="application/json" id="strings">${JSON.stringify(strings).replace(/</g, '\\u003c')}</script>\n`
}

const header = (lang, path) => `${SPRITE}
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${href(lang, '/')}"><img src="/img/icon.svg" alt="" width="30" height="30">IPAForge</a>
    <nav class="site-nav" aria-label="${esc(t(lang, 'header.pages'))}">
${NAV.map((item) => `      ${navLink(lang, item, path)}`).join('\n')}
    </nav>
    <div class="site-actions">
${languageMenu(lang, path)}      <button class="btn small" id="theme" type="button" aria-label="${esc(t(lang, 'header.switchTheme'))}"><svg class="when-dark"><use href="#i-sun"/></svg><svg class="when-light"><use href="#i-moon"/></svg></button>
      <a class="btn small" href="${DISCORD}" aria-label="Discord"><svg><use href="#i-discord"/></svg><span class="label">Discord</span></a>
      <a class="btn small" href="${REPO}" aria-label="GitHub"><svg><use href="#i-gh"/></svg><span class="label">GitHub</span></a>
    </div>
  </div>
</header>
`

const footer = (lang, kind) => `<footer class="site-footer">
  <div class="wrap">
    <span>© 2026 Dan Motpan · <a href="${REPO}/blob/main/LICENSE">${esc(t(lang, 'footer.license'))}</a></span>
    <nav aria-label="${esc(t(lang, 'footer.links'))}">
      <a href="${REPO}">GitHub</a>
      <a href="${REPO}/releases">${esc(t(lang, 'footer.downloads'))}</a>
      ${navLink(lang, NAV[0])}
      ${navLink(lang, NAV[1])}
      <a href="${REPO}/issues">${esc(t(lang, 'footer.report'))}</a>
      <a href="${DISCORD}">Discord</a>
      <a href="${PATREON}">${esc(t(lang, 'footer.patreon'))}</a>
      <a href="/translate/">${esc(t(lang, 'footer.translate'))}</a>
    </nav>
  </div>
</footer>
${scriptStrings(lang, kind)}<script src="/assets/js/site.js" defer></script>
${kind === 'home' ? '<script src="/assets/js/home.js" defer></script>' : '<script src="/assets/js/docs.js" defer></script>'}
</body>
</html>
`

/** A docs page: the sidebar (every docs page, then this page's sections), the picker for phones, the page. */
const docsPage = ({ lang = SOURCE, path, title, description, kicker, h1, intro, body, toc = [], source, jsonLd, pageType, noindex }) => {
  const sections = toc.length
    ? `<h2>${esc(t(lang, 'docs.onThisPage'))}</h2>
      <ul class="toc">
${toc.map((item) => `        <li><a href="#${item.id}"${item.pick ? ` data-pick-area="${esc(item.pick)}"` : ''}>${esc(item.text)}</a></li>`).join('\n')}
      </ul>`
    : ''
  return (
    head({ lang, path, title, description, kind: 'docs', jsonLd, pageType, noindex }) +
    header(lang, path) +
    `<div class="wrap docs">
  <aside class="docs-side" aria-label="${esc(t(lang, 'docs.sidebar'))}">
    <h2>${esc(t(lang, 'docs.heading'))}</h2>
    <ul>
${NAV.map((item) => `      <li>${navLink(lang, item, path)}</li>`).join('\n')}
    </ul>
    ${sections}
  </aside>
  <main>
    <div class="docs-picker">
      <label class="visually-hidden" for="docs-picker">${esc(t(lang, 'docs.page'))}</label>
      <select id="docs-picker">
${NAV.map((item) => `        <option value="${href(lang, item.path)}"${item.path === path ? ' selected' : ''}>${esc(t(lang, item.key))}</option>`).join('\n')}
      </select>
    </div>
    <article class="prose" id="top">
      <p class="page-kicker">${esc(kicker)}</p>
      <h1>${esc(h1)}</h1>
      <p class="intro">${intro}</p>
${body}
      <div class="page-foot">
        <span>${t(lang, 'docs.madeFrom', { source: esc(source.label) })}</span>
        <a href="${source.url}">${esc(t(lang, 'docs.edit'))}</a>
        <a href="${REPO}/issues/new/choose">${esc(t(lang, 'docs.report'))}</a>
      </div>
    </article>
  </main>
</div>
` +
    footer(lang, 'docs')
  )
}

const qa = (lang, item, open = false) =>
  `<details class="qa"${open ? ' open' : ''}><summary>${esc(item.q)}</summary><p>${localizeLinks(lang, item.a)}</p></details>`

// ---------------------------------------------------------------------------------------------------------------
// The pages.

// The versions to show: those with notes in docs/releases/ whose GitHub release is published. Notes merged before
// their release (the tag is pushed after) stay hidden until the release workflow asks for a rebuild, so the site
// never links to downloads that aren't there yet. Without an answer from GitHub, every version with notes counts.
const versionsWithNotes = () =>
  readdirSync(join(CONTENT, 'docs/releases'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

const publishedVersions = (dates) => {
  const versions = versionsWithNotes()
  if (Object.keys(dates).length === 0) return versions
  return versions.filter((version) => dates[version])
}

let shownVersions = []
/** When each page's content last changed, by path (read before the pages are written: they carry it too). */
let lastmod = {}
const latestVersion = () => shownVersions[0]

/** The languages the app itself speaks, by their own names (from the app's `status.json`). */
const appLanguages = () =>
  Object.keys(JSON.parse(read(join(CONTENT, 'packages/ui/src/locales/status.json'))))

/**
 * Fills the landing page's `{{key}}` slots with the language's strings. `{{key|name=value}}` fills a placeholder in
 * the string; `special` names values worked out at build time (`latest`: the newest version).
 */
const fillTemplate = (lang, template, special) =>
  template.replace(/\{\{([\w.-]+)(?:\|(\w+)=([\w]+))?\}\}/g, (match, key, name, value) => {
    if (!key.includes('.')) return match
    const values = name ? { [name]: special[value] ?? value } : {}
    return localizeLinks(lang, t(lang, key, values))
  })

const home = (lang) => {
  const languages = appLanguages()
  const body = fillTemplate(
    lang,
    read(join(ROOT, 'src/pages/home.html'))
      .replace(
        '{{app-languages}}',
        new Intl.ListFormat(lang, { type: 'unit' }).format(languages.map((code) => `<bdi lang="${code}">${esc(nativeName(code))}</bdi>`))
      )
      .replace(
        '{{faq-home}}',
        t(lang, 'faq.items')
          .slice(0, FAQ_ON_HOME)
          .map((item) => `        ${qa(lang, item)}`)
          .join('\n')
      ),
    { latest: latestVersion(), languages: languages.length }
  )
    .replaceAll('{{latest-version}}', latestVersion())
    .replace(/href="\/faq\/"/g, `href="${href(lang, '/faq/')}"`)
  return (
    head({
      lang,
      path: '/',
      title: t(lang, 'home.title'),
      description: t(lang, 'home.description'),
      kind: 'home',
      // The version is the newest released one, written in on every build.
      jsonLd: {
        ...SOFTWARE,
        '@id': `${SITE}/#software`,
        softwareVersion: latestVersion(),
        ...(dates[latestVersion()] ? { dateModified: dates[latestVersion()].slice(0, 10) } : {}),
        downloadUrl: `${REPO}/releases/tag/v${latestVersion()}`,
        releaseNotes: `${SITE}/releases/#v${latestVersion()}`,
        installUrl: `${SITE}/install/`,
        screenshot: SCREENSHOTS.map((name) => `${SITE}/img/${name}.webp`),
        publisher: { '@id': `${SITE}/#organization` },
        inLanguage: lang
      }
    }) +
    header(lang, '/') +
    body +
    footer(lang, 'home')
  )
}

/** The install guide without its breadcrumb line and title: the page has its own. */
const guideBody = (source) =>
  source
    .split('\n')
    .filter((line) => !/^\[← /.test(line) && !/^# /.test(line))
    .join('\n')

const install = (lang) => {
  const doc = docIn(lang, 'installing.md')
  const { ids } = markdown(guideBody(docIn(SOURCE, 'installing.md').source))
  const { html, toc } = markdown(guideBody(doc.source), { lang, file: doc.file, ids })
  return docsPage({
    lang,
    path: '/install/',
    title: t(lang, 'install.title'),
    description: t(lang, 'install.description'),
    kicker: t(lang, 'install.kicker'),
    pageType: 'TechArticle',
    h1: t(lang, 'install.h1'),
    intro: t(lang, 'install.intro'),
    body: `      <div class="os-card" id="os-card"><div><b>${esc(t(lang, 'install.card'))}</b><span>${esc(t(lang, 'install.cardSystems'))}</span></div><a class="btn primary" data-version="${latestVersion()}" href="${REPO}/releases">${esc(t(lang, 'install.download'))}</a></div>
${doc.isEnglish ? `      ${englishNote(lang)}\n` : ''}${doc.isEnglish ? `<div lang="en" dir="ltr">${html}</div>` : html}`,
    toc,
    source: { label: doc.file, url: `${REPO}/blob/main/${doc.file}` }
  })
}

/** Each error code's area, by its prefix: the key of its label in `troubleshooting.areas`. */
const AREAS = [
  ['device', 'device'],
  ['apple', 'apple'],
  ['catalog', 'catalog'],
  ['signer', 'app'],
  ['plist', 'app'],
  ['net', 'net'],
  ['installer', 'installer'],
  ['rpc', 'ipaforge'],
  ['internal', 'ipaforge']
]
const areaOf = (code) => (AREAS.find(([prefix]) => code.startsWith(`${prefix}.`)) ?? [null, 'other'])[1]

const errorsFrom = (node, prefix = '') =>
  typeof node?.title === 'string'
    ? [{ code: prefix, title: node.title, body: node.body ?? '' }]
    : Object.entries(node ?? {}).flatMap(([key, child]) => errorsFrom(child, prefix ? `${prefix}.${key}` : key))

/** The app's error texts in `lang` (from its own locale file), each falling back to English where it has none. */
const appErrors = (lang) => {
  const english = errorsFrom(JSON.parse(read(join(CONTENT, 'packages/ui/src/locales/en.json'))).errors)
  const file = join(CONTENT, `packages/ui/src/locales/${lang}.json`)
  if (lang === SOURCE || !existsSync(file)) return english
  const translated = new Map(errorsFrom(JSON.parse(read(file)).errors).map((error) => [error.code, error]))

  return english.map((error) => {
    const own = translated.get(error.code)
    return {
      code: error.code,
      title: own?.title || error.title,
      body: own?.title ? own.body || error.body : error.body
    }
  })
}

const troubleshooting = (lang) => {
  const errors = appErrors(lang)
  const count = errors.length
  const areas = [...new Set(errors.map((error) => areaOf(error.code)))]
  const areaLabel = (area) => t(lang, `troubleshooting.areas.${area}`)
  const list = errors
    .map(
      (error) => `        <section class="err" id="${esc(error.code)}" data-area="${esc(areaOf(error.code))}" data-text="${esc(`${error.code} ${error.title} ${error.body}`.toLocaleLowerCase(lang))}">
          <header><h3>${esc(error.title)}</h3><code>${esc(error.code)}</code><span class="area">${esc(areaLabel(areaOf(error.code)))}</span></header>
          <p>${esc(error.body)}</p>
          <a class="anchor" href="#${esc(error.code)}">${esc(t(lang, 'troubleshooting.link'))}</a>
        </section>`
    )
    .join('\n')
  const localeFile = `packages/ui/src/locales/${lang === SOURCE || !existsSync(join(CONTENT, `packages/ui/src/locales/${lang}.json`)) ? SOURCE : lang}.json`
  return docsPage({
    lang,
    path: '/troubleshooting/',
    title: t(lang, 'troubleshooting.title'),
    pageType: 'TechArticle',
    description: t(lang, 'troubleshooting.description', { count }),
    kicker: t(lang, 'troubleshooting.kicker'),
    h1: t(lang, 'troubleshooting.h1'),
    intro: t(lang, 'troubleshooting.intro'),
    body: `      <div class="search"><svg aria-hidden="true"><use href="#i-search"/></svg><input id="q" type="search" placeholder="${esc(t(lang, 'troubleshooting.search', { count }))}" aria-label="${esc(t(lang, 'troubleshooting.searchLabel'))}"></div>
      <div class="filters" role="group" aria-label="${esc(t(lang, 'troubleshooting.filters'))}">
        <button class="filter" type="button" aria-pressed="true" data-area="">${esc(t(lang, 'troubleshooting.all'))}</button>
${areas.map((area) => `        <button class="filter" type="button" aria-pressed="false" data-area="${esc(area)}">${esc(areaLabel(area))}</button>`).join('\n')}
      </div>
      <p class="count" id="count" aria-live="polite">${esc(t(lang, 'troubleshooting.count', { count }))}</p>
      <div class="errors" id="errors">
${list}
      </div>
      <p class="empty" id="empty" hidden>${t(lang, 'troubleshooting.empty', { discord: DISCORD })}</p>`,
    toc: areas.map((area) => ({ id: 'top', text: areaLabel(area), pick: area })),
    source: { label: localeFile, url: `${REPO}/blob/main/${localeFile}` }
  })
}

/** When a file last changed in a repository, from its last commit (GitHub's API); undefined if GitHub can't say. */
const lastCommitDate = async (repo, path) => {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/commits?path=${encodeURIComponent(path)}&per_page=1`, {
      headers: process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}
    })
    if (!response.ok) return undefined
    const [commit] = await response.json()
    return commit?.commit?.committer?.date
  } catch {
    return undefined
  }
}

const releaseDates = async () => {
  try {
    const response = await fetch('https://api.github.com/repos/IPAForge/ipaforge/releases?per_page=100', {
      headers: process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}
    })
    if (!response.ok) return {}
    const releases = await response.json()
    // Published releases only: a draft has no date and isn't downloadable.
    return Object.fromEntries(
      releases
        .filter((release) => !release.draft && release.published_at)
        .map((release) => [release.tag_name.replace(/^v/, ''), release.published_at])
    )
  } catch {
    return {}
  }
}

/**
 * A release's notes without the sections that belong on the Install page (Downloads, Before you start), found by their
 * English name or, in a translation, by their id.
 */
const withoutInstallSections = (source) =>
  source.replace(/\n## (?:Downloads|Before you start|[^\n]*\{#(?:downloads|before-you-start)\})[^\n]*[\s\S]*?(?=\n## |$)/g, '\n')

const releases = (lang, dates) => {
  const versions = shownVersions
  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString(lang === SOURCE ? 'en-GB' : lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const docs = versions.map((version) => docIn(lang, `releases/${version}.md`))
  // None translated (the usual case: release notes are written in English): one note above them all.
  const allEnglish = lang !== SOURCE && docs.every((doc) => doc.isEnglish)
  const sections = versions.map((version, index) => {
    const doc = docs[index]
    const { html } = markdown(withoutInstallSections(doc.source), { demote: true, lang, file: doc.file })
    const date = dates[version]
    return `      <section class="release" id="v${esc(version)}"${doc.isEnglish ? ' lang="en" dir="ltr"' : ''}>
        <header><h2 class="ltr">${esc(version)}</h2>${date ? `<time datetime="${date.slice(0, 10)}">${formatDate(date)}</time>` : ''}${index === 0 ? `<span class="chip done">${esc(t(lang, 'releases.latest'))}</span>` : ''}<a class="downloads" href="${REPO}/releases/tag/v${esc(version)}">${esc(t(lang, 'releases.downloads'))}</a></header>
${doc.isEnglish && !allEnglish ? `        ${englishNote(lang)}\n` : ''}${html.replace(/ id="/g, ` id="v${esc(version)}-`)}
      </section>`
  })
  return docsPage({
    lang,
    path: '/releases/',
    title: t(lang, 'releases.title'),
    description: t(lang, 'releases.description'),
    kicker: t(lang, 'releases.kicker'),
    h1: t(lang, 'releases.h1'),
    intro: t(lang, 'releases.intro'),
    body: `${allEnglish ? `      ${englishNote(lang)}\n` : ''}${sections.join('\n')}`,
    toc: versions.map((version) => ({ id: `v${version}`, text: version })),
    source: {
      label: lang === SOURCE ? 'docs/releases/' : `docs/i18n/${lang}/releases/`,
      url: `${REPO}/tree/main/${lang === SOURCE ? 'docs/releases' : `docs/i18n/${lang}/releases`}`
    }
  })
}

/** An Atom feed of the releases, newest first, each linking to its notes and downloads. */
const releasesFeed = (dates) => {
  const entries = shownVersions.map((version) => {
    const updated = dates[version] ?? new Date(0).toISOString()
    const source = withoutInstallSections(read(join(CONTENT, 'docs/releases', `${version}.md`)))
    return `  <entry>
    <title>IPAForge ${esc(version)}</title>
    <id>${SITE}/releases/#v${esc(version)}</id>
    <link href="${SITE}/releases/#v${esc(version)}"/>
    <link rel="related" href="${REPO}/releases/tag/v${esc(version)}"/>
    <updated>${updated}</updated>
    <content type="html">${esc(marked.parse(source))}</content>
  </entry>`
  })
  const updated = dates[shownVersions[0]] ?? new Date(0).toISOString()

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>IPAForge releases</title>
  <subtitle>What changed in each version of IPAForge.</subtitle>
  <id>${SITE}/releases/</id>
  <link href="${SITE}/releases/"/>
  <link rel="self" href="${SITE}/releases/feed.xml"/>
  <icon>${SITE}/img/icon-96.png</icon>
  <author><name>Dan Motpan</name></author>
  <updated>${updated}</updated>
${entries.join('\n')}
</feed>
`
}

const faq = (lang) => {
  const items = t(lang, 'faq.items')

  return docsPage({
    lang,
    path: '/faq/',
    title: t(lang, 'faq.title'),
    description: t(lang, 'faq.description'),
    kicker: t(lang, 'faq.kicker'),
    h1: t(lang, 'faq.h1'),
    intro: t(lang, 'faq.intro'),
    body: items.map((item, index) => `      ${qa(lang, item, index < 2)}`).join('\n'),
    source: {
      label: `src/i18n/${lang}.json`,
      url: `https://github.com/IPAForge/ipaforge.github.io/blob/main/src/i18n/${lang}.json`
    },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a.replace(/<[^>]+>/g, '') }
      }))
    }
  })
}

const notFound = () =>
  docsPage({
    path: '/404.html',
    title: t(SOURCE, 'notFound.title'),
    description: t(SOURCE, 'notFound.description'),
    kicker: '404',
    h1: t(SOURCE, 'notFound.h1'),
    intro: t(SOURCE, 'notFound.intro'),
    body: '',
    source: { label: 'scripts/build.mjs', url: 'https://github.com/IPAForge/ipaforge.github.io' },
    noindex: true
  })

// ---------------------------------------------------------------------------------------------------------------
// Write dist/.

rmSync(DIST, { recursive: true, force: true })
mkdirSync(DIST, { recursive: true })
const write = (path, html) => {
  const file = join(DIST, path.endsWith('/') ? `${path}index.html` : path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
}

const dates = await releaseDates()
shownVersions = publishedVersions(dates)
if (shownVersions.length === 0) throw new Error('no released version with notes in docs/releases/')
// Each page's lastmod is when its content last changed, not when the site was built: Google trusts dates that move
// only with the content. The newest of a page's sources counts; without an answer from GitHub, the page has none.
const APP = 'IPAForge/ipaforge'
const SITE_REPO = 'IPAForge/ipaforge.github.io'
const newest = (...dates) => dates.filter(Boolean).sort().at(-1)
const latestRelease = Object.values(dates).filter(Boolean).sort().at(-1)
lastmod = {
  '/': newest(await lastCommitDate(SITE_REPO, 'src/pages/home.html'), await lastCommitDate(SITE_REPO, 'src/i18n'), latestRelease),
  '/install/': await lastCommitDate(APP, 'docs/installing.md'),
  '/troubleshooting/': await lastCommitDate(APP, 'packages/ui/src/locales'),
  '/releases/': newest(latestRelease, await lastCommitDate(APP, 'docs/releases')),
  '/faq/': await lastCommitDate(SITE_REPO, 'src/i18n')
}
for (const { code } of LANGUAGES) {
  write(localePath(code, '/'), home(code))
  write(localePath(code, '/install/'), install(code))
  write(localePath(code, '/troubleshooting/'), troubleshooting(code))
  write(localePath(code, '/releases/'), releases(code, dates))
  write(localePath(code, '/faq/'), faq(code))
}
write('/404.html', notFound())
// A short address for translators, to the Weblate project: a redirect, with a link for browsers that don't follow it.
write(
  '/translate/',
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Translate IPAForge</title>
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${WEBLATE}">
<link rel="canonical" href="${WEBLATE}">
</head>
<body>
<p>IPAForge is translated on Weblate: <a href="${WEBLATE}">${WEBLATE}</a></p>
</body>
</html>
`
)

writeFileSync(join(DIST, 'releases/feed.xml'), releasesFeed(dates))

for (const item of ['assets', 'img', 'og.png', 'favicon.ico', 'site.webmanifest', 'CNAME', 'robots.txt', 'google0b5838584fd20e84.html'])
  cpSync(join(ROOT, item), join(DIST, item), { recursive: true })

// Every page in every language it has, each translated page naming its other languages.
const sitemapEntries = ['/', ...NAV.map((item) => item.path)].flatMap((path) => {
  const date = lastmod[path]?.slice(0, 10)
  const codes = isTranslated(path) ? LANGUAGES.map((language) => language.code) : [SOURCE]
  const links = isTranslated(path)
    ? [...codes.map((code) => [code, localePath(code, path)]), ['x-default', path]]
        .map(([code, page]) => `    <xhtml:link rel="alternate" hreflang="${code}" href="${SITE}${page}"/>\n`)
        .join('')
    : ''

  return codes.map(
    (code) =>
      `  <url>\n    <loc>${SITE}${localePath(code, path)}</loc>\n${date ? `    <lastmod>${date}</lastmod>\n` : ''}${links}  </url>`
  )
})
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntries.join('\n')}
</urlset>
`
)

console.log(`built ${sitemapEntries.length + 1} pages in ${LANGUAGES.length} languages into dist/ from ${CONTENT}`)
