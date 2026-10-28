import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import translations from '../../l10n/translations.json'

type Messages = Record<string, string | string[]>
const french = translations.fr as Messages

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : /\.(ts|vue)$/.test(path) ? [path] : []
  })
}

function literal(source: string) {
  const parsed = ts.createSourceFile('message.ts', source, ts.ScriptTarget.Latest)
  const statement = parsed.statements[0] as ts.ExpressionStatement
  return (statement.expression as ts.StringLiteral).text
}

/** Every message of the sources: singular ones, and the singular form of plural ones */
function messages() {
  const found: { file: string; key: string; plural: boolean }[] = []
  for (const file of sourceFiles('src')) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(
      /\$(n?)gettext\(\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g
    )) {
      found.push({ file, key: literal(match[2]), plural: match[1] === 'n' })
    }
  }
  return found
}

it('has a French translation for every message', () => {
  const missing = messages()
    .filter(({ key, plural }) => {
      const translation = french[key]
      return plural
        ? !Array.isArray(translation) || translation.length !== 2
        : typeof translation !== 'string'
    })
    .map(({ file, key }) => `${file}: ${key}`)
  expect(missing).toEqual([])
})

it('keeps no translation that is not used anymore', () => {
  const used = new Set(messages().map(({ key }) => key))
  expect(Object.keys(french).filter((key) => !used.has(key))).toEqual([])
})

it('keeps the interpolation parameters of every message', () => {
  const placeholders = (value: string) =>
    [...value.matchAll(/%{\s*[^}]+}/g)].map(([m]) => m.replace(/\s/g, '')).sort()
  for (const [key, value] of Object.entries(french)) {
    for (const text of Array.isArray(value) ? value : [value]) {
      expect(text.trim(), key).not.toBe('')
      if (Array.isArray(value)) {
        // the forms of a plural may use the count the singular message leaves out
        const allowed = new Set([...placeholders(key), '%{count}'])
        expect(
          placeholders(text).filter((p) => !allowed.has(p)),
          key
        ).toEqual([])
      } else {
        expect(placeholders(text), key).toEqual(placeholders(key))
      }
    }
  }
})
