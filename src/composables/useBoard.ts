import { computed, onBeforeUnmount, onMounted, shallowRef, unref, watch, type Ref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { onBeforeRouteLeave } from 'vue-router'
import { useExternalFileUpdates, useMessages, useModals, useUserStore } from '@opencloud-eu/web-pkg'
import type { Resource } from '@opencloud-eu/web-client'
import { KanbanFormatError, parseDocument, serializeDocument } from '../model/schema'
import { operationCardId, type PendingOperation, type RebaseResult } from '../model/operations'
import { createBoardSync, GatewayError, type SyncErrorKind } from '../sync/boardSync'
import { useBoardGateway } from '../sync/useBoardGateway'
import { useDefaultBoard } from './useDefaultBoard'

/** How often the file is checked for changes made elsewhere */
export const CHECK_INTERVAL_MS = 30_000
/** How long leaving the app waits for a running save */
const LEAVE_SAVE_TIMEOUT_MS = 5_000

interface StoredChanges {
  etag: string
  operations: PendingOperation[]
}

function storageKey(fileId: string, userId: string) {
  return `kanban:unsaved:${userId}:${fileId}`
}

function readStoredChanges(key: string): StoredChanges | null {
  try {
    const value = window.localStorage.getItem(key)
    if (!value) {
      return null
    }
    const parsed = JSON.parse(value) as StoredChanges
    return Array.isArray(parsed.operations) ? parsed : null
  } catch {
    return null
  }
}

function writeStoredChanges(key: string, changes: StoredChanges | null) {
  try {
    if (changes) {
      window.localStorage.setItem(key, JSON.stringify(changes))
    } else {
      window.localStorage.removeItem(key)
    }
  } catch {
    // storage full or blocked: the changes are still on screen and being saved
  }
}

export type LoadError = KanbanFormatError | { kind: SyncErrorKind }

/**
 * Loads a board from its file and keeps it in sync: autosave, conflicts, changes made by
 * others (pushed by the server, checked every 30 seconds and when the tab is shown again),
 * and a copy of unsaved changes in the browser in case the tab is closed before they are
 * saved.
 */
export function useBoard({
  resource,
  isReadOnly
}: {
  resource: Ref<Resource>
  isReadOnly: Ref<boolean>
}) {
  const { $gettext, $ngettext } = useGettext()
  const { showMessage } = useMessages()
  const { dispatchModal } = useModals()
  const userStore = useUserStore()
  const createDefaultBoard = useDefaultBoard()
  const gateway = useBoardGateway(() => unref(resource))

  const userId = computed(() => userStore.user?.id ?? '')
  const loading = shallowRef(true)
  const loadError = shallowRef<LoadError | null>(null)

  function describeDropped(dropped: RebaseResult['dropped']) {
    const titles = new Set<string>()
    for (const { pending } of dropped) {
      const cardId = operationCardId(pending.operation)
      const card =
        pending.operation.type === 'addCard'
          ? pending.operation.card
          : unref(sync.document)?.cards.find(({ id }) => id === cardId)
      titles.add(card?.title || $gettext('Untitled card'))
    }
    return [...titles].join(', ')
  }

  function notifyDropped(dropped: RebaseResult['dropped']) {
    const cardIds = new Set(dropped.map(({ pending }) => operationCardId(pending.operation)))
    showMessage({
      title: $ngettext(
        'A change could not be applied',
        '%{count} changes could not be applied',
        dropped.length,
        { count: String(dropped.length) }
      ),
      desc: cardIds.has(null)
        ? $gettext('Someone else changed or deleted the column in the meantime.')
        : $gettext('Someone else deleted or changed it in the meantime: %{cards}', {
            cards: describeDropped(dropped)
          }),
      status: 'warning'
    })
  }

  const sync = createBoardSync({
    gateway,
    parse: (content) => parseDocument(content, createDefaultBoard),
    serialize: serializeDocument,
    context: () => ({ userId: unref(userId), now: new Date().toISOString() }),
    readOnly: unref(isReadOnly),
    onDropped: notifyDropped
  })

  watch(isReadOnly, (value) => sync.setReadOnly(value))

  const fileId = computed(() => unref(resource)?.fileId || unref(resource)?.id || '')
  const backupKey = computed(() => storageKey(unref(fileId), unref(userId)))

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      sync.start(await gateway.read())
    } catch (e) {
      if (e instanceof KanbanFormatError) {
        loadError.value = e
      } else {
        console.error('Kanban: the board could not be loaded', e)
        loadError.value = {
          kind: e instanceof GatewayError && e.kind !== 'conflict' ? e.kind : 'network'
        }
      }
      return
    } finally {
      loading.value = false
    }
    restoreBackup()
  }

  function restoreBackup() {
    const stored = readStoredChanges(unref(backupKey))
    if (!stored?.operations.length) {
      return
    }
    if (unref(sync.readOnly)) {
      // nothing to save them to, but keep them for when writing is possible again
      return
    }
    const dropped = sync.restore(stored.operations)
    showMessage({
      title: $gettext('Unsaved changes restored'),
      desc: $gettext(
        'Changes from your last visit had not been saved yet. They are being saved now.'
      )
    })
    if (dropped.length) {
      notifyDropped(dropped)
    }
  }

  // a copy of what is not saved yet survives closing the tab or a crash
  watch(sync.unsavedOperations, (operations) => {
    if (!unref(fileId) || unref(loading)) {
      return
    }
    writeStoredChanges(
      unref(backupKey),
      operations.length ? { etag: unref(sync.etag), operations } : null
    )
  })

  function check() {
    if (!unref(loading) && !unref(loadError)) {
      void sync.checkForChanges()
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      check()
    } else {
      void sync.save()
    }
  }

  function onOnline() {
    void sync.save()
    check()
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (unref(sync.hasUnsavedChanges)) {
      event.preventDefault()
    }
  }

  let interval: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    void load()
    interval = setInterval(check, CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onOnline)
    window.addEventListener('beforeunload', onBeforeUnload)
  })

  onBeforeUnmount(() => {
    if (interval) {
      clearInterval(interval)
    }
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('beforeunload', onBeforeUnload)
    void sync.save().finally(() => sync.dispose())
  })

  // the server tells about writes to the file right away, when it supports it
  useExternalFileUpdates({
    resource,
    currentETag: sync.etag,
    isActive: () => !unref(loading) && !unref(loadError),
    onExternalEvent: ({ etag }) => sync.checkForChanges(etag)
  })

  onBeforeRouteLeave(async () => {
    if (!unref(sync.hasUnsavedChanges)) {
      return true
    }
    await Promise.race([
      sync.save(),
      new Promise((resolve) => setTimeout(resolve, LEAVE_SAVE_TIMEOUT_MS))
    ])
    if (!unref(sync.hasUnsavedChanges)) {
      return true
    }
    return new Promise<boolean>((resolve) => {
      dispatchModal({
        title: $gettext('Changes not saved yet'),
        message: $gettext(
          'Some changes could not be saved yet. They are kept in this browser and saved the next time you open the board.'
        ),
        confirmText: $gettext('Leave'),
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })
  })

  return { sync, loading, loadError, reload: load, userId }
}
