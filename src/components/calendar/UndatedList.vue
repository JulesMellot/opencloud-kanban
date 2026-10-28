<template>
  <section
    class="kanban-undated ext:flex ext:min-h-0 ext:flex-col ext:rounded-xl ext:border ext:border-role-outline-variant"
    :class="{ 'ext:bg-role-secondary-container/40': isDropTarget }"
    aria-labelledby="kanban-undated-title"
    data-drop-zone="undated"
  >
    <header class="ext:flex ext:items-center ext:gap-2 ext:px-3 ext:py-2">
      <h2
        id="kanban-undated-title"
        class="ext:m-0 ext:flex-1 ext:text-base ext:font-semibold"
        v-text="$gettext('No date')"
      />
      <span
        class="ext:rounded-full ext:bg-role-surface-container-highest ext:px-2 ext:text-sm ext:text-role-on-surface-variant"
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
      class="ext:m-0 ext:px-3 ext:pb-2 ext:text-sm ext:text-role-on-surface-variant"
      v-text="$gettext('Drag a card onto a day to plan it.')"
    />
    <ol
      class="ext:m-0 ext:flex ext:min-h-14 ext:flex-1 ext:list-none ext:flex-col ext:gap-1 ext:overflow-y-auto ext:p-2 ext:pt-0"
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
        class="ext:list-none ext:rounded-md ext:border ext:border-dashed ext:border-role-outline-variant ext:px-3 ext:py-4 ext:text-center ext:text-sm ext:text-role-on-surface-variant"
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
