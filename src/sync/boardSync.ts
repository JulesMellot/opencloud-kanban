/**
 * Keeps a board in sync with its file while several people edit it.
 *
 * The file on the server is the only shared state. Locally there is the last version read
 * from or written to it (`base`, with its etag) and the changes made since, as operations.
 * What the user sees is always `base` with those operations applied.
 *
 * Saving writes that result with `If-Match: <etag of base>`. When someone else wrote the
 * file in the meantime (412), the newer version becomes the base, the operations are replayed
 * on it and the save is tried again. An operation that no longer applies (its card was
 * deleted, …) is dropped and reported. Nothing is ever written over a version that was not
 * read first, and nothing is written at all once the file stopped being a valid board.
 */
import { computed, shallowRef } from 'vue'
import {
  applyOperation,
  rebase,
  type FailureReason,
  type Operation,
  type OperationContext,
  type PendingOperation,
  type RebaseResult
} from '../model/operations'
import { KanbanFormatError, type KanbanDocument } from '../model/schema'

export interface BoardFile {
  content: string
  etag: string
}

/** Access to the board file, see `useBoardGateway` for the WebDAV one. */
export interface BoardGateway {
  read(): Promise<BoardFile>
  /** Writes `content` if the file still has `etag`, returns the new etag. */
  write(content: string, etag: string): Promise<string>
  /** Current etag of the file, without its content */
  etag(): Promise<string>
}

export type SyncErrorKind =
  /** The server or the network failed; retried automatically */
  | 'network'
  /** The file is locked by another application; retried automatically */
  | 'locked'
  /** No space left; retried automatically */
  | 'quota'
  /** Saving is not allowed (anymore) */
  | 'forbidden'
  /** The file is gone */
  | 'notFound'

/** An error a {@link BoardGateway} throws; anything else counts as `network`. */
export class GatewayError extends Error {
  constructor(
    public kind: SyncErrorKind | 'conflict',
    public status = 0
  ) {
    super(kind)
    this.name = 'GatewayError'
  }
}

export type SaveStatus = 'saved' | 'saving' | 'error'

export interface BoardSyncOptions {
  gateway: BoardGateway
  parse(content: string): KanbanDocument
  serialize(document: KanbanDocument): string
  /** Who is making a change, and when */
  context(): OperationContext
  readOnly?: boolean
  /** Local changes that had to be given up after someone else's change */
  onDropped?(dropped: RebaseResult['dropped']): void
  /** Wait after the last change before saving */
  debounceMs?: number
  /** Waits between attempts after a failed save; the last one repeats */
  retryDelaysMs?: number[]
  /** Saves in a row that may hit a conflict before giving up for a while */
  maxConflictRetries?: number
}

function errorKind(error: unknown): SyncErrorKind | 'conflict' | 'format' {
  if (error instanceof KanbanFormatError) {
    return 'format'
  }
  if (error instanceof GatewayError) {
    return error.kind
  }
  return 'network'
}

function sameEtag(a: string, b: string) {
  const normalize = (etag: string) => etag.replace(/^W\//, '').replace(/"/g, '')
  return normalize(a) === normalize(b)
}

export function createBoardSync(options: BoardSyncOptions) {
  const {
    gateway,
    parse,
    serialize,
    context,
    onDropped = () => undefined,
    debounceMs = 800,
    retryDelaysMs = [2_000, 5_000, 10_000, 30_000, 60_000],
    maxConflictRetries = 5
  } = options

  const base = shallowRef<KanbanDocument | null>(null)
  const baseEtag = shallowRef('')
  /** Changes being written right now */
  const inFlight = shallowRef<PendingOperation[]>([])
  /** Changes made since, or not written yet */
  const pending = shallowRef<PendingOperation[]>([])
  const document = shallowRef<KanbanDocument | null>(null)
  const status = shallowRef<SaveStatus>('saved')
  const error = shallowRef<SyncErrorKind | null>(null)
  /** Set when the file on the server is no longer a valid board: syncing stops */
  const formatError = shallowRef<KanbanFormatError | null>(null)
  const readOnly = shallowRef(Boolean(options.readOnly))

  const hasUnsavedChanges = computed(() => inFlight.value.length > 0 || pending.value.length > 0)
  const isStopped = computed(() => formatError.value !== null || error.value === 'notFound')

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let failedAttempts = 0
  let disposed = false
  /** Saves and reloads run one after the other */
  let queue: Promise<unknown> = Promise.resolve()

  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task)
    queue = run.catch(() => undefined)
    return run
  }

  function refreshDocument() {
    if (!base.value) {
      return
    }
    document.value = rebase(base.value, [...inFlight.value, ...pending.value]).document
  }

  function load(file: BoardFile) {
    base.value = parse(file.content)
    baseEtag.value = file.etag
    refreshDocument()
  }

  /** Makes `file` the new base and replays the local changes on it. */
  function adopt(file: BoardFile) {
    let fresh: KanbanDocument
    try {
      fresh = parse(file.content)
    } catch (e) {
      // somebody replaced the board with something else: keep what is on screen, write nothing
      formatError.value = e instanceof KanbanFormatError ? e : new KanbanFormatError('invalid')
      return
    }
    base.value = fresh
    baseEtag.value = file.etag
    const result = rebase(fresh, [...inFlight.value, ...pending.value])
    inFlight.value = []
    pending.value = result.kept
    document.value = result.document
    if (result.dropped.length) {
      onDropped(result.dropped)
    }
  }

  function clearTimers() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  function scheduleSave(delay = debounceMs) {
    if (disposed || readOnly.value || isStopped.value) {
      return
    }
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      saveTimer = null
      void save()
    }, delay)
  }

  function scheduleRetry() {
    if (disposed || retryTimer) {
      return
    }
    const delay = retryDelaysMs[Math.min(failedAttempts - 1, retryDelaysMs.length - 1)]
    retryTimer = setTimeout(() => {
      retryTimer = null
      void save()
    }, delay)
  }

  function fail(kind: SyncErrorKind) {
    // the changes stay local, on screen, until a save goes through
    pending.value = [...inFlight.value, ...pending.value]
    inFlight.value = []
    error.value = kind
    status.value = 'error'
    failedAttempts++
    if (kind === 'forbidden') {
      readOnly.value = true
      return
    }
    if (kind !== 'notFound') {
      scheduleRetry()
    }
  }

  async function writeOnce(): Promise<'done' | 'conflict'> {
    inFlight.value = pending.value
    pending.value = []
    const target = rebase(base.value as KanbanDocument, inFlight.value)
    const content = serialize(target.document)
    try {
      const etag = await gateway.write(content, baseEtag.value)
      base.value = target.document
      baseEtag.value = etag
      inFlight.value = []
      return 'done'
    } catch (e) {
      if (errorKind(e) !== 'conflict') {
        throw e
      }
      adopt(await gateway.read())
      return 'conflict'
    }
  }

  /** Writes the local changes now. Resolves once they are saved, or saving failed. */
  function save(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    return serialized(async () => {
      if (disposed || readOnly.value || isStopped.value || !pending.value.length || !base.value) {
        if (!hasUnsavedChanges.value) {
          status.value = 'saved'
        }
        return
      }
      status.value = 'saving'
      try {
        let conflicts = 0
        while (pending.value.length && !isStopped.value) {
          if ((await writeOnce()) === 'conflict' && ++conflicts > maxConflictRetries) {
            throw new GatewayError('network', 412)
          }
        }
        if (isStopped.value) {
          status.value = 'error'
          return
        }
        failedAttempts = 0
        error.value = null
        if (retryTimer) {
          clearTimeout(retryTimer)
          retryTimer = null
        }
        status.value = pending.value.length ? 'saving' : 'saved'
      } catch (e) {
        const kind = errorKind(e)
        fail(kind === 'conflict' || kind === 'format' ? 'network' : kind)
      }
    })
  }

  return {
    document,
    status,
    error,
    formatError,
    readOnly,
    hasUnsavedChanges,
    /** Etag of the version on screen, minus the local changes */
    etag: baseEtag,

    /** Shows the board read from the file; throws a KanbanFormatError if it is none. */
    start(file: BoardFile) {
      load(file)
      status.value = 'saved'
    },

    /** Applies a change locally right away and saves it shortly after. */
    apply(operation: Operation): FailureReason | 'readOnly' | null {
      if (!document.value || readOnly.value || isStopped.value) {
        return 'readOnly'
      }
      const item: PendingOperation = { operation, context: context() }
      const result = applyOperation(document.value, operation, item.context)
      if (!result.ok) {
        return result.reason
      }
      pending.value = [...pending.value, item]
      document.value = result.document
      if (status.value !== 'error') {
        status.value = 'saving'
      }
      scheduleSave()
      return null
    },

    save,

    /**
     * Looks for a newer version of the file and shows it, with the local changes on top.
     * Cheap when nothing changed: only the etag is fetched.
     */
    checkForChanges(knownEtag?: string): Promise<void> {
      return serialized(async () => {
        if (disposed || isStopped.value || !base.value) {
          return
        }
        try {
          const etag = knownEtag ?? (await gateway.etag())
          if (sameEtag(etag, baseEtag.value)) {
            return
          }
          adopt(await gateway.read())
          if (pending.value.length) {
            scheduleSave(0)
          }
        } catch (e) {
          const kind = errorKind(e)
          if (kind === 'notFound') {
            error.value = 'notFound'
            status.value = 'error'
          }
          // anything else: try again at the next check
        }
      })
    },

    /** Local changes not known to be saved yet, oldest first */
    unsavedOperations: computed(() => [...inFlight.value, ...pending.value]),

    /**
     * Puts changes saved aside earlier (e.g. before the tab was closed) on top of the board
     * and saves them. Returns the ones that no longer apply.
     */
    restore(operations: PendingOperation[]): RebaseResult['dropped'] {
      if (!document.value || readOnly.value || isStopped.value || !operations.length) {
        return []
      }
      const result = rebase(document.value, operations)
      pending.value = [...pending.value, ...result.kept]
      document.value = result.document
      if (result.kept.length) {
        status.value = 'saving'
        scheduleSave(0)
      }
      return result.dropped
    },

    setReadOnly(value: boolean) {
      readOnly.value = value
      if (!value && pending.value.length) {
        scheduleSave()
      }
    },

    /** The board as shown, local changes included, as file content. */
    exportContent() {
      return document.value ? serialize(document.value) : ''
    },

    dispose() {
      disposed = true
      clearTimers()
    }
  }
}

export type BoardSync = ReturnType<typeof createBoardSync>
