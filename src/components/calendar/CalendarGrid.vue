<template>
  <div
    class="kanban-calendar-grid ext:flex ext:min-h-0 ext:flex-col ext:overflow-hidden ext:rounded-xl ext:border ext:border-role-outline-variant"
    role="grid"
    :aria-label="label"
  >
    <div class="ext:grid ext:grid-cols-7 ext:border-b ext:border-role-outline-variant" role="row">
      <span
        v-for="(name, index) in weekdays"
        :key="name"
        role="columnheader"
        class="ext:truncate ext:px-2 ext:py-1.5 ext:text-sm ext:font-semibold ext:text-role-on-surface-variant"
        :aria-label="longWeekdays[index]"
        v-text="name"
      />
    </div>
    <div class="ext:flex ext:min-h-0 ext:flex-1 ext:flex-col ext:overflow-y-auto" data-drag-scroll>
      <div
        v-for="week in weeks"
        :key="week[0]"
        class="ext:grid ext:flex-1 ext:grid-cols-7 ext:border-b ext:border-role-outline-variant ext:last:border-b-0"
        :class="range === 'week' ? 'ext:min-h-80' : 'ext:min-h-28'"
        role="row"
      >
        <div
          v-for="day in week"
          :key="day"
          role="gridcell"
          :aria-label="dayLabel(day)"
          :aria-current="day === todayIso ? 'date' : undefined"
          class="kanban-calendar-day ext:group ext:flex ext:min-w-0 ext:flex-col ext:gap-1 ext:border-r ext:border-role-outline-variant ext:p-1 ext:last:border-r-0"
          :class="{
            'ext:bg-role-surface-container-low': range === 'month' && !isSameMonth(day, month),
            'ext:bg-role-secondary-container/40': isDropTarget(day)
          }"
          data-drop-zone="day"
          :data-day="day"
        >
          <div class="ext:flex ext:items-center ext:justify-between ext:gap-1">
            <span
              class="kanban-calendar-day-number ext:inline-flex ext:size-7 ext:items-center ext:justify-center ext:rounded-full ext:text-sm"
              :class="
                day === todayIso
                  ? 'ext:bg-role-secondary ext:font-semibold ext:text-role-on-secondary'
                  : range === 'month' && !isSameMonth(day, month)
                    ? 'ext:text-role-on-surface-variant'
                    : ''
              "
              aria-hidden="true"
              v-text="dayNumber(day)"
            />
            <oc-button
              v-if="!isReadOnly"
              v-oc-tooltip="$gettext('Add a card on %{day}', { day: dayLabel(day) })"
              appearance="raw"
              class="kanban-calendar-add ext:p-0.5 ext:opacity-0 ext:group-hover:opacity-100 ext:focus-visible:opacity-100"
              :aria-label="$gettext('Add a card on %{day}', { day: dayLabel(day) })"
              @click="$emit('addOnDay', day)"
            >
              <oc-icon name="add" fill-type="line" size="small" />
            </oc-button>
          </div>
          <ol class="ext:m-0 ext:flex ext:list-none ext:flex-col ext:gap-1 ext:p-0">
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
