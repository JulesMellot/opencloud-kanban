<template>
  <div class="kanban-app ext:flex ext:size-full ext:overflow-hidden ext:text-role-on-surface">
    <app-loading-spinner v-if="loading" />
    <load-error-message v-else-if="loadError" :error="loadError" @retry="reload" />
    <template v-else-if="board">
      <div class="ext:flex ext:min-w-0 ext:flex-1 ext:flex-col">
        <kanban-toolbar v-model:view="view" v-model:filters="filters" />
        <status-banner />
        <board-view v-if="view === 'board'" class="ext:min-h-0 ext:flex-1" />
        <calendar-view v-else v-model:range="calendarRange" class="ext:min-h-0 ext:flex-1" />
      </div>
      <card-side-bar v-if="openCardId" :key="openCardId" :card-id="openCardId" @close="closeCard" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, toRef, unref, watch } from 'vue'
import { AppLoadingSpinner } from '@opencloud-eu/web-pkg'
import type { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { useBoard } from './composables/useBoard'
import { provideBoardContext, type BoardContext } from './composables/useBoardContext'
import { useViewPreferences } from './composables/useViewPreferences'
import { emptyFilters, type CardFilters } from './model/filters'
import KanbanToolbar from './components/KanbanToolbar.vue'
import StatusBanner from './components/StatusBanner.vue'
import LoadErrorMessage from './components/LoadErrorMessage.vue'
import BoardView from './components/board/BoardView.vue'
import CalendarView from './components/calendar/CalendarView.vue'
import CardSideBar from './components/details/CardSideBar.vue'

const props = defineProps<{
  space: SpaceResource
  resource: Resource
  isReadOnly: boolean
}>()

const resource = toRef(props, 'resource')
const space = toRef(props, 'space')
const { sync, loading, loadError, reload, userId } = useBoard({
  resource,
  isReadOnly: toRef(props, 'isReadOnly')
})
const { view, calendarRange } = useViewPreferences(userId)

const filters = shallowRef<CardFilters>(emptyFilters())
const openCardId = shallowRef<string | null>(null)
/** Element that had the focus when a card was opened, focused again on close */
let returnFocus: HTMLElement | null = null

const context = provideBoardContext({
  sync,
  space,
  resource,
  filters,
  openCardId,
  userId
})

const board = computed<BoardContext | null>(() => (unref(sync.document) ? context : null))

watch(openCardId, (id, previous) => {
  if (id && !previous) {
    returnFocus = document.activeElement as HTMLElement | null
  }
})

// a card deleted by someone else closes its side bar
watch(
  () => unref(sync.document)?.cards.some(({ id }) => id === unref(openCardId)),
  (exists) => {
    if (unref(openCardId) && exists === false) {
      closeCard()
    }
  }
)

async function closeCard() {
  openCardId.value = null
  await nextTick()
  returnFocus?.focus()
  returnFocus = null
}
</script>
