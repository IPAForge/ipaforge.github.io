// The site's languages: one `<code>.json` next to this file per language, English (`en.json`) the source. English is
// at the root (`/faq/`), every other language under its code (`/de/faq/`). A string missing from a language falls
// back to English, so a new string can land in English first.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'en'
const RTL = new Set(['ar', 'he', 'fa', 'ur'])

const load = (code) => JSON.parse(readFileSync(join(DIR, `${code}.json`), 'utf8'))

const codes = readdirSync(DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''))
  .sort((a, b) => (a === SOURCE ? -1 : b === SOURCE ? 1 : a.localeCompare(b)))

const STRINGS = Object.fromEntries(codes.map((code) => [code, load(code)]))

/** A language's name in itself ("Deutsch", "日本語"), capitalised as it starts a menu entry. */
export const nativeName = (code) => {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
  return name.charAt(0).toLocaleUpperCase(code) + name.slice(1)
}

/** Open Graph's `language_TERRITORY` (`de_DE`), from the language's most likely region. */
const ogLocale = (code) => {
  const locale = new Intl.Locale(code).maximize()
  return `${locale.language}_${locale.region ?? 'US'}`
}

export const LANGUAGES = codes.map((code) => ({
  code,
  name: nativeName(code),
  dir: RTL.has(new Intl.Locale(code).language) ? 'rtl' : 'ltr',
  ogLocale: ogLocale(code)
}))

const lookup = (tree, key) => key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), tree)

/** The string at `key` in `lang` (English when the language lacks it), with `{name}` placeholders filled in. */
export const t = (lang, key, values = {}) => {
  const found = lookup(STRINGS[lang], key) ?? lookup(STRINGS[SOURCE], key)
  if (found === undefined) throw new Error(`no string ${key}`)
  if (typeof found !== 'string') return found
  return found.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match))
}

/** Whether the language has the string itself (not through English). */
export const has = (lang, key) => lookup(STRINGS[lang], key) !== undefined

/** The site path for `path` in `lang`: `/faq/` → `/de/faq/`; English keeps it. */
export const localePath = (lang, path) => (lang === SOURCE ? path : `/${lang}${path}`)
