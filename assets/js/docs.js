// The docs pages: the page picker on a phone, and searching and filtering the errors on Troubleshooting.
(() => {
  const picker = document.getElementById('docs-picker')
  if (picker) picker.addEventListener('change', () => (location.href = picker.value))

  // Install: the card at the top names the visitor's system and its file.
  const osCard = document.getElementById('os-card')
  if (osCard) {
    const ua = navigator.userAgent
    const os = /Mac/.test(ua)
      ? ['macOS', 'The .dmg for Apple silicon (M1 and later) or Intel']
      : /Win/.test(ua)
        ? ['Windows', 'The .exe installer, which updates itself']
        : ['Linux', 'The AppImage, or a .deb or .rpm package']
    osCard.querySelector('b').textContent = 'IPAForge for ' + os[0]
    osCard.querySelector('span').textContent = os[1]
  }

  // Troubleshooting: every error is in the page (for search engines too); this only hides the ones that don't match.
  const list = document.getElementById('errors')
  if (!list) return
  const items = [...list.querySelectorAll('.err')]
  const input = document.getElementById('q')
  const filters = [...document.querySelectorAll('.filter')]
  const count = document.getElementById('count')
  const empty = document.getElementById('empty')
  let area = ''

  const apply = () => {
    const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
    let shown = 0
    for (const item of items) {
      const text = item.dataset.text
      const match = (!area || item.dataset.area === area) && words.every((word) => text.includes(word))
      item.hidden = !match
      if (match) shown += 1
    }
    count.textContent = shown === items.length ? `${items.length} errors` : `${shown} of ${items.length} errors`
    empty.hidden = shown > 0
  }

  input.addEventListener('input', apply)
  filters.forEach((button) =>
    button.addEventListener('click', () => {
      area = button.dataset.area
      filters.forEach((other) => other.setAttribute('aria-pressed', String(other === button)))
      apply()
    })
  )
  // The sidebar's areas pick the same filter.
  document.querySelectorAll('[data-pick-area]').forEach((link) =>
    link.addEventListener('click', (event) => {
      event.preventDefault()
      filters.find((button) => button.dataset.area === link.dataset.pickArea)?.click()
      document.getElementById('top')?.scrollIntoView()
    })
  )
  // Arriving at #<code> shows that error even when a filter would hide it.
  const reveal = () => {
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)))
    if (target && target.classList.contains('err') && target.hidden) {
      input.value = ''
      filters[0].click()
      target.scrollIntoView()
    }
  }
  window.addEventListener('hashchange', reveal)
  apply()
  reveal()
})()
