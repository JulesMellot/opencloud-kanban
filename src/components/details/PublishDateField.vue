<template>
  <fieldset class="kanban-publish-date ext:m-0 ext:border-0 ext:p-0">
    <legend class="ext:sr-only" v-text="$gettext('Publication')" />
    <div class="ext:grid ext:grid-cols-[1fr_8rem] ext:items-start ext:gap-2">
      <oc-datepicker
        id="kanban-card-publish-date"
        :label="$gettext('Publication date')"
        :current-date="publishDay"
        :is-dark="isDark"
        :disabled="isReadOnly"
        @date-changed="setDay"
      />
      <div @focusout="commitTime">
        <oc-text-input
          id="kanban-card-publish-time"
          v-model="time"
          v-bind="timeInputAttributes"
          :label="$gettext('Time')"
          :disabled="isReadOnly || !card.publishDate"
          :error-message="timeError"
          fix-message-line
          @keydown.enter="commitTime"
        />
      </div>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { computed, shallowRef, unref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import { DateTime } from 'luxon'
import { useThemeStore } from '@opencloud-eu/web-pkg'
import { dayOf, moveToDay, timeOf, withTime } from '../../model/calendar'
import type { Card } from '../../model/schema'
import { useBoardContext } from '../../composables/useBoardContext'

const { card } = defineProps<{ card: Card }>()

const { $gettext } = useGettext()
const themeStore = useThemeStore()
const board = useBoardContext()
const { isReadOnly } = board

const isDark = computed(() => themeStore.currentTheme?.isDark ?? false)
const publishDay = computed(() =>
  card.publishDate ? DateTime.fromISO(dayOf(card.publishDate)) : undefined
)
// the design system text input renders the browser's time field for this type
const timeInputAttributes = { type: 'time' as 'text' }
const time = shallowRef(card.publishDate ? timeOf(card.publishDate) : '')
const timeError = shallowRef('')

watch(
  () => card.publishDate,
  (value) => {
    time.value = value ? timeOf(value) : ''
    timeError.value = ''
  }
)

function update(publishDate: string | null) {
  if (publishDate !== card.publishDate) {
    board.change({ type: 'updateCard', cardId: card.id, patch: { publishDate } })
  }
}

function setDay({ date, error }: { date: DateTime | null; error: boolean }) {
  if (error) {
    return
  }
  update(date ? moveToDay(card.publishDate, date.toISODate() as string) : null)
}

function commitTime() {
  if (!card.publishDate || unref(isReadOnly)) {
    return
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time.value)) {
    timeError.value = $gettext('Enter a time like 18:30')
    return
  }
  timeError.value = ''
  update(withTime(card.publishDate, time.value))
}
</script>
