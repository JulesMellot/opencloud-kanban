import type { JsonObject } from './schema'
import { SCHEMA_VERSION } from './version'

/**
 * Upgrades of the file format, one per past version: `migrations[n]` turns a version `n`
 * document into a version `n + 1` one. Version 1 is the first version, so there is none yet.
 *
 * A migration gets a copy it may change freely and must set the new `version`. It must keep
 * fields it does not know about.
 */
export type Migration = (data: JsonObject) => JsonObject

export const migrations: Record<number, Migration> = {}

export class MigrationError extends Error {
  constructor(public fromVersion: number) {
    super(`no migration from version ${fromVersion}`)
    this.name = 'MigrationError'
  }
}

/** Brings `data` (with an integer `version`) to `targetVersion`, one version at a time. */
export function migrate(
  data: JsonObject,
  targetVersion = SCHEMA_VERSION,
  steps: Record<number, Migration> = migrations
): JsonObject {
  let current = structuredClone(data)
  while ((current.version as number) < targetVersion) {
    const version = current.version as number
    const step = steps[version]
    if (!step) {
      throw new MigrationError(version)
    }
    current = step(current)
    if (current.version !== version + 1) {
      throw new MigrationError(version)
    }
  }
  return current
}
