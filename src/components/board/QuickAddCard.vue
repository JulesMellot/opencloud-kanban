<template>
  <div class="kanban-quick-add ext:px-2 ext:pb-2">
    <form v-if="isOpen" class="ext:flex ext:flex-col ext:gap-2" @submit.prevent="submit">
      <oc-textarea
        :id="`kanban-quick-add-${columnId}`"
        ref="inputRef"
        v-model="title"
        class="ext:[&_textarea]:min-h-16"
        :label="$gettext('Title of the new card')"
        rows="2"
        @keydown.enter.exact.prevent="submit"
        @keydown.esc.stop="close"
      />
      <div class="ext:flex ext:items-center ext:gap-2">
        <oc-button submit="submit" appearance="filled" color-role="secondaryContainer" size="small">
          <span v-text="$gettext('Add card')" />
        </oc-button>
        <oc-button appearance="raw" size="small" @click="close">
          <span v-text="$gettext('Cancel')" />
        </oc-button>
      </div>
    </form>
    <oc-button
      v-else
      appearance="raw"
      justify-content="left"
      gap-size="small"
      class="kanban-quick-add-toggle ext:w-full ext:px-2 ext:py-1.5 ext:text-role-on-surface-variant"
      @click="open"
    >
      <oc-icon name="add" fill-type="line" size="small" />
      <span v-text="$gettext('Add a card')" />
    </oc-button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, shallowRef, useTemplateRef } from 'vue'
import { useBoardActions } from '../../composables/useBoardActions'

const { columnId } = defineProps<{ columnId: string }>()

const { addCard } = useBoardActions()
const isOpen = shallowRef(false)
const title = shallowRef('')
const inputRef = useTemplateRef<{ $el: HTMLElement }>('inputRef')

async function open() {
  isOpen.value = true
  await nextTick()
  inputRef.value?.$el.querySelector('textarea')?.focus()
}

function close() {
  isOpen.value = false
  title.value = ''
}

function submit() {
  const value = title.value.trim()
  if (!value) {
    return
  }
  addCard(columnId, value)
  // stays open for the next card
  title.value = ''
}

defineExpose({ open })
</script>
