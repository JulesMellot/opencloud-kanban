<template>
  <span
    class="kanban-color-dot kb:inline-block kb:size-3 kb:shrink-0 kb:rounded-full"
    :style="{ backgroundColor: `var(--oc-role-${color})` }"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import type { ColumnColor } from '../../model/schema'

defineProps<{ color: ColumnColor }>()
</script>
