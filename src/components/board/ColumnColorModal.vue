<template>
  <fieldset class="kanban-column-color ext:m-0 ext:border-0 ext:p-0">
    <legend class="ext:sr-only" v-text="$gettext('Color')" />
    <div class="ext:grid ext:grid-cols-1 ext:gap-1 ext:xs:grid-cols-2">
      <label
        v-for="option in options"
        :key="option.color"
        class="ext:flex ext:cursor-pointer ext:items-center ext:gap-3 ext:rounded-md ext:px-2 ext:py-1.5 ext:hover:bg-role-surface-container-highest"
        :class="{ 'ext:bg-role-secondary-container': selected === option.color }"
      >
        <input
          v-model="selected"
          type="radio"
          name="kanban-column-color"
          class="ext:sr-only ext:peer"
          :value="option.color"
        />
        <column-color-dot
          :color="option.color"
          class="ext:peer-focus-visible:outline-2 ext:peer-focus-visible:outline-role-outline ext:peer-focus-visible:outline-offset-2"
        />
        <span v-text="option.label" />
        <oc-icon v-if="selected === option.color" name="check" class="ext:ml-auto" />
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
