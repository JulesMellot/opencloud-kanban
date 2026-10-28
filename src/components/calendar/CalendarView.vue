<template>
  <div class="kanban-calendar ext:flex ext:flex-col ext:gap-2 ext:px-4 ext:pb-4">
    <div class="ext:flex ext:flex-wrap ext:items-center ext:gap-2">
      <div class="ext:flex ext:items-center ext:gap-1">
        <oc-button
          v-oc-tooltip="previousLabel"
          appearance="raw"
          class="kanban-calendar-previous ext:p-1"
          :aria-label="previousLabel"
          @click="go(-1)"
        >
          <oc-icon name="arrow-left-s" fill-type="line" />
        </oc-button>
        <oc-button
          v-oc-tooltip="nextLabel"
          appearance="raw"
          class="kanban-calendar-next ext:p-1"
          :aria-label="nextLabel"
          @click="go(1)"
        >
          <oc-icon name="arrow-right-s" fill-type="line" />
        </oc-button>
        <oc-button appearance="outline" size="small" class="kanban-calendar-today" @click="goToday">
          <span v-text="$gettext('Today')" />
        </oc-button>
      </div>
      <h2
        class="kanban-calendar-title ext:m-0 ext:flex-1 ext:text-lg ext:font-semibold ext:first-letter:uppercase"
        aria-live="polite"
        v-text="title"
      />
      <div class="oc-button-group" role="group" :aria-label="$gettext('Period')">
        <oc-button
          v-for="option in ranges"
          :key="option.name"
          :class="`kanban-calendar-range-${option.name}`"
          :aria-pressed="range === option.name"
          :appearance="range === option.name ? 'filled' : 'raw'"
          :color-role="range === option.name ? 'secondaryContainer' : 'secondary'"
          :no-hover="range === option.name"
          size="small"
          class="ext:px-2"
          @click="range = option.name"
        >
          <span v-text="option.label" />
        </oc-button>
      </div>
    </div>

    <div class="ext:flex ext:min-h-0 ext:flex-1 ext:flex-col ext:gap-3 ext:md:flex-row">
      <div class="ext:flex ext:min-h-0 ext:min-w-0 ext:flex-1 ext:flex-col">
        <calendar-grid
          class="ext:hidden ext:flex-1 ext:sm:flex"
          :weeks="weeks"
          :range="range"
          :month="cursor"
          :today-iso="todayIso"
          :label="title"
          :cards-by-day="byDay"
          :dragged-id="draggedId"
          :drop-target="dropTarget"
          @drag-start="onPointerDown"
          @add-on-day="addOnDay"
        />
        <calendar-agenda
          class="ext:sm:hidden"
          :days="weeks.flat()"
          :today-iso="todayIso"
          :label="title"
          :cards-by-day="byDay"
          :dragged-id="draggedId"
          :drop-target="dropTarget"
          @drag-start="onPointerDown"
        />
      </div>
      <undated-list
        class="ext:md:w-72 ext:md:shrink-0"
        :cards="undated"
        :dragged-id="draggedId"
        :drop-target="dropTarget"
        @drag-start="onPointerDown"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useModals } from '@opencloud-eu/web-pkg'
import {
  addDays,
  addMonths,
  cardsByDay,
  formatDay,
  formatMonth,
  formatWeek,
  monthGrid,
  moveToDay,
  today,
  weekDays
} from '../../model/calendar'
import { byOrder } from '../../model/order'
import type { CalendarRange } from '../../composables/useViewPreferences'
import { useBoardContext } from '../../composables/useBoardContext'
import { useBoardActions } from '../../composables/useBoardActions'
import { useCalendarDrop } from '../../composables/useCalendarDrop'
import CalendarGrid from './CalendarGrid.vue'
import CalendarAgenda from './CalendarAgenda.vue'
import UndatedList from './UndatedList.vue'

const range = defineModel<CalendarRange>('range', { required: true })
/** A day of the period shown */
const cursor = defineModel<string>('cursor', { required: true })

const { $gettext, current } = useGettext()
const { dispatchModal } = useModals()
const board = useBoardContext()
const { document, visibleCards } = board
const actions = useBoardActions()
const { draggedId, dropTarget, onPointerDown } = useCalendarDrop()

// "today" moves on at midnight, also for a board left open
const todayIso = shallowRef(today())
const clock = setInterval(() => {
  todayIso.value = today()
}, 60_000)
onBeforeUnmount(() => clearInterval(clock))

const ranges = computed(() => [
  { name: 'month' as const, label: $gettext('Month') },
  { name: 'week' as const, label: $gettext('Week') }
])

const weeks = computed(() =>
  unref(range) === 'week' ? [weekDays(unref(cursor))] : monthGrid(unref(cursor))
)
const title = computed(() =>
  unref(range) === 'week' ? formatWeek(unref(cursor), current) : formatMonth(unref(cursor), current)
)
const previousLabel = computed(() =>
  unref(range) === 'week' ? $gettext('Previous week') : $gettext('Previous month')
)
const nextLabel = computed(() =>
  unref(range) === 'week' ? $gettext('Next week') : $gettext('Next month')
)

const byDay = computed(() => cardsByDay(unref(visibleCards)))
const undated = computed(() =>
  unref(visibleCards)
    .filter(({ publishDate }) => !publishDate)
    .sort((a, b) => {
      const columns = unref(document).columns.map(({ id }) => id)
      return columns.indexOf(a.columnId) - columns.indexOf(b.columnId) || byOrder(a, b)
    })
)

function go(delta: -1 | 1) {
  cursor.value =
    unref(range) === 'week' ? addDays(unref(cursor), delta * 7) : addMonths(unref(cursor), delta)
}

function goToday() {
  cursor.value = unref(todayIso)
}

function addOnDay(day: string) {
  const column = unref(document).columns[0]
  if (!column) {
    return
  }
  dispatchModal({
    title: $gettext('New card on %{day}', { day: formatDay(day, current) }),
    confirmText: $gettext('Add'),
    hasInput: true,
    inputLabel: $gettext('Title'),
    inputDescription: $gettext('The card is added to »%{column}«.', { column: column.title }),
    onInput: (value, setError) =>
      setError(value.trim() ? '' : $gettext('The title cannot be empty')),
    onConfirm: (value: string) => {
      if (value.trim()) {
        actions.addCard(column.id, value.trim(), {}, { publishDate: moveToDay(null, day) })
      }
    }
  })
}
</script>
