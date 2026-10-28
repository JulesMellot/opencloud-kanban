<template>
  <div
    class="kanban-calendar-grid kb:flex kb:min-h-0 kb:flex-col kb:overflow-hidden kb:rounded-xl kb:border kb:border-role-outline-variant"
    role="grid"
    :aria-label="label"
  >
    <div class="kb:grid kb:grid-cols-7 kb:border-b kb:border-role-outline-variant" role="row">
      <span
        v-for="(name, index) in weekdays"
        :key="name"
        role="columnheader"
        class="kb:truncate kb:px-2 kb:py-1.5 kb:text-sm kb:font-semibold kb:text-role-on-surface-variant"
        :aria-label="longWeekdays[index]"
        v-text="name"
      />
    </div>
    <div class="kb:flex kb:min-h-0 kb:flex-1 kb:flex-col kb:overflow-y-auto" data-drag-scroll>
      <div
        v-for="week in weeks"
        :key="week[0]"
        class="kb:grid kb:flex-1 kb:grid-cols-7 kb:border-b kb:border-role-outline-variant kb:last:border-b-0"
        :class="range === 'week' ? 'kb:min-h-80' : 'kb:min-h-28'"
        role="row"
      >
        <div
          v-for="day in week"
          :key="day"
          role="gridcell"
          :aria-label="dayLabel(day)"
          :aria-current="day === todayIso ? 'date' : undefined"
          class="kanban-calendar-day kb:group kb:flex kb:min-w-0 kb:flex-col kb:gap-1 kb:border-r kb:border-role-outline-variant kb:p-1 kb:last:border-r-0"
          :class="{
            'kb:bg-role-surface-container-low': range === 'month' && !isSameMonth(day, month),
            'kb:bg-role-secondary-container/40': isDropTarget(day)
          }"
          data-drop-zone="day"
          :data-day="day"
        >
          <div class="kb:flex kb:items-center kb:justify-between kb:gap-1">
            <span
              class="kanban-calendar-day-number kb:inline-flex kb:size-7 kb:items-center kb:justify-center kb:rounded-full kb:text-sm"
              :class="
                day === todayIso
                  ? 'kb:bg-role-secondary kb:font-semibold kb:text-role-on-secondary'
                  : range === 'month' && !isSameMonth(day, month)
                    ? 'kb:text-role-on-surface-variant'
                    : ''
              "
              aria-hidden="true"
              v-text="dayNumber(day)"
            />
            <oc-button
              v-if="!isReadOnly"
              v-oc-tooltip="$gettext('Add a card on %{day}', { day: dayLabel(day) })"
              appearance="raw"
              class="kanban-calendar-add kb:p-0.5 kb:opacity-0 kb:group-hover:opacity-100 kb:focus-visible:opacity-100"
              :aria-label="$gettext('Add a card on %{day}', { day: dayLabel(day) })"
              @click="$emit('addOnDay', day)"
            >
              <oc-icon name="add" fill-type="line" size="small" />
            </oc-button>
          </div>
          <ol class="kb:m-0 kb:flex kb:list-none kb:flex-col kb:gap-1 kb:p-0">
            <calendar-entry
              v-for="card in cardsByDay.get(day) ?? []"
              :key="card.id"
              :card="card"
              :is-dragged="card.id === draggedId"
              :compact="range === 'month'"
              @drag-start="$emit('dragStart', $event, card.id)"
            />
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { formatDay, isSameMonth, weekdayNames } from '../../model/calendar'
import type { Card } from '../../model/schema'
import type { DropTarget } from '../../composables/useCardDrag'
import type { CalendarRange } from '../../composables/useViewPreferences'
import { useBoardContext } from '../../composables/useBoardContext'
import CalendarEntry from './CalendarEntry.vue'

const { dropTarget } = defineProps<{
  weeks: string[][]
  range: CalendarRange
  /** A day of the month shown */
  month: string
  todayIso: string
  label: string
  cardsByDay: Map<string, Card[]>
  draggedId: string | null
  dropTarget: DropTarget | null
}>()
defineEmits<{ dragStart: [event: PointerEvent, cardId: string]; addOnDay: [day: string] }>()

const { current } = useGettext()
const { isReadOnly } = useBoardContext()

const weekdays = computed(() => weekdayNames(current, 'short'))
const longWeekdays = computed(() => weekdayNames(current, 'long'))

function dayNumber(day: string) {
  return String(Number(day.slice(8, 10)))
}

function dayLabel(day: string) {
  return formatDay(day, current)
}

function isDropTarget(day: string) {
  return dropTarget?.kind === 'day' && dropTarget.day === day
}
</script>
