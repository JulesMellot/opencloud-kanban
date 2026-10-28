<template>
  <div />
</template>

<script setup lang="ts">
import type { CalendarRange } from '../../composables/useViewPreferences'

defineModel<CalendarRange>('range', { required: true })
</script>
