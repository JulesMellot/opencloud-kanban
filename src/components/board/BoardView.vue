<template>
  <div class="kanban-board ext:flex ext:flex-col">
    <no-content-message
      v-if="!columns.length"
      id="kanban-board-empty"
      class="ext:flex-1"
      :icon="{ name: 'kanban-view-2', fillType: 'none' }"
    >
      <template #message>
        <span v-text="$gettext('This board has no columns')" />
      </template>
      <template #callToAction>
        <oc-button
          v-if="!isReadOnly"
          appearance="filled"
          color-role="secondaryContainer"
          @click="actions.addColumn(null)"
        >
          <oc-icon name="add" fill-type="line" />
          <span v-text="$gettext('Add a column')" />
        </oc-button>
      </template>
    </no-content-message>
    <div
      v-else
      class="kanban-board-columns ext:flex ext:min-h-0 ext:flex-1 ext:flex-col ext:gap-3 ext:overflow-y-auto ext:px-4 ext:pb-4 ext:sm:flex-row ext:sm:items-start ext:sm:overflow-x-auto ext:sm:overflow-y-hidden"
      data-drag-scroll
    >
      <board-column
        v-for="column in columns"
        :key="column.id"
        :column="column"
        :cards="visibleByColumn.get(column.id) ?? []"
        :total-count="allByColumn.get(column.id)?.length ?? 0"
        :drop-index="dropIndexFor(column.id)"
        :dragged-id="draggedId"
        :dragged-height="draggedHeight"
        @drag-start="onPointerDown"
      />
      <div v-if="!isReadOnly" class="ext:shrink-0 ext:sm:w-72">
        <oc-button
          appearance="raw"
          justify-content="left"
          gap-size="small"
          class="kanban-add-column ext:w-full ext:rounded-xl ext:border ext:border-dashed ext:border-role-outline-variant ext:px-3 ext:py-2.5 ext:text-role-on-surface-variant"
          @click="actions.addColumn(columns.at(-1)?.id ?? null)"
        >
          <oc-icon name="add" fill-type="line" />
          <span v-text="$gettext('Add a column')" />
        </oc-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import { NoContentMessage } from '@opencloud-eu/web-pkg'
import { byOrder, placementAt } from '../../model/order'
import type { Card } from '../../model/schema'
import { useBoardContext } from '../../composables/useBoardContext'
import { useBoardActions } from '../../composables/useBoardActions'
import { useCardDrag, type DropTarget } from '../../composables/useCardDrag'
import BoardColumn from './BoardColumn.vue'

const board = useBoardContext()
const { document, visibleCards, isReadOnly } = board
const actions = useBoardActions()

const columns = computed(() => unref(document).columns)

/** Cards by column, in order; cards of a column that no longer exists show in the first one */
function group(cards: readonly Card[]) {
  const ids = new Set(unref(columns).map(({ id }) => id))
  const fallback = unref(columns)[0]?.id
  const result = new Map<string, Card[]>()
  for (const card of [...cards].sort(byOrder)) {
    const columnId = ids.has(card.columnId) ? card.columnId : fallback
    if (columnId) {
      result.set(columnId, [...(result.get(columnId) ?? []), card])
    }
  }
  return result
}

const allByColumn = computed(() => group(unref(document).cards))
const visibleByColumn = computed(() => group(unref(visibleCards)))

function onDrop(cardId: string, target: DropTarget) {
  if (target.kind !== 'column') {
    return
  }
  const card = unref(document).cards.find(({ id }) => id === cardId)
  if (!card) {
    return
  }
  // placed between its visible neighbours, which is what the user saw
  const visible = (unref(visibleByColumn).get(target.columnId) ?? []).filter(
    ({ id }) => id !== cardId
  )
  const placement = placementAt(visible, target.index)
  const current = unref(visibleByColumn).get(card.columnId) ?? []
  const currentIndex = current.findIndex(({ id }) => id === cardId)
  if (
    card.columnId === target.columnId &&
    (current[currentIndex - 1]?.id ?? null) === placement.afterId &&
    (current[currentIndex + 1]?.id ?? null) === placement.beforeId
  ) {
    return
  }
  board.change({ type: 'moveCard', cardId, columnId: target.columnId, placement })
}

const { draggedId, draggedHeight, dropTarget, onPointerDown } = useCardDrag({
  isEnabled: () => !unref(isReadOnly),
  onDrop
})

function dropIndexFor(columnId: string) {
  const target = unref(dropTarget)
  return target?.kind === 'column' && target.columnId === columnId ? target.index : null
}
</script>
