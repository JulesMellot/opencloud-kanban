import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : /\.(ts|vue)$/.test(path) ? [path] : []
  })
}

// `ext:` utilities are shared by every extension built with the SDK, the last stylesheet loaded
// wins over ours (see src/styles.css)
it('uses only its own Tailwind prefix', () => {
  const offending = sourceFiles('src').filter((file) =>
    /(?<![\w-])ext:[a-z]/.test(readFileSync(file, 'utf8'))
  )
  expect(offending).toEqual([])
})
