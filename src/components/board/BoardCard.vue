<template>
  <li
    :id="`kanban-card-${card.id}`"
    :data-card-id="card.id"
    class="kanban-card ext:relative ext:list-none ext:rounded-md ext:outline ext:select-none ext:[-webkit-touch-callout:none]"
    :class="[
      isOpen
        ? 'kanban-card-open ext:bg-role-secondary-container ext:outline-2 ext:outline-role-outline'
        : 'ext:bg-role-surface-container ext:outline-role-surface-container-highest ext:hover:bg-role-surface-container-highest',
      { 'ext:opacity-40': isDragged, 'ext:cursor-grab': !isReadOnly }
    ]"
    @pointerdown="$emit('dragStart', $event)"
  >
    <div class="ext:flex ext:items-start ext:gap-1 ext:p-2">
      <div class="ext:flex ext:min-w-0 ext:flex-1 ext:flex-col ext:gap-1.5">
        <ul
          v-if="card.tags.length"
          class="ext:m-0 ext:flex ext:list-none ext:flex-wrap ext:gap-1 ext:p-0"
          :aria-label="$gettext('Tags')"
        >
          <li v-for="tag in card.tags" :key="tag">
            <oc-tag size="small" class="kanban-card-tag" v-text="tag" />
          </li>
        </ul>
        <button
          type="button"
          class="kanban-card-title ext:cursor-[inherit] ext:border-0 ext:bg-transparent ext:p-0 ext:text-left ext:text-role-on-surface ext:break-words ext:after:absolute ext:after:inset-0 ext:after:rounded-md ext:after:content-[''] ext:focus-visible:outline-none ext:focus-visible:after:outline-2 ext:focus-visible:after:outline-offset-2 ext:focus-visible:after:outline-role-outline"
          :aria-label="$gettext('Open »%{title}«', { title: displayTitle })"
          @click="openCard(card.id)"
        >
          <span class="ext:line-clamp-4" v-text="displayTitle" />
        </button>
        <div
          v-if="hasMeta"
          class="ext:flex ext:flex-wrap ext:items-center ext:gap-x-3 ext:gap-y-1 ext:text-sm ext:text-role-on-surface-variant"
        >
          <span
            v-if="card.publishDate"
            class="kanban-card-publish ext:inline-flex ext:items-center ext:gap-1"
            :title="$gettext('Publication')"
          >
            <oc-icon name="calendar-event" fill-type="line" size="small" />
            <span class="ext:sr-only" v-text="$gettext('Publication:')" />
            <span v-text="publishLabel" />
          </span>
          <span
            v-if="card.links.length"
            class="kanban-card-links ext:inline-flex ext:items-center ext:gap-1"
            :title="linksLabel"
          >
            <oc-icon name="links" fill-type="line" size="small" />
            <span class="ext:sr-only" v-text="linksLabel" />
            <span aria-hidden="true" v-text="card.links.length" />
          </span>
          <card-avatars
            v-if="card.assignees.length"
            :assignees="card.assignees"
            class="ext:ml-auto"
          />
        </div>
      </div>
      <kanban-menu
        class="ext:relative ext:z-10 ext:-mr-1 ext:-mt-1"
        :label="$gettext('Actions for »%{title}«', { title: displayTitle })"
        :title="displayTitle"
        :sections="menuSections"
      />
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, unref } from 'vue'
import { useGettext } from 'vue3-gettext'
import type { Action, MenuSection } from '@opencloud-eu/web-pkg'
import { formatPublishDate } from '../../model/calendar'
import type { Card } from '../../model/schema'
import { useBoardContext } from '../../composables/useBoardContext'
import { useBoardActions } from '../../composables/useBoardActions'
import KanbanMenu from '../KanbanMenu.vue'
import CardAvatars from '../CardAvatars.vue'

const { card, isDragged = false } = defineProps<{
  card: Card
  isDragged?: boolean
}>()
defineEmits<{ dragStart: [event: PointerEvent] }>()

const { $gettext, $ngettext, current } = useGettext()
const { document, isReadOnly, openCardId, openCard } = useBoardContext()
const actions = useBoardActions()

const displayTitle = computed(() => card.title || $gettext('Untitled card'))
const isOpen = computed(() => unref(openCardId) === card.id)
const publishLabel = computed(() =>
  card.publishDate ? formatPublishDate(card.publishDate, current) : ''
)
const linksLabel = computed(() =>
  $ngettext('%{count} linked item', '%{count} linked items', card.links.length, {
    count: String(card.links.length)
  })
)
const hasMeta = computed(
  () => Boolean(card.publishDate) || card.links.length > 0 || card.assignees.length > 0
)

function action(
  name: string,
  icon: string,
  label: string,
  handler: () => void,
  isVisible = () => true
): Action {
  return { name, icon, label: () => label, handler, isVisible }
}

const menuSections = computed<MenuSection[]>(() => {
  const open = action('kanban-open-card', 'eye', $gettext('Open'), () => openCard(card.id))
  if (unref(isReadOnly)) {
    return [{ name: 'primary', items: [open] }]
  }
  const siblings = actions.columnCards(card.columnId)
  const index = siblings.findIndex(({ id }) => id === card.id)
  const moveTo: Action = {
    name: 'kanban-move-card',
    icon: 'arrow-right',
    label: () => $gettext('Move to…'),
    isVisible: () => unref(document).columns.length > 1,
    children: unref(document)
      .columns.filter(({ id }) => id !== card.columnId)
      .map((column) =>
        action(`kanban-move-card-${column.id}`, 'arrow-right', column.title, () =>
          actions.moveCard(card.id, column.id, actions.columnCards(column.id).length)
        )
      )
  }
  return [
    { name: 'primary', items: [open] },
    {
      name: 'secondary',
      items: [
        moveTo,
        action(
          'kanban-move-card-up',
          'arrow-up',
          $gettext('Move up'),
          () => actions.shiftCard(card, -1),
          () => index > 0
        ),
        action(
          'kanban-move-card-down',
          'arrow-down',
          $gettext('Move down'),
          () => actions.shiftCard(card, 1),
          () => index > -1 && index < siblings.length - 1
        )
      ].filter((item) => item.isVisible())
    },
    {
      name: 'tertiary',
      items: [
        action('kanban-delete-card', 'delete-bin', $gettext('Delete'), () =>
          actions.deleteCard(card)
        )
      ]
    }
  ]
})
</script>
