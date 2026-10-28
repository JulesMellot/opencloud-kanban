<template>
  <div class="kanban-assignees ext:flex ext:flex-col ext:gap-2">
    <span :id="labelId" class="ext:font-semibold ext:text-sm" v-text="$gettext('Assignees')" />
    <ul
      v-if="card.assignees.length"
      class="ext:m-0 ext:flex ext:list-none ext:flex-col ext:gap-1 ext:p-0"
      :aria-labelledby="labelId"
    >
      <li
        v-for="assignee in card.assignees"
        :key="assignee.id"
        class="ext:flex ext:items-center ext:gap-2 ext:rounded-md ext:py-0.5"
      >
        <user-avatar :user-id="assignee.id" :user-name="assignee.displayName" :width="28" />
        <span class="ext:min-w-0 ext:flex-1 ext:truncate" v-text="assignee.displayName" />
        <oc-button
          v-if="!isReadOnly"
          v-oc-tooltip="$gettext('Remove %{name}', { name: assignee.displayName })"
          appearance="raw"
          class="ext:p-1"
          :aria-label="$gettext('Remove %{name}', { name: assignee.displayName })"
          @click="remove(assignee.id)"
        >
          <oc-icon name="close" fill-type="line" size="small" />
        </oc-button>
      </li>
    </ul>
    <p
      v-else-if="isReadOnly"
      class="ext:m-0 ext:text-sm ext:text-role-on-surface-variant"
      v-text="$gettext('Nobody is assigned')"
    />
    <oc-select
      v-if="!isReadOnly"
      id="kanban-card-add-assignee"
      :model-value="null"
      :label="$gettext('Add an assignee')"
      label-hidden
      :placeholder="$gettext('Add an assignee')"
      :options="options"
      :filterable="false"
      :get-option-label="(option: Member) => option.displayName"
      @search:input="onSearch"
      @open="onSearch('')"
      @update:model-value="add"
    >
      <template #option="option">
        <span class="ext:flex ext:items-center ext:gap-2">
          <user-avatar :user-id="option.id" :user-name="option.displayName" :width="24" />
          <span v-text="option.displayName" />
        </span>
      </template>
      <template #no-options>
        <span v-text="noOptionsText" />
      </template>
    </oc-select>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, unref, useId } from 'vue'
import { useGettext } from 'vue3-gettext'
import { UserAvatar } from '@opencloud-eu/web-pkg'
import type { Card } from '../../model/schema'
import type { Member } from '../../composables/useMembers'
import { useBoardContext } from '../../composables/useBoardContext'

const { card } = defineProps<{ card: Card }>()

const { $gettext } = useGettext()
const board = useBoardContext()
const { isReadOnly, members } = board
const labelId = `kanban-assignees-${useId()}`

const results = shallowRef<Member[]>([])
const searching = shallowRef(false)
const term = shallowRef('')
let controller: AbortController | null = null
let timer: ReturnType<typeof setTimeout> | null = null

const options = computed(() =>
  unref(results).filter(({ id }) => !card.assignees.some((assignee) => assignee.id === id))
)

const noOptionsText = computed(() => {
  if (unref(searching)) {
    return $gettext('Searching…')
  }
  if (!unref(members.isLimitedToSpace) && unref(term).trim().length < 2) {
    return $gettext('Type at least two letters of a name')
  }
  return $gettext('Nobody found')
})

function onSearch(query: string) {
  term.value = query ?? ''
  if (timer) {
    clearTimeout(timer)
  }
  timer = setTimeout(async () => {
    controller?.abort()
    controller = new AbortController()
    searching.value = true
    try {
      results.value = await members.search(unref(term), controller.signal)
    } catch {
      results.value = []
    } finally {
      searching.value = false
    }
  }, 250)
}

function add(member: Member | null) {
  if (!member) {
    return
  }
  board.change({
    type: 'addAssignee',
    cardId: card.id,
    assignee: { id: member.id, displayName: member.displayName, extra: {} }
  })
}

function remove(assigneeId: string) {
  board.change({ type: 'removeAssignee', cardId: card.id, assigneeId })
}
</script>
