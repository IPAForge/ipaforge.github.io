// The landing page: the screen tabs, and the download button naming the visitor's system. The newest version is
// written in by the build, which runs on every release.
(() => {
  // Each screen's alt text and caption, in the page's language (written in by the build).
  const strings = window.siteStrings
  const SHOTS = strings.shots ?? {}

  const tabs = [...document.querySelectorAll('.tab')]
  const light = document.getElementById('shot-l')
  const dark = document.getElementById('shot-d')
  const caption = document.getElementById('caption')
  const panel = document.getElementById('panel')
  const select = (tab) => {
    const name = tab.dataset.shot
    const shot = SHOTS[name]
    tabs.forEach((t) => {
      t.setAttribute('aria-selected', String(t === tab))
      t.tabIndex = t === tab ? 0 : -1
    })
    light.src = `/img/${name}.webp`
    light.alt = shot?.alt ?? ''
    dark.src = `/img/${name}-dark.webp`
    caption.textContent = shot?.caption ?? ''
    panel.setAttribute('aria-labelledby', tab.id)
  }
  tabs.forEach((tab, i) => {
    tab.tabIndex = i === 0 ? 0 : -1
    tab.addEventListener('click', () => select(tab))
    tab.addEventListener('keydown', (event) => {
      // In a right-to-left page the next tab is on the left.
      const rtl = document.documentElement.dir === 'rtl'
      const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key]
      if (!step) return
      event.preventDefault()
      const next = tabs[(i + step + tabs.length) % tabs.length]
      next.focus()
      select(next)
    })
  })

  // The download button names the visitor's system and, on a Mac or Windows, downloads its file straight away (the
  // Apple silicon build on a Mac, with a link to the Intel one). Linux has several packages: the release page.
  const ua = navigator.userAgent
  const os = /Mac/.test(ua) ? 'macOS' : /Win/.test(ua) ? 'Windows' : /Linux|X11/.test(ua) && !/Android/.test(ua) ? 'Linux' : ''
  const label = document.getElementById('download-label')
  if (os && label) label.textContent = window.fillString(strings.downloadFor, { os })
  const button = document.getElementById('download')
  const version = button?.dataset.version
  const files = { macOS: 'mac-arm64.dmg', Windows: 'win-x64.exe' }
  if (button && version && files[os])
    button.href = `https://github.com/IPAForge/ipaforge/releases/download/v${version}/IPAForge-${version}-${files[os]}`
  const intel = document.getElementById('alt-download')
  if (intel && os === 'macOS') intel.hidden = false
})()
