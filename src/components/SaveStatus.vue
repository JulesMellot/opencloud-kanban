<template>
  <span
    class="kanban-save-status kb:flex kb:items-center kb:gap-1 kb:text-sm"
    :class="state === 'error' ? 'kb:text-role-error' : 'kb:text-role-on-surface-variant'"
    role="status"
    aria-live="polite"
    :data-state="state"
  >
    <oc-spinner v-if="state === 'saving'" size="xsmall" :aria-label="label" />
    <oc-icon v-else :name="icon" fill-type="line" size="small" />
    <span class="kb:hidden kb:sm:inline" v-text="label" />
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
