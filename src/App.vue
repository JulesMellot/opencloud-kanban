<template>
  <div class="ext:size-full ext:p-4 ext:text-role-on-surface">{{ resource?.name }}</div>
</template>

<script setup lang="ts">
import type { Resource, SpaceResource } from '@opencloud-eu/web-client'

defineProps<{
  space: SpaceResource
  resource: Resource
  currentContent: string
  isReadOnly: boolean
}>()
</script>
