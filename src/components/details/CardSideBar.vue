<template>
  <side-bar
    class="kanban-card-sidebar ext:z-30"
    :available-panels="panels"
    :panel-context="{}"
    :loading="false"
    :aria-label="$gettext('Card details')"
    @close="$emit('close')"
    @keydown.esc.stop="$emit('close')"
  >
    <template #rootHeader>
      <div class="ext:flex ext:min-w-0 ext:items-center ext:gap-2 ext:px-2">
        <column-color-dot v-if="column" :color="columnColor(column)" />
        <h2
          class="ext:m-0 ext:truncate ext:text-base ext:font-semibold"
          v-text="column ? column.title : $gettext('Card details')"
        />
      </div>
    </template>
  </side-bar>
</template>

<script setup lang="ts">
import { computed, markRaw, onMounted, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { SideBar, useSideBar, type SideBarPanel } from '@opencloud-eu/web-pkg'
import { columnColor } from '../../model/schema'
import { useBoardContext } from '../../composables/useBoardContext'
import ColumnColorDot from '../board/ColumnColorDot.vue'
import CardDetails from './CardDetails.vue'

const { cardId } = defineProps<{ cardId: string }>()
defineEmits<{ close: [] }>()

const { $gettext } = useGettext()
const { document } = useBoardContext()
const { focusSidebar } = useSideBar()

const card = computed(() => unref(document).cards.find(({ id }) => id === cardId))
const column = computed(() =>
  unref(document).columns.find(({ id }) => id === unref(card)?.columnId)
)

const panels = computed<SideBarPanel<never, never, never>[]>(() => [
  {
    name: 'kanban-card-details',
    icon: 'information',
    title: () => $gettext('Card details'),
    isVisible: () => true,
    isRoot: () => true,
    component: markRaw(CardDetails),
    componentAttrs: () => ({ cardId })
  }
])

onMounted(() => {
  void focusSidebar()
})
</script>
