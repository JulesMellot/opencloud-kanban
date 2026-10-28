<template>
  <ol
    class="kanban-calendar-agenda ext:m-0 ext:flex ext:list-none ext:flex-col ext:gap-3 ext:p-0"
    :aria-label="label"
  >
    <li
      v-for="day in shownDays"
      :key="day"
      class="ext:rounded-xl ext:border ext:border-role-outline-variant ext:p-2"
      :class="{
        'ext:bg-role-secondary-container/40': dropTarget?.kind === 'day' && dropTarget.day === day
      }"
      :aria-current="day === todayIso ? 'date' : undefined"
      data-drop-zone="day"
      :data-day="day"
    >
      <div class="ext:mb-1 ext:flex ext:items-center ext:gap-2">
        <span
          class="ext:text-sm ext:font-semibold"
          :class="day === todayIso ? 'ext:text-role-secondary' : ''"
          v-text="formatDay(day, current, { weekday: 'long', day: 'numeric', month: 'long' })"
        />
        <oc-tag v-if="day === todayIso" size="small" v-text="$gettext('Today')" />
      </div>
      <ol class="ext:m-0 ext:flex ext:list-none ext:flex-col ext:gap-1 ext:p-0">
        <calendar-entry
          v-for="card in cardsByDay.get(day) ?? []"
          :key="card.id"
          :card="card"
          :compact="false"
          :is-dragged="card.id === draggedId"
          @drag-start="$emit('dragStart', $event, card.id)"
        />
      </ol>
    </li>
    <li
      v-if="!shownDays.length"
      class="ext:rounded-xl ext:border ext:border-dashed ext:border-role-outline-variant ext:p-4 ext:text-center ext:text-sm ext:text-role-on-surface-variant"
      v-text="$gettext('Nothing is planned for this period')"
    />
  </ol>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { formatDay } from '../../model/calendar'
import type { Card } from '../../model/schema'
import type { DropTarget } from '../../composables/useCardDrag'
import CalendarEntry from './CalendarEntry.vue'

const { days, cardsByDay, todayIso } = defineProps<{
  /** Every day of the period shown */
  days: string[]
  todayIso: string
  label: string
  cardsByDay: Map<string, Card[]>
  draggedId: string | null
  dropTarget: DropTarget | null
}>()
defineEmits<{ dragStart: [event: PointerEvent, cardId: string] }>()

const { current } = useGettext()

/** Days with something planned, and today */
const shownDays = computed(() => days.filter((day) => cardsByDay.has(day) || day === todayIso))
</script>
