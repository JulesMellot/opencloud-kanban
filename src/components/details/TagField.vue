<template>
  <div class="kanban-tags ext:flex ext:flex-col ext:gap-2">
    <span :id="labelId" class="ext:font-semibold ext:text-sm" v-text="$gettext('Tags')" />
    <ul
      v-if="card.tags.length"
      class="ext:m-0 ext:flex ext:list-none ext:flex-wrap ext:gap-1 ext:p-0"
      :aria-labelledby="labelId"
    >
      <li v-for="tag in card.tags" :key="tag">
        <oc-tag size="small" class="ext:gap-1">
          <span v-text="tag" />
          <oc-button
            v-if="!isReadOnly"
            appearance="raw"
            class="ext:-mr-1 ext:p-0"
            :aria-label="$gettext('Remove the tag %{tag}', { tag })"
            @click="remove(tag)"
          >
            <oc-icon name="close" fill-type="line" size="xsmall" />
          </oc-button>
        </oc-tag>
      </li>
    </ul>
    <p
      v-else-if="isReadOnly"
      class="ext:m-0 ext:text-sm ext:text-role-on-surface-variant"
      v-text="$gettext('No tags')"
    />
    <oc-select
      v-if="!isReadOnly"
      id="kanban-card-add-tag"
      :model-value="null"
      :label="$gettext('Add a tag')"
      label-hidden
      :placeholder="$gettext('Add a tag')"
      :options="options"
      taggable
      position-fixed
      :create-option="(value: string) => value"
      @update:model-value="add"
    >
      <template #no-options>
        <span v-text="$gettext('Type a new tag and press Enter')" />
      </template>
    </oc-select>
  </div>
</template>

<script setup lang="ts">
import { computed, unref, useId } from 'vue'
import { allTags } from '../../model/filters'
import type { Card } from '../../model/schema'
import { useBoardContext } from '../../composables/useBoardContext'

const { card } = defineProps<{ card: Card }>()

const board = useBoardContext()
const { document, isReadOnly } = board
const labelId = `kanban-tags-${useId()}`

const options = computed(() =>
  allTags(unref(document).cards).filter((tag) => !card.tags.includes(tag))
)

function add(tag: string | null) {
  const value = tag?.trim()
  if (value) {
    board.change({ type: 'addTag', cardId: card.id, tag: value })
  }
}

function remove(tag: string) {
  board.change({ type: 'removeTag', cardId: card.id, tag })
}
</script>
