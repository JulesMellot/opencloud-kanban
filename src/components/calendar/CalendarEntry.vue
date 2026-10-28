<template>
  <li
    :data-card-id="card.id"
    class="kanban-calendar-entry kb:relative kb:list-none kb:rounded-md kb:border-l-4 kb:bg-role-surface-container kb:outline kb:outline-role-surface-container-highest kb:select-none kb:hover:bg-role-surface-container-highest kb:[-webkit-touch-callout:none]"
    :class="[
      { 'kb:bg-role-secondary-container kb:outline-2 kb:outline-role-outline': isOpen },
      { 'kb:opacity-40': isDragged, 'kb:cursor-grab': !isReadOnly }
    ]"
    :style="{ borderLeftColor: `var(--oc-role-${color})` }"
    @pointerdown="$emit('dragStart', $event)"
  >
    <button
      type="button"
      class="kb:flex kb:w-full kb:min-w-0 kb:cursor-[inherit] kb:rounded-md kb:border-0 kb:bg-transparent kb:px-1.5 kb:py-1 kb:text-left kb:text-sm kb:text-role-on-surface"
      :class="compact ? 'kb:items-baseline kb:gap-1.5' : 'kb:flex-col kb:gap-0'"
      :aria-label="accessibleLabel"
      @click="openCard(card.id)"
    >
      <span
        v-if="showTime && card.publishDate"
        class="kb:shrink-0 kb:text-role-on-surface-variant kb:tabular-nums"
        v-text="formatTime(card.publishDate, current)"
      />
      <span class="kb:min-w-0" :class="compact ? 'kb:truncate' : 'kb:break-words'" v-text="title" />
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
