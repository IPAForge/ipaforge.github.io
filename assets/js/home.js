// The landing page: the screen tabs, and the download button naming the visitor's system. The newest version is
// written in by the build, which runs on every release.
(() => {
  const SHOTS = {
    'install-home': {
      alt: "IPAForge's Install page: SideStore or LiveContainer with SideStore, the channel, and the install plan.",
      caption: 'Pick SideStore, or LiveContainer with SideStore, and see what the install will use before anything changes: App IDs left this week, free-app slots, the certificate and the team.'
    },
    preload: {
      alt: 'The Preload page with apps from the catalog and a chosen .ipa file, checked and ready to install.',
      caption: 'Add apps from the catalog, from sources, from a link or from .ipa files. Each one is checked against your iPhone first, then they install in one run.'
    },
    apps: {
      alt: 'The Apps page listing installed apps with when each one expires.',
      caption: 'Every app you sideloaded and when it expires. Refresh, update or remove it, or let IPAForge refresh it by itself before it expires.'
    },
    repair: {
      alt: 'Repair SideStore checking SideStore line by line.',
      caption: 'Repair SideStore checks who signed it, its certificate, its pairing file and when it expires, then fixes what keeps it from refreshing by itself.'
    },
    devices: {
      alt: 'The Devices page with the checklist for an iPhone.',
      caption: 'A checklist for each device, for its iOS version: what IPAForge sees ticks itself, what only you can see on the iPhone has a box to tick.'
    },
    'sidestore-qr': {
      alt: 'A QR code that adds a source to SideStore.',
      caption: 'Scan a code with your iPhone to add a source to SideStore, or to have SideStore install an app itself.'
    }
  }

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
    light.alt = shot.alt
    dark.src = `/img/${name}-dark.webp`
    caption.textContent = shot.caption
    panel.setAttribute('aria-labelledby', tab.id)
  }
  tabs.forEach((tab, i) => {
    tab.tabIndex = i === 0 ? 0 : -1
    tab.addEventListener('click', () => select(tab))
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
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
  if (os && label) label.textContent = 'Download for ' + os
  const button = document.getElementById('download')
  const version = button?.dataset.version
  const files = { macOS: 'mac-arm64.dmg', Windows: 'win-x64.exe' }
  if (button && version && files[os])
    button.href = `https://github.com/IPAForge/ipaforge/releases/download/v${version}/IPAForge-${version}-${files[os]}`
  const intel = document.getElementById('alt-download')
  if (intel && os === 'macOS') intel.hidden = false
})()
