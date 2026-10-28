<template>
  <span
    class="kanban-save-status ext:flex ext:items-center ext:gap-1 ext:text-sm"
    :class="state === 'error' ? 'ext:text-role-error' : 'ext:text-role-on-surface-variant'"
    role="status"
    aria-live="polite"
    :data-state="state"
  >
    <oc-spinner v-if="state === 'saving'" size="xsmall" :aria-label="label" />
    <oc-icon v-else :name="icon" fill-type="line" size="small" />
    <span class="ext:hidden ext:sm:inline" v-text="label" />
  </span>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useBoardContext } from '../composables/useBoardContext'

const { $gettext } = useGettext()
const { sync, isReadOnly } = useBoardContext()

const state = computed(() =>
  unref(isReadOnly) && unref(sync.status) !== 'error' ? 'readOnly' : unref(sync.status)
)

const label = computed(() => {
  switch (unref(state)) {
    case 'saving':
      return $gettext('Saving…')
    case 'error':
      return $gettext('Not saved')
    case 'readOnly':
      return $gettext('Read-only')
    default:
      return $gettext('Saved')
  }
})

const icon = computed(() => {
  switch (unref(state)) {
    case 'error':
      return 'error-warning'
    case 'readOnly':
      return 'lock'
    default:
      return 'checkbox-circle'
  }
})
</script>
