<template>
  <section
    class="kanban-undated kb:flex kb:min-h-0 kb:flex-col kb:rounded-xl kb:border kb:border-role-outline-variant"
    :class="{ 'kb:bg-role-secondary-container/40': isDropTarget }"
    aria-labelledby="kanban-undated-title"
    data-drop-zone="undated"
  >
    <header class="kb:flex kb:items-center kb:gap-2 kb:px-3 kb:py-2">
      <h2
        id="kanban-undated-title"
        class="kb:m-0 kb:flex-1 kb:text-base kb:font-semibold"
        v-text="$gettext('No date')"
      />
      <span
        class="kb:rounded-full kb:bg-role-surface-container-highest kb:px-2 kb:text-sm kb:text-role-on-surface-variant"
        :aria-label="
          $ngettext('%{count} card', '%{count} cards', cards.length, {
            count: String(cards.length)
          })
        "
        v-text="cards.length"
      />
    </header>
    <p
      v-if="!isReadOnly && cards.length"
      class="kb:m-0 kb:px-3 kb:pb-2 kb:text-sm kb:text-role-on-surface-variant"
      v-text="$gettext('Drag a card onto a day to plan it.')"
    />
    <ol
      class="kb:m-0 kb:flex kb:min-h-14 kb:flex-1 kb:list-none kb:flex-col kb:gap-1 kb:overflow-y-auto kb:p-2 kb:pt-0"
      data-drag-scroll
    >
      <calendar-entry
        v-for="card in cards"
        :key="card.id"
        :card="card"
        :show-time="false"
        :compact="false"
        :is-dragged="card.id === draggedId"
        @drag-start="$emit('dragStart', $event, card.id)"
      />
      <li
        v-if="!cards.length"
        class="kb:list-none kb:rounded-md kb:border kb:border-dashed kb:border-role-outline-variant kb:px-3 kb:py-4 kb:text-center kb:text-sm kb:text-role-on-surface-variant"
        v-text="$gettext('Every card has a publication date')"
      />
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '../../model/schema'
import type { DropTarget } from '../../composables/useCardDrag'
import { useBoardContext } from '../../composables/useBoardContext'
import CalendarEntry from './CalendarEntry.vue'

const { dropTarget } = defineProps<{
  cards: Card[]
  draggedId: string | null
  dropTarget: DropTarget | null
}>()
defineEmits<{ dragStart: [event: PointerEvent, cardId: string] }>()

const { isReadOnly } = useBoardContext()
const isDropTarget = computed(() => dropTarget?.kind === 'undated')
</script>
