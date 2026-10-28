<template>
  <span
    v-if="viewers.length"
    class="kanban-viewers kb:inline-flex kb:items-center kb:-space-x-1"
    role="img"
    :aria-label="label"
  >
    <span
      v-for="viewer in viewers"
      :key="viewer.id"
      v-oc-tooltip="label"
      class="kb:inline-flex kb:rounded-full kb:border-2"
      :style="{ borderColor: viewer.color }"
      :data-test-user-id="viewer.id"
    >
      <user-avatar
        :user-id="viewer.id"
        :user-name="viewer.name"
        :width="width"
        :background-color="viewer.color"
      />
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { UserAvatar } from '@opencloud-eu/web-pkg'
import type { Viewer } from '../composables/usePresence'

const { viewers, width = 18 } = defineProps<{ viewers: Viewer[]; width?: number }>()

const { $gettext } = useGettext()
const label = computed(() =>
  $gettext('Open right now by %{names}', { names: viewers.map(({ name }) => name).join(', ') })
)
</script>
