<template>
  <ol
    class="kanban-calendar-agenda kb:m-0 kb:flex kb:list-none kb:flex-col kb:gap-3 kb:p-0"
    :aria-label="label"
  >
    <li
      v-for="day in shownDays"
      :key="day"
      class="kb:rounded-xl kb:border kb:border-role-outline-variant kb:p-2"
      :class="{
        'kb:bg-role-secondary-container/40': dropTarget?.kind === 'day' && dropTarget.day === day
      }"
      :aria-current="day === todayIso ? 'date' : undefined"
      data-drop-zone="day"
      :data-day="day"
    >
      <div class="kb:mb-1 kb:flex kb:items-center kb:gap-2">
        <span
          class="kb:text-sm kb:font-semibold"
          :class="day === todayIso ? 'kb:text-role-secondary' : ''"
          v-text="formatDay(day, current, { weekday: 'long', day: 'numeric', month: 'long' })"
        />
        <oc-tag v-if="day === todayIso" size="small">{{ $gettext('Today') }}</oc-tag>
      </div>
      <ol class="kb:m-0 kb:flex kb:list-none kb:flex-col kb:gap-1 kb:p-0">
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
      class="kb:rounded-xl kb:border kb:border-dashed kb:border-role-outline-variant kb:p-4 kb:text-center kb:text-sm kb:text-role-on-surface-variant"
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
