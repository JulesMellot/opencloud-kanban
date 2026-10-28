<template>
  <section
    :id="`kanban-column-${column.id}`"
    class="kanban-column kb:flex kb:w-full kb:shrink-0 kb:flex-col kb:rounded-xl kb:border kb:border-role-outline-variant kb:bg-role-surface kb:sm:max-h-full kb:sm:w-72"
    :aria-labelledby="`kanban-column-title-${column.id}`"
    :data-column-id="column.id"
  >
    <header class="kb:flex kb:items-center kb:gap-2 kb:py-1 kb:pl-3 kb:pr-1">
      <column-color-dot :color="color" />
      <h2
        :id="`kanban-column-title-${column.id}`"
        class="kanban-column-title kb:m-0 kb:min-w-0 kb:flex-1 kb:truncate kb:text-base kb:font-semibold"
        v-text="column.title"
      />
      <span
        class="kanban-column-count kb:rounded-full kb:bg-role-surface-container-highest kb:px-2 kb:text-sm kb:text-role-on-surface-variant"
        :aria-label="countLabel"
        v-text="countText"
      />
      <kanban-menu
        v-if="menuSections.length"
        :label="$gettext('Actions for the column »%{title}«', { title: column.title })"
        :title="column.title"
        :sections="menuSections"
      />
    </header>
    <ol
      class="kanban-column-cards kb:m-0 kb:flex kb:min-h-14 kb:flex-1 kb:flex-col kb:gap-2 kb:overflow-y-auto kb:p-2 kb:pt-1"
      data-drop-zone="column"
      :data-column-id="column.id"
      data-drag-scroll
      :aria-label="$gettext('Cards in »%{title}«', { title: column.title })"
    >
      <template v-for="(item, position) in rows" :key="item.key">
        <li
          v-if="item.kind === 'placeholder'"
          class="kanban-drop-placeholder kb:list-none kb:rounded-md kb:border-2 kb:border-dashed kb:border-role-outline-variant kb:bg-role-surface-container-low"
          :style="{ height: `${draggedHeight}px` }"
          aria-hidden="true"
        />
        <board-card
          v-else
          :card="item.card"
          :is-dragged="item.card.id === draggedId"
          :data-position="position"
          @drag-start="$emit('dragStart', $event, item.card.id)"
        />
      </template>
      <li
        v-if="!cards.length && dropIndex === null"
        class="kanban-column-empty kb:list-none kb:rounded-md kb:border kb:border-dashed kb:border-role-outline-variant kb:px-3 kb:py-4 kb:text-center kb:text-sm kb:text-role-on-surface-variant"
        v-text="totalCount ? $gettext('No card matches the filters') : $gettext('No cards yet')"
      />
    </ol>
    <quick-add-card v-if="!isReadOnly" ref="quickAdd" :column-id="column.id" />
  </section>
</template>

<script setup lang="ts">
import { computed, unref, useTemplateRef } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Action, MenuSection } from '@opencloud-eu/web-pkg'
import { columnColor, type Card, type Column } from '../../model/schema'
import { useBoardContext } from '../../composables/useBoardContext'
import { useBoardActions } from '../../composables/useBoardActions'
import KanbanMenu from '../KanbanMenu.vue'
import BoardCard from './BoardCard.vue'
import ColumnColorDot from './ColumnColorDot.vue'
import QuickAddCard from './QuickAddCard.vue'

const {
  column,
  cards,
  totalCount,
  dropIndex = null,
  draggedId = null,
  draggedHeight = 0
} = defineProps<{
  column: Column
  /** Visible cards, in order */
  cards: Card[]
  /** Cards in the column, filtered or not */
  totalCount: number
  /** Where a dragged card would land, counted without it */
  dropIndex?: number | null
  draggedId?: string | null
  draggedHeight?: number
}>()
defineEmits<{ dragStart: [event: PointerEvent, cardId: string] }>()

const { $gettext, $ngettext } = useGettext()
const { document, isReadOnly } = useBoardContext()
const actions = useBoardActions()
const quickAdd = useTemplateRef<InstanceType<typeof QuickAddCard>>('quickAdd')

const color = computed(() => columnColor(column))

type Row = { kind: 'card'; key: string; card: Card } | { kind: 'placeholder'; key: string }

/** The cards, with the drop placeholder where a dragged card would land */
const rows = computed<Row[]>(() => {
  const result: Row[] = []
  let position = 0
  for (const card of cards) {
    if (card.id !== draggedId) {
      if (position === dropIndex) {
        result.push({ kind: 'placeholder', key: 'placeholder' })
      }
      position++
    }
    result.push({ kind: 'card', key: card.id, card })
  }
  if (dropIndex !== null && dropIndex >= position) {
    result.push({ kind: 'placeholder', key: 'placeholder' })
  }
  return result
})

const isFiltered = computed(() => cards.length !== totalCount)
const countText = computed(() =>
  unref(isFiltered) ? `${cards.length} / ${totalCount}` : String(totalCount)
)
const countLabel = computed(() =>
  unref(isFiltered)
    ? $gettext('%{shown} of %{total} cards shown', {
        shown: String(cards.length),
        total: String(totalCount)
      })
    : $ngettext('%{count} card', '%{count} cards', totalCount, { count: String(totalCount) })
)

function action(name: string, icon: string, label: string, handler: () => void): Action {
  return { name, icon, label: () => label, handler, isVisible: () => true }
}

const menuSections = computed<MenuSection[]>(() => {
  if (unref(isReadOnly)) {
    return []
  }
  const columns = unref(document).columns
  const index = columns.findIndex(({ id }) => id === column.id)
  return [
    {
      name: 'primary',
      items: [
        action('kanban-add-card', 'add', $gettext('Add a card'), () => quickAdd.value?.open()),
        action('kanban-rename-column', 'edit', $gettext('Rename'), () =>
          actions.renameColumn(column)
        ),
        action('kanban-color-column', 'palette', $gettext('Change color'), () =>
          actions.recolorColumn(column)
        )
      ]
    },
    {
      name: 'secondary',
      items: [
        ...(index > 0
          ? [
              action('kanban-move-column-left', 'arrow-left', $gettext('Move left'), () =>
                actions.shiftColumn(column, -1)
              )
            ]
          : []),
        ...(index < columns.length - 1
          ? [
              action('kanban-move-column-right', 'arrow-right', $gettext('Move right'), () =>
                actions.shiftColumn(column, 1)
              )
            ]
          : []),
        action('kanban-add-column-after', 'add', $gettext('Add a column after'), () =>
          actions.addColumn(column.id)
        )
      ]
    },
    {
      name: 'tertiary',
      items: [
        action('kanban-delete-column', 'delete-bin', $gettext('Delete column'), () =>
          actions.deleteColumn(column)
        )
      ]
    }
  ]
})
</script>
