// Every page: the light/dark switch. It picks the other one of what shows now, and remembers it. Until the visitor
// picks, the site follows the system (the theme saved earlier is applied by a small script in <head>).
//
// The page's scripts read their text, in the page's language, from the JSON the build writes into #strings.
window.siteStrings = (() => {
  try {
    return JSON.parse(document.getElementById('strings')?.textContent ?? '{}')
  } catch {
    return {}
  }
})()
/** A string with its `{name}` placeholders filled in. */
window.fillString = (text, values) => String(text ?? '').replace(/\{(\w+)\}/g, (match, name) => (name in values ? values[name] : match))

;(() => {
  const strings = window.siteStrings
  const button = document.getElementById('theme')
  if (!button) return
  const root = document.documentElement
  const isDark = () => getComputedStyle(root).getPropertyValue('--show-dark').trim() === 'block'
  const label = () => button.setAttribute('aria-label', isDark() ? strings.toLight : strings.toDark)
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
