<template>
  <span class="kanban-menu ext:inline-flex" data-no-drag>
    <oc-button
      :id="toggleId"
      v-oc-tooltip="label"
      :aria-label="label"
      appearance="raw"
      class="kanban-menu-toggle ext:p-1"
      @click.stop
    >
      <oc-icon name="more-2" />
    </oc-button>
    <oc-drop
      :drop-id="`${toggleId}-drop`"
      mode="click"
      padding-size="small"
      :toggle="`#${toggleId}`"
      :title="title"
      close-on-click
      is-menu
      @click.stop
    >
      <context-action-menu :menu-sections="sections" :action-options="actionOptions" />
    </oc-drop>
  </span>
</template>

<script setup lang="ts">
import { computed, unref, useId } from 'vue'
import { ContextActionMenu, type MenuSection } from '@opencloud-eu/web-pkg'
import { useBoardContext } from '../composables/useBoardContext'

const { sections } = defineProps<{
  label: string
  title: string
  sections: MenuSection[]
}>()

const toggleId = `kanban-menu-${useId()}`
const { space } = useBoardContext()
const actionOptions = computed(() => ({ space: unref(space), resources: [] }))
</script>
