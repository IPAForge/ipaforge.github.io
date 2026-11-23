// The site's languages: one `<code>.json` next to this file per language, English (`en.json`) the source. English is
// at the root (`/faq/`), every other language under its code (`/de/faq/`). A string missing from a language falls
// back to English, so a new string can land in English first.
//
// The files come from Weblate, which adds a language's file as soon as someone starts it. A language is published only
// once it is mostly translated (MIN_COMPLETION), so the site never offers a page that is English under another name.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'en'
const RTL = new Set(['ar', 'he', 'fa', 'ur'])

const load = (code) => JSON.parse(readFileSync(join(DIR, `${code}.json`), 'utf8'))

/** The share of English's strings a language needs before the site publishes it. */
const MIN_COMPLETION = 0.9

/** Whether `code` is a language tag the browser and Intl understand (Weblate can also name variants like `pt-BR@formal`). */
const isLanguageTag = (code) => {
  try {
    return Intl.getCanonicalLocales(code).length === 1
  } catch {
    return false
  }
}

const files = readdirSync(DIR)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''))
  .filter(isLanguageTag)
  .sort((a, b) => (a === SOURCE ? -1 : b === SOURCE ? 1 : a.localeCompare(b)))

const STRINGS = Object.fromEntries(files.map((code) => [code, load(code)]))

/** Every string in a tree of strings, by its path (`home.hero.lede`, `faq.items.0.q`). */
const leaves = (node, path = '') =>
  typeof node === 'string'
    ? [[path, node]]
    : Object.entries(node ?? {}).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key))

const english = leaves(STRINGS[SOURCE])

/** The share of English's strings `code` has translated (a missing or empty one isn't). */
export const completion = (code) => {
  const own = new Map(leaves(STRINGS[code]))
  return english.filter(([path]) => own.get(path)).length / english.length
}

/** The languages the site publishes: English, and every language translated far enough. */
const codes = files.filter((code) => code === SOURCE || completion(code) >= MIN_COMPLETION)
/** The languages with a file that isn't published yet, with how far each is, for the build's log. */
export const UNPUBLISHED = files
  .filter((code) => !codes.includes(code))
  .map((code) => ({ code, completion: completion(code) }))

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
