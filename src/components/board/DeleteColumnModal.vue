<template>
  <div class="kanban-delete-column">
    <p
      class="kb:mt-0"
      v-text="
        $ngettext(
          'This column contains %{count} card. What should happen to it?',
          'This column contains %{count} cards. What should happen to them?',
          cardCount,
          { count: String(cardCount) }
        )
      "
    />
    <fieldset class="kb:m-0 kb:flex kb:flex-col kb:gap-3 kb:border-0 kb:p-0">
      <legend class="kb:sr-only" v-text="$gettext('Cards of the column')" />
      <div v-if="otherColumns.length" class="kb:flex kb:flex-col kb:gap-2">
        <oc-radio
          id="kanban-delete-column-move"
          v-model="choice"
          option="move"
          :label="$gettext('Move them to another column')"
        />
        <oc-select
          v-if="choice === 'move'"
          id="kanban-delete-column-target"
          v-model="target"
          class="kb:ml-7"
          :label="$gettext('Column')"
          :options="otherColumns"
          option-label="title"
          :clearable="false"
          position-fixed
        />
      </div>
      <oc-radio
        id="kanban-delete-column-delete"
        v-model="choice"
        option="delete"
        :label="$ngettext('Delete the card as well', 'Delete the cards as well', cardCount)"
      />
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue'
import type { Modal } from '@opencloud-eu/web-pkg'
import type { Column } from '../../model/schema'

const { otherColumns, onDelete } = defineProps<{
  modal: Modal
  column: Column
  cardCount: number
  otherColumns: Column[]
  onDelete: (moveCardsTo: string | null) => void
}>()

const choice = shallowRef<'move' | 'delete'>(otherColumns.length ? 'move' : 'delete')
const target = shallowRef<Column | null>(otherColumns[0] ?? null)

function onConfirm() {
  onDelete(choice.value === 'move' && target.value ? target.value.id : null)
  return Promise.resolve()
}

defineExpose({ onConfirm })
</script>
