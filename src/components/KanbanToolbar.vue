<template>
  <div
    id="kanban-app-bar"
    class="kb:bg-role-surface kb:rounded-t-xl kb:px-4 kb:py-1"
    :aria-label="$gettext('Board toolbar')"
    role="toolbar"
  >
    <div class="kb:flex kb:min-h-12 kb:flex-wrap kb:items-center kb:gap-x-2 kb:gap-y-1">
      <oc-search-bar
        id="kanban-search"
        v-model="text"
        is-filter
        class="kb:w-full kb:sm:w-3xs"
        :label="$gettext('Search cards')"
        :placeholder="$gettext('Search cards')"
        button-hidden
        :is-rounded="false"
      />
      <div class="kb:flex kb:flex-wrap kb:items-center kb:gap-2">
        <item-filter
          filter-name="assignees"
          :filter-label="$gettext('Assignee')"
          :items="assigneeItems"
          :option-filter-label="$gettext('Filter assignees')"
          :no-items-message="$gettext('No card has an assignee yet')"
          show-option-filter
          allow-multiple
          :filterable-attributes="['name']"
        >
          <template #image="{ item }">
            <user-avatar :user-id="item.id" :user-name="item.name" :width="24" class="kb:mr-2" />
          </template>
          <template #item="{ item }">
            <span v-text="item.name" />
          </template>
        </item-filter>
        <item-filter
          filter-name="tags"
          :filter-label="$gettext('Tag')"
          :items="tagItems"
          :option-filter-label="$gettext('Filter tags')"
          :no-items-message="$gettext('No card has a tag yet')"
          show-option-filter
          allow-multiple
          :filterable-attributes="['name']"
        >
          <template #image>
            <oc-icon name="price-tag-3" fill-type="line" size="small" class="kb:mr-2" />
          </template>
          <template #item="{ item }">
            <span v-text="item.name" />
          </template>
        </item-filter>
      </div>
      <div class="kb:ml-auto kb:flex kb:items-center kb:gap-2">
        <yjs-collaborators v-if="viewers.length > 1" :users="viewers" />
        <save-status />
        <div
          id="kanban-view-switch"
          class="oc-button-group kb:mx-1 kb:my-2"
          role="group"
          :aria-label="$gettext('View')"
        >
          <oc-button
            v-for="option in views"
            :key="option.name"
            v-oc-tooltip="option.label"
            :class="`kanban-view-switch-${option.name}`"
            :aria-label="option.label"
            :aria-pressed="view === option.name"
            :appearance="view === option.name ? 'filled' : 'raw'"
            :color-role="view === option.name ? 'secondaryContainer' : 'secondary'"
            :no-hover="view === option.name"
            class="kb:p-1"
            @click="view = option.name"
          >
            <oc-icon :name="option.icon" :fill-type="option.fillType" />
          </oc-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, unref, watch } from 'vue'
import { useGettext } from 'vue3-gettext'
import {
  ItemFilter,
  UserAvatar,
  YjsCollaborators,
  queryItemAsString,
  useRouteQuery
} from '@opencloud-eu/web-pkg'
import { useBoardContext } from '../composables/useBoardContext'
import { allAssignees, allTags, type CardFilters } from '../model/filters'
import type { BoardView } from '../composables/useViewPreferences'
import SaveStatus from './SaveStatus.vue'

const view = defineModel<BoardView>('view', { required: true })
const filters = defineModel<CardFilters>('filters', { required: true })

const { $gettext } = useGettext()
const { document, presence } = useBoardContext()
const viewers = presence.viewers

const views = computed(() => [
  {
    name: 'board' as const,
    label: $gettext('Board'),
    icon: 'kanban-view-2',
    fillType: 'none' as const
  },
  {
    name: 'calendar' as const,
    label: $gettext('Calendar'),
    icon: 'calendar',
    fillType: 'line' as const
  }
])

const assigneeItems = computed(() =>
  allAssignees(unref(document).cards).map(({ id, displayName }) => ({ id, name: displayName }))
)
const tagItems = computed(() =>
  allTags(unref(document).cards).map((tag) => ({ id: tag, name: tag }))
)

// the chips keep their selection in the URL, like the filters of the file search
const assigneeQuery = useRouteQuery('q_assignees')
const tagQuery = useRouteQuery('q_tags')
const text = computed({
  get: () => unref(filters).text,
  set: (value: string) => {
    filters.value = { ...unref(filters), text: value ?? '' }
  }
})

function ids(query: unknown) {
  return (queryItemAsString(query as string) ?? '').split('+').filter(Boolean)
}

watch(
  [assigneeQuery, tagQuery],
  ([assignees, tags]) => {
    filters.value = { ...unref(filters), assignees: ids(assignees), tags: ids(tags) }
  },
  { immediate: true }
)
</script>
