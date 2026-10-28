import {
  computed,
  inject,
  provide,
  unref,
  type ComputedRef,
  type InjectionKey,
  type Ref
} from 'vue'
import type { Resource, SpaceResource } from '@opencloud-eu/web-client'
import type { BoardSync } from '../sync/boardSync'
import type { Operation } from '../model/operations'
import type { Card, KanbanDocument } from '../model/schema'
import { matchesFilters, type CardFilters } from '../model/filters'

export interface BoardContext {
  sync: BoardSync
  space: Ref<SpaceResource>
  resource: Ref<Resource>
  document: ComputedRef<KanbanDocument>
  isReadOnly: ComputedRef<boolean>
  filters: Ref<CardFilters>
  /** Cards matching the filters */
  visibleCards: ComputedRef<Card[]>
  /** Id of the card open in the side bar */
  openCardId: Ref<string | null>
  userId: ComputedRef<string>
  /** Applies a change; false if it could not be applied */
  change(operation: Operation): boolean
  openCard(cardId: string): void
}

const key: InjectionKey<BoardContext> = Symbol('kanban-board')

export function provideBoardContext(
  context: Omit<BoardContext, 'document' | 'visibleCards' | 'isReadOnly' | 'change' | 'openCard'>
) {
  const document = computed(() => unref(context.sync.document) as KanbanDocument)
  const board: BoardContext = {
    ...context,
    document,
    isReadOnly: computed(
      () => unref(context.sync.readOnly) || unref(context.sync.formatError) !== null
    ),
    visibleCards: computed(() =>
      unref(document).cards.filter((card) => matchesFilters(card, unref(context.filters)))
    ),
    change(operation) {
      return context.sync.apply(operation) === null
    },
    openCard(cardId) {
      context.openCardId.value = cardId
    }
  }
  provide(key, board)
  return board
}

export function useBoardContext() {
  const board = inject(key)
  if (!board) {
    throw new Error('useBoardContext() needs a board provided by an ancestor')
  }
  return board
}
