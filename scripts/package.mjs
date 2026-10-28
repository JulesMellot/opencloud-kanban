// Builds the release archive: a `kanban/` folder to unzip into the web apps directory of
// OpenCloud, as the official extensions are shipped, plus its checksum.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const name = `kanban-${version}.zip`
const staging = mkdtempSync(join(tmpdir(), 'opencloud-kanban-'))

try {
  cpSync(join(root, 'dist'), join(staging, 'kanban'), { recursive: true })
  rmSync(join(root, name), { force: true })
  execFileSync('zip', ['-qr', join(root, name), 'kanban'], { cwd: staging })
  const sum = createHash('sha256')
    .update(readFileSync(join(root, name)))
    .digest('hex')
  writeFileSync(join(root, 'sha256sum.txt'), `${sum}  ${name}\n`)
  console.log(`${name} ${sum}`)
} finally {
  rmSync(staging, { recursive: true, force: true })
}
