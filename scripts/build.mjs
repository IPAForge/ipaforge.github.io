// Builds ipaforge.com into dist/: the hand-made landing page, and the docs pages made from the IPAForge repository
// (the install guide, the release notes and the app's own error texts), all in one layout.
//
//   CONTENT_DIR=../ipaforge node scripts/build.mjs
//
// CONTENT_DIR is a checkout of IPAForge/ipaforge (CI checks it out next to this repo). GITHUB_TOKEN, when set,
// is used to read the release dates from GitHub's API.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { marked } from 'marked'

import { FAQ, FAQ_ON_HOME } from '../src/content/faq.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = resolve(ROOT, process.env.CONTENT_DIR ?? '../ipaforge')
const DIST = join(ROOT, 'dist')
const SITE = 'https://ipaforge.com'
const REPO = 'https://github.com/IPAForge/ipaforge'
const DISCORD = 'https://discord.gg/kGJn7NC5Zf'
const PATREON = 'https://patreon.com/IPAForge'

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
// go to the site's page for them or to the file on GitHub.

const DOC_PAGES = { 'device.md': '/troubleshooting/', 'apple-account.md': '/troubleshooting/', 'installing.md': '/install/' }

const markdown = (source, { demote = false } = {}) => {
  const toc = []
  const renderer = new marked.Renderer()
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens)
    const id = slug(text)
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
      const [file, hash] = href.split('#')
      const name = file.split('/').pop()
      target = DOC_PAGES[name]
        ? DOC_PAGES[name] + (hash ? `#${hash}` : '')
        : `${REPO}/blob/main/${join('docs', file).replace(/\\/g, '/')}${hash ? `#${hash}` : ''}`
    }
    return `<a href="${esc(target)}"${title ? ` title="${esc(title)}"` : ''}>${text}</a>`
  }
  return { html: marked.parse(source, { renderer }), toc }
}

// ---------------------------------------------------------------------------------------------------------------
// The layout every page shares.

const NAV = [
  { path: '/install/', label: 'Install' },
  { path: '/troubleshooting/', label: 'Troubleshooting' },
  { path: '/releases/', label: 'Release notes' },
  { path: '/faq/', label: 'FAQ' }
]

const SPRITE = read(join(ROOT, 'src/sprite.svg'))
const SOFTWARE = JSON.parse(read(join(ROOT, 'src/content/software.json')))
/** The app's screens on the landing page, for the app's structured data. */
const SCREENSHOTS = ['install-home', 'preload', 'apps', 'developer', 'repair', 'devices', 'sidestore-qr']
const OG_IMAGE_ALT = 'IPAForge: install SideStore and your own apps onto iPhone and iPad from Windows, macOS and Linux.'

// What Google reads about the site: its name and logo (WebSite, Organization) on the home page with the app itself,
// and on every docs page where it sits (a breadcrumb), with the page's own data (the FAQ's questions) next to it.
const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  name: 'IPAForge',
  alternateName: 'ipaforge.com',
  url: `${SITE}/`,
  inLanguage: 'en',
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
const breadcrumb = (path) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'IPAForge', item: `${SITE}/` },
    {
      '@type': 'ListItem',
      position: 2,
      name: NAV.find((item) => item.path === path)?.label ?? path,
      item: `${SITE}${path}`
    }
  ]
})
/** A docs page itself: a TechArticle for a guide, a WebPage otherwise, with when its content last changed. */
const pageNode = ({ path, title, description, pageType = 'WebPage' }) => {
  const modified = lastmod[path]?.slice(0, 10)

  return {
    '@type': pageType,
    '@id': `${SITE}${path}#page`,
    url: `${SITE}${path}`,
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
    inLanguage: 'en',
    isPartOf: { '@id': `${SITE}/#website` },
    ...(modified ? { dateModified: modified } : {})
  }
}
const structuredData = ({ path, title, description, jsonLd, pageType, noindex }) => {
  if (noindex) return ''
  const graph =
    path === '/'
      ? [WEBSITE, ORGANIZATION, ...(jsonLd ? [withoutContext(jsonLd)] : [])]
      : [
          // The page's own data (the FAQ's questions) makes the page that type, rather than a second node.
          { ...pageNode({ path, title, description, pageType: jsonLd?.['@type'] ?? pageType }), ...(jsonLd ? withoutContext(jsonLd) : {}) },
          breadcrumb(path)
        ]
  const data = { '@context': 'https://schema.org', '@graph': graph }

  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>\n`
}

const head = ({ path, title, description, kind, jsonLd, pageType, noindex = false }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE}${path}">\n<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`}
<meta name="author" content="Dan Motpan">
<link rel="alternate" type="application/atom+xml" title="IPAForge releases" href="${SITE}/releases/feed.xml">
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
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="640">
<meta property="og:image:alt" content="${esc(OG_IMAGE_ALT)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/og.png">
<meta name="twitter:image:alt" content="${esc(OG_IMAGE_ALT)}">
${structuredData({ path, title, description, jsonLd, pageType, noindex })}<script>
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

const header = (path) => `${SPRITE}
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/"><img src="/img/icon.svg" alt="" width="30" height="30">IPAForge</a>
    <nav class="site-nav" aria-label="Pages">
${NAV.map((item) => `      <a href="${item.path}"${item.path === path ? ' aria-current="page"' : ''}>${item.label}</a>`).join('\n')}
    </nav>
    <div class="site-actions">
      <button class="btn small" id="theme" type="button" aria-label="Switch theme"><svg class="when-dark"><use href="#i-sun"/></svg><svg class="when-light"><use href="#i-moon"/></svg></button>
      <a class="btn small" href="${DISCORD}" aria-label="Discord"><svg><use href="#i-discord"/></svg><span class="label">Discord</span></a>
      <a class="btn small" href="${REPO}" aria-label="GitHub"><svg><use href="#i-gh"/></svg><span class="label">GitHub</span></a>
    </div>
  </div>
</header>
`

const footer = (kind) => `<footer class="site-footer">
  <div class="wrap">
    <span>© 2026 Dan Motpan · <a href="${REPO}/blob/main/LICENSE">AGPL-3.0 license</a></span>
    <nav aria-label="Links">
      <a href="${REPO}">GitHub</a>
      <a href="${REPO}/releases">Downloads</a>
      <a href="/install/">Install</a>
      <a href="/troubleshooting/">Troubleshooting</a>
      <a href="${REPO}/issues">Report a problem</a>
      <a href="${DISCORD}">Discord</a>
      <a href="${PATREON}">Support on Patreon</a>
    </nav>
  </div>
</footer>
<script src="/assets/js/site.js" defer></script>
${kind === 'home' ? '<script src="/assets/js/home.js" defer></script>' : '<script src="/assets/js/docs.js" defer></script>'}
</body>
</html>
`

/** A docs page: the sidebar (every docs page, then this page's sections), the picker for phones, the page. */
const docsPage = ({ path, title, description, kicker, h1, intro, body, toc = [], source, jsonLd, pageType, noindex }) => {
  const sections = toc.length
    ? `<h2>On this page</h2>
      <ul class="toc">
${toc.map((item) => `        <li><a href="#${item.id}"${item.pick ? ` data-pick-area="${esc(item.pick)}"` : ''}>${esc(item.text)}</a></li>`).join('\n')}
      </ul>`
    : ''
  return (
    head({ path, title, description, kind: 'docs', jsonLd, pageType, noindex }) +
    header(path) +
    `<div class="wrap docs">
  <aside class="docs-side" aria-label="Documentation">
    <h2>Docs</h2>
    <ul>
${NAV.map((item) => `      <li><a href="${item.path}"${item.path === path ? ' aria-current="page"' : ''}>${item.label}</a></li>`).join('\n')}
    </ul>
    ${sections}
  </aside>
  <main>
    <div class="docs-picker">
      <label class="visually-hidden" for="docs-picker">Page</label>
      <select id="docs-picker">
${NAV.map((item) => `        <option value="${item.path}"${item.path === path ? ' selected' : ''}>${item.label}</option>`).join('\n')}
      </select>
    </div>
    <article class="prose" id="top">
      <p class="page-kicker">${esc(kicker)}</p>
      <h1>${esc(h1)}</h1>
      <p class="intro">${intro}</p>
${body}
      <div class="page-foot">
        <span>Made from <code>${esc(source.label)}</code> in the IPAForge repository.</span>
        <a href="${source.url}">Edit this page on GitHub</a>
        <a href="${REPO}/issues/new/choose">Report a problem</a>
      </div>
    </article>
  </main>
</div>
` +
    footer('docs')
  )
}

const qa = (item, open = false) =>
  `<details class="qa"${open ? ' open' : ''}><summary>${esc(item.q)}</summary><p>${item.a}</p></details>`

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

const home = () => {
  const body = read(join(ROOT, 'src/pages/home.html'))
    .replaceAll('{{latest-version}}', latestVersion())
    .replace(
    '{{faq-home}}',
    FAQ.slice(0, FAQ_ON_HOME)
      .map((item) => `        ${qa(item)}`)
      .join('\n')
  )
  return (
    head({
      path: '/',
      title: 'IPAForge: install SideStore from Windows, macOS and Linux',
      description:
        'IPAForge is a free, open-source desktop app for Windows, macOS and Linux that installs SideStore and your own apps onto iPhone and iPad with a free Apple ID.',
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
        publisher: { '@id': `${SITE}/#organization` }
      }
    }) +
    header('/') +
    body +
    footer('home')
  )
}

const install = () => {
  const source = read(join(CONTENT, 'docs/installing.md'))
    .split('\n')
    .filter((line) => !/^\[← /.test(line) && !/^# /.test(line))
    .join('\n')
  const { html, toc } = markdown(source)
  return docsPage({
    path: '/install/',
    title: 'Install IPAForge on Windows, macOS and Linux',
    description:
      'Download IPAForge, open it the first time on macOS, Windows or Linux, connect your iPhone, and install SideStore.',
    kicker: 'Install',
    pageType: 'TechArticle',
    h1: 'Installing IPAForge',
    intro: 'Download, the first open on each system, what your iPhone needs, and the first run.',
    body: `      <div class="os-card" id="os-card"><div><b>IPAForge for your computer</b><span>Windows, macOS and Linux</span></div><a class="btn primary" data-version="${latestVersion()}" href="${REPO}/releases">Download</a></div>
${html}`,
    toc,
    source: { label: 'docs/installing.md', url: `${REPO}/blob/main/docs/installing.md` }
  })
}

const AREAS = [
  ['device', 'iPhone or iPad'],
  ['apple', 'Apple ID'],
  ['catalog', 'Downloads and sources'],
  ['signer', 'The app'],
  ['plist', 'The app'],
  ['net', 'Network'],
  ['installer', 'Installing'],
  ['rpc', 'IPAForge itself'],
  ['internal', 'IPAForge itself']
]
const areaOf = (code) => (AREAS.find(([prefix]) => code.startsWith(`${prefix}.`)) ?? [null, 'Other'])[1]

const errorsFrom = (node, prefix = '') =>
  typeof node?.title === 'string'
    ? [{ code: prefix, title: node.title, body: node.body ?? '' }]
    : Object.entries(node ?? {}).flatMap(([key, child]) => errorsFrom(child, prefix ? `${prefix}.${key}` : key))

const troubleshooting = () => {
  const errors = errorsFrom(JSON.parse(read(join(CONTENT, 'packages/ui/src/locales/en.json'))).errors)
  const areas = [...new Set(errors.map((error) => areaOf(error.code)))]
  const list = errors
    .map(
      (error) => `        <section class="err" id="${esc(error.code)}" data-area="${esc(areaOf(error.code))}" data-text="${esc(`${error.code} ${error.title} ${error.body}`.toLowerCase())}">
          <header><h3>${esc(error.title)}</h3><code>${esc(error.code)}</code><span class="area">${esc(areaOf(error.code))}</span></header>
          <p>${esc(error.body)}</p>
          <a class="anchor" href="#${esc(error.code)}">Link to this error</a>
        </section>`
    )
    .join('\n')
  return docsPage({
    path: '/troubleshooting/',
    title: 'Troubleshooting IPAForge: every error and how to fix it',
    pageType: 'TechArticle',
    description: `What each of IPAForge's ${errors.length} errors means and how to fix it: device, Apple ID, downloads, signing and installing.`,
    kicker: 'Troubleshooting',
    h1: 'When something fails',
    intro:
      'Every error IPAForge shows has a code. Search for it, or for the words on your screen, to see what it means and how to fix it.',
    body: `      <div class="search"><svg aria-hidden="true"><use href="#i-search"/></svg><input id="q" type="search" placeholder="Search ${errors.length} errors: a code like apple.app_id_quota, or words like “locked”" aria-label="Search errors"></div>
      <div class="filters" role="group" aria-label="Filter by area">
        <button class="filter" type="button" aria-pressed="true" data-area="">All</button>
${areas.map((area) => `        <button class="filter" type="button" aria-pressed="false" data-area="${esc(area)}">${esc(area)}</button>`).join('\n')}
      </div>
      <p class="count" id="count" aria-live="polite">${errors.length} errors</p>
      <div class="errors" id="errors">
${list}
      </div>
      <p class="empty" id="empty" hidden>No error matches. Try fewer words, or ask on <a href="${DISCORD}">Discord</a>.</p>`,
    toc: areas.map((area) => ({ id: 'top', text: area, pick: area })),
    source: { label: 'packages/ui/src/locales/en.json', url: `${REPO}/blob/main/packages/ui/src/locales/en.json` }
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

const releases = (dates) => {
  const dir = join(CONTENT, 'docs/releases')
  const versions = shownVersions
  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const sections = versions.map((version, index) => {
    // Downloads and first-open steps are on the Install page; the notes keep what changed.
    const source = read(join(dir, `${version}.md`)).replace(/\n## (Downloads|Before you start)[\s\S]*?(?=\n## |$)/g, '\n')
    const { html } = markdown(source, { demote: true })
    const date = dates[version]
    return `      <section class="release" id="v${esc(version)}">
        <header><h2>${esc(version)}</h2>${date ? `<time datetime="${date.slice(0, 10)}">${formatDate(date)}</time>` : ''}${index === 0 ? '<span class="chip done">Latest</span>' : ''}<a class="downloads" href="${REPO}/releases/tag/v${esc(version)}">Downloads</a></header>
${html.replace(/ id="/g, ` id="v${esc(version)}-`)}
      </section>`
  })
  return docsPage({
    path: '/releases/',
    title: 'IPAForge release notes: what changed in every version',
    description:
      'What changed in each version of IPAForge, newest first: new features, fixes and the downloads for Windows, macOS and Linux.',
    kicker: 'Release notes',
    h1: 'Every version, newest first',
    intro: "What changed in each release of IPAForge. The app shows the same changes in What's new.",
    body: sections.join('\n'),
    toc: versions.map((version) => ({ id: `v${version}`, text: version })),
    source: { label: 'docs/releases/', url: `${REPO}/tree/main/docs/releases` }
  })
}

/** An Atom feed of the releases, newest first, each linking to its notes and downloads. */
const releasesFeed = (dates) => {
  const entries = shownVersions.map((version) => {
    const updated = dates[version] ?? new Date(0).toISOString()
    const source = read(join(CONTENT, 'docs/releases', `${version}.md`)).replace(/\n## (Downloads|Before you start)[\s\S]*?(?=\n## |$)/g, '\n')
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

const faq = () =>
  docsPage({
    path: '/faq/',
    title: 'IPAForge FAQ: cost, requirements, Apple ID and updates',
    description: 'Short answers about IPAForge: what it costs, what you need, the warnings on first open, your password, updates and getting help.',
    kicker: 'FAQ',
    h1: 'Questions people ask',
    intro: 'Short answers, each pointing to the page with the details.',
    body: FAQ.map((item, index) => `      ${qa(item, index < 2)}`).join('\n'),
    source: { label: 'src/content/faq.mjs', url: 'https://github.com/IPAForge/ipaforge.github.io/blob/main/src/content/faq.mjs' },
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a.replace(/<[^>]+>/g, '') }
      }))
    }
  })

const notFound = () =>
  docsPage({
    path: '/404.html',
    title: 'Page not found · IPAForge',
    description: 'This page does not exist.',
    kicker: '404',
    h1: 'This page does not exist',
    intro: 'The address may have changed. The pages are all in the sidebar, or go back to the <a href="/">home page</a>.',
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
  '/': newest(await lastCommitDate(SITE_REPO, 'src/pages/home.html'), await lastCommitDate(SITE_REPO, 'src/content/faq.mjs'), latestRelease),
  '/install/': await lastCommitDate(APP, 'docs/installing.md'),
  '/troubleshooting/': await lastCommitDate(APP, 'packages/ui/src/locales/en.json'),
  '/releases/': newest(latestRelease, await lastCommitDate(APP, 'docs/releases')),
  '/faq/': await lastCommitDate(SITE_REPO, 'src/content/faq.mjs')
}
write('/', home())
write('/install/', install())
write('/troubleshooting/', troubleshooting())
write('/releases/', releases(dates))
write('/faq/', faq())
write('/404.html', notFound())

writeFileSync(join(DIST, 'releases/feed.xml'), releasesFeed(dates))

for (const item of ['assets', 'img', 'og.png', 'favicon.ico', 'site.webmanifest', 'CNAME', 'robots.txt', 'google0b5838584fd20e84.html'])
  cpSync(join(ROOT, item), join(DIST, item), { recursive: true })

writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['/', ...NAV.map((item) => item.path)]
  .map((path) => {
    const date = lastmod[path]?.slice(0, 10)
    return `  <url>\n    <loc>${SITE}${path}</loc>\n${date ? `    <lastmod>${date}</lastmod>\n` : ''}  </url>`
  })
  .join('\n')}
</urlset>
`
)

console.log(`built ${NAV.length + 2} pages into dist/ from ${CONTENT}`)
