// Every page: the light/dark switch. It picks the other one of what shows now, and remembers it. Until the visitor
// picks, the site follows the system (the theme saved earlier is applied by a small script in <head>).
(() => {
  const button = document.getElementById('theme')
  if (!button) return
  const root = document.documentElement
  const isDark = () => getComputedStyle(root).getPropertyValue('--show-dark').trim() === 'block'
  const label = () => button.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode')
  const themeColor = () => {
    const color = getComputedStyle(document.body).backgroundColor
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', color))
  }

  button.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark'
    root.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {}
    label()
    themeColor()
  })
  label()
  if (root.dataset.theme) themeColor()
})()
