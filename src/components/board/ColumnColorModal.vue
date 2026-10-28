<template>
  <fieldset class="kanban-column-color kb:m-0 kb:border-0 kb:p-0">
    <legend class="kb:sr-only" v-text="$gettext('Color')" />
    <div class="kb:grid kb:grid-cols-1 kb:gap-1 kb:xs:grid-cols-2">
      <label
        v-for="option in options"
        :key="option.color"
        class="kb:flex kb:cursor-pointer kb:items-center kb:gap-3 kb:rounded-md kb:px-2 kb:py-1.5 kb:hover:bg-role-surface-container-highest"
        :class="{ 'kb:bg-role-secondary-container': selected === option.color }"
      >
        <input
          v-model="selected"
          type="radio"
          name="kanban-column-color"
          class="kb:sr-only kb:peer"
          :value="option.color"
        />
        <column-color-dot
          :color="option.color"
          class="kb:peer-focus-visible:outline-2 kb:peer-focus-visible:outline-role-outline kb:peer-focus-visible:outline-offset-2"
        />
        <span v-text="option.label" />
        <oc-icon v-if="selected === option.color" name="check" class="kb:ml-auto" />
      </label>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue'
import type { Modal } from '@opencloud-eu/web-pkg'
import { columnColor, type Column, type ColumnColor } from '../../model/schema'
import { useColumnColors } from '../../composables/useColumnColors'
import ColumnColorDot from './ColumnColorDot.vue'

const { column, onSelect } = defineProps<{
  modal: Modal
  column: Column
  onSelect: (color: ColumnColor) => void
}>()

const options = useColumnColors()
const selected = shallowRef<ColumnColor>(columnColor(column))

function onConfirm() {
  onSelect(selected.value)
  return Promise.resolve()
}

defineExpose({ onConfirm })
</script>
