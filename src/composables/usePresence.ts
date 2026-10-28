import { computed, onBeforeUnmount, shallowRef, unref, watch, type Ref } from 'vue'
import {
  useConfigStore,
  useYjsSession,
  YjsStatus,
  type YjsAdapter,
  type YjsCollaborator,
  type YjsSession
} from '@opencloud-eu/web-pkg'
import type { Resource } from '@opencloud-eu/web-client'

type Awareness = NonNullable<YjsSession['awareness']['value']>

export interface Viewer extends YjsCollaborator {
  /** The card this person has open, if any */
  cardId: string | null
}

/** Name of the awareness field this app publishes, next to the `user` the server stamps */
const FIELD = 'kanban'

/**
 * The board itself is synced through its file. The Yjs room only tells who has the board
 * open and which card they look at, so its document holds nothing but a marker.
 */
const presenceAdapter: YjsAdapter = {
  hydrate(ydoc) {
    ydoc.getMap(FIELD).set('presence', true)
  },
  serialize() {
    return ''
  },
  hasContent(ydoc) {
    return ydoc.getMap(FIELD).has('presence')
  },
  reset(ydoc) {
    ydoc.getMap(FIELD).delete('presence')
  }
}

/** Everyone in the room once, from the awareness states of all their tabs */
export function readViewers(awareness: Pick<Awareness, 'getStates' | 'clientID'>): Viewer[] {
  const viewers = new Map<string, Viewer>()
  for (const [clientId, state] of awareness.getStates()) {
    const user = state.user as { id?: string; name?: string; color?: string } | undefined
    if (!user?.id) {
      continue
    }
    const isSelf = clientId === awareness.clientID
    const cardId = (state[FIELD] as { cardId?: string | null } | undefined)?.cardId ?? null
    const known = viewers.get(user.id)
    // one person in several tabs counts once; their own tab wins for "is self"
    if (!known || isSelf) {
      viewers.set(user.id, {
        id: user.id,
        name: user.name ?? user.id,
        color: user.color ?? '',
        isSelf: isSelf || Boolean(known?.isSelf),
        cardId: cardId ?? known?.cardId ?? null
      })
    }
  }
  return [...viewers.values()].sort(
    (a, b) => Number(b.isSelf) - Number(a.isSelf) || a.name.localeCompare(b.name)
  )
}

/**
 * Who else has the board open, through the Yjs server of OpenCloud when one is configured
 * (`options.yjsServerUrl`). Without it everything here stays empty and the board works the
 * same, only without seeing the others.
 */
export function usePresence({
  resource,
  enabled,
  openCardId
}: {
  resource: Ref<Resource>
  enabled: () => boolean
  openCardId: Ref<string | null>
}) {
  const configStore = useConfigStore()
  const viewers = shallowRef<Viewer[]>([])
  const isAvailable = computed(() => Boolean(configStore.options.yjsServerUrl))

  const session = useYjsSession({
    resource,
    currentContent: () => '',
    enabled: () => unref(isAvailable) && enabled(),
    // nothing is ever written to the room: no seeding, no recovery
    isReadOnly: () => true,
    adapter: presenceAdapter,
    documentPrefix: 'kanban-presence',
    onContentChange: () => undefined,
    onServerContentChange: () => undefined,
    onEtagChange: () => undefined,
    hasUnsavedChanges: () => false,
    onConflict: () => undefined
  })

  let detach: (() => void) | null = null

  watch(
    session.awareness,
    (awareness) => {
      detach?.()
      detach = null
      viewers.value = []
      if (!awareness) {
        return
      }
      const update = () => {
        viewers.value = readViewers(awareness)
      }
      awareness.setLocalStateField(FIELD, { cardId: unref(openCardId) })
      awareness.on('change', update)
      update()
      detach = () => awareness.off('change', update)
    },
    { immediate: true }
  )

  watch(openCardId, (cardId) => {
    unref(session.awareness)?.setLocalStateField(FIELD, { cardId })
  })

  onBeforeUnmount(() => detach?.())

  const isConnected = computed(() => unref(session.status) === YjsStatus.Connected)
  const others = computed(() => unref(viewers).filter(({ isSelf }) => !isSelf))

  return {
    isAvailable,
    isConnected,
    /** Everyone on the board, this user first */
    viewers: computed(() => (unref(isConnected) ? unref(viewers) : [])),
    /** Other people looking at a card */
    viewersOf: (cardId: string) =>
      unref(isConnected) ? unref(others).filter((viewer) => viewer.cardId === cardId) : []
  }
}

export type Presence = ReturnType<typeof usePresence>
