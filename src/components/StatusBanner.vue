<template>
  <div v-if="banner" class="kb:px-4 kb:pb-2">
    <div
      class="kanban-status-banner kb:flex kb:flex-wrap kb:items-center kb:gap-x-3 kb:gap-y-2 kb:rounded-lg kb:px-3 kb:py-2"
      :class="
        banner.tone === 'error'
          ? 'kb:bg-role-error-container kb:text-role-on-error-container'
          : 'kb:bg-role-secondary-container kb:text-role-on-secondary-container'
      "
      :role="banner.tone === 'error' ? 'alert' : 'status'"
      :data-kind="banner.kind"
    >
      <oc-icon :name="banner.icon" fill-type="line" size="small" />
      <p class="kb:m-0 kb:min-w-0 kb:flex-1 kb:text-sm">
        <span class="kb:font-semibold" v-text="banner.title" />
        <span v-if="banner.text" v-text="` ${banner.text}`" />
      </p>
      <div v-if="banner.actions" class="kb:flex kb:gap-2">
        <oc-button v-if="canRetry" size="small" appearance="outline" @click="retry">
          <oc-icon name="refresh" fill-type="line" size="small" />
          <span v-text="$gettext('Try again')" />
        </oc-button>
        <oc-button size="small" appearance="outline" @click="copy">
          <oc-icon name="file-copy" fill-type="line" size="small" />
          <span v-text="$gettext('Copy board with my changes')" />
        </oc-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { useMessages } from '@opencloud-eu/web-pkg'
import { useBoardContext } from '../composables/useBoardContext'

const { $gettext } = useGettext()
const { showMessage, showErrorMessage } = useMessages()
const { sync } = useBoardContext()

const canRetry = computed(() => !unref(sync.formatError) && unref(sync.error) !== 'notFound')

interface Banner {
  kind: string
  tone: 'error' | 'info'
  icon: string
  title: string
  text?: string
  actions?: boolean
}

const banner = computed<Banner | null>(() => {
  const unsaved = unref(sync.hasUnsavedChanges)
  if (unref(sync.formatError)) {
    return {
      kind: 'format',
      tone: 'error',
      icon: 'error-warning',
      title: $gettext('The file was replaced by something that is not a board.'),
      text: unsaved
        ? $gettext('It is left as it is. Copy your changes to keep them.')
        : $gettext('It is left as it is. Reload to see what it contains now.'),
      actions: unsaved
    }
  }
  switch (unref(sync.error)) {
    case 'notFound':
      return {
        kind: 'notFound',
        tone: 'error',
        icon: 'error-warning',
        title: $gettext('This board was deleted or moved out of your reach.'),
        text: unsaved ? $gettext('Copy your changes to keep them.') : undefined,
        actions: unsaved
      }
    case 'forbidden':
      return {
        kind: 'forbidden',
        tone: 'error',
        icon: 'lock',
        title: $gettext('You can no longer edit this board.'),
        text: unsaved
          ? $gettext('Your last changes were not saved. Copy them to keep them.')
          : undefined,
        actions: unsaved
      }
    case 'locked':
    case 'quota':
    case 'network':
      if (!unsaved) {
        return null
      }
      return {
        kind: unref(sync.error) as string,
        tone: 'error',
        icon: 'cloud-off',
        title: $gettext('Your changes are not saved yet.'),
        text:
          unref(sync.error) === 'locked'
            ? $gettext(
                'The file is locked by another application. Saving is retried automatically.'
              )
            : unref(sync.error) === 'quota'
              ? $gettext('There is not enough space left. Saving is retried automatically.')
              : $gettext('The server cannot be reached. Saving is retried automatically.'),
        actions: true
      }
  }
  if (unref(sync.readOnly)) {
    return {
      kind: 'readOnly',
      tone: 'info',
      icon: 'eye',
      title: $gettext('Read-only.'),
      text: $gettext('You can view this board but not change it.')
    }
  }
  return null
})

function retry() {
  void sync.save()
}

async function copy() {
  try {
    await navigator.clipboard.writeText(sync.exportContent())
    showMessage({
      title: $gettext('Board copied'),
      desc: $gettext('Paste it into a new .kanban file to keep your changes.')
    })
  } catch (e) {
    showErrorMessage({ title: $gettext('The board could not be copied'), errors: [e as Error] })
  }
}
</script>
