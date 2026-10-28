<template>
  <div v-if="card" class="kanban-card-details kb:flex kb:flex-col kb:gap-4 kb:px-2 kb:pt-1">
    <div @focusout="title.blur">
      <oc-text-input
        id="kanban-card-title"
        :model-value="title.draft.value"
        :label="$gettext('Title')"
        :read-only="isReadOnly"
        @update:model-value="title.update"
        @keydown.enter="title.flush"
      />
    </div>

    <oc-select
      id="kanban-card-column"
      :model-value="column"
      :label="$gettext('Column')"
      :options="document.columns"
      option-label="title"
      :clearable="false"
      :disabled="isReadOnly"
      @update:model-value="moveToColumn"
    />

    <publish-date-field :card="card" />

    <oc-datepicker
      id="kanban-card-due"
      :label="$gettext('Due date')"
      :current-date="dueDate"
      :is-dark="isDark"
      :disabled="isReadOnly"
      @date-changed="setDueDate"
    />

    <assignee-field :card="card" />
    <tag-field :card="card" />

    <div @focusout="description.blur">
      <oc-textarea
        id="kanban-card-description"
        :model-value="description.draft.value"
        :label="$gettext('Description')"
        :readonly="isReadOnly"
        rows="6"
        @update:model-value="description.update"
      />
    </div>

    <link-list :card="card" />

    <dl
      class="kanban-card-history kb:m-0 kb:grid kb:grid-cols-[auto_1fr] kb:gap-x-3 kb:gap-y-1 kb:text-sm"
    >
      <template v-if="card.createdAt">
        <dt class="kb:text-role-on-surface-variant" v-text="$gettext('Created')" />
        <dd class="kb:m-0" v-text="history(card.createdAt, card.createdBy)" />
      </template>
      <template v-if="card.updatedAt">
        <dt class="kb:text-role-on-surface-variant" v-text="$gettext('Last change')" />
        <dd class="kb:m-0" v-text="history(card.updatedAt, card.updatedBy)" />
      </template>
    </dl>

    <div v-if="!isReadOnly" class="kb:border-t kb:border-role-outline-variant kb:pt-4">
      <oc-button
        appearance="outline"
        color-role="error"
        size="small"
        @click="actions.deleteCard(card)"
      >
        <oc-icon name="delete-bin" fill-type="line" size="small" />
        <span v-text="$gettext('Delete card')" />
      </oc-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import { DateTime } from 'luxon'
import { useThemeStore } from '@opencloud-eu/web-pkg'
import type { Column } from '../../model/schema'
import { useBoardContext } from '../../composables/useBoardContext'
import { useBoardActions } from '../../composables/useBoardActions'
import { useDraft } from '../../composables/useDraft'
import PublishDateField from './PublishDateField.vue'
import AssigneeField from './AssigneeField.vue'
import TagField from './TagField.vue'
import LinkList from './LinkList.vue'

const { cardId } = defineProps<{ cardId: string }>()

const { $gettext, current } = useGettext()
const themeStore = useThemeStore()
const board = useBoardContext()
const { document, isReadOnly, members } = board
const actions = useBoardActions()

const card = computed(() => unref(document).cards.find(({ id }) => id === cardId))
const column = computed(() =>
  unref(document).columns.find(({ id }) => id === unref(card)?.columnId)
)
const isDark = computed(() => themeStore.currentTheme?.isDark ?? false)
const dueDate = computed(() =>
  unref(card)?.dueDate ? DateTime.fromISO(unref(card)?.dueDate as string) : undefined
)

const title = useDraft(
  () => unref(card)?.title ?? '',
  (value) => board.change({ type: 'updateCard', cardId, patch: { title: value } })
)
const description = useDraft(
  () => unref(card)?.description ?? '',
  (value) => board.change({ type: 'updateCard', cardId, patch: { description: value } })
)

function moveToColumn(target: Column | null) {
  if (target && target.id !== unref(card)?.columnId) {
    actions.moveCard(cardId, target.id, actions.columnCards(target.id).length)
  }
}

function setDueDate({ date, error }: { date: DateTime | null; error: boolean }) {
  if (error) {
    return
  }
  const value = date ? (date.toISODate() as string) : null
  if (value !== unref(card)?.dueDate) {
    board.change({ type: 'updateCard', cardId, patch: { dueDate: value } })
  }
}

function history(at: string, by: string) {
  const date = DateTime.fromISO(at).setLocale(current)
  const when = date.isValid ? date.toLocaleString(DateTime.DATETIME_MED) : at
  const who = by ? (members.nameOf(by) ?? (by === unref(board.userId) ? $gettext('you') : '')) : ''
  return who ? $gettext('%{date} by %{name}', { date: when, name: who }) : when
}

onMounted(() => {
  void members.ensureLoaded()
})
</script>
