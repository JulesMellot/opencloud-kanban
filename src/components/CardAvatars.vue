<template>
  <oc-avatars
    class="kanban-avatars kb:flex kb:items-center kb:flex-row kb:flex-nowrap"
    :items="items"
    :stacked="stacked"
    :max-displayed="maxDisplayed"
    :is-tooltip-displayed="true"
    :width="width"
    gap-size="xsmall"
    :accessible-description="description"
  >
    <template #userAvatars="{ avatars, width: avatarWidth }">
      <user-avatar
        v-for="avatar in avatars"
        :key="avatar.userId"
        :user-id="avatar.userId"
        :user-name="avatar.displayName"
        :width="avatarWidth"
      />
    </template>
  </oc-avatars>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { UserAvatar } from '@opencloud-eu/web-pkg'
import type { Assignee } from '../model/schema'

const {
  assignees,
  maxDisplayed = 3,
  stacked = false,
  width = 24
} = defineProps<{
  assignees: Assignee[]
  maxDisplayed?: number
  width?: number
  stacked?: boolean
}>()

const { $gettext } = useGettext()

const items = computed(() =>
  assignees.map(({ id, displayName }) => ({
    userId: id,
    displayName: displayName || id,
    name: displayName || id,
    userName: displayName || id,
    avatarType: 'user'
  }))
)
const description = computed(() =>
  $gettext('Assigned to %{names}', {
    names: assignees.map(({ displayName }) => displayName).join(', ')
  })
)
</script>
