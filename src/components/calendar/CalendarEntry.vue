<template>
  <li
    :data-card-id="card.id"
    class="kanban-calendar-entry ext:relative ext:list-none ext:rounded-md ext:border-l-4 ext:bg-role-surface-container ext:outline ext:outline-role-surface-container-highest ext:select-none ext:hover:bg-role-surface-container-highest ext:[-webkit-touch-callout:none]"
    :class="[
      { 'ext:bg-role-secondary-container ext:outline-2 ext:outline-role-outline': isOpen },
      { 'ext:opacity-40': isDragged, 'ext:cursor-grab': !isReadOnly }
    ]"
    :style="{ borderLeftColor: `var(--oc-role-${color})` }"
    @pointerdown="$emit('dragStart', $event)"
  >
    <button
      type="button"
      class="ext:flex ext:w-full ext:min-w-0 ext:cursor-[inherit] ext:rounded-md ext:border-0 ext:bg-transparent ext:px-1.5 ext:py-1 ext:text-left ext:text-sm ext:text-role-on-surface"
      :class="compact ? 'ext:items-baseline ext:gap-1.5' : 'ext:flex-col ext:gap-0'"
      :aria-label="accessibleLabel"
      @click="openCard(card.id)"
    >
      <span
        v-if="showTime && card.publishDate"
        class="ext:shrink-0 ext:text-role-on-surface-variant ext:tabular-nums"
        v-text="formatTime(card.publishDate, current)"
      />
      <span
        class="ext:min-w-0"
        :class="compact ? 'ext:truncate' : 'ext:break-words'"
        v-text="title"
      />
    </button>
  </li>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { formatPublishDate, formatTime } from '../../model/calendar'
import { columnColor, type Card } from '../../model/schema'
import { useBoardContext } from '../../composables/useBoardContext'

const {
  card,
  isDragged = false,
  showTime = true,
  compact = true
} = defineProps<{ card: Card; isDragged?: boolean; showTime?: boolean; compact?: boolean }>()
defineEmits<{ dragStart: [event: PointerEvent] }>()

const { $gettext, current } = useGettext()
const { document, isReadOnly, openCardId, openCard } = useBoardContext()

const column = computed(() => unref(document).columns.find(({ id }) => id === card.columnId))
const color = computed(() =>
  unref(column) ? columnColor(unref(column) as { color: string }) : 'outline'
)
const title = computed(() => card.title || $gettext('Untitled card'))
const isOpen = computed(() => unref(openCardId) === card.id)
const accessibleLabel = computed(() => {
  const parts = [unref(title)]
  if (card.publishDate) {
    parts.push(formatPublishDate(card.publishDate, current))
  }
  if (unref(column)) {
    parts.push(unref(column)?.title as string)
  }
  return parts.join(', ')
})
</script>
