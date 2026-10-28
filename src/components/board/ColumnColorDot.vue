<template>
  <span
    class="kanban-color-dot ext:inline-block ext:size-3 ext:shrink-0 ext:rounded-full"
    :style="{ backgroundColor: `var(--oc-role-${color})` }"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import type { ColumnColor } from '../../model/schema'

defineProps<{ color: ColumnColor }>()
</script>
