<template>
  <no-content-message
    id="kanban-load-error"
    class="kb:size-full"
    img-src="images/illustrations/404.svg"
    role="alert"
  >
    <template #message>
      <span v-text="title" />
    </template>
    <template #callToAction>
      <p class="kb:mt-0 kb:max-w-md kb:text-center" v-text="text" />
      <p v-if="detail" class="kb:mt-0 kb:text-sm kb:text-role-on-surface-variant">
        <span v-text="$gettext('Problem found at:')" />
        <code class="kb:ml-1" v-text="detail" />
      </p>
      <oc-button v-if="canRetry" appearance="outline" @click="$emit('retry')">
        <oc-icon name="refresh" fill-type="line" />
        <span v-text="$gettext('Try again')" />
      </oc-button>
    </template>
  </no-content-message>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGettext } from 'vue3-gettext'
import { NoContentMessage } from '@opencloud-eu/web-pkg'
import { KanbanFormatError } from '../model/schema'
import type { LoadError } from '../composables/useBoard'

const { error } = defineProps<{ error: LoadError }>()
defineEmits<{ retry: [] }>()

const { $gettext } = useGettext()

const canRetry = computed(() => !(error instanceof KanbanFormatError))
const detail = computed(() => (error instanceof KanbanFormatError ? error.path : ''))

const title = computed(() => {
  if (error instanceof KanbanFormatError) {
    return error.code === 'tooNew' || error.code === 'unsupportedVersion'
      ? $gettext('This board needs another version of the app')
      : $gettext('This file is not a valid board')
  }
  return error.kind === 'notFound'
    ? $gettext('Board not found')
    : error.kind === 'forbidden'
      ? $gettext('You cannot open this board')
      : $gettext('The board could not be loaded')
})

const text = computed(() => {
  if (error instanceof KanbanFormatError) {
    switch (error.code) {
      case 'tooNew':
        return $gettext(
          'It was saved by a newer version of Kanban. Ask your administrator to update the app. The file was not changed.'
        )
      case 'unsupportedVersion':
        return $gettext('Its format version is not supported. The file was not changed.')
      case 'invalidJson':
        return $gettext(
          'Its content is damaged or is not a board at all. The file was not changed: you can restore an earlier version from its versions in Files.'
        )
      default:
        return $gettext(
          'Part of its content is not what a board contains. The file was not changed: you can restore an earlier version from its versions in Files.'
        )
    }
  }
  return error.kind === 'notFound'
    ? $gettext('It may have been deleted or moved somewhere you have no access to.')
    : error.kind === 'forbidden'
      ? $gettext('You do not have access to this file.')
      : $gettext('Check your connection and try again.')
})
</script>
